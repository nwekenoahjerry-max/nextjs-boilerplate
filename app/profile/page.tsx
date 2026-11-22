"use client";

import { useEffect, useState } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";
import { nigeriaLgasByState, nigeriaStates } from "../../lib/nigeria-locations";
import { nigerianUniversities } from "../../lib/nigerian-universities";

type Profile = {
  id: string; email: string; name: string; university: string; level: string;
  futureSpecialty: string; state: string; lga: string;
};
const levelSuggestions = [
  "100 Level","200 Level","300 Level","400 Level","500 Level","600 Level","700 Level",
  "1st year","2nd year","3rd year","4th year","5th year","6th year",
  "Clinical year 1","Clinical year 2","Clinical year 3","Clinical year 4",
  "Internship / House Officer","Graduate / Other",
];
const specialtySuggestions = [
  "General Medicine / Internal Medicine","Surgery","Paediatrics","Obstetrics and Gynaecology",
  "Family Medicine","Community Medicine / Public Health","Emergency Medicine","Anaesthesia",
  "Radiology","Pathology","Laboratory Medicine","Dermatology","Ophthalmology",
  "Otorhinolaryngology (ENT)","Orthopaedics and Trauma","Neurology","Cardiology","Oncology",
  "Psychiatry","Other / undecided",
];
const sortedNigerianUniversities = [...nigerianUniversities].sort((a, b) =>
  a.localeCompare(b, "en", { sensitivity: "base" }),
);

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [universitySelection, setUniversitySelection] = useState("");
  const [level, setLevel] = useState("");
  const [futureSpecialty, setFutureSpecialty] = useState("");
  const [stateSelection, setStateSelection] = useState("");
  const [otherState, setOtherState] = useState("");
  const [lga, setLga] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isOutsideNigeria = stateSelection === "Outside Nigeria";
  const availableLgas = nigeriaLgasByState[stateSelection] || [];
  const requiredProfileValues = [
    name.trim(),
    university.trim(),
    level.trim(),
    (isOutsideNigeria ? otherState : stateSelection).trim(),
    lga.trim(),
  ];
  const completedRequiredFields = requiredProfileValues.filter(Boolean).length;
  const profileCompletion = Math.round((completedRequiredFields / 5) * 100);
  useEffect(() => {
    fetch("/api/profile", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (response.status === 401) { window.location.assign("/login"); return null; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your profile.");
        return data.profile as Profile;
      })
      .then(value => {
        if (!value) return;
        setProfile(value);
        setName(value.name || "");
        const savedUniversity = value.university || "";
        const listedUniversity = nigerianUniversities.find(
          item => item.toLocaleLowerCase("en") === savedUniversity.toLocaleLowerCase("en"),
        );
        setUniversity(listedUniversity || savedUniversity);
        setUniversitySelection(listedUniversity || (savedUniversity ? "__other__" : ""));
        setLevel(value.level === "Clinical year 1" && !value.university ? "" : (value.level || ""));
        setFutureSpecialty(value.futureSpecialty || "");
        setLga(value.lga || "");
        if (value.state && nigeriaLgasByState[value.state]) setStateSelection(value.state);
        else if (value.state?.startsWith("Outside Nigeria: ")) { setStateSelection("Outside Nigeria"); setOtherState(value.state.slice("Outside Nigeria: ".length)); }
        else if (value.state) { setStateSelection("Outside Nigeria"); setOtherState(value.state); }
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const changeUniversity = (next: string) => {
    setUniversitySelection(next);
    setUniversity(next === "__other__" ? "" : next);
  };

  const changeState = (next: string) => {
    setStateSelection(next);
    setLga("");
    if (next !== "Outside Nigeria") setOtherState("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    // Read the live form controls at submit time. This avoids sending a stale
    // React state value if the browser's native select changed immediately
    // before submission (notably on mobile browsers and installed PWAs).
    const formData = new FormData(event.currentTarget);
    const submittedSelection = String(formData.get("universitySelection") || "").trim();
    const submittedManualName = String(formData.get("universityOther") || "").trim();

    // FormData is the primary source, but retain a controlled-state fallback.
    // This covers browsers/webviews that expose a changed select visually but
    // omit it from FormData during an immediate submit.
    const effectiveSelection = submittedSelection || universitySelection;
    const effectiveManualName = submittedManualName || university;
    const resolvedUniversity = effectiveSelection === "__other__"
      ? effectiveManualName.trim()
      : (effectiveSelection || university).trim();

    if (resolvedUniversity.length < 2) {
      setError("Please select your university or enter its full name.");
      return;
    }
    setUniversity(resolvedUniversity);
    setSaving(true);
    const state = isOutsideNigeria ? `Outside Nigeria: ${otherState.trim()}` : stateSelection;
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ name: name.trim(), university: resolvedUniversity, level: level.trim(), futureSpecialty: futureSpecialty.trim(), state, lga: lga.trim() }),
      });
      const responseText = await response.text();
      let data: { error?: string; profile?: Profile } = {};
      try {
        data = responseText ? JSON.parse(responseText) as typeof data : {};
      } catch {
        throw new Error(`The server returned an unexpected response (${response.status}). Please try again.`);
      }
      if (!response.ok) throw new Error(data.error || `Could not save your changes (error ${response.status}).`);
      if (!data.profile) throw new Error("The server did not confirm that your profile was saved. Please try again.");
      setProfile(data.profile);
      // Return students to their workspace only after the API confirms the save.
      window.location.replace("/?welcome=1");
      return;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <main className="auth-page"><div className="auth-card profile-loading"><ClerkMeBrand caption="STUDENT PROFILE"/><p>Loading your profile…</p></div></main>;

  return (
    <main className="auth-page profile-page">
      <section className="auth-card profile-card">
        <div className="profile-brand-row">
          <ClerkMeBrand caption="STUDENT PROFILE"/>
          <a className="auth-back profile-back-link" href="/">Back to workspace</a>
        </div>
        <div className="profile-page-heading">
          <div className="eyebrow">YOUR CLERKME PROFILE</div>
          <h1>Your student profile</h1>
          <p className="profile-intro">A few details help ClerkME organise your clinical learning. You can update them whenever your academic information changes.</p>
        </div>
        {profile && <div className="profile-account-summary"><strong>{profile.name || "Student account"}</strong><span>{profile.email}</span></div>}

        <section className="profile-progress-card" aria-label="Student profile completion">
          <div className="profile-progress-heading">
            <div><span>PROFILE COMPLETION</span><p>{completedRequiredFields} of 5 required details completed</p></div>
            <strong>{profileCompletion}%</strong>
          </div>
          <div className="profile-progress-track" role="progressbar" aria-label="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileCompletion}>
            <span style={{ width: profileCompletion + "%" }}/>
          </div>
          <p className="profile-progress-note">{profileCompletion === 100 ? "Your required profile details are complete. You can update them whenever they change." : "Complete the required details below. Your career interest is optional."}</p>
        </section>

        <form className="student-profile-form" onSubmit={save}>
          <div className="profile-form-section">
            <div className="profile-form-section-heading"><span>01</span><div><h2>Personal and academic details</h2><p>Tell us who you are and where you study.</p></div></div>
            <label>Full name <span className="required-mark">Required</span>
              <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Enter your full name"/>
            </label>
            <label className="university-native-field" htmlFor="clerkme-university">
              University / institution <span className="required-mark">Required</span>
              <select
                id="clerkme-university"
                name="universitySelection"
                className="university-native-select"
                value={universitySelection}
                onChange={event => changeUniversity(event.target.value)}
                required
                autoComplete="organization"
              >
                <option value="">Choose your university / institution</option>
                <optgroup label="Nigerian universities and institutions">
                  {sortedNigerianUniversities.map(item => <option key={item} value={item}>{item}</option>)}
                </optgroup>
                <option value="__other__">Other / international institution</option>
              </select>
              <small>Tap the field to open the institution list. On a computer, type the first letters of your university to jump to it.</small>
              <small className="university-selection-status" aria-live="polite">
                {universitySelection === "__other__"
                  ? (university.trim() ? `Institution entered: ${university.trim()}` : "Enter your institution name below.")
                  : (universitySelection ? `Selected institution: ${universitySelection}` : "No institution selected yet.")}
              </small>
            </label>
            {universitySelection === "__other__" && (
              <label className="university-manual-entry" htmlFor="clerkme-university-other">
                Enter your institution name
                <input
                  id="clerkme-university-other"
                  name="universityOther"
                  required
                  maxLength={150}
                  autoComplete="organization"
                  value={university}
                  onChange={event => setUniversity(event.target.value)}
                  placeholder="Enter your university or institution name"
                />
              </label>
            )}
            <label>Current level / year of study <span className="required-mark">Required</span>
              <input required list="clerkme-levels" maxLength={80} value={level} onChange={event => setLevel(event.target.value)} placeholder="Select or enter your current level"/>
              <datalist id="clerkme-levels">{levelSuggestions.map(item => <option key={item} value={item}/>)}</datalist>
            </label>
          </div>

          <div className="profile-form-section">
            <div className="profile-form-section-heading"><span>02</span><div><h2>Location</h2><p>Select your state first; your local area options will update automatically.</p></div></div>
            <label>State / province <span className="required-mark">Required</span>
              <select required value={stateSelection} onChange={event => changeState(event.target.value)}>
                <option value="">Choose your state</option>
                {nigeriaStates.map(item => <option key={item} value={item}>{item}</option>)}
                <option value="Outside Nigeria">Outside Nigeria</option>
              </select>
            </label>
            {isOutsideNigeria && <label>State / province outside Nigeria <span className="required-mark">Required</span>
              <input required maxLength={100} value={otherState} onChange={event => setOtherState(event.target.value)} placeholder="Enter your state or province"/>
            </label>}
            <label>{isOutsideNigeria ? "LGA / district / local area" : "Local Government Area (LGA)"} <span className="required-mark">Required</span>
              {isOutsideNigeria
                ? <input required maxLength={120} value={lga} onChange={event => setLga(event.target.value)} placeholder="Enter your district or local area"/>
                : <select required value={lga} onChange={event => setLga(event.target.value)} disabled={!stateSelection}>
                    <option value="">{stateSelection ? "Choose your LGA" : "Choose a state first"}</option>
                    {availableLgas.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>}
            </label>
          </div>

          <div className="profile-form-section">
            <div className="profile-form-section-heading"><span>03</span><div><h2>Career interests</h2><p>Your future clinical direction is optional and can be changed at any time.</p></div></div>
            <label>Future area of specialisation <span className="optional-mark">Optional</span>
              <input list="clerkme-specialties" maxLength={120} value={futureSpecialty} onChange={event => setFutureSpecialty(event.target.value)} placeholder="e.g. Paediatrics, Surgery, Psychiatry"/>
              <datalist id="clerkme-specialties">{specialtySuggestions.map(item => <option key={item} value={item}/>)}</datalist>
            </label>
          </div>

          <label className="profile-email-field">Google account email
            <input value={profile?.email || ""} disabled/>
            <small>This is the email linked to your Google sign-in and cannot be changed here.</small>
          </label>

          <div className="profile-form-actions">
            <p>Save your changes to keep your ClerkME workspace details up to date.</p>
            <button className="primary-button profile-save-button" type="submit" disabled={saving}>
              {saving ? "Saving profile…" : "Save changes"} <span>→</span>
            </button>
          </div>
        </form>
        {message && <div className="auth-message profile-save-success" role="status">
          <p>{message}</p>
          <a href="/">Return to your ClerkME workspace →</a>
        </div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
