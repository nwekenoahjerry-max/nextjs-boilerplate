// ClerkMD API — Cloudflare Pages Function + D1. Needs secret PAYSTACK_SECRET.
const PLANS = { monthly: { kobo: 200000, days: 31 }, annual: { kobo: 1500000, days: 366 } }; // ₦2,000 / ₦15,000 — edit freely
const enc = new TextEncoder();
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', ...h } });
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rnd = () => hex(crypto.getRandomValues(new Uint8Array(24)));
const day = () => new Date().toISOString().slice(0, 10);
async function verifyGoogleToken(token, clientId) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some(x => !x)) return null;
    const decode = x => {
      let b = x.replace(/-/g, '+').replace(/_/g, '/');
      b += '='.repeat((4 - b.length % 4) % 4);
      return Uint8Array.from(atob(b), c => c.charCodeAt(0));
    };
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (header.alg !== 'RS256' || !header.kid) return null;
    const keyResponse = await fetch('https://www.googleapis.com/oauth2/v3/certs');
    if (!keyResponse.ok) return null;
    const keySet = await keyResponse.json();
    const jwk = (keySet.keys || []).find(k => k.kid === header.kid && k.kty === 'RSA' && k.use === 'sig');
    if (!jwk) return null;
    const publicKey = await crypto.subtle.importKey('jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decode(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
    const now = Math.floor(Date.now() / 1000);
    const audienceOk = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
    if (!valid || !audienceOk || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss)
      || !claims.sub || !claims.email || !(claims.email_verified === true || claims.email_verified === 'true')
      || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= now
      || (claims.nbf && Number(claims.nbf) > now)) return null;
    return claims;
  } catch { return null; }
}
async function hash(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, school: u.school, level: u.level, xp: u.xp, streak: u.streak,
  settings: JSON.parse(u.settings || '{}'), plan: u.plan === 'pro' && u.pro_until > Date.now() ? 'pro' : 'free', pro_until: u.pro_until });
