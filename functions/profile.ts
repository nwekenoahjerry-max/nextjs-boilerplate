export const onRequestGet = async () => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Student profile | ClerkMe</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7f4;color:#193b35;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}
.card{width:min(100%,560px);background:#fff;border:1px solid #e3ebe5;border-radius:18px;padding:32px;box-shadow:0 18px 55px #173b3610}
a{color:#167b67;text-decoration:none;font-weight:650}.brand{display:flex;align-items:center;gap:12px;margin:24px 0}.mark{width:42px;height:42px;border-radius:13px;background:#103f39;color:#fff;display:grid;place-items:center;font-size:20px;font-weight:800}.brand strong{font-size:21px;letter-spacing:-.7px}.brand small{display:block;font-size:9px;letter-spacing:1.5px;color:#7a8c83;margin-top:3px}
.eyebrow{font-size:10px;letter-spacing:1.7px;font-weight:800;color:#17836d;margin-top:24px}h1{font-size:30px;letter-spacing:-1px;margin:8px 0}p{color:#718078;line-height:1.6;font-size:14px}
.identity{background:#f0f6f2;padding:14px;border-radius:10px;margin:22px 0}.identity strong,.identity span{display:block}.identity span{font-size:12px;color:#78877f;margin-top:4px}
label{display:block;font-size:12px;font-weight:700;color:#425b50;margin:18px 0}input{display:block;width:100%;margin-top:8px;padding:13px;border:1px solid #dce7df;border-radius:9px;font-size:14px;color:#193b35;outline-color:#16836d}input:disabled{background:#f6f8f6;color:#829087}
button{width:100%;border:0;border-radius:9px;background:#103f39;color:#fff;font-weight:700;padding:14px;font-size:14px;cursor:pointer;margin-top:12px}button:disabled{opacity:.6;cursor:wait}
#status{font-size:13px;margin-top:16px}#status.error{color:#b42318}#status.ok{color:#167b52}.back{font-size:13px}
</style>
</head>
<body><main class="card">
<a class="back" href="/">← Back to ClerkMe workspace</a>
<div class="brand"><div class="mark">C+</div><div><strong>clerkme</strong><small>STUDENT PROFILE</small></div></div>
<div class="eyebrow">YOUR ACCOUNT</div><h1>Student profile</h1>
<p>Keep your academic details up to date. You can edit your name, institution and current level at any time.</p>
<div class="identity"><strong id="displayName">Loading your profile…</strong><span id="displayEmail"></span></div>
<form id="profileForm">
<label>Full name<input id="name" required minlength="2" maxlength="100" autocomplete="name"></label>
<label>University / institution<input id="school" maxlength="150" placeholder="Enter your medical school"></label>
<label>Academic level / year of study<input id="level" maxlength="80" placeholder="e.g. 5th year MBBS"></label>
<label>Email address<input id="email" disabled><small style="display:block;color:#87948d;font-weight:400;margin-top:6px">Email is linked to your Google sign-in and cannot be changed here.</small></label>
<button id="save" type="submit">Save profile changes →</button>
</form><p id="status" role="status"></p>
</main>
<script>
const el=id=>document.getElementById(id);
async function loadProfile(){
 try{
  const r=await fetch('/api/profile',{credentials:'same-origin'});
  if(r.status===401){location.href='/login';return}
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load your profile.');
  const p=d.profile||{};el('name').value=p.name||'';el('school').value=p.school||'';el('level').value=p.level||'';el('email').value=p.email||'';el('displayName').textContent=p.name||'Student';el('displayEmail').textContent=p.email||'';
 }catch(e){el('displayName').textContent='Profile unavailable';show(e.message,true)}
}
function show(message,error){el('status').textContent=message;el('status').className=error?'error':'ok'}
el('profileForm').addEventListener('submit',async event=>{
 event.preventDefault();const button=el('save');button.disabled=true;button.textContent='Saving…';show('');
 try{
  const r=await fetch('/api/profile',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:el('name').value,school:el('school').value,level:el('level').value})});
  const d=await r.json();if(r.status===401){location.href='/login';return}if(!r.ok)throw new Error(d.error||'Could not save your changes.');
  el('displayName').textContent=d.profile?.name||el('name').value;show('Your profile has been updated successfully.',false);
 }catch(e){show(e.message,true)}finally{button.disabled=false;button.textContent='Save profile changes →'}
});
loadProfile();
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" } });
};
