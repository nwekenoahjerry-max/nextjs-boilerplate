(() => {
  let googleClientId = '';
  let googleInitialized = false;

  const showGoogleError = message => {
    const box = document.getElementById('clerk-google-status') || document.getElementById('er');
    if (box) box.textContent = message;
  };

  function renderGoogleButton() {
    const host = document.getElementById('clerk-google-btn');
    if (!host || !googleClientId || !window.google?.accounts?.id) return;
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async response => {
          if (!response?.credential) return showGoogleError('Google did not return a sign-in credential. Please try again.');
          showGoogleError('Signing in with Google…');
          try {
            const res = await fetch('/api/google', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ credential: response.credential })
            });
            const result = await res.json();
            if (!res.ok || result.error) return showGoogleError(result.error || 'Google sign-in failed. Please try again.');
            location.reload();
          } catch {
            showGoogleError('Could not reach ClerkMD. Check your connection and try again.');
          }
        }
      });
      googleInitialized = true;
    }
    if (host.dataset.ready === '1') return;
    host.innerHTML = '';
    window.google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 300
    });
    host.dataset.ready = '1';
  }

  function ensureGoogleArea() {
    const card = document.querySelector('#app .card');
    if (!card || !document.getElementById('e') || document.getElementById('clerk-google-auth')) return;
    const section = document.createElement('section');
    section.id = 'clerk-google-auth';
    section.style.cssText = 'margin-top:1.1rem;padding-top:.9rem;border-top:1px solid var(--l);text-align:center';
    section.innerHTML = '<div class="m" style="font-size:.9rem;margin-bottom:.65rem">Or continue with Google</div><div id="clerk-google-btn" style="display:flex;justify-content:center;min-height:42px"></div><p id="clerk-google-status" class="err" role="status" style="font-size:.88rem;margin:.45rem 0 0"></p>';
    card.appendChild(section);
    renderGoogleButton();
  }

  window.forgot = async function () {
    const email = (document.getElementById('e')?.value || '').trim();
    const status = document.getElementById('er');
    if (!email) {
      if (status) status.textContent = 'Enter your email address first.';
      return;
    }
    if (status) status.textContent = 'Requesting a password-reset link…';
    try {
      const res = await fetch('/api/reset/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email })
      });
      const result = await res.json();
      if (status) status.textContent = result.error || 'If that email is registered, a reset link has been sent. Check your inbox and spam folder.';
    } catch {
      if (status) status.textContent = 'Could not contact ClerkMD. Please try again.';
    }
  };

  const app = document.getElementById('app');
  if (app) {
    new MutationObserver(() => {
      ensureGoogleArea();
      renderGoogleButton();
    }).observe(app, { childList: true, subtree: true });
  }
  ensureGoogleArea();

  (async () => {
    try {
      const res = await fetch('/api/config', { credentials: 'same-origin' });
      const config = await res.json();
      googleClientId = config.googleClientId || '';
      if (!googleClientId) {
        showGoogleError('Google sign-in is not configured on this deployment.');
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      script.onerror = () => showGoogleError('Google sign-in could not load. Please check your connection.');
      document.head.appendChild(script);
    } catch {
      showGoogleError('Google sign-in could not be initialised. Please refresh the page.');
    }
  })();
})();