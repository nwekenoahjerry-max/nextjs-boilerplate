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


async function sendEmailReminders(env) {
  if (!env.RESEND_API_KEY) {
    console.error("[clerkme-reminders] RESEND_API_KEY is not configured.");
    return { skipped: true, reason: "RESEND_API_KEY missing" };
  }
  const users = await env.DB.prepare(
    "SELECT id, email, full_name, last_seen_at FROM student_profiles " +
    "WHERE email_verified_at IS NOT NULL AND email_reminders_enabled = 1 " +
    "AND last_seen_at IS NOT NULL AND last_seen_at <= unixepoch() - 172800 " +
    "AND (email_reminder_sent_at IS NULL OR email_reminder_sent_at < last_seen_at) " +
    "ORDER BY last_seen_at ASC LIMIT 100"
  ).all();
  let sent = 0, failed = 0;
  for (const user of users.results || []) {
    try {
      const current = await env.DB.prepare(
        "SELECT last_seen_at, email_reminders_enabled FROM student_profiles WHERE id = ?"
      ).bind(user.id).first();
      if (!current || current.last_seen_at !== user.last_seen_at || current.email_reminders_enabled !== 1) continue;
      const firstName = (user.full_name || "there").trim().split(/\s+/)[0].slice(0, 50) || "there";
      const safeName = firstName.replace(/[&<>"]/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[character] || character);
      const actionUrl = "https://clerkme.com.ng/";
      const html =
        '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#193354">' +
        '<div style="display:none;max-height:0;overflow:hidden;opacity:0">A little note from your ClerkMe study companion. We have missed you.</div>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3f6fb"><tr><td align="center" style="padding:34px 14px">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e0e8f2;border-radius:20px;overflow:hidden">' +
        '<tr><td style="padding:25px 30px;background:#102d5a;color:#fff;font-size:24px;font-weight:800">ClerkMe <span style="color:#a9c9f4">♥</span><div style="padding-top:5px;font-size:10px;letter-spacing:1.4px;color:#dbe7f7">YOUR CLINICAL LEARNING COMPANION</div></td></tr>' +
        '<tr><td style="padding:38px 34px 30px"><p style="margin:0 0 12px;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#6380a3">JUST A LITTLE NOTE FROM US</p>' +
        '<h1 style="margin:0 0 17px;font-size:28px;line-height:1.25;color:#102d5a">We have missed you, ' + safeName + '. 💙</h1>' +
        '<p style="margin:0 0 17px;font-size:15px;line-height:1.8;color:#4d617b">It has been a little quieter around your ClerkMe corner, and we wanted to send a small hello. Your study space has been right here, keeping your place warm for you.</p>' +
        '<div style="margin:23px 0;padding:18px 19px;border:1px solid #dce8f8;border-radius:13px;background:#f5f8ff"><p style="margin:0 0 7px;font-size:14px;line-height:1.7;font-weight:700;color:#183b69">Your next little win is waiting. ✨</p><p style="margin:0;font-size:13px;line-height:1.75;color:#536a86">A quick revision, one clinical case, or just ten quiet minutes with a topic. You do not have to catch up on everything today. Start wherever you are.</p></div>' +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 22px"><tr><td align="center" bgcolor="#174b91" style="border-radius:10px"><a href="' + actionUrl + '" style="display:inline-block;padding:15px 25px;border-radius:10px;background:#174b91;color:#fff;text-decoration:none;font-size:14px;font-weight:750">Come back to ClerkMe →</a></td></tr></table>' +
        '<p style="margin:0 0 5px;font-size:13px;line-height:1.75;color:#536a86">No pressure, no guilt. We are simply happy whenever you come by.</p><p style="margin:22px 0 0;font-size:14px;line-height:1.75;color:#29496e">With a little warmth,<br><strong>Your ClerkMe study companion 💙</strong></p></td></tr>' +
        '<tr><td align="center" style="padding:20px 24px;background:#f8fafd;border-top:1px solid #edf1f6"><p style="margin:0;font-size:11px;line-height:1.8;color:#8491a3">ClerkMe · Your clinical learning workspace<br><a href="https://clerkme.com.ng" style="color:#2456a6;text-decoration:none">clerkme.com.ng</a><br>Manage email reminders in Account &amp; settings.</p></td></tr></table></td></tr></table></body></html>';
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "clerkme-reengagement-" + user.id + "-" + user.last_seen_at
        },
        body: JSON.stringify({
          from: "ClerkMe Accounts <accounts@mail.clerkme.com.ng>",
          to: [user.email],
          subject: "A little note: ClerkMe has missed you 💙",
          html
        })
      });
      if (!response.ok) {
        failed++;
        console.error("[clerkme-reminders] Resend rejected a reminder.", response.status);
        continue;
      }
      await env.DB.prepare(
        "UPDATE student_profiles SET email_reminder_sent_at = unixepoch() WHERE id = ? AND last_seen_at = ? AND email_reminders_enabled = 1"
      ).bind(user.id, user.last_seen_at).run();
      sent++;
    } catch (error) {
      failed++;
      console.error("[clerkme-reminders] Email reminder failed.", error instanceof Error ? error.message : "unknown error");
    }
  }
  return { checked: users.results?.length || 0, sent, failed };
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
    const emailResult = await sendEmailReminders(env);
    console.log("[clerkme-reminders] Email batch:", JSON.stringify(emailResult));
    const pushResult = await sendPushReminders(env);
    console.log("[clerkme-reminders] Push batch:", JSON.stringify(pushResult));
  },
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/health") return Response.json({ ok: true, service: "clerkme-reminders" });
    return new Response("Not found", { status: 404 });
  }
};
