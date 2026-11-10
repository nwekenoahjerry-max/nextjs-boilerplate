type LoginEnv = { GOOGLE_CLIENT_ID?: string };

export const onRequestGet = async ({ env }: { env: LoginEnv }) => {
  const clientId = env.GOOGLE_CLIENT_ID || "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#103f39">
<title>Sign in | ClerkMe</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#f3f7f3,#e8f0eb);color:#193b35;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.card{width:min(100%,480px);background:#fff;border:1px solid #e2ebe4;border-radius:22px;padding:38px;box-shadow:0 24px 70px #153d3514}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#193b35;margin-bottom:44px}.mark{width:44px;height:44px;border-radius:14px;background:#103f39;color:#fff;display:grid;place-items:center;font-weight:850;font-size:19px}.brand strong{display:block;font-size:22px;letter-spacing:-.8px}.brand strong span{color:#19836d}.brand small{display:block;color:#829188;font-size:9px;letter-spacing:1.6px;margin-top:3px;font-weight:700}
.eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:800;color:#17836d}h1{font-size:34px;line-height:1.13;letter-spacing:-1.4px;margin:12px 0}p{font-size:14px;line-height:1.7;color:#718078;margin:0 0 26px}
.google-wrap{min-height:48px;display:flex;align-items:center;justify-content:center;margin:26px 0 18px}.error{color:#b42318;background:#fff3f1;border-radius:9px;padding:11px;font-size:13px}.status{color:#60756b;font-size:12px;text-align:center}.privacy{font-size:11px;color:#89958e;line-height:1.6;border-top:1px solid #edf1ed;padding-top:18px;margin-top:24px}.back{display:inline-block;color:#167b67;text-decoration:none;font-weight:700;font-size:13px;margin-top:24px}
</style>
<script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
<main class="card">
<a class="brand" href="/"><span class="mark">C+</span><span><strong>clerk<span>me</span></strong><small>CLINICAL COMPANION</small></span></a>
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
  let tries=0;const timer=setInterval(()=>{if(window.google?.accounts?.id){clearInterval(timer);resolve();}else if(++tries>80){clearInterval(timer);reject(new Error("Google sign-in could not load. Check your connection and refresh."));}},100);
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
