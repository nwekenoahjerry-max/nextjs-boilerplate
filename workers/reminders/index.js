const encoder = new TextEncoder();

function decodeBase64Url(value) {
  const normal = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normal + "=".repeat((4 - normal.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function encodeBase64Url(value) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function concatBytes(...parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
async function hmac(keyBytes, data) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}
async function hkdfExtract(salt, inputKeyMaterial) {
  return hmac(salt, inputKeyMaterial);
}
async function hkdfExpand(prk, info, length) {
  const blocks = [];
  let previous = new Uint8Array(0);
  let outputLength = 0;
  for (let counter = 1; outputLength < length; counter++) {
    previous = await hmac(prk, concatBytes(previous, info, Uint8Array.of(counter)));
    blocks.push(previous);
    outputLength += previous.length;
  }
  return concatBytes(...blocks).slice(0, length);
}
async function createVapidToken(endpoint, env) {
  const publicBytes = decodeBase64Url(env.VAPID_PUBLIC_KEY);
  const jwk = {
    kty: "EC", crv: "P-256",
    x: encodeBase64Url(publicBytes.slice(1, 33)),
    y: encodeBase64Url(publicBytes.slice(33, 65)),
    d: env.VAPID_PRIVATE_KEY,
    ext: true, key_ops: ["sign"]
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const origin = new URL(endpoint).origin;
  const header = encodeBase64Url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = encodeBase64Url(encoder.encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || "mailto:accounts@mail.clerkme.com.ng"
  })));
  const signingInput = header + "." + claims;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)
  ));
  return signingInput + "." + encodeBase64Url(signature);
}
async function encryptPayload(subscription, payload) {
  const receiverPublic = decodeBase64Url(subscription.p256dh);
  const authSecret = decodeBase64Url(subscription.auth);
  const receiverKey = await crypto.subtle.importKey("raw", receiverPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, ephemeral.privateKey, 256));

  const authPrk = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = concatBytes(encoder.encode("WebPush: info\0"), receiverPublic, serverPublic);
  const inputKeyMaterial = await hkdfExpand(authPrk, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentPrk = await hkdfExtract(salt, inputKeyMaterial);
  const contentKey = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(contentPrk, encoder.encode("Content-Encoding: nonce\0"), 12);
  const plaintext = concatBytes(encoder.encode(JSON.stringify(payload)), Uint8Array.of(2));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, plaintext));

  const header = new Uint8Array(16 + 4 + 1 + serverPublic.length);
  header.set(salt, 0);
  header.set(Uint8Array.of(0, 0, 16, 0), 16); // record size: 4096 bytes
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concatBytes(header, ciphertext);
}
async function sendPush(subscription, payload, env) {
  const body = await encryptPayload(subscription, payload);
  const token = await createVapidToken(subscription.endpoint, env);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Authorization": "vapid t=" + token + ", k=" + env.VAPID_PUBLIC_KEY,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
      "Urgency": "normal"
    },
    body
  });
  return response.status;
}


async function sendPushReminders(env) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return { skipped: true, reason: "VAPID keys not configured" };
  const users = await env.DB.prepare(
    "SELECT p.id, p.full_name, p.last_seen_at FROM student_profiles p " +
    "WHERE p.last_seen_at IS NOT NULL AND p.last_seen_at <= unixepoch() - 172800 " +
    "AND (p.push_reminder_sent_at IS NULL OR p.push_reminder_sent_at < p.last_seen_at) " +
    "AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = p.id) " +
    "ORDER BY p.last_seen_at ASC LIMIT 100"
  ).all();
  let usersSent = 0;
  let endpointsRemoved = 0;
  for (const user of users.results || []) {
    const latest = await env.DB.prepare("SELECT last_seen_at FROM student_profiles WHERE id = ?").bind(user.id).first();
    if (!latest || latest.last_seen_at !== user.last_seen_at) continue;
    const subscriptions = await env.DB.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").bind(user.id).all();
    let delivered = false;
    for (const subscription of subscriptions.results || []) {
      try {
        const status = await sendPush(subscription, {
          title: "We've missed you at ClerkMe 💙",
          body: "Your study corner is right here. Come back for one little win — no pressure.",
          url: "/",
          tag: "clerkme-reengagement-" + user.id
        }, env);
        if (status === 201 || status === 202) {
          delivered = true;
          await env.DB.prepare("UPDATE push_subscriptions SET last_success_at = unixepoch() WHERE id = ?").bind(subscription.id).run();
        } else if (status === 404 || status === 410) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(subscription.id).run();
          endpointsRemoved++;
        } else {
          console.error("[clerkme-reminders] Push service returned status", status);
        }
      } catch (error) {
        console.error("[clerkme-reminders] Push delivery failed.", error instanceof Error ? error.message : "unknown error");
      }
    }
    if (delivered) {
      await env.DB.prepare("UPDATE student_profiles SET push_reminder_sent_at = unixepoch() WHERE id = ? AND last_seen_at = ?").bind(user.id, user.last_seen_at).run();
      usersSent++;
    }
  }
  return { usersChecked: users.results?.length || 0, usersSent, endpointsRemoved };
}

