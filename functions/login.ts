type LoginEnv = { GOOGLE_CLIENT_ID?: string };

export const onRequestGet = async ({ env }: { env: LoginEnv }) => {
  const clientId = env.GOOGLE_CLIENT_ID || "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#102D5A">
<title>Sign in | ClerkMe</title>
<style>
:root{color-scheme:light;--navy:#102D5A;--navy-dark:#0B2348;--cloud:#F5F8FC;--line:#E2E8F0;--muted:#63738A}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#F5F8FC,#EAF0F8);color:var(--navy);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.card{width:min(100%,480px);background:#fff;border:1px solid var(--line);border-radius:22px;padding:38px;box-shadow:0 24px 70px rgba(16,45,90,.10)}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--navy);margin-bottom:44px}
.mark{width:44px;height:44px;border-radius:13px;display:block;object-fit:cover;flex:0 0 44px}
.brand strong{display:block;font-size:22px;letter-spacing:-.8px;color:var(--navy)}
.brand small{display:block;color:var(--muted);font-size:9px;letter-spacing:1.6px;margin-top:3px;font-weight:700}
.eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:800;color:var(--navy)}
h1{font-size:34px;line-height:1.13;letter-spacing:-1.4px;margin:12px 0;color:var(--navy)}
p{font-size:14px;line-height:1.7;color:var(--muted);margin:0 0 26px}
.google-wrap{min-height:48px;display:flex;align-items:center;justify-content:center;margin:26px 0 18px}
.error{color:#B42318;background:#FFF3F1;border:1px solid #F5D2CE;border-radius:9px;padding:11px;font-size:13px}
.status{color:var(--muted);font-size:12px;text-align:center}
.privacy{font-size:11px;color:#718198;line-height:1.6;border-top:1px solid var(--line);padding-top:18px;margin-top:24px}
.back{display:inline-block;color:var(--navy);text-decoration:none;font-weight:700;font-size:13px;margin-top:24px}
.back:hover{text-decoration:underline}
@media(max-width:520px){.card{padding:28px 22px;border-radius:18px}h1{font-size:30px}}
@media(prefers-reduced-motion:no-preference){.card{animation:enter .35s ease-out both}@keyframes enter{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}}
</style>
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
<main class="card">
<a class="brand" href="/"><img class="mark" src="/clerkme-mark.svg" alt=""><span><strong>ClerkMe</strong><small>CLINICAL COMPANION</small></span></a>
<div class="eyebrow">WELCOME TO CLERKME</div>
<h1>Sign in to your clinical workspace.</h1>
<p>Continue with your Google account to access your saved cases and learning progress.</p>
<div class="google-wrap" id="googleButton"></div>
<div id="message" class="status" role="status"></div>
<div class="privacy">Your account is used to protect access to your workspace. Do not enter identifiable patient information unless your institution and applicable privacy requirements authorise it.</div>
<a class="back" href="/">← Back to ClerkMe</a>
</main>
<script>
const CLIENT_ID = "__CLERKME_GOOGLE_CLIENT_ID__";
const message = document.getElementById("message");
function show(text, error=false){message.textContent=text;message.className=error?"error":"status";}
(async()=>{
 try {
  const me=await fetch("/api/auth/me",{credentials:"same-origin"});
  if(me.ok){location.replace("/");return;}
 } catch {}
 if(!CLIENT_ID){show("Google sign-in is not configured. Please contact the ClerkMe administrator.",true);return;}
 const waitForGoogle=()=>new Promise((resolve,reject)=>{
  let tries=0;
  const timer=setInterval(()=>{
   if(window.google?.accounts?.id){clearInterval(timer);resolve();}
   else if(++tries>80){clearInterval(timer);reject(new Error("Google sign-in could not load. Check your connection and refresh."));}
  },100);
 });
 try{
  await waitForGoogle();
  window.google.accounts.id.initialize({client_id:CLIENT_ID,callback:async(response)=>{
   show("Signing you in securely…");
   try{
    const r=await fetch("/api/auth/google",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({credential:response.credential})});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||"Sign-in failed. Please try again.");
    location.replace("/");
   }catch(e){show(e.message||"Sign-in failed. Please try again.",true);}
  }});
  window.google.accounts.id.renderButton(document.getElementById("googleButton"),{theme:"outline",size:"large",shape:"rectangular",text:"continue_with",width:300});
 }catch(e){show(e.message,true);}
})();
</script>
</body>
</html>`.replace("__CLERKME_GOOGLE_CLIENT_ID__", clientId);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
};
