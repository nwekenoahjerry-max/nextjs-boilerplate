"use client";

import { useEffect, useMemo, useState } from "react";
import ClerkMeBrand from "../../components/clerkme-brand";
import SearchablePicker from "../searchable-picker";
import { nigeriaLgasByState, nigeriaStates } from "../../lib/nigeria-locations";
import { nigerianUniversities } from "../../lib/nigerian-universities";

type Profile = {
  id: string; email: string; name: string; university: string; country: string; level: string;
  futureSpecialty: string; state: string; lga: string;
};
type CountryOption = { code: string; name: string };
type UniversityRecord = [string, string];
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
  const [country, setCountry] = useState("Nigeria");
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);
  const [worldUniversities, setWorldUniversities] = useState<UniversityRecord[]>([]);
  const [worldDirectoryLoaded, setWorldDirectoryLoaded] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState("");
  const [university, setUniversity] = useState("");
  const [universitySelection, setUniversitySelection] = useState("");
  const [level, setLevel] = useState("");
  const [futureSpecialty, setFutureSpecialty] = useState("");
  const [stateSelection, setStateSelection] = useState("");
  const [lga, setLga] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isNigeria = country === "Nigeria";
  const availableLgas = isNigeria ? (nigeriaLgasByState[stateSelection] || []) : [];
  const countryNames = countryOptions.map(item => item.name);
  const selectedCountryCode = countryOptions.find(item => item.name === country)?.code || "";
  const availableUniversities = useMemo(() => {
    const international = worldUniversities
      .filter(([code]) => code === selectedCountryCode)
      .map(([, universityName]) => universityName);
    const local = isNigeria ? nigerianUniversities : [];
    return Array.from(new Set([...local, ...international]))
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [isNigeria, selectedCountryCode, worldUniversities]);
  const requiredProfileValues = [name.trim(), university.trim(), country.trim(), level.trim(), stateSelection.trim(), lga.trim()];
  const completedRequiredFields = requiredProfileValues.filter(Boolean).length;
  const profileCompletion = Math.round((completedRequiredFields / 6) * 100);
  useEffect(() => {
    let cancelled = false;
    fetch("/data/countries.json", { cache: "force-cache" })
      .then(async response => {
        if (!response.ok) throw new Error("The country directory could not be loaded.");
        return response.json() as Promise<CountryOption[]>;
      })
      .then(items => { if (!cancelled) setCountryOptions(items); })
      .catch(reason => {
        if (!cancelled) setDirectoryError(reason instanceof Error ? reason.message : "The country directory could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!country || country === "Nigeria" || worldDirectoryLoaded) return;
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError("");
    fetch("/data/world-universities.json", { cache: "force-cache" })
      .then(async response => {
        if (!response.ok) throw new Error("The international university directory could not be loaded.");
        return response.json() as Promise<UniversityRecord[]>;
      })
      .then(items => {
        if (!cancelled) {
          setWorldUniversities(items);
          setWorldDirectoryLoaded(true);
        }
      })
      .catch(reason => {
        if (!cancelled) setDirectoryError(reason instanceof Error ? reason.message : "The university directory could not be loaded.");
      })
      .finally(() => { if (!cancelled) setDirectoryLoading(false); });
    return () => { cancelled = true; };
  }, [country, worldDirectoryLoaded]);

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
        const savedCountry = value.country || (value.state?.startsWith("Outside Nigeria") ? "" : "Nigeria");
        setCountry(savedCountry);
        const savedUniversity = value.university || "";
        setUniversity(savedUniversity);
        setUniversitySelection(savedUniversity);
        setLevel(value.level === "Clinical year 1" && !value.university ? "" : (value.level || ""));
        setFutureSpecialty(value.futureSpecialty || "");
        setLga(value.lga || "");
        if (value.state && value.state !== "Outside Nigeria" && !value.state.startsWith("Outside Nigeria: ")) setStateSelection(value.state);
        else if (value.state?.startsWith("Outside Nigeria: ")) setStateSelection(value.state.slice("Outside Nigeria: ".length));
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const changeCountry = (next: string) => {
    setCountry(next);
    setDirectoryLoading(false);
    setUniversity("");
    setUniversitySelection("");
    setStateSelection("");
    setLga("");
  };

  const changeUniversity = (next: string) => {
    setUniversitySelection(next);
    setUniversity(next);
  };

  const changeState = (next: string) => {
    setStateSelection(next);
    setLga("");
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
    const effectiveSelection = submittedSelection || universitySelection;
    const effectiveManualName = submittedManualName || university;
    const resolvedUniversity = effectiveSelection === "__other__"
      ? effectiveManualName.trim()
      : (effectiveSelection || university).trim();

    if (!country.trim()) {
      setError("Please select your country.");
      return;
    }
    if (resolvedUniversity.length < 2) {
      setError("Please select your university or enter its full name.");
      return;
    }
    if (!stateSelection.trim() || !lga.trim()) {
      setError("Please complete your state / province and local area.");
      return;
    }
    setUniversity(resolvedUniversity);
    setSaving(true);
    const state = stateSelection.trim();
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ name: name.trim(), university: resolvedUniversity, country: country.trim(), level: level.trim(), futureSpecialty: futureSpecialty.trim(), state, lga: lga.trim() }),
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
            <div><span>PROFILE COMPLETION</span><p>{completedRequiredFields} of 6 required details completed</p></div>
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
            <SearchablePicker
              label="Country"
              required
              value={country}
              options={countryNames}
              placeholder="Choose your country"
              searchPlaceholder="Search all countries…"
              emptyMessage="No country matches that search."
              showInitialOptions
              minimumQueryLength={0}
              onChange={changeCountry}
              disabled={!countryOptions.length}
            />
            {countryOptions.length === 0 && <small className="profile-directory-note">{directoryError || "Loading country list…"}</small>}
            <SearchablePicker
              label="University / institution"
              value={universitySelection === "__other__" ? "" : universitySelection}
              options={availableUniversities}
              placeholder={country ? "Search universities in " + country : "Choose your country first"}
              searchPlaceholder={"Search universities in " + (country || "your country") + "…"}
              emptyMessage={directoryError || "No matching institution was found. You can enter its name manually below."}
              loading={directoryLoading}
              showInitialOptions={false}
              minimumQueryLength={2}
              onChange={changeUniversity}
              required
            />
            <input type="hidden" name="universitySelection" value={universitySelection}/>
            {directoryError && country !== "Nigeria" && <p className="profile-directory-note" role="status">{directoryError} You can still enter your institution manually.</p>}
            {universitySelection !== "__other__" ? (
              <button className="profile-manual-university-toggle" type="button" onClick={() => { setUniversitySelection("__other__"); setUniversity(""); }}>
                Can’t find your university? Enter it manually
              </button>
            ) : (
              <div className="profile-manual-university">
                <label htmlFor="clerkme-university-other">Enter your institution name <span className="required-mark">Required</span>
                  <input
                    id="clerkme-university-other"
                    name="universityOther"
                    required
                    maxLength={150}
                    autoComplete="organization"
                    value={university}
                    onChange={event => setUniversity(event.target.value)}
                    placeholder="Type the full name of your university or institution"
                  />
                </label>
                <button className="profile-manual-university-toggle" type="button" onClick={() => { setUniversitySelection(""); setUniversity(""); }}>
                  Choose from the university directory
                </button>
              </div>
            )}
            <label>Current level / year of study <span className="required-mark">Required</span>
              <input required list="clerkme-levels" maxLength={80} value={level} onChange={event => setLevel(event.target.value)} placeholder="Select or enter your current level"/>
              <datalist id="clerkme-levels">{levelSuggestions.map(item => <option key={item} value={item}/>)}</datalist>
            </label>
          </div>

          <div className="profile-form-section">
            <div className="profile-form-section-heading"><span>02</span><div><h2>Location</h2><p>{isNigeria ? "Select your state first; your local government areas will update automatically." : "Enter your state or province and your local area."}</p></div></div>
            <label>{isNigeria ? "State" : "State / province"} <span className="required-mark">Required</span>
              {isNigeria
                ? <select required value={stateSelection} onChange={event => changeState(event.target.value)}>
                    <option value="">Choose your state</option>
                    {nigeriaStates.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                : <input required maxLength={100} value={stateSelection} onChange={event => changeState(event.target.value)} placeholder="Enter your state or province"/>}
            </label>
            <label>{isNigeria ? "Local Government Area (LGA)" : "City / district / local area"} <span className="required-mark">Required</span>
              {isNigeria
                ? <select required value={lga} onChange={event => setLga(event.target.value)} disabled={!stateSelection}>
                    <option value="">{stateSelection ? "Choose your LGA" : "Choose a state first"}</option>
                    {availableLgas.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                : <input required maxLength={120} value={lga} onChange={event => setLga(event.target.value)} placeholder="Enter your city, district or local area"/>}
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
