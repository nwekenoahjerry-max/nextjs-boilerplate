"use client";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    } } };
  }
}
export default function LoginPage() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState("");
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/auth/config").then(r => r.json()).then(d => { if (d.clientId) setClientId(d.clientId); else setError(d.error || "Sign-in is not configured."); }).catch(() => setError("Unable to load sign-in configuration."));
    fetch("/api/auth/me").then(r => { if (r.ok) window.location.replace("/"); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!clientId || !scriptReady || !window.google || !buttonRef.current) return;
    window.google.accounts.id.initialize({ client_id: clientId, callback: async ({ credential }) => {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ credential }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Sign-in failed.");
        window.location.replace("/");
      } catch (e) { setError(e instanceof Error ? e.message : "Sign-in failed."); setBusy(false); }
    }});
    buttonRef.current.innerHTML = "";
    window.google.accounts.id.renderButton(buttonRef.current, { theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 300 });
  }, [clientId, scriptReady]);
  return <main className="auth-page">
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} />
    <section className="auth-card">
      <a className="brand auth-brand" href="/"><span className="brand-mark">C<span>M</span></span><span><strong>Clerk<span>ME</span></strong><small>CLINICAL COMPANION</small></span></a>
      <div className="eyebrow">WELCOME TO CLERKME</div>
      <h1>Sign in to your<br/>clinical workspace.</h1>
      <p>Your saved cases and learning progress stay connected to your account.</p>
      <div className="google-button" ref={buttonRef} />
      {busy && <p className="auth-message">Securely signing you in…</p>}
      {error && <p className="auth-error">{error}</p>}
      <small className="auth-privacy">By continuing, you agree to use ClerkMe responsibly. Do not enter identifiable patient information unless your institution and applicable privacy requirements authorise it.</small>
      <a className="auth-back" href="/">← Back to ClerkMe</a>
    </section>
  </main>;
}
