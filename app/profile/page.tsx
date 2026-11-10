"use client";

import { useEffect, useState } from "react";

type Profile = { id: string; email: string; name: string; school: string | null; level: string | null };

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/profile", { credentials: "same-origin" })
      .then(async response => {
        if (response.status === 401) { window.location.href = "/login"; return null; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your profile.");
        return data.profile as Profile;
      })
      .then(value => {
        if (!value) return;
        setProfile(value); setName(value.name || ""); setSchool(value.school || ""); setLevel(value.level || "");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, school, level })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your changes.");
      setProfile(data.profile); setMessage("Your profile has been updated successfully.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your changes.");
    } finally { setSaving(false); }
  };

  if (loading) return <main className="auth-page"><div className="auth-card">Loading your profile…</div></main>;
  return (
    <main className="auth-page">
      <section className="auth-card" style={{ width: "min(100%, 560px)" }}>
        <a className="auth-back" href="/">← Back to ClerkMe workspace</a>
        <div className="auth-brand">
          <a className="brand" href="/" style={{ padding: 0 }}>
            <span className="brand-mark">C<span>+</span></span>
            <span><strong>clerk<span>me</span></strong><small>STUDENT PROFILE</small></span>
          </a>
        </div>
        <div className="eyebrow">YOUR ACCOUNT</div>
        <h1>Student profile</h1>
        <p>Keep your academic details up to date. You can edit your name, institution and current level at any time.</p>
        {profile && <div style={{ background: "#f1f6f2", borderRadius: 10, padding: 14, marginBottom: 20 }}>
          <strong style={{ display: "block", fontSize: 12, color: "#173b36" }}>{profile.name}</strong>
          <span style={{ fontSize: 11, color: "#788680" }}>{profile.email}</span>
        </div>}
        <form onSubmit={save}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, margin: "16px 0", color: "#425b50" }}>
            Full name
            <input required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} style={{ display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe8e1", borderRadius: 7, fontSize: 12 }} />
          </label>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, margin: "16px 0", color: "#425b50" }}>
            University / institution
            <input maxLength={150} value={school} onChange={event => setSchool(event.target.value)} placeholder="Enter your medical school" style={{ display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe8e1", borderRadius: 7, fontSize: 12 }} />
          </label>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, margin: "16px 0", color: "#425b50" }}>
            Academic level / year of study
            <input maxLength={80} value={level} onChange={event => setLevel(event.target.value)} placeholder="e.g. 5th year MBBS" style={{ display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #dfe8e1", borderRadius: 7, fontSize: 12 }} />
          </label>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, margin: "16px 0", color: "#425b50" }}>
            Email address
            <input value={profile?.email || ""} disabled style={{ display: "block", width: "100%", marginTop: 7, padding: 12, border: "1px solid #e8eeea", borderRadius: 7, fontSize: 12, background: "#f7f9f7", color: "#788680" }} />
            <span style={{ display: "block", marginTop: 5, color: "#8a9690", fontSize: 9 }}>Email is linked to your Google sign-in and cannot be changed here.</span>
          </label>
          <button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save profile changes"} <span>→</span></button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
