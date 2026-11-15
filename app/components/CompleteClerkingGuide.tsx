"use client";

const sections: [string, string, string[], string][] = [
  ["Biodata and source of history", "Establish the patient's demographic context and the source, reliability and limitations of the account.", [
    "Age/date of birth, sex and clinically relevant gender information; occupation, residence/community and marital status where relevant.",
    "Date and time of clerking, clinical setting and a non-identifying study reference.",
    "Informant: patient, parent/carer, relative, witness or record; relationship to patient and whether the account is direct or collateral.",
    "Reliability and limitations: confusion, pain, memory impairment, language barrier, distress, young age or conflicting accounts. Document interpreter use."
  ], "Introduce the patient briefly, identify the informant and state reliability. Use a case reference only in ClerkMe; never upload patient names, hospital numbers, contact details, addresses or photographs."],
  ["Presenting complaints", "List the main problems in the patient's words and give each a separate duration.", [
    "Ask what made the patient seek care today; list complaints in chronological order.",
    "Record the duration of each complaint separately and identify the dominant or most urgent problem.",
    "Do not write a diagnosis as a presenting complaint; preserve the symptom as described."
  ], "Use a numbered list, for example: fever — five days; cough — three days; breathlessness — one day."],
  ["History of presenting complaint", "Construct a chronological account from the first symptom to the current encounter.", [
    "Onset: exact or approximate start, sudden or gradual, circumstances at onset.",
    "Duration, frequency, progression and pattern: continuous, episodic, recurrent, worsening or improving.",
    "Site, radiation, character/quality, severity and effect on daily activity.",
    "Aggravating and relieving factors; treatment tried, dose if known and response.",
    "Associated symptoms and relevant negatives; previous similar episodes and risk factors/exposures.",
    "Ask about red flags early: collapse, severe pain, breathlessness, altered consciousness, bleeding, focal neurological symptoms, inability to drink, reduced urine output or pregnancy-related danger symptoms."
  ], "For pain, use SOCRATES: Site, Onset, Character, Radiation, Associations, Timing, Exacerbating/relieving factors and Severity. For other symptoms explore onset, course, frequency, character, associations, impact and relevant negatives."],
  ["Review of systems", "Screen for additional symptoms, complications and co-existing disease.", [
    "General: fever, weight change, appetite, fatigue, night sweats and sleep.",
    "Cardiovascular: chest discomfort, palpitations, exertional symptoms, orthopnoea, paroxysmal nocturnal dyspnoea, oedema and syncope.",
    "Respiratory: cough, sputum, haemoptysis, wheeze, breathlessness and pleuritic pain.",
    "Gastrointestinal: swallowing, nausea, vomiting, abdominal pain, bowel habit, stool colour, jaundice and rectal bleeding.",
    "Genitourinary: dysuria, frequency, urgency, nocturia, haematuria, urine volume, genital symptoms and incontinence.",
    "Neurological/musculoskeletal: headache, weakness, numbness, seizures, vision/speech change, gait, joint pain and back pain.",
    "Endocrine, skin, haematological and psychiatric symptoms according to the presentation."
  ], "Record relevant positives and negatives by system. Do not write 'systems review normal' unless the relevant systems were actually reviewed."],
  ["Past medical and surgical history", "Identify prior illnesses, procedures and risk factors that may affect the present problem.", [
    "Chronic illnesses: hypertension, diabetes, asthma, sickle cell disease, kidney/liver disease, HIV/TB and relevant mental health conditions.",
    "Previous admissions, similar episodes, complications, specialist follow-up and prior diagnoses.",
    "Operations, procedures, injuries, fractures, blood transfusions and transfusion reactions.",
    "Previous relevant test results and treatment; pregnancy/obstetric history where relevant."
  ], "Record the condition, approximate date, treatment and current status where known. Clarify whether information is patient-reported or verified in a record."],
  ["Medication and allergy history", "Identify current and recent exposures, adherence, adverse effects and medicine-related risks.", [
    "Prescribed medicines: name, dose, route, frequency, duration, last dose and indication where known.",
    "Over-the-counter medicines, analgesics, supplements, herbal/traditional remedies, topical products and recreational substances.",
    "Recent antibiotics, steroids, anticoagulants, insulin, antiepileptics and medicines started or stopped recently.",
    "Adherence, missed doses, affordability, access, side effects and understanding of the regimen.",
    "Allergies and exact reaction: rash, swelling, breathing difficulty, anaphylaxis, intolerance or uncertain history."
  ], "Distinguish allergy from intolerance/adverse effect. Never record 'no known allergies' unless specifically asked and verified."],
  ["Immunisation, screening and preventive history", "Record prevention relevant to age, risk and the current presentation.", [
    "Immunisation history and vaccination card, particularly for children and pregnancy.",
    "Relevant screening: cervical, breast, colorectal, blood pressure, diabetes, HIV and other locally recommended screening.",
    "Prior infections, exposure risks, prophylaxis and preventive treatments relevant to the case.",
    "Tetanus status after injury and other time-critical preventive measures when indicated."
  ], "Use dates or documented status where available. If uncertain, state that the history is uncertain."],
  ["Family history", "Look for inherited disease, shared exposures and familial patterns.", [
    "Relevant conditions in first-degree relatives: parents, siblings and children.",
    "Age at diagnosis or death where known; premature or unexplained deaths.",
    "Diabetes, hypertension, cardiovascular disease, cancer, sickle cell disease, epilepsy, psychiatric illness and congenital disorders.",
    "Consanguinity or inherited disorders where clinically relevant; ask sensitively."
  ], "Record the relative and condition rather than writing only 'family history positive'. Draw a pedigree when inheritance matters."],
  ["Personal, social and occupational history", "Understand living circumstances, exposures, health behaviours, function and support.", [
    "Occupation, workplace exposures, protective equipment and environmental risks.",
    "Smoking, alcohol and other substances: type, quantity, frequency, duration and last use; ask neutrally.",
    "Diet, fluid intake, exercise, sleep and recent changes in weight or appetite.",
    "Housing, household composition, ventilation, sanitation, water source, travel and access/financial barriers where relevant.",
    "Sexual history only when clinically indicated: explain confidentiality, seek permission and use non-judgemental language.",
    "Functional baseline, activities of daily living, mobility, work/school attendance, caregiving and support."
  ], "Include information relevant to care. Explain confidentiality and its limits before sensitive questions; avoid assumptions."],
  ["Menstrual and gynaecological history", "Use where relevant to reproductive or gynaecological concerns.", [
    "Menarche, cycle length and regularity, duration/amount of flow, last menstrual period and dysmenorrhoea.",
    "Intermenstrual or postcoital bleeding, vaginal discharge, pelvic pain, dyspareunia and menopausal symptoms.",
    "Gravidity/parity and pregnancy outcomes using the locally taught convention.",
    "Contraception, fertility concerns, ectopic pregnancy, miscarriage, pelvic infection, fibroids or gynaecological procedures.",
    "Pregnancy possibility and testing where indicated."
  ], "State the LMP clearly and confirm the date. Do not infer pregnancy status or gestational age from uncertain dates."],
  ["Obstetric history", "Assess the current pregnancy and previous pregnancies, births and complications.", [
    "Current pregnancy: gestational age and dating source, antenatal booking/visits, scans, screening and complications.",
    "Danger symptoms: bleeding, fluid leakage, contractions, abdominal pain, severe headache, visual symptoms, epigastric pain, fever and fetal movement where appropriate.",
    "Each previous pregnancy: year, gestational age, outcome, mode/place of delivery, birth weight if known, maternal and neonatal complications.",
    "Previous caesarean section/uterine surgery: indication, number and operative details if available.",
    "Postpartum history, breastfeeding, contraception and emotional wellbeing."
  ], "Present gravidity/parity consistently with the school's or facility's convention. Do not label a pregnancy normal without supporting information."],
  ["Paediatric history", "For children, obtain caregiver history and involve the child in an age-appropriate way.", [
    "Informant and relationship; reliability and what the child can report.",
    "Antenatal: maternal illness/infection, medicines, antenatal care, pregnancy complications and exposures.",
    "Birth: gestational age, place/mode, birth weight, cry at birth, resuscitation and complications.",
    "Neonatal: jaundice, sepsis, convulsions, admission and feeding difficulty.",
    "Nutrition: breastfeeding/formula, complementary feeding, current diet, appetite and growth concerns.",
    "Development: gross/fine motor, language, hearing, vision, social milestones and regression.",
    "Immunisation card, previous illnesses/admissions, medicines, allergies, family/home/school context and safeguarding."
  ], "Use age-appropriate milestones and growth charts. Document measurements with dates and follow safeguarding policy where concerns arise."],
  ["Summarise and verify the history", "Demonstrate understanding and give the patient a chance to correct omissions.", [
    "Summarise chronology, key positives, relevant negatives and major risk factors.",
    "Ask whether you have understood correctly and whether anything important was missed.",
    "Clarify contradictions, uncertain dates, units and medication details.",
    "Explore the patient's main concern, ideas, expectations and impact on daily life where appropriate."
  ], "Separate patient-reported information from observed or verified findings. Keep the summary brief, chronological and clinically weighted."],
  ["Physical examination", "Perform a focused but sufficiently complete examination, guided by stability and the clinical question.", [
    "Explain the examination, obtain consent, offer a chaperone when appropriate, ensure privacy and use infection-prevention measures.",
    "Assess immediate stability first: ABCDE when indicated.",
    "Record vital signs with units and time: BP, pulse, respiratory rate, temperature, SpO₂, pain score and weight/height where relevant.",
    "General examination: appearance/distress, hydration, pallor, jaundice, cyanosis, clubbing, lymph nodes, oedema and relevant signs.",
    "Perform the relevant systemic examination in a recognised sequence; compare sides and document important negatives.",
    "Adapt for children and distressed patients. Intimate examinations require consent, chaperone and local safeguarding policy."
  ], "Record only findings personally examined or reliably verified. Distinguish 'not examined' from 'normal'; include units, laterality and meaningful negatives."],
  ["Clinical synthesis and problem list", "Connect history and examination without claiming more than the evidence supports.", [
    "Write a one- or two-sentence problem representation: age group, time course, syndrome and discriminating findings.",
    "List active problems in order of urgency and clinical importance.",
    "Prioritise differentials: most likely, important alternatives and must-not-miss diagnoses.",
    "For each differential, state supporting/opposing evidence and what further information may change your view."
  ], "Use calibrated wording such as 'most likely', 'possible' or 'cannot yet exclude'. A differential is not a confirmed diagnosis."],
  ["Investigations and clinical reasoning", "Choose tests that answer a clinical question and explain how results may change management.", [
    "Identify immediate bedside tests such as glucose, ECG, urinalysis or pregnancy testing when indicated.",
    "Select laboratory tests based on the differential and severity; avoid indiscriminate panels.",
    "Choose imaging/specialised tests only when clinically justified and available.",
    "Consider urgency, cost, access, preference and contraindications; follow local protocols.",
    "Record results with units, reference ranges where relevant, date and interpretation."
  ], "For each investigation, document why it is required and what action may follow an abnormal result. Never invent results."],
  ["Initial management, monitoring and escalation", "Prioritise immediate threats, begin appropriate care and arrange senior review.", [
    "Stabilise emergencies first using local ABCDE and emergency-response protocols.",
    "State immediate treatment, supportive care and medication details only within authorised scope; note important contraindications/monitoring.",
    "Plan observations, fluid balance, pain control, nutrition, infection prevention and reassessment as relevant.",
    "Identify who needs to be informed: senior clinician, specialty, multidisciplinary team or emergency service.",
    "Document shared decisions, consent/refusal, preferences and practical barriers."
  ], "A student plan must be reviewed by the supervising clinician. ClerkMe is an educational aid, not a prescribing system or substitute for clinical judgement."],
  ["Closure, documentation and handover", "Finish safely and leave a clear record another clinician can follow.", [
    "Explain findings and next steps in accessible language; invite questions.",
    "Document pending results, reviews, referrals, follow-up and who is responsible.",
    "Provide appropriate safety-netting: danger symptoms and where/how to seek urgent help.",
    "Use structured handover such as SBAR when transferring care.",
    "Date, time and sign the authorised clinical record according to facility policy."
  ], "Check completeness, chronology, spelling, units, laterality and internal consistency before saving. Do not place direct patient identifiers in ClerkMe."]
];

