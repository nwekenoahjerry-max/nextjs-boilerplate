"use client";

import { useEffect, useState, type FormEvent } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (!token) { setError("This reset link is incomplete. Request a new one."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your password could not be changed.");
      setComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your password could not be changed.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-card">
      <ClerkMeBrand caption="CLINICAL COMPANION" className="auth-brand"/>
      <div className="eyebrow">ACCOUNT RECOVERY</div>
      <h1>{complete ? "Password updated." : "Choose a new password."}</h1>
      <p className="auth-copy">{complete
        ? "Your password has been changed and all previous ClerkME sessions have been signed out. Sign in with your new password."
        : "Create a new password with at least 12 characters. This reset link can only be used once."}</p>
      {!complete && <form className="auth-form" onSubmit={submit}>
        <label className="auth-field">
          <span>New password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/>
        </label>
        <label className="auth-field">
          <span>Confirm new password</span>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/>
        </label>
        <button className="auth-submit" type="submit" disabled={busy || !token}>{busy ? "Updating password…" : "Update password"}</button>
      </form>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {complete && <a className="auth-submit auth-action-link" href="/login">Sign in to ClerkME</a>}
      {!token && !complete && <p className="auth-error">No reset token was found. Return to sign in and request another reset email.</p>}
      <a className="auth-back" href="/login">← Back to sign in</a>
    </section>
  </main>;
}
