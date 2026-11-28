export type GuideSection = {
  title: string;
  purpose: string;
  questions: string[];
  document: string[];
  reasoning: string;
  redFlags: string[];
  pitfalls: string[];
};

export type UnitClerkingFramework = {
  title: string;
  overview: string;
  learningOutcomes: string[];
  unitSections: GuideSection[];
};

export const coreClerkingSections: GuideSection[] = [
  {
    title: "1. Preparation, introduction, consent and patient safety",
    purpose: "Establish a respectful, safe and clinically appropriate encounter before collecting information.",
    questions: [
      "Introduce yourself by name and role; confirm how the patient would like to be addressed.",
      "Explain the purpose and likely duration of the interview in language the patient understands.",
      "Ask permission to proceed. Check whether the patient is comfortable, in pain, breathless, distressed, hearing-impaired or needs an interpreter.",
      "Offer privacy and an appropriate chaperone for intimate examinations. Explain confidentiality and its limits where safeguarding or serious risk is involved.",
      "Establish whether the patient can provide a history. When necessary, identify a relative, carer, interpreter or health record as a collateral source."
    ],
    document: [
      "Date, time, clinical location and your role.",
      "Consent or any reason the interview could not proceed as planned.",
      "Source of information and whether the history appears reliable; explain any limitations.",
      "Any interpreter, communication aid or chaperone used."
    ],
    reasoning: "A reliable history depends on communication, consent, privacy and an accurate record of who supplied the information. The patient's immediate safety and comfort take priority over completing a form.",
    redFlags: ["Severe distress, altered consciousness or inability to protect the airway.", "Immediate risk of harm to the patient or another person.", "A communication barrier that could make consent or the history unreliable."],
    pitfalls: ["Do not assume consent because the patient is in hospital.", "Do not label a history unreliable without explaining why.", "Do not allow routine clerking to delay urgent assessment or escalation."]
  },
  {
    title: "2. Biodata and patient context",
    purpose: "Record enough contextual information to identify the study case safely and interpret the clinical history.",
    questions: [
      "Confirm the patient's age and the demographic details relevant to the assessment.",
      "Ask about occupation, usual residence and living circumstances when these affect exposure, function, access to care or discharge planning.",
      "Establish the referral route, date of presentation or admission, ward or service and the reason for transfer.",
      "Identify the informant: patient, parent, carer, relative, ambulance team, referral note or existing record.",
      "For educational notes, use an approved non-identifying case reference rather than patient names, hospital numbers, addresses or telephone numbers."
    ],
    document: [
      "Approved study reference, age, relevant sex or reproductive context, occupation and residence at an appropriate level of detail.",
      "Date/time of clerking, unit, referral source and admission/presentation context.",
      "Informant, relationship to the patient and reliability or limitations.",
      "Relevant demographic context without unnecessary identifying information."
    ],
    reasoning: "Age, occupation, residence, referral context and source of information change the pre-test probability of disease and the interpretation of findings. Data minimisation protects confidentiality.",
    redFlags: ["A vulnerable patient who has no reliable informant or support.", "A mismatch between the recorded history and the available referral or transfer information."],
    pitfalls: ["Do not store direct patient identifiers in an educational platform unless the system is explicitly approved for that purpose.", "Do not assume marital status, occupation or residence is clinically relevant in every case.", "Do not confuse the date of clerking with the date symptoms began."]
  },
  {
    title: "3. Presenting complaints",
    purpose: "Create a brief, prioritised list of the symptoms that led the patient to seek care.",
    questions: [
      "Ask: What brought you to hospital today? Allow the patient to answer without interruption.",
      "Clarify each principal symptom and how long it has been present.",
      "Ask which symptom is most troublesome and whether several symptoms began together or in sequence.",
      "Arrange complaints in chronological order, beginning with the earliest relevant symptom."
    ],
    document: [
      "Each complaint as a concise symptom statement with its duration.",
      "Chronological order and the principal reason for presentation.",
      "Avoid inserting a diagnosis into the presenting-complaint list."
    ],
    reasoning: "A clear complaint list provides the map for the history of the presenting complaint and prevents premature diagnostic labelling.",
    redFlags: ["Symptoms suggesting immediate airway, breathing or circulatory compromise.", "Sudden neurological deficit, severe bleeding, collapse or rapidly progressive symptoms."],
    pitfalls: ["Do not write a diagnosis such as 'malaria' as a presenting complaint unless it is a previously established diagnosis being reported.", "Do not omit duration.", "Do not list every minor chronic symptom as if it caused the current presentation."]
  },
  {
    title: "4. History of the presenting complaint",
    purpose: "Build a chronological, patient-centred account of the current illness and its evolution.",
    questions: [
      "Onset: When did it start? Was it sudden or gradual? What was happening at the time?",
      "Chronology: What happened first, next and most recently? Has the problem progressed, fluctuated, recurred or resolved?",
      "Character and severity: Ask the patient to describe the symptom in their own words; use a suitable severity scale where helpful.",
      "Site and radiation: Ask the patient to point to the location and describe any spread or migration.",
      "Duration and pattern: Is it constant, intermittent, episodic, positional, exertional, meal-related or linked to a particular time?",
      "Aggravating and relieving factors: Explore movement, exertion, meals, posture, breathing, medication, rest and other symptom-specific triggers.",
      "Associated symptoms: Ask about relevant accompanying symptoms and important negatives, not an indiscriminate checklist.",
      "Previous episodes and treatment: Has this happened before? What has the patient tried, and what was the response?",
      "Impact: Explore sleep, mobility, work, feeding, school, activities of daily living and the patient's main concern."
    ],
    document: [
      "A connected chronological narrative with exact timings or dates when clinically important.",
      "Positive symptoms and relevant negatives that were actually asked about.",
      "Treatments already taken, dose if known, response and adverse effects.",
      "Functional impact and the patient's perspective."
    ],
    reasoning: "The time course and symptom pattern often distinguish acute emergencies from chronic or recurrent disease. A good narrative preserves the patient's account while organising it for clinical reasoning.",
    redFlags: ["Thunderclap or rapidly maximal headache; sudden severe chest, abdominal or back pain.", "Syncope, haemoptysis, major bleeding, peritonism, new focal neurological deficit or acute visual loss.", "Pregnancy-associated pain or bleeding, severe breathlessness, confusion or shock features."],
    pitfalls: ["Do not use SOCRATES as a substitute for clinical judgement; adapt it to the symptom.", "Do not document a negative symptom unless it was elicited.", "Do not turn an uncertain time into a precise time.", "Do not omit treatment already taken or the response."]
  },
  {
    title: "5. Focused red-flag and severity screen",
    purpose: "Recognise time-critical illness early and decide whether the routine history should pause for stabilisation or escalation.",
    questions: [
      "Ask about severe breathlessness, chest pain, collapse, confusion, seizure, severe weakness or rapidly worsening symptoms.",
      "Ask about major bleeding, black stools, vomiting blood, severe dehydration, inability to drink or markedly reduced urine output.",
      "Explore fever with rigors, neck stiffness, non-blanching rash, severe pain or altered mental state.",
      "Where relevant, ask about pregnancy possibility, postpartum state, anticoagulant use, immunosuppression, recent surgery and major trauma."
    ],
    document: [
      "Specific danger symptoms present or absent after direct questioning.",
      "Vital signs, immediate assessment, escalation and interventions undertaken.",
      "Who was informed and when, where this is relevant to the record."
    ],
    reasoning: "The purpose is not to complete a long checklist; it is to identify instability and immediately actionable threats. An unstable patient requires assessment and treatment before a full clerking.",
    redFlags: ["Airway compromise, respiratory failure, shock, severe haemorrhage, sepsis, status epilepticus or rapidly evolving neurological signs."],
    pitfalls: ["Do not delay escalation to finish the history.", "Do not interpret a single reassuring observation as proof that a patient is stable.", "Do not rely on a normal early examination when the history suggests evolving pathology."]
  },
  {
    title: "6. Past medical, surgical and relevant treatment history",
    purpose: "Identify pre-existing disease, previous episodes and interventions that alter the current assessment.",
    questions: [
      "Ask about chronic conditions, previous similar episodes, previous diagnoses and how they were established.",
      "Explore hospital admissions, emergency visits, operations, procedures, transfusions and complications.",
      "Ask about relevant infections, immunisations, pregnancy history or psychiatric history when appropriate to the unit.",
      "Ask about devices, implants, dialysis access, stomas, prostheses or previous injuries where relevant."
    ],
    document: [
      "Condition or procedure, approximate date, current status and complications.",
      "Previous investigations or diagnoses only where known or verified.",
      "Relevant admissions, operations, transfusions and devices."
    ],
    reasoning: "Past disease changes differential diagnoses, medication risk, operative risk and the interpretation of current symptoms.",
    redFlags: ["Recent surgery, recent hospitalisation, immunosuppression, implanted devices or previous severe adverse events relevant to the presentation."],
    pitfalls: ["Do not assume a condition is inactive because the patient is not taking medication.", "Do not infer an operation from a scar without asking.", "Do not record undocumented history as 'nil'."]
  },
  {
    title: "7. Medication, allergy and substance exposure history",
    purpose: "Identify treatment effects, interactions, adherence issues and preventable harm.",
    questions: [
      "Ask the patient to list prescribed medicines, including recently started, stopped or changed drugs.",
      "For each important medicine, confirm dose, route, frequency, duration, indication and adherence where possible.",
      "Ask about over-the-counter medicines, traditional or herbal preparations, supplements and recreational substances.",
      "Ask specifically about allergies and adverse drug reactions: the agent, reaction, timing and severity.",
      "Check anticoagulants, antiplatelets, insulin, steroids, immunosuppressants, contraceptives and other high-impact medicines when relevant."
    ],
    document: [
      "Medication name, dose, route and frequency where known; note uncertainty.",
      "Adherence, recent changes, response and suspected adverse effects.",
      "Allergy status and the actual reaction; distinguish allergy from intolerance.",
      "Relevant tobacco, alcohol and other substance exposure in a non-judgemental manner."
    ],
    reasoning: "Medication effects can mimic disease, worsen symptoms, alter investigations and change emergency or operative decisions. A precise allergy history reduces avoidable harm.",
    redFlags: ["Possible overdose, severe allergic reaction, anticoagulant-associated bleeding, insulin-related hypoglycaemia or withdrawal risk."],
    pitfalls: ["Do not write 'no known allergies' if allergy status has not been checked.", "Do not assume herbal products are harmless.", "Do not record a medicine without verifying the dose when the dose affects safety."]
  },
  {
    title: "8. Family history",
    purpose: "Identify inherited, familial and shared environmental risks relevant to the presentation.",
    questions: [
      "Ask about illnesses in first-degree relatives and other relatives where a familial pattern is suspected.",
      "Clarify the relative, diagnosis, age at onset and age or cause of death where known.",
      "Explore premature cardiovascular disease, diabetes, cancers, sudden death, neurological disease, inherited blood disorders and psychiatric illness when relevant.",
      "For paediatric or genetic presentations, ask about consanguinity and similar illness in siblings where appropriate and sensitively."
    ],
    document: [
      "Relevant relative and relationship to the patient.",
      "Condition, age at onset and whether the diagnosis is confirmed or reported.",
      "A simple pedigree or family pattern when it changes assessment."
    ],
    reasoning: "A family history can reveal inherited risk, shared exposure or the need for screening, counselling or specialist assessment.",
    redFlags: ["Strong family history of premature sudden death, inherited cardiac disease, early-onset malignancy or known familial genetic disorder."],
    pitfalls: ["Do not assume a relative's reported diagnosis is confirmed.", "Do not collect extensive family details unrelated to the clinical question.", "Do not use stigmatising language."]
  },
  {
    title: "9. Personal, social, occupational and functional history",
    purpose: "Understand the context in which illness occurs and the support needed for safe care and recovery.",
    questions: [
      "Ask about occupation, workplace exposures, housing, household composition and usual support.",
      "Explore diet, physical activity, sleep, smoking, alcohol and other substance use where relevant.",
      "Ask about travel, animal contact, food/water exposure, sexual health or occupational risks where indicated.",
      "Establish baseline mobility, activities of daily living, exercise tolerance, falls, assistive devices and current functional change.",
      "Ask about financial, transport, caregiving or access barriers when they affect adherence or discharge."
    ],
    document: [
      "Relevant exposures and lifestyle factors without judgement.",
      "Baseline and current function, mobility aids and support needs.",
      "Living situation, caregiver availability and barriers to care when relevant."
    ],
    reasoning: "Social context changes exposure risk, prevention, adherence, rehabilitation, safeguarding and discharge planning.",
    redFlags: ["Unsafe home circumstances, neglect, exploitation, domestic violence, severe substance-related risk or inability to meet basic needs."],
    pitfalls: ["Do not ask sensitive questions without explaining relevance and ensuring privacy.", "Do not equate occupation with exposure without asking about actual tasks.", "Do not overlook functional decline."]
  },
  {
    title: "10. Systematic review of systems",
    purpose: "Check for additional symptoms that may support, challenge or broaden the working differential.",
    questions: [
      "General: fever, weight change, appetite, fatigue, night sweats and sleep.",
      "Cardiovascular: chest discomfort, palpitations, syncope, orthopnoea, paroxysmal nocturnal dyspnoea and oedema.",
      "Respiratory: cough, sputum, haemoptysis, wheeze, pleuritic pain and breathlessness.",
      "Gastrointestinal: dysphagia, reflux, nausea, vomiting, abdominal pain, bowel habit, blood in stool and jaundice.",
      "Genitourinary: dysuria, frequency, urgency, haematuria, urine output and relevant reproductive symptoms.",
      "Neurological: headache, weakness, sensory change, speech or visual disturbance, balance, seizures and consciousness.",
      "Musculoskeletal, skin, endocrine, haematological and psychiatric symptoms guided by the case."
    ],
    document: [
      "Relevant positives and negatives by system.",
      "Clearly state if a system was not reviewed or could not be assessed.",
      "Avoid copying a normal-system template when the questions were not asked."
    ],
    reasoning: "A systematic review can identify multisystem disease, complications and symptoms outside the patient's initial description. It should be focused enough to remain useful.",
    redFlags: ["New focal neurological deficit, severe chest symptoms, haemoptysis, gastrointestinal bleeding, acute urinary retention or rapidly progressive systemic symptoms."],
    pitfalls: ["Do not repeat the whole HPC verbatim.", "Do not record 'all systems normal' without a genuine review.", "Do not let a lengthy review delay emergency care."]
  },
  {
    title: "11. Physical examination",
    purpose: "Use a structured, consent-based examination to seek and document objective findings.",
    questions: [
      "Explain each component and obtain consent; expose only the area required and preserve dignity.",
      "Start with general appearance, mental state, hydration, perfusion, respiratory effort and vital signs.",
      "Perform the relevant system examination using inspection, palpation, percussion and auscultation as appropriate.",
      "Compare sides where relevant, examine adjacent systems and look for complications or alternative diagnoses.",
      "Use a chaperone for intimate examinations and document limitations or declined components."
    ],
    document: [
      "Vital signs with units, time and oxygen/therapy context where relevant.",
      "Positive findings, important negatives and the exact site or distribution.",
      "Examination components not performed, declined or limited and the reason.",
      "Relevant measurements, scores or charts using the correct age- or unit-specific reference."
    ],
    reasoning: "The examination should answer questions raised by the history and assess severity. Findings need to be reproducible, specific and separated from the patient's reported symptoms.",
    redFlags: ["Abnormal vital signs, poor perfusion, severe respiratory distress, peritonism, meningism, acute neurovascular compromise or a rapidly deteriorating examination."],
    pitfalls: ["Do not document a finding that was not examined.", "Do not use vague phrases such as 'systemic examination normal' when detail is required.", "Do not omit the time or context of observations."]
  },
  {
    title: "12. Clinical summary and problem representation",
    purpose: "Condense the case into a clear, clinically meaningful statement before generating diagnoses.",
    questions: [
      "What are the most important demographic and risk features?",
      "What is the principal syndrome, its time course and the most discriminating positive and negative findings?",
      "What makes the patient acutely unwell or changes the urgency?",
      "What is still unknown and needs clarification?"
    ],
    document: [
      "A concise summary linking age/context, time course, key symptoms, relevant history and examination findings.",
      "A separate list of active problems, prioritised by severity and clinical importance.",
      "Missing information that could materially change the differential."
    ],
    reasoning: "A concise problem representation helps prevent anchoring and provides a shared picture for discussion with the clinical team.",
    redFlags: ["An unstable problem or significant missing fact that requires immediate escalation rather than further routine documentation."],
    pitfalls: ["Do not introduce unsupported diagnoses into the summary.", "Do not copy the entire history into the summary.", "Do not bury the most urgent problem among minor chronic conditions."]
  },
  {
    title: "13. Differential diagnosis and clinical reasoning",
    purpose: "Generate and prioritise plausible explanations using evidence from the history and examination.",
    questions: [
      "What is the most likely diagnosis and what findings support it?",
      "Which serious diagnoses must not be missed, even if they are less likely?",
      "What findings argue against each candidate diagnosis?",
      "What additional question, examination finding or test would best discriminate between the alternatives?"
    ],
    document: [
      "A prioritised differential, not an unranked exhaustive list.",
      "Supporting and opposing evidence for important diagnoses.",
      "Uncertainty, alternative explanations and the reason for escalation or specialist input."
    ],
    reasoning: "Clinical reasoning should be transparent and revisable. The goal is not to guess one diagnosis but to manage uncertainty safely.",
    redFlags: ["A potentially life-threatening diagnosis remains plausible or a patient is deteriorating despite an initially reassuring assessment."],
    pitfalls: ["Avoid premature closure and confirmation bias.", "Do not force a diagnosis when evidence is insufficient.", "Do not use a differential as a substitute for a management plan."]
  },
  {
    title: "14. Investigations and interpretation",
    purpose: "Select investigations that answer a clinical question and interpret results in context.",
    questions: [
      "What question is each proposed test intended to answer?",
      "Is a bedside test needed immediately? Are there time-critical tests?",
      "What result is expected if the leading diagnosis is correct, and what alternative result would change the plan?",
      "Are there patient-specific considerations such as pregnancy, renal function, allergy, age or prior results?"
    ],
    document: [
      "Investigation requested, indication and urgency.",
      "Relevant results with units, reference intervals where appropriate and date/time.",
      "Interpretation and how the result changes the differential or management.",
      "Pending results and who is responsible for review."
    ],
    reasoning: "Testing should be hypothesis-led and proportionate. A result without context can be misleading, and pending results need clear ownership.",
    redFlags: ["Time-critical abnormal results, unexpected deterioration or a result requiring immediate escalation."],
    pitfalls: ["Do not order tests without a clinical question.", "Do not interpret a value without units or relevant context.", "Do not assume a test has been reviewed simply because it was requested."]
  },
  {
    title: "15. Initial management, escalation and shared plan",
    purpose: "Translate the assessment into a safe, prioritised plan with review and escalation built in.",
    questions: [
      "Does the patient need immediate stabilisation, senior review, transfer or specialist input?",
      "What is required now, what can wait and what must be avoided?",
      "What treatment, monitoring, supportive care, prevention and patient education are appropriate under local protocol?",
      "What should trigger reassessment, escalation or a change in plan?",
      "What does the patient understand, prefer or need help with?"
    ],
    document: [
      "Immediate actions, escalation, referrals and responsible clinician or team.",
      "Treatment and supportive care with indication; detailed prescriptions should follow local prescribing policy.",
      "Monitoring, reassessment interval, response and safety-netting.",
      "Patient or caregiver discussion, consent, preferences and follow-up."
    ],
    reasoning: "Management is a dynamic process. A clear plan identifies priorities, responsibility, reassessment and what to do if the patient worsens.",
    redFlags: ["Failure to respond to initial treatment, worsening observations, new organ dysfunction or inability to provide safe care in the current setting."],
    pitfalls: ["Do not use generic treatment text instead of an individualised plan.", "Do not delay escalation while waiting for routine investigations.", "Do not leave a pending result or referral without an assigned reviewer."]
  },
  {
    title: "16. Progress notes, handover and final case presentation",
    purpose: "Communicate the patient's course, current risks and next steps so that care remains continuous.",
    questions: [
      "What has changed since the last review? What treatment was given and what was the response?",
      "What remains unresolved, pending or unsafe?",
      "What does the next clinician need to know immediately?",
      "Can you present the case clearly in a structured format and defend the reasoning?"
    ],
    document: [
      "Time-stamped progress notes with new symptoms, observations, examination changes and response to treatment.",
      "A structured handover including current status, key risks, actions completed, pending tasks and escalation triggers.",
      "A concise oral case presentation: identification/context, presenting complaints, HPC, relevant background, examination, summary, differential, investigations and plan."
    ],
    reasoning: "Good documentation is not complete until another clinician can understand what happened, what matters now and what must happen next.",
    redFlags: ["A deteriorating patient, unresolved critical result, missed treatment, unclear responsibility or unsafe transfer/discharge plan."],
    pitfalls: ["Do not copy forward outdated findings.", "Do not hand over vague tasks without a responsible person or timeframe.", "Do not omit uncertainty, pending investigations or escalation criteria."]
  }
];

const section = (
  title: string,
  purpose: string,
  questions: string[],
  document: string[],
  reasoning: string,
  redFlags: string[] = [],
  pitfalls: string[] = []
): GuideSection => ({ title, purpose, questions, document, reasoning, redFlags, pitfalls });

export { unitClerkingFrameworks } from "./unit-clerking-frameworks";