const specialty: [string, string][] = [
  ["Medicine", "Explore cardiovascular, respiratory, gastrointestinal, renal, endocrine, neurological, rheumatological, haematological and infectious symptoms. Include risk factors, disease control, complications and medication adherence."],
  ["Surgery and emergency", "Establish mechanism/timing of injury where relevant, previous operations, anaesthetic history, bleeding risk, anticoagulants, last oral intake and tetanus status. In trauma, perform the primary survey and life-saving interventions before a prolonged history."],
  ["Paediatrics", "Use the caregiver as informant while addressing the child appropriately. Include antenatal, birth, neonatal, feeding, nutrition, development, immunisation, growth, family environment and safeguarding."],
  ["Obstetrics and gynaecology", "Confirm pregnancy possibility and stability early. Include menstrual, obstetric, antenatal, intrapartum, postpartum, contraception and relevant sexual history. Ask intimate questions privately and with consent."],
  ["Psychiatry", "Cover mood, thought, perception, cognition, sleep, appetite, energy, risk to self/others, substance use, previous episodes, treatment/adherence, insight, collateral history and social support."]
];

export default function CompleteClerkingGuide() {
  return <section className="complete-clerking-guide">
    <div className="complete-guide-header"><div><span className="eyebrow">THE COMPLETE CLERKING FRAMEWORK</span><h2>From biodata to handover</h2><p>Work through this sequence. Adapt the depth and order to the patient's condition, specialty, urgency and local protocol.</p></div><span className="complete-guide-count">18 stages</span></div>
    <div className="complete-guide-note"><strong>Patient privacy:</strong> Use a non-identifying study reference only. Do not upload patient names, hospital numbers, addresses, telephone numbers, photographs or other direct identifiers. Use authorised hospital records for identifiable documentation.</div>
    <div className="clerking-stage-list">{sections.map((section, index) => <details className="clerking-stage" key={section[0]} open={index === 0}><summary><span className="clerking-stage-number">{String(index + 1).padStart(2, "0")}</span><span className="clerking-stage-title">{section[0]}</span><span className="clerking-stage-toggle">＋</span></summary><div className="clerking-stage-content"><p>{section[1]}</p><ul>{section[2].map((item, i) => <li key={i}>{item}</li>)}</ul><div className="clerking-writeup"><strong>How to document it</strong><p>{section[3]}</p></div></div></details>)}</div>
    <div className="specialty-notes"><h3>Specialty-specific additions</h3><p>Use alongside the universal sequence, not instead of it.</p><div className="specialty-note-grid">{specialty.map(item => <article key={item[0]}><strong>{item[0]}</strong><p>{item[1]}</p></article>)}</div></div>
    <div className="clerk-presentation-template"><strong>Suggested case presentation order</strong><p>Biodata and informant → presenting complaints → history of presenting complaint → relevant systems review → past history → drugs and allergies → family/social history → specialty-specific history → examination → problem list/differentials → investigations → management, monitoring and handover.</p></div>
  </section>;
}