export default {
  async scheduled(_controller, env, _ctx) {
    if (env.CRON_TOKEN) {
      try {
        const response = await fetch((env.APP_ORIGIN || "https://clerkme.com.ng") + "/api/internal/reminders/email", {
          method: "POST",
          headers: { "Authorization": "Bearer " + env.CRON_TOKEN, "Accept": "application/json" }
        });
        if (!response.ok) console.error("[clerkme-reminders] Email batch failed with status", response.status);
        else console.log("[clerkme-reminders] Email batch:", await response.text());
      } catch (error) {
        console.error("[clerkme-reminders] Email batch request failed.", error instanceof Error ? error.message : "unknown error");
      }
    } else {
      console.error("[clerkme-reminders] Email reminders are paused until CRON_TOKEN is configured.");
    }
    const pushResult = await sendPushReminders(env);
    console.log("[clerkme-reminders] Push batch:", JSON.stringify(pushResult));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true, service: "clerkme-reminders" });

    // Internal service-binding endpoint for private chat notifications.
    // It is protected by a dedicated service-to-service secret, separate from
    // the scheduled email-reminder CRON_TOKEN.
    if (url.pathname === "/internal/direct-message" && request.method === "POST") {
      if (!env.PUSH_INTERNAL_TOKEN || request.headers.get("Authorization") !== "Bearer " + env.PUSH_INTERNAL_TOKEN) {
        return new Response("Unauthorized", { status: 401 });
      }
      let input;
      try { input = await request.json(); }
      catch { return Response.json({ error: "Invalid notification payload." }, { status: 400 }); }
      const userId = typeof input?.userId === "string" ? input.userId.slice(0, 100) : "";
      const title = typeof input?.title === "string" ? input.title.slice(0, 100) : "New ClerkMe message";
      const body = typeof input?.body === "string" ? input.body.slice(0, 160) : "You have a new private message.";
      const requestedUrl = typeof input?.url === "string" ? input.url : "/";
      const destination = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/";
      const tag = typeof input?.tag === "string" ? input.tag.slice(0, 120) : "clerkme-direct-message";
      if (!userId) return Response.json({ error: "A recipient is required." }, { status: 400 });
      if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
        return Response.json({ skipped: true, reason: "Web Push is not configured." }, { status: 503 });
      }

      const subscriptions = await env.DB.prepare(
        "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?"
      ).bind(userId).all();
      let sent = 0;
      let removed = 0;
      let failed = 0;
      for (const subscription of subscriptions.results || []) {
        try {
          const status = await sendPush(subscription, {
            title, body, url: destination, tag
          }, env);
          if (status === 201 || status === 202) {
            sent++;
            await env.DB.prepare(
              "UPDATE push_subscriptions SET last_success_at = unixepoch() WHERE id = ?"
            ).bind(subscription.id).run();
          } else if (status === 404 || status === 410) {
            removed++;
            await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(subscription.id).run();
          } else {
            failed++;
            console.error("[clerkme-reminders] Direct-message push endpoint returned status", status);
          }
        } catch (error) {
          failed++;
          console.error("[clerkme-reminders] Direct-message push failed.", error instanceof Error ? error.message : "unknown error");
        }
      }
      return Response.json({ sent, removed, failed, subscriptions: subscriptions.results?.length || 0 });
    }

    return new Response("Not found", { status: 404 });
  }
};