async function getUser(req, db) {
  const sid = (req.headers.get('cookie') || '').match(/sid=([a-f0-9]+)/)?.[1];
  if (!sid) return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.uid WHERE s.id=? AND s.exp>?').bind(sid, Date.now()).first();
}
async function startSession(db, uid, user) {
  const sid = rnd();
  await db.prepare('INSERT INTO sessions VALUES(?,?,?)').bind(sid, uid, Date.now() + 30 * 864e5).run();
  return J({ user: publicUser(user) }, 200, { 'set-cookie': `sid=${sid}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=2592000` });
}
export async function onRequest({ request, env, params }) {
  const db = env.DB, route = (params.path || []).join('/');
  const raw = request.method === 'POST' ? await request.text() : ''; let body = {}; try { body = JSON.parse(raw); } catch {}
  if (route === 'config') return J({ googleClientId: env.GOOGLE_CLIENT_ID || '' });
  if (route === 'google') {
    if (!env.GOOGLE_CLIENT_ID) return J({ error: 'Google sign-in is not configured on this deployment.' }, 503);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return J({ error: 'Google sign-in request rejected.' }, 403);
    const claims = await verifyGoogleToken(body.credential, env.GOOGLE_CLIENT_ID);
    if (!claims) return J({ error: 'Google could not verify this sign-in. Please try again.' }, 401);
    const email = String(claims.email).trim().toLowerCase();
    let user = await db.prepare('SELECT u.* FROM google_accounts g JOIN users u ON u.id=g.uid WHERE g.sub=?').bind(claims.sub).first();
    if (user) return startSession(db, user.id, user);
    user = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if (user) {
      const trustedEmail = email.endsWith('@gmail.com') || Boolean(claims.hd);
      if (!trustedEmail) return J({ error: 'This email already has an account. Sign in with your password first.' }, 409);
      const linked = await db.prepare('SELECT sub FROM google_accounts WHERE uid=?').bind(user.id).first();
      if (linked && linked.sub !== claims.sub) return J({ error: 'This account is already linked to another Google account.' }, 409);
      if (!linked) await db.prepare('INSERT INTO google_accounts(sub,uid,created) VALUES(?,?,?)').bind(claims.sub, user.id, Date.now()).run();
      return startSession(db, user.id, user);
    }
    const salt = rnd(), randomPassword = rnd() + rnd();
    try {
      const created = await db.prepare('INSERT INTO users(email,name,school,level,pw,salt,created) VALUES(?,?,?,?,?,?,?)')
        .bind(email, String(claims.name || '').slice(0, 80), '', '', await hash(randomPassword, salt), salt, Date.now()).run();
      user = await db.prepare('SELECT * FROM users WHERE id=?').bind(created.meta.last_row_id).first();
    } catch {
      user = await db.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
      if (!user) return J({ error: 'Could not create your ClerkMD account. Please try again.' }, 500);
    }
    try {
      await db.prepare('INSERT INTO google_accounts(sub,uid,created) VALUES(?,?,?)').bind(claims.sub, user.id, Date.now()).run();
    } catch {
      const mapped = await db.prepare('SELECT u.* FROM google_accounts g JOIN users u ON u.id=g.uid WHERE g.sub=?').bind(claims.sub).first();
      if (mapped) user = mapped;
      else return J({ error: 'This Google account is already linked elsewhere. Please contact support.' }, 409);
    }
    return startSession(db, user.id, user);
  }
  if (route === 'signup') {
    const { email, password, name, school, level } = body;
    if (!/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8) return J({ error: 'Valid email and 8+ character password required' }, 400);
    const salt = rnd(), e = email.toLowerCase();
    try {
      const r = await db.prepare('INSERT INTO users(email,name,school,level,pw,salt,created) VALUES(?,?,?,?,?,?,?)')
        .bind(e, name || '', school || '', level || '', await hash(password, salt), salt, Date.now()).run();
      return startSession(db, r.meta.last_row_id, await db.prepare('SELECT * FROM users WHERE id=?').bind(r.meta.last_row_id).first());
    } catch { return J({ error: 'Email already registered' }, 409); }
  }
  if (route === 'login') {
    const u = await db.prepare('SELECT * FROM users WHERE email=?').bind((body.email || '').toLowerCase()).first();
    if (!u || u.pw !== await hash(body.password || '', u.salt)) return J({ error: 'Wrong email or password' }, 401);
    return startSession(db, u.id, u);
  }
  if (route === 'pay/webhook') {
    const key = await crypto.subtle.importKey('raw', enc.encode(env.PAYSTACK_SECRET), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
    if (hex(await crypto.subtle.sign('HMAC', key, enc.encode(raw))) !== request.headers.get('x-paystack-signature')) return J({ error: 'bad signature' }, 401);
    if (body.event === 'charge.success') {
      const pay = await db.prepare('SELECT * FROM payments WHERE ref=?').bind(body.data.reference).first();
      if (pay && pay.status !== 'success' && body.data.amount === pay.amount) {
        const usr = await db.prepare('SELECT * FROM users WHERE id=?').bind(pay.uid).first();
        const until = Math.max(Date.now(), usr.pro_until || 0) + PLANS[pay.plan].days * 864e5;
        await db.batch([db.prepare("UPDATE payments SET status='success' WHERE ref=?").bind(pay.ref), db.prepare("UPDATE users SET plan='pro', pro_until=? WHERE id=?").bind(until, pay.uid)]);
      }
    }
    return J({ ok: 1 });
  }
  if (route === 'reset/request') {
    const e = String(body.email || '').trim().toLowerCase();
    if (!/^\\S+@\\S+\\.\\S+$/.test(e)) return J({ error: 'Enter a valid email address.' }, 400);
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
      return J({ error: 'Password reset email is not configured. Add RESEND_API_KEY and a verified MAIL_FROM sender in Cloudflare Pages.' }, 503);
    }
    const usr = await db.prepare('SELECT id FROM users WHERE email=?').bind(e).first();
    if (!usr) return J({ ok: 1 });
    const t = rnd(), tokenHash = await hash(t, 'rs');
    await db.prepare('DELETE FROM resets WHERE uid=?').bind(usr.id).run();
    await db.prepare('INSERT INTO resets VALUES(?,?,?)').bind(tokenHash, usr.id, Date.now() + 36e5).run();
    const resetUrl = new URL('/?reset=' + encodeURIComponent(t), new URL(request.url).origin).toString();
    const mail = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: e,
        subject: 'Reset your ClerkMD password',
        html: '<p>We received a request to reset your ClerkMD password.</p><p><a href="' + resetUrl + '">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>'
      })
    });
    if (!mail.ok) {
      await db.prepare('DELETE FROM resets WHERE uid=?').bind(usr.id).run();
      return J({ error: 'The reset email could not be sent. Check that your Resend sender domain is verified and MAIL_FROM matches it.' }, 502);
    }
    return J({ ok: 1 });
  }
  if (route === 'reset/confirm') {
    const r = await db.prepare('SELECT * FROM resets WHERE tok=? AND exp>?').bind(await hash(body.token || '', 'rs'), Date.now()).first();
    if (!r || (body.password || '').length < 8) return J({ error: 'Link expired or password too short' }, 400);
    const salt = rnd();
    await db.batch([db.prepare('UPDATE users SET pw=?,salt=? WHERE id=?').bind(await hash(body.password, salt), salt, r.uid),
      db.prepare('DELETE FROM resets WHERE uid=?').bind(r.uid), db.prepare('DELETE FROM sessions WHERE uid=?').bind(r.uid)]);
    return J({ ok: 1 });
  }
  const u = await getUser(request, db);
  if (!u) return J({ error: 'Not signed in' }, 401);
  const pro = publicUser(u).plan === 'pro';
  if (route === 'me') return J({ user: publicUser(u) });
  if (route === 'logout') {
    await db.prepare('DELETE FROM sessions WHERE uid=?').bind(u.id).run();
    return J({ ok: 1 }, 200, { 'set-cookie': 'sid=; Path=/; Max-Age=0' });
  }
  if (route === 'progress') {
    const { unit, caseId, score } = body, s = Math.max(0, Math.min(100, score | 0));
    if (!pro && unit !== 'game') { const n = await db.prepare("SELECT COUNT(*) c FROM attempts WHERE uid=? AND unit!='game' AND at>?").bind(u.id, Date.now() - 864e5).first(); if (n.c >= 1) return J({ error: 'Free plan: 1 simulation a day. Go Pro for unlimited.' }, 403); }
    const today = day(), yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    const streak = u.last_day === today ? u.streak : u.last_day === yest ? u.streak + 1 : 1;
    await db.batch([
      db.prepare('INSERT INTO attempts(uid,unit,case_id,score,at) VALUES(?,?,?,?,?)').bind(u.id, unit, caseId, s, Date.now()),
      db.prepare('UPDATE users SET xp=xp+?, streak=?, last_day=? WHERE id=?').bind(s, streak, today, u.id)]);
    return J({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first()) });
  }
  if (route === 'settings') {
    const st = JSON.stringify({ goal: [1, 2, 3, 5].includes(body.goal) ? body.goal : 1, theme: ['auto', 'light', 'dark'].includes(body.theme) ? body.theme : 'auto' });
    await db.prepare('UPDATE users SET name=?,school=?,level=?,settings=? WHERE id=?').bind(String(body.name || '').slice(0, 80), String(body.school || '').slice(0, 80), String(body.level || '').slice(0, 10), st, u.id).run();
    return J({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first()) });
  }
  if (route === 'quiz') {
    if (!pro) return J({ error: 'Pro required' }, 403);
    if (!env.ANTHROPIC_API_KEY) return J({ error: 'Quiz AI is not configured yet' }, 503);
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.QUIZ_MODEL || 'claude-sonnet-5-5', max_tokens: 3000,
        system: 'You write medical MCQs for Nigerian clinical students strictly from the provided slide text. Reply with ONLY a JSON array of 10 objects {"q":string,"o":[4 strings],"a":index of the correct option}. No markdown.',
        messages: [{ role: 'user', content: String(body.text || '').slice(0, 12000) }] }) }).then(r => r.json()).catch(() => ({}));
    try {
      const qs = JSON.parse((r.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '')).filter(x => x.q && x.o?.length === 4 && x.a >= 0 && x.a < 4);
      if (qs.length) return J({ questions: qs });
    } catch {}
    return J({ error: 'Could not make questions from that file' }, 502);
  }
  if (route === 'history') {
    const r = await db.prepare('SELECT unit,case_id,score,at FROM attempts WHERE uid=? ORDER BY at DESC LIMIT 30').bind(u.id).all();
    return J({ attempts: r.results });
  }
  if (route === 'pay/init') {
    const p = PLANS[body.plan]; if (!p) return J({ error: 'Unknown plan' }, 400);
    const ref = 'CMD' + rnd().slice(0, 16);
    await db.prepare('INSERT INTO payments VALUES(?,?,?,?,?,?)').bind(ref, u.id, p.kobo, body.plan, 'pending', Date.now()).run();
    const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST',
      headers: { authorization: 'Bearer ' + env.PAYSTACK_SECRET, 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, amount: p.kobo, reference: ref, callback_url: new URL(request.url).origin + '/?ref=' + ref }) }).then(r => r.json());
    return r.status ? J({ url: r.data.authorization_url }) : J({ error: r.message || 'Paystack error' }, 502);
  }
  if (route === 'pay/verify') {
    const pay = await db.prepare('SELECT * FROM payments WHERE ref=? AND uid=?').bind(body.ref, u.id).first();
    if (!pay) return J({ error: 'Unknown reference' }, 404);
    if (pay.status === 'success') return J({ user: publicUser(u) });
    const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(pay.ref), { headers: { authorization: 'Bearer ' + env.PAYSTACK_SECRET } }).then(r => r.json());
    if (r.data?.status !== 'success' || r.data.amount !== pay.amount) return J({ error: 'Payment not confirmed yet' }, 402);
    const until = Math.max(Date.now(), u.pro_until || 0) + PLANS[pay.plan].days * 864e5;
    await db.batch([db.prepare("UPDATE payments SET status='success' WHERE ref=?").bind(pay.ref),
      db.prepare("UPDATE users SET plan='pro', pro_until=? WHERE id=?").bind(until, u.id)]);
    return J({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id=?').bind(u.id).first()) });
  }
  return J({ error: 'Not found' }, 404);
}
