"use client";

import Script from "next/script";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    } } };
  }
}

type AuthMode = "signin" | "signup" | "forgot" | "pending";

export default function LoginPage() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [clientId, setClientId] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config").then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.clientId) setClientId(d.clientId); })
      .catch(() => {});
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then(r => { if (r.ok) window.location.replace("/"); })
      .catch(() => {});
    if (new URLSearchParams(window.location.search).get("verified") === "1") {
      setNotice("Your email address is verified. You can now sign in.");
    }
  }, []);

  useEffect(() => {
    if (!clientId || !scriptReady || !window.google || !buttonRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        setBusy(true);
        setGoogleError("");
        try {
          const response = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ credential })
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Google sign-in failed.");
          window.location.replace("/?welcome=1");
        } catch (e) {
          setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
          setBusy(false);
        }
      }
    });
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 310
    });
  }, [clientId, scriptReady, mode]);

  const clearMessages = () => { setError(""); setNotice(""); };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    clearMessages();
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === "signup" && password !== confirmPassword) {
      setError("Your passwords do not match. Please check them and try again.");
      return;
    }
    setBusy(true);
    clearMessages();
    try {
      const endpoint = mode === "signup" ? "/api/auth/register"
        : mode === "forgot" ? "/api/auth/forgot-password" : "/api/auth/login";
      const payload = mode === "signup" ? { name, email, password } : mode === "forgot" ? { email } : { email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED" || data.verificationPending) {
          setMode("pending");
          setNotice(data.error || "Your account is ready. Verify your email address to continue.");
        } else {
          throw new Error(data.error || "We could not complete that request.");
        }
        return;
      }
      if (mode === "signup") {
        setMode("pending");
        setNotice("We have sent a verification link to your email address. Open it to activate your ClerkME account.");
      } else if (mode === "forgot") {
        setNotice(data.message || "If a verified account exists for this address, a password-reset link has been sent.");
      } else {
        window.location.replace("/?welcome=1");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not complete that request.");
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (busy) return;
    setBusy(true);
    clearMessages();
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not send a new verification email.");
      setNotice(data.message || "Check your inbox for a new verification link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We could not send a new verification email.");
    } finally {
      setBusy(false);
    }
  };

  const isPending = mode === "pending";
  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  return (
    <main className="auth-page">
      {clientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />}
      <section className="auth-card">
        <ClerkMeBrand caption="CLINICAL COMPANION" className="auth-brand"/>
        <div className="eyebrow">WELCOME TO CLERKME</div>
        <h1>{isPending ? "Check your inbox." : isForgot ? "Reset your password." : isSignup ? "Create your account." : <>Sign in to your<br/>clinical workspace.</>}</h1>
        <p className="auth-copy">
          {isPending ? "We need to verify your email address before you can access your clinical learning workspace."
            : isForgot ? "Enter the email address linked to your ClerkME account. We will send a secure reset link if an account exists."
            : isSignup ? "Create an account with any email address. You do not need a Gmail account."
            : "Access your saved cases, study materials and learning progress."}
        </p>

        {isPending ? (
          <div className="auth-pending-panel">
            <div className="auth-pending-icon">✉</div>
            <strong>Verification required</strong>
            <span>Check your inbox and spam folder. The verification link expires after 24 hours.</span>
            <label className="auth-field">
              <span>Email address</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required/>
            </label>
            <button className="auth-submit" type="button" disabled={busy || !email} onClick={resendVerification}>
              {busy ? "Sending…" : "Resend verification email"}
            </button>
            <button className="auth-text-button" type="button" onClick={() => switchMode("signin")}>Back to sign in</button>
          </div>
        ) : isForgot ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Email address</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required maxLength={254}/>
            </label>
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Sending reset link…" : "Send password-reset link"}</button>
            <button className="auth-text-button" type="button" onClick={() => switchMode("signin")}>Back to sign in</button>
          </form>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "active" : ""} onClick={() => switchMode("signin")}>Sign in</button>
              <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "active" : ""} onClick={() => switchMode("signup")}>Create account</button>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              {isSignup && <label className="auth-field">
                <span>Full name</span>
                <input type="text" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={100}/>
              </label>}
              <label className="auth-field">
                <span>Email address</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required maxLength={254}/>
              </label>
              <label className="auth-field">
                <span>Password</span>
                <div className="auth-password-wrap">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} required minLength={isSignup ? 12 : undefined} maxLength={128}/>
                  <button className="auth-password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {isSignup && <small>Use at least 12 characters.</small>}
              </label>
              {isSignup && <label className="auth-field">
                <span>Confirm password</span>
                <div className="auth-password-wrap">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} aria-invalid={confirmPassword.length > 0 && password !== confirmPassword}/>
                  <button className="auth-password-toggle" type="button" onClick={() => setShowConfirmPassword(value => !value)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword}>
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <small className={password === confirmPassword ? "auth-password-match" : "auth-password-mismatch"}>
                    {password === confirmPassword ? "Passwords match." : "Passwords do not match yet."}
                  </small>
                )}
              </label>}
              {!isSignup && <div className="auth-forgot-row"><button type="button" className="auth-text-button" onClick={() => switchMode("forgot")}>Forgot password?</button></div>}
              <button className="auth-submit" type="submit" disabled={busy || (isSignup && password !== confirmPassword)}>{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in with email"}</button>
            </form>
            <div className="auth-divider"><span>or continue with</span></div>
            {clientId ? <div className="google-button" ref={buttonRef}/> : <p className="auth-google-unavailable">Google sign-in is temporarily unavailable. You can still use email and password.</p>}
          </>
        )}

        {notice && <p className="auth-message" role="status">{notice}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {googleError && <p className="auth-error" role="alert">{googleError}</p>}
        <small className="auth-privacy">By continuing, you agree to use ClerkME responsibly. Do not enter identifiable patient information unless your institution and applicable privacy requirements authorise it.</small>
        <a className="auth-back" href="/">← Back to ClerkME</a>
      </section>
    </main>
  );
}
