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

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
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
        setUniversity(value.university || "");
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

  const changeState = (next: string) => {
    setStateSelection(next);
    setLga("");
    if (next !== "Outside Nigeria") setOtherState("");
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const state = isOutsideNigeria ? `Outside Nigeria: ${otherState.trim()}` : stateSelection;
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, university, level, futureSpecialty, state, lga }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your changes.");
      setProfile(data.profile);
      setMessage("Your student profile has been saved.");
      window.setTimeout(() => window.location.assign("/"), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your changes.");
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
        <div className="eyebrow">YOUR CLERKME ACCOUNT</div>
        <h1>Complete your student profile</h1>
        <p className="profile-intro">These details help personalise your learning workspace. Your future area of specialisation is optional and can be changed later.</p>
        {profile && <div className="profile-account-summary"><strong>{profile.name || "Student account"}</strong><span>{profile.email}</span></div>}

        <form className="student-profile-form" onSubmit={save}>
          <div className="profile-form-section">
            <div><h2>Personal and academic details</h2><p>Fields marked required must be completed.</p></div>
            <label>Full name <span className="required-mark">Required</span>
              <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Enter your full name"/>
            </label>
            <label>University / institution <span className="required-mark">Required</span>
              <input required list="clerkme-universities" maxLength={150} autoComplete="organization" value={university} onChange={event => setUniversity(event.target.value)} placeholder="Search or enter your university"/>
              <datalist id="clerkme-universities">{nigerianUniversities.map(item => <option key={item} value={item}/>)}</datalist>
              <small>Choose a suggestion or enter your institution if it is not listed.</small>
            </label>
            <label>Current level / year of study <span className="required-mark">Required</span>
              <input required list="clerkme-levels" maxLength={80} value={level} onChange={event => setLevel(event.target.value)} placeholder="Select or enter your current level"/>
              <datalist id="clerkme-levels">{levelSuggestions.map(item => <option key={item} value={item}/>)}</datalist>
            </label>
          </div>

          <div className="profile-form-section">
            <div><h2>Location</h2><p>Select your state first; the LGA list will update automatically.</p></div>
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
            <div><h2>Career interests</h2><p>Keep your future clinical direction in view. You can leave this blank.</p></div>
            <label>Future area of specialisation <span className="optional-mark">Optional</span>
              <input list="clerkme-specialties" maxLength={120} value={futureSpecialty} onChange={event => setFutureSpecialty(event.target.value)} placeholder="e.g. Paediatrics, Surgery, Psychiatry"/>
              <datalist id="clerkme-specialties">{specialtySuggestions.map(item => <option key={item} value={item}/>)}</datalist>
            </label>
          </div>

          <label className="profile-email-field">Google account email
            <input value={profile?.email || ""} disabled/>
            <small>This is the email linked to your Google sign-in and cannot be changed here.</small>
          </label>

          <button className="primary-button profile-save-button" type="submit" disabled={saving || !name.trim() || !university.trim() || !level.trim() || !stateSelection || !lga.trim() || (isOutsideNigeria && !otherState.trim())}>
            {saving ? "Saving profile…" : "Save student profile"} <span>→</span>
          </button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </section>
    </main>
  );
}
