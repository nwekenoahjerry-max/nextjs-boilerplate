"use client";

import { useEffect, useRef, useState } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";

export default function VerifyEmailPage() {
  const attempted = useRef(false);
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking your verification link…");

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("This verification link is incomplete. Request a new one from the sign-in page.");
      return;
    }
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ token })
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This verification link is invalid or has expired.");
      setStatus("success");
      setMessage("Your email address has been verified. You can now sign in to ClerkME.");
    }).catch(error => {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "We could not verify your email address.");
    });
  }, []);

  return <main className="auth-page">
    <section className="auth-card">
      <ClerkMeBrand caption="CLINICAL COMPANION" className="auth-brand"/>
      <div className="eyebrow">EMAIL VERIFICATION</div>
      <h1>{status === "success" ? "You're verified." : status === "error" ? "Verification unsuccessful." : "Verifying your email."}</h1>
      <p className="auth-copy">{message}</p>
      {status === "success" && <a className="auth-submit auth-action-link" href="/login?verified=1">Continue to sign in</a>}
      {status === "error" && <a className="auth-submit auth-action-link" href="/login">Return to sign in</a>}
      <a className="auth-back" href="/">← Back to ClerkME</a>
    </section>
  </main>;
}
