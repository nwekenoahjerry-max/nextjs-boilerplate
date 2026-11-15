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

export const unitClerkingFrameworks: Record<string, UnitClerkingFramework> = {
  "general-medicine": {
    title: "General Medicine",
    overview: "A comprehensive medical clerking should establish the dominant symptom, identify multisystem disease, assess comorbidity and function, and distinguish acute illness from chronic disease and treatment complications.",
    learningOutcomes: ["Take a chronological, symptom-led medical history.", "Review cardiovascular, respiratory, gastrointestinal, renal, neurological, endocrine, infectious and haematological symptoms systematically.", "Assess chronic disease control, complications, medicines, function and frailty.", "Present a coherent problem list and evidence-based differential."],
    unitSections: [
      section("Cardiovascular history and focused assessment", "Explore cardiac symptoms, vascular risk and evidence of congestion or poor perfusion.", ["Chest pain: exertional or at rest, site, radiation, duration, character, associated sweating, nausea or breathlessness.", "Breathlessness: exertional capacity, orthopnoea, number of pillows, paroxysmal nocturnal dyspnoea and nocturnal cough.", "Palpitations: onset, duration, regularity, triggers, associated dizziness, syncope or chest pain.", "Peripheral symptoms: ankle swelling, calf pain, claudication, transient neurological symptoms and exercise limitation.", "Risk and background: hypertension, diabetes, dyslipidaemia, smoking, renal disease, rheumatic fever, previous cardiac disease and family history of premature cardiovascular disease."], ["Functional capacity and symptom progression.", "Cardiovascular risk factors and previous cardiac events or procedures.", "Medication adherence and adverse effects, including antihypertensives, diuretics and anticoagulants."], "The relationship to exertion, posture and time of day helps distinguish ischaemia, heart failure, arrhythmia and other causes. Assess haemodynamic stability before detailed history.", ["Chest pain with collapse, severe breathlessness, syncope, new neurological deficit or signs of shock."], ["Do not label all chest pain as cardiac or assume ankle swelling is heart failure.", "Do not omit orthopnoea, PND, syncope or exercise tolerance."]),
      section("Respiratory history", "Characterise respiratory symptoms, exposure and chronic airway disease.", ["Cough: duration, dry/productive, sputum volume, colour, odour and haemoptysis.", "Breathlessness: onset, progression, rest/exertional, wheeze, nocturnal symptoms and exercise limitation.", "Chest pain: pleuritic or pressure-like; ask about fever, weight loss and night sweats.", "Exposure: smoking, biomass fuel, occupational dust, TB contact, travel, sick contacts and previous respiratory admissions.", "Background: asthma, COPD, bronchiectasis, TB, pneumonia, malignancy, inhaler use and oxygen therapy."], ["Smoking pack-years where appropriate, occupational and household exposure.", "Inhaler technique/adherence, prior exacerbations, admissions and baseline exercise capacity.", "Sputum and haemoptysis details."], "Chronic respiratory disease requires a baseline comparison. TB and malignancy risk should be explored when symptoms are persistent or accompanied by systemic features.", ["Severe work of breathing, cyanosis, haemoptysis, hypoxia, altered consciousness or inability to speak in sentences."], ["Do not document only 'cough'; establish sputum and duration.", "Do not overlook TB, occupational exposure or medication-related cough."]),
      section("Gastrointestinal and hepatobiliary history", "Identify the likely gastrointestinal segment and screen for bleeding, obstruction, inflammation and hepatobiliary disease.", ["Dysphagia, odynophagia, reflux, early satiety, nausea, vomiting and relation to meals.", "Abdominal pain: site, migration, radiation, character, severity and peritoneal features.", "Bowel habit: constipation, diarrhoea, stool calibre, steatorrhoea, melaena, fresh blood and last passage of stool/flatus.", "Jaundice: dark urine, pale stool, pruritus, fever/rigors, weight loss and abdominal swelling.", "Risk factors: alcohol, viral hepatitis exposure, travel, food/water, NSAIDs, previous endoscopy, abdominal surgery and family history of GI cancer."], ["Bleeding symptoms and haemodynamic symptoms.", "Weight trend, nutritional intake, bowel pattern and medication exposures.", "Previous liver/pancreatic disease and relevant investigations."], "The combination of stool changes, pain, jaundice, systemic symptoms and exposures helps distinguish luminal, inflammatory, hepatic and pancreatic disease.", ["Haematemesis, melaena with collapse, peritonism, persistent vomiting, obstructive jaundice with fever or severe dehydration."], ["Do not omit weight loss, bleeding, dysphagia or medication exposure.", "Do not call jaundice a diagnosis without exploring the pattern."]),
      section("Renal, urinary and fluid-balance history", "Assess urinary symptoms, renal risk, volume status and complications of kidney disease.", ["Urine output, frequency, urgency, dysuria, haematuria, frothy urine, nocturia and retention symptoms.", "Loin pain, renal colic, fever, rigors, oedema, breathlessness and weight change.", "Ask about diabetes, hypertension, kidney stones, recurrent UTI, prostate disease, autoimmune disease and family renal disease.", "Review NSAIDs, contrast exposure, traditional medicines, diuretics and other nephrotoxic medicines.", "Ask about dialysis, transplant, access problems and recent changes in fluid intake or losses."], ["Baseline and current urine output where known.", "Fluid losses/intake, oedema, medication and nephrotoxin exposure.", "Dialysis schedule, access and transplant history if relevant."], "Acute change from baseline, volume status, urine output and medication exposures are central to renal assessment.", ["Anuria/marked oliguria, pulmonary oedema, suspected obstructed infected kidney, severe electrolyte symptoms or uraemic confusion."], ["Do not assume normal urine output because the patient has not volunteered a complaint.", "Do not omit medicines and fluid balance."]),
      section("Neurological history", "Localise the neurological problem, establish onset and screen for time-critical causes.", ["Weakness: sudden or gradual, face/arm/leg distribution, side, progression and functional effect.", "Speech, vision, balance, swallowing, sensation, coordination, memory and behaviour changes.", "Headache: onset, time to peak, pattern, fever, neck stiffness, visual symptoms, vomiting and focal deficit.", "Seizure: witness account, onset, duration, movements, awareness, tongue bite, incontinence, recovery and triggers.", "Background: stroke/TIA, epilepsy, migraine, head injury, anticoagulants, infection, alcohol or substance exposure."], ["Exact onset/last-known-well time for acute focal deficit.", "Witness account and recovery pattern for seizures or collapse.", "Baseline function, cognition and relevant medication."], "Time of onset and localisation influence urgent pathways. Collateral history is often essential when consciousness, memory or communication is impaired.", ["New focal deficit, thunderclap headache, status epilepticus, meningism, reduced consciousness or rapidly progressive weakness."], ["Do not estimate onset when an exact last-known-well time can be obtained.", "Do not label transient loss of consciousness as seizure without considering alternatives."]),
      section("Endocrine, metabolic and haematological review", "Look for metabolic symptoms, complications and systemic features.", ["Diabetes: thirst, polyuria, weight change, hypoglycaemia, foot symptoms, visual change and treatment/adherence.", "Thyroid: heat/cold intolerance, weight change, tremor, bowel change, neck swelling, palpitations and eye symptoms.", "Adrenal/calcium symptoms where relevant: postural dizziness, pigmentation, weakness, stones, bone pain or confusion.", "Anaemia/haematology: fatigue, pallor, bruising, bleeding, infections, bone pain, lymph node swelling and constitutional symptoms.", "Ask about transfusion, nutritional deficiency, chronic blood loss and family history of blood disorders."], ["Disease duration, treatment and control; complications and screening.", "Bleeding, thrombotic, infective and constitutional symptoms.", "Relevant laboratory trends or previous specialist care where known."], "Endocrine and haematological disease often presents with nonspecific multisystem symptoms; the targeted review should follow the patient's dominant complaint.", ["Severe hypoglycaemic symptoms, diabetic emergency features, major bleeding, neutropenic sepsis concern or symptomatic severe anaemia."], ["Do not document diabetes as controlled without evidence.", "Do not omit treatment adherence or hypoglycaemia history."]),
      section("Comorbidity, function and frailty review", "Understand the total burden of disease and the patient's baseline before the acute illness.", ["Ask about mobility, falls, walking distance, aids, self-care, continence, nutrition, cognition and social support.", "Review previous admissions, medication burden, adverse effects and treatment priorities.", "Ask what the patient could do independently before this illness and what has changed.", "Explore advance care planning or treatment preferences sensitively where clinically appropriate."], ["Baseline versus current activities of daily living.", "Falls, mobility aids, caregiver support and nutritional risk.", "Relevant patient goals and barriers to care."], "A medical plan must fit the patient's baseline function, comorbidities and support system, not only the presenting diagnosis.", ["Acute functional collapse, delirium, recurrent falls, inability to take essential medication or no safe discharge support."], ["Do not assume independence from age or appearance.", "Do not mistake chronic baseline limitation for a new acute deficit."])
    ]
  },
  surgery: {
    title: "Surgery",
    overview: "Surgical clerking must identify time-critical abdominal, traumatic and vascular pathology, establish the likely operative problem, assess physiological reserve and document peri-operative risks. Stabilisation takes priority over a complete history in an unwell patient.",
    learningOutcomes: ["Characterise acute surgical symptoms and identify peritonitis, obstruction, bleeding and sepsis.", "Take a relevant previous-operation, anaesthetic and peri-operative history.", "Perform and document a focused surgical examination.", "Assess comorbidity, medicines, anticoagulants, functional status and operative risk."],
    unitSections: [
      section("Acute abdominal and gastrointestinal surgical history", "Use a site- and pathology-directed history while screening for surgical emergencies.", ["Pain: site, migration, sudden/gradual onset, colicky/constant, radiation, severity, movement-related pain and progression.", "Vomiting: timing, frequency, bilious/feculent/bloody content and ability to tolerate fluids.", "Bowel function: last stool and flatus, distension, constipation, diarrhoea, melaena and rectal bleeding.", "Associated features: fever, anorexia, jaundice, urinary symptoms and pregnancy possibility.", "Past episodes, gallstones, ulcers, hernias, inflammatory bowel disease, malignancy and previous abdominal surgery."], ["Onset and progression, last stool/flatus, vomiting content and bleeding.", "Previous abdominal operations and hernias.", "Pregnancy possibility and relevant pelvic/urinary symptoms."], "Pain migration, obstruction symptoms, peritoneal features and operative history shape urgency and likely pathology.", ["Rigid abdomen, peritonism, shock, persistent vomiting, GI bleeding, strangulated hernia or suspected perforation."], ["Do not omit last flatus/stool, previous surgery or hernia history.", "Do not delay analgesia or resuscitation while completing a long history."]),
      section("Surgical, anaesthetic and peri-operative history", "Identify previous procedures, complications and risks that change the peri-operative plan.", ["What operations or procedures has the patient had, when and for what indication?", "Any anaesthetic complications, difficult airway, severe nausea, malignant hyperthermia history or unexpected ICU admission?", "Any wound infection, bleeding, thromboembolism, transfusion or poor healing?", "Current anticoagulants, antiplatelets, steroids, diabetes treatment, allergies and last oral intake?", "Previous surgical review, imaging, endoscopy, biopsy or relevant histology?"], ["Operation and approximate date, indication and complications.", "Anaesthetic history, transfusions, thromboembolism and wound problems.", "Medication, allergy, fasting and functional risk factors."], "Prior operations can alter anatomy and increase the risk of adhesions, difficult access, anaesthetic complications and postoperative morbidity.", ["Recent anticoagulant use with bleeding, severe anaesthetic reaction history or major cardiopulmonary instability."], ["Do not write 'fit for surgery' from a brief history alone.", "Do not assume the patient knows the name of an operation; clarify or verify records."]),
      section("Hernia, breast, urology and peripheral vascular symptoms", "Explore common surgical presentations using anatomy-specific symptom questions.", ["Hernia: site, duration, reducibility, pain, cough impulse history, change in size, vomiting and bowel obstruction symptoms.", "Breast: lump duration and progression, pain, nipple discharge/retraction, skin change, axillary lump and family history.", "Urology: lower urinary tract symptoms, haematuria, retention, loin pain, infection and sexual/reproductive context where relevant.", "Vascular: claudication distance, rest pain, ulcers, colour/temperature change, acute pain, numbness and weakness.", "Ask about previous imaging, biopsies, vascular procedures and relevant risk factors."], ["Exact site, duration, growth, associated skin/nipple or urinary symptoms.", "Limb perfusion symptoms and functional limitation.", "Previous procedures and family history where relevant."], "The pattern and progression of symptoms help identify urgent obstruction, malignancy, infection or limb-threatening ischaemia.", ["Irreducible painful hernia, acute limb ischaemia, rapidly progressive breast changes with systemic illness or clot retention."], ["Do not assume a painless lump is benign.", "Do not omit neurovascular symptoms in limb complaints."]),
      section("Trauma and mechanism of injury", "Establish mechanism and energy transfer while following the trauma primary survey.", ["What happened, at what time and where? Establish mechanism, speed/height, direction and energy involved.", "Was there a fall, collision, penetrating injury, crush, blast or burn?", "Seat belt, helmet, protective equipment, ejection, entrapment, loss of consciousness and extrication?", "Any bleeding, pain, breathlessness, abdominal symptoms, weakness or numbness?", "Pre-hospital observations, interventions, analgesia, fluids and transfer timeline?"], ["Mechanism, time, protective devices and associated injuries.", "Loss of consciousness, anticoagulants and last-known-well where relevant.", "Pre-hospital treatment and response."], "Mechanism helps anticipate occult injuries, but it never replaces the primary survey and repeated examination.", ["Airway or breathing compromise, uncontrolled haemorrhage, shock, reduced consciousness, spinal symptoms or neurovascular deficit."], ["Do not perform a detailed secondary history before treating immediate threats.", "Do not assume absence of pain excludes serious injury."]),
      section("Pre-operative risk, nutrition and recovery planning", "Assess physiological reserve and factors that affect anaesthesia, wound healing and rehabilitation.", ["Exercise tolerance, cardiopulmonary disease, diabetes, renal/liver disease and frailty.", "Weight loss, poor intake, swallowing difficulty, anaemia and nutritional risk.", "Smoking, alcohol, substance use, sleep apnoea and thromboembolic history.", "Baseline mobility, home support, work, caregiving and expected rehabilitation needs.", "Patient understanding, preferences, consent concerns and potential need for blood products or critical care discussion."], ["Relevant comorbidities, functional capacity and frailty.", "Nutrition, smoking, alcohol, VTE history and medication risks.", "Baseline mobility and anticipated discharge support."], "Operative risk is influenced by the interaction of surgical urgency, physiological reserve, comorbidity and the likely postoperative environment.", ["Unoptimised severe comorbidity, sepsis, severe malnutrition, unstable cardiopulmonary status or high-risk anticoagulation."], ["Do not use a risk score as a substitute for clinical assessment.", "Do not assume postoperative support will be available without checking."])
    ]
  },
  paediatrics: {
    title: "Paediatrics",
    overview: "Paediatric clerking is age-sensitive and family-centred. The history must cover pregnancy, birth, neonatal course, feeding, growth, development, immunisation and safeguarding in addition to the presenting illness. The child's age, communication ability and physiological reserve shape the approach.",
    learningOutcomes: ["Adapt the history to the child's developmental stage and involve the caregiver appropriately.", "Take a detailed antenatal, birth and neonatal history.", "Assess feeding, growth, development and immunisation.", "Recognise paediatric danger signs and safeguarding concerns."],
    unitSections: [
      section("Paediatric identification and source of history", "Clarify the child's age and developmental context and establish who is providing the history.", ["Confirm age in completed years/months and, for young infants, days or weeks.", "Who brought the child? What is the relationship to the child and how much time do they spend caring for the child?", "Is the child able to describe symptoms? What does the caregiver observe?", "Are there differences between the accounts of caregivers, the child and referral records?", "Ask about the child's usual behaviour, feeding, play, sleep and activity."], ["Age precisely, caregiver/informant and reliability.", "Usual baseline behaviour and function.", "Any interpreter, communication or developmental limitations."], "Symptoms and normal observations vary substantially with age. Caregiver observations and the child's developmental level must be considered together.", ["Lethargy, poor interaction, inability to feed, respiratory distress, reduced urine output, seizures or signs of shock."], ["Do not use adult symptom assumptions for an infant.", "Do not dismiss caregiver concern when the child is not yet able to communicate."]),
      section("Antenatal, pregnancy and maternal history", "Identify prenatal exposures and pregnancy complications that may affect the child's health.", ["Maternal age and relevant medical conditions during pregnancy.", "Antenatal care, infections, fever, hypertension, diabetes, bleeding and medication exposure.", "Maternal nutrition, smoking, alcohol or other substance exposure where relevant.", "Antenatal scans and known fetal concerns.", "Relevant obstetric history, previous pregnancy outcomes and family history."], ["Maternal illnesses, infections, medications and exposures.", "Pregnancy complications and antenatal findings.", "Gestational age estimate and relevant birth planning."], "Pregnancy history may explain prematurity, congenital conditions, growth restriction, neonatal complications and infection risk.", ["Known congenital anomaly, significant maternal infection, severe growth restriction or complications requiring neonatal care."], ["Do not infer an uncomplicated pregnancy from absence of information.", "Ask sensitively and avoid blame."]),
      section("Birth, delivery and neonatal history", "Establish gestational age, delivery circumstances and the newborn's transition and early course.", ["Gestational age at birth and how it was determined, if known.", "Mode and place of delivery; spontaneous or assisted; indication for operative delivery.", "Birth weight, need for resuscitation, breathing support or neonatal intensive care.", "Timing of first feed, jaundice, infection, seizures, congenital concerns and length of stay.", "Any neonatal admissions, phototherapy, oxygen, procedures or feeding difficulties."], ["Gestational age, birth weight and delivery mode.", "Resuscitation, Apgar scores if reliably known, neonatal complications and admissions.", "Early feeding, jaundice, infection and discharge context."], "Prematurity and neonatal complications influence development, respiratory risk, feeding, growth and future vulnerability.", ["History of neonatal seizures, severe jaundice, prolonged respiratory support, suspected sepsis or major congenital condition."], ["Do not invent Apgar scores or birth weight.", "Do not use 'normal delivery' without clarifying the mode and complications."]),
      section("Nutrition, feeding, growth and development", "Assess nutritional intake, growth trajectory and achievement of age-appropriate milestones.", ["Breastfeeding or formula: initiation, frequency, duration, technique, preparation and difficulties.", "Complementary feeding: age started, food types, frequency, diversity, hygiene and feeding responsiveness.", "Appetite, vomiting, swallowing, stool pattern, dietary restrictions and food insecurity.", "Growth: previous weights/lengths, growth chart trajectory and caregiver concern.", "Development: gross motor, fine motor, language/hearing, vision, social interaction and regression; ask about milestones and loss of skills."], ["Feeding method and pattern, dietary diversity and relevant difficulties.", "Growth measurements and trajectory, not just one value.", "Milestones achieved, delays, regression and support or therapy."], "Growth and developmental trajectories can reveal chronic illness, malnutrition, neurodevelopmental conditions and social barriers.", ["Weight loss/failure to thrive, dehydration, choking/aspiration, developmental regression or loss of previously acquired skills."], ["Do not judge development by a single milestone.", "Do not label a child undernourished without age-appropriate measurements and context.", "Regression is a red flag and should not be treated as simple delay."]),
      section("Immunisation, medications and previous illness", "Check immunisation status and relevant prior disease or treatment.", ["Review the vaccination card or reliable record, doses and dates.", "Ask about missed or delayed vaccines, adverse events and contraindications reported by the caregiver.", "Previous admissions, recurrent infections, chronic conditions, surgery and blood transfusion.", "Current and recent medicines, dose, route, frequency, adherence and allergies.", "Vitamin supplements, deworming or prophylaxis where relevant to the local schedule."], ["Verified vaccination record and gaps.", "Previous admissions and recurrent or severe infections.", "Medicines, allergies and relevant preventive care."], "Immunisation status informs susceptibility and prevention but should be verified against the current national schedule.", ["Incomplete immunisation with suspected vaccine-preventable disease, severe allergic reaction or recurrent unusual infections."], ["Do not assume vaccines are complete based on caregiver recall alone.", "Do not prescribe or recommend catch-up schedules from outdated memory; check current local guidance."]),
      section("Paediatric examination and safeguarding", "Assess the child in a developmentally appropriate way and remain alert to welfare and protection needs.", ["Observe interaction, alertness, consolability, play, work of breathing and hydration before disturbing the child.", "Ask about supervision, living arrangements, school/childcare, safety and who provides daily care.", "Where injury is present, obtain a clear, developmentally plausible explanation and assess consistency of history.", "Explore concerns about neglect, abuse, violence, exploitation or unmet basic needs sensitively and in line with safeguarding policy.", "Examine with caregiver presence where appropriate, preserving dignity and explaining each step."], ["Age-appropriate vital signs, growth measurements and general appearance.", "Developmentally appropriate systemic findings.", "Safeguarding concerns and actions in accordance with local policy."], "Children may not disclose harm directly. Safeguarding assessment should be careful, factual, non-leading and escalated through established procedures.", ["Inconsistent injury history, unexplained injury, repeated presentations, concerning delay in seeking care or immediate safety concern."], ["Do not conduct leading or repeated investigative questioning.", "Do not dismiss a concern because a caregiver is cooperative.", "Document factual observations and follow local safeguarding pathways."])
    ]
  },
  "obstetrics-gynaecology": {
    title: "Obstetrics & Gynaecology",
    overview: "Obstetric and gynaecological clerking requires sensitive, confidential reproductive history-taking, careful pregnancy dating, assessment of maternal and fetal wellbeing where relevant, and early recognition of haemorrhage, hypertensive disease, sepsis, ectopic pregnancy and other emergencies.",
    learningOutcomes: ["Take a complete obstetric history using gravidity, parity and pregnancy outcomes accurately.", "Explore menstrual, gynaecological, sexual and contraceptive history sensitively.", "Assess antenatal, intrapartum and postpartum symptoms according to the current stage.", "Recognise maternal and gynaecological red flags and document gestational context clearly."],
    unitSections: [
      section("Obstetric summary and pregnancy history", "Establish current pregnancy status and accurately describe previous pregnancy outcomes.", ["Confirm pregnancy, gestational age and how dating was established; record LMP, cycle regularity and scan dating where available.", "Record gravidity and parity using the locally taught convention; clarify living children and each pregnancy outcome.", "For each previous pregnancy, ask year, gestational age at outcome, mode of delivery, complications and neonatal outcome.", "Ask about miscarriage, ectopic pregnancy, termination, stillbirth, neonatal death, multiple pregnancy and previous caesarean section.", "Explore previous pre-eclampsia, eclampsia, postpartum haemorrhage, preterm birth, shoulder dystocia, retained placenta and operative delivery."], ["G/P and pregnancy outcomes with dates or sequence.", "Current gestational age and dating source; note uncertainty.", "Previous obstetric complications, uterine surgery and neonatal outcomes."], "Previous pregnancy complications affect current risk assessment and planning. Accurate dating and obstetric notation are essential for communication.", ["Current pregnancy with pain/bleeding, severe headache/visual symptoms, reduced fetal movement, seizure, collapse or heavy bleeding."], ["Do not calculate gestational age without stating the dating source.", "Do not use parity notation without confirming what the convention means locally.", "Do not omit previous caesarean section or uterine surgery."]),
      section("Current antenatal history", "Review the current pregnancy from booking to the present and assess maternal and fetal wellbeing.", ["Booking: date, gestational age, antenatal attendance and any late booking.", "Scans: dating, anomaly, growth, placenta and any reported concerns.", "Maternal symptoms: headache, visual symptoms, epigastric pain, swelling, bleeding, fluid loss, fever, urinary symptoms and breathlessness.", "Fetal symptoms: fetal movements compared with usual pattern, contractions, uterine pain and concerns about growth.", "Antenatal tests, blood group/Rh status, infections, anaemia, hypertension, diabetes and medicines or supplements."], ["Booking and visit history, scan findings and relevant test results.", "Maternal complications, treatment and medication.", "Fetal movement pattern and current gestational context."], "The current stage of pregnancy changes the differential diagnosis and urgency. Maternal stability and fetal wellbeing are assessed in parallel where appropriate.", ["Reduced or absent fetal movement, severe-range hypertension symptoms, significant bleeding, suspected membrane rupture with infection or preterm labour."], ["Do not document fetal wellbeing from maternal impression alone.", "Do not overlook the gestational age when interpreting symptoms.", "Do not delay assessment of maternal instability for fetal investigations."]),
      section("Labour, delivery and immediate postpartum history", "Clarify labour progress, delivery events and postpartum complications.", ["Onset of contractions, frequency, duration, pain and progression.", "Rupture of membranes: time, colour, smell, amount and associated fever or fetal movement change.", "Vaginal bleeding, fetal movement, presentation, previous labour and travel/transfer timeline.", "Delivery: spontaneous or assisted vaginal birth, caesarean section, indication, complications and analgesia/anaesthesia.", "Postpartum: bleeding amount, clots, uterine pain, fever, urinary symptoms, breastfeeding, mood and neonatal condition."], ["Labour onset and key timings, membrane status and liquor description.", "Mode of delivery, indication, complications and neonatal outcome.", "Postpartum bleeding, infection, pain, feeding and maternal recovery."], "Timings, membrane status, bleeding and maternal/fetal observations are central to intrapartum risk and escalation.", ["Heavy bleeding, collapse, severe abdominal pain, fever/rigors, seizure, severe headache, chest pain or breathlessness."], ["Do not omit time of membrane rupture or delivery.", "Do not assume postpartum bleeding is normal without assessing amount and symptoms.", "Do not omit newborn outcome and maternal recovery."]),
      section("Menstrual and gynaecological history", "Assess menstrual pattern, reproductive symptoms and relevant gynaecological conditions.", ["Menarche, cycle length and regularity, duration and amount of bleeding, dysmenorrhoea and intermenstrual/postcoital bleeding.", "Last menstrual period and pregnancy possibility; contraception and fertility intentions.", "Vaginal discharge, odour, itching, pelvic pain, dyspareunia, urinary or bowel symptoms.", "Previous fibroids, endometriosis, ovarian cysts, pelvic inflammatory disease, sexually transmitted infections and cervical screening.", "Previous gynaecological operations, fertility treatment and relevant family history."], ["Menstrual pattern and LMP; distinguish reported date from calculated gestation.", "Bleeding pattern, pain, discharge and associated symptoms.", "Pregnancy possibility, contraception, previous diagnoses and procedures."], "Menstrual and sexual history should be obtained privately and sensitively. Bleeding and pain patterns may point to pregnancy-related, structural, infectious or malignant causes.", ["Postmenopausal bleeding, heavy bleeding with instability, acute severe pelvic pain, pregnancy possibility with pain/bleeding or suspected pelvic sepsis."], ["Do not assume regular cycles.", "Do not overlook pregnancy testing when pregnancy is possible.", "Do not use judgemental language when discussing sexual history."]),
      section("Sexual, contraceptive and reproductive health", "Obtain relevant information with consent, confidentiality and a non-judgemental approach.", ["Ask permission before discussing sexual activity and explain why the information may matter.", "Explore partners, practices, protection, STI exposure, symptoms and relevant safety concerns only as needed.", "Current and previous contraception, adherence, adverse effects and emergency contraception where relevant.", "Fertility goals, pregnancy intention, infertility history and previous treatment.", "Consider coercion, reproductive control or violence and follow safeguarding policy if disclosed."], ["Only clinically relevant information, in respectful language.", "Contraception method and adherence; pregnancy intention.", "Testing, counselling or referral discussed and consented to."], "Reproductive health history can change diagnosis, investigation, treatment and safeguarding. Privacy and patient control over disclosure are essential.", ["Sexual assault or coercion disclosure, immediate safety threat, pregnancy-related emergency or severe pelvic infection."], ["Do not ask sensitive questions in front of accompanying people without permission.", "Do not assume partner gender, relationship status or pregnancy intention.", "Do not document unnecessary intimate detail."])
    ]
  },
  emergency: {
    title: "Emergency Medicine",
    overview: "Emergency clerking is prioritised rather than sequential. The first task is to identify and treat immediate threats using a structured primary survey, then obtain a focused history that supports stabilisation, diagnosis and safe disposition.",
    learningOutcomes: ["Use an ABCDE primary survey and reassess after interventions.", "Obtain a focused AMPLE history without delaying resuscitation.", "Identify time-critical features in trauma, poisoning, chest pain, stroke, sepsis and acute breathlessness.", "Document response to treatment, escalation and disposition clearly."],
    unitSections: [
      section("Primary survey and immediate assessment", "Identify life-threatening problems and treat them as they are found.", ["Airway: can the patient speak? Is there obstruction, stridor, vomit, blood or reduced airway protection?", "Breathing: respiratory rate, work of breathing, chest expansion, oxygen saturation, breath sounds and immediate respiratory threats.", "Circulation: pulse, blood pressure, perfusion, external haemorrhage, skin temperature and suspected internal bleeding.", "Disability: consciousness, pupils, focal neurology, glucose and seizure activity.", "Exposure/environment: inspect for injuries, rash, bleeding, temperature and relevant hidden threats while preventing hypothermia."], ["ABCDE findings, time, interventions and response.", "Vital signs and repeated observations.", "Senior review, resuscitation team activation and transfer arrangements."], "The patient may deteriorate quickly. Repeat ABCDE after every major intervention and whenever the clinical state changes.", ["Any airway compromise, severe respiratory distress, shock, reduced consciousness, uncontrolled bleeding or rapidly worsening observations."], ["Do not wait for a complete history before treating an immediate threat.", "Do not document only one set of observations.", "Do not forget exposure, temperature control and reassessment."]),
      section("AMPLE history and focused collateral", "Use a brief structured history once immediate threats are addressed or in parallel with resuscitation.", ["A — Allergies: agents and actual reaction.", "M — Medications: prescribed, over-the-counter, anticoagulants, insulin, recreational or possible overdose substances.", "P — Past history: relevant disease, operations, pregnancy, previous episodes and baseline function.", "L — Last meal/oral intake: time and amount when relevant to anaesthesia, poisoning or altered consciousness.", "E — Events/environment: what happened, exact timing, mechanism, witnesses, exposures and pre-hospital treatment."], ["Exact time course and witness/source.", "Medication and allergy details; last oral intake when relevant.", "Pre-hospital interventions, observations and response."], "AMPLE is a memory aid, not a replacement for a focused symptom history or complete subsequent clerking.", ["Possible overdose, anticoagulant-associated injury, pregnancy-related emergency, high-energy mechanism or unknown event with reduced consciousness."], ["Do not let AMPLE delay ABCDE.", "Do not assume an intoxicated or confused patient can provide a reliable history."]),
      section("Time-critical presentations", "Use presentation-specific questions to identify high-risk disease and trigger appropriate pathways.", ["Chest pain: onset, radiation, exertion, syncope, breathlessness, cardiovascular risk and stimulant exposure.", "Stroke symptoms: exact last-known-well, onset, focal deficit, speech/vision change, anticoagulants and seizure.", "Sepsis: suspected source, fever/rigors, recent infection/procedure, immune status, urine output and mental status.", "Breathlessness: onset, wheeze, pleuritic pain, haemoptysis, oedema, allergy exposure and previous respiratory/cardiac disease.", "Trauma: mechanism, speed/height, restraints, ejection, head injury, loss of consciousness, bleeding and anticoagulants."], ["Time-critical onset and relevant pathway criteria.", "Risk factors and key positive/negative symptoms.", "Differential diagnoses and escalation rationale."], "Exact onset, trajectory and major risk factors determine which investigations and interventions cannot safely wait.", ["Suspected acute coronary syndrome, stroke, sepsis, anaphylaxis, major trauma, pulmonary embolism or aortic emergency."], ["Do not force a single diagnosis early.", "Do not omit exact onset/last-known-well or anticoagulant history."]),
      section("Poisoning, overdose and environmental exposure", "Identify the agent, dose, route, timing, co-ingestants and intent while managing immediate toxicity.", ["What substance was taken or encountered? Confirm packaging, formulation and strength if available.", "How much, by what route and at what time? Was it repeated or combined with other substances?", "Was the exposure accidental, occupational, recreational or intentional? Explore self-harm risk sensitively.", "Ask about symptoms, co-ingestants, chronic disease, current medicines and previous episodes.", "For environmental exposure, ask about carbon monoxide, chemicals, bites/stings, heat/cold, water and confined spaces."], ["Agent, amount, route, timing and source of information.", "Co-ingestants, symptoms, intent and access to more substance.", "Decontamination or pre-hospital measures and response."], "Toxicity depends on substance, dose, route, time and host factors. Specialist toxicology or poison-centre advice may be required.", ["Reduced consciousness, respiratory depression, seizures, dysrhythmia, severe agitation, hyperthermia or intentional self-harm."], ["Do not delay supportive care while identifying every substance.", "Do not assume a claimed dose is accurate.", "Do not overlook safeguarding and self-harm assessment after stabilisation."]),
      section("Reassessment, handover and disposition", "Close the emergency encounter with a clear trajectory, pending tasks and destination.", ["Has the patient improved, deteriorated or remained unchanged after each intervention?", "What critical diagnosis remains possible? What results are pending?", "Does the patient need admission, transfer, observation, specialist review or safe discharge?", "What escalation triggers and safety-net instructions have been explained?"], ["Serial observations and response to treatment.", "Pending results, responsible reviewer and expected timeframe.", "Disposition decision, handover and explicit safety-netting."], "Disposition is a clinical decision that requires stability, a follow-up plan and clarity about outstanding risks.", ["Persistent abnormal observations, unresolved high-risk diagnosis, recurrent symptoms or unsafe home circumstances."], ["Do not discharge on the basis of one normal reading.", "Do not leave pending investigations without ownership."])
    ]
  },
  psychiatry: {
    title: "Psychiatry",
    overview: "Psychiatric clerking requires a detailed, chronological account of symptoms and functioning, a full mental state examination, explicit risk assessment, collateral where appropriate and careful consideration of physical, substance-related and medication causes.",
    learningOutcomes: ["Take a structured psychiatric history using the patient's own language.", "Perform and document a mental state examination.", "Assess risk to self, others and vulnerability, including protective factors.", "Consider physical illness, substances, capacity, consent and collateral information."],
    unitSections: [
      section("Psychiatric presenting complaint and symptom analysis", "Clarify the main psychological or behavioural change, onset, course and functional effect.", ["Ask what has changed and when it began. Was onset acute, subacute or gradual?", "Mood: low mood, loss of interest, guilt, hopelessness, energy, sleep, appetite, concentration and psychomotor change.", "Elevated mood: reduced need for sleep, increased energy, pressured speech, grandiosity, impulsivity and risk-taking.", "Psychosis: hallucinations, delusions, thought interference, disorganisation and negative symptoms.", "Anxiety, panic, obsessions/compulsions, trauma symptoms, eating concerns, cognitive symptoms and somatic symptoms as relevant.", "Explore triggers, previous episodes, treatment response and impact on work, relationships and self-care."], ["Patient's own description, onset, duration, progression and severity.", "Specific symptoms and functional impairment.", "Patient's explanation, concerns and expectations."], "A precise phenomenological description helps distinguish psychiatric syndromes, medication effects, substance effects and physical illness.", ["Acute confusion, catatonia, severe agitation, inability to care for basic needs or symptoms suggesting delirium/organic disease."], ["Do not use diagnostic labels instead of describing symptoms.", "Do not assume psychosis from unusual beliefs without assessing context, conviction and cultural meaning."]),
      section("Mental state examination", "Record a time-specific description of the patient's current mental state.", ["Appearance and behaviour: dress, hygiene, eye contact, psychomotor activity, cooperation and abnormal movements.", "Speech: rate, volume, tone, fluency, latency and pressure.", "Mood and affect: subjective mood and observed range, reactivity, congruence and stability.", "Thought: form, rate, associations, content, preoccupations, delusions, obsessions and suicidal ideas.", "Perception: hallucinations, illusions, depersonalisation and derealisation.", "Cognition: orientation, attention, memory and executive function as appropriate.", "Insight and judgement: understanding of illness, need for care and consequences of decisions."], ["Objective observations and direct patient statements separately.", "Mood/affect, speech, thought form/content, perception, cognition and insight.", "Limitations due to distress, language, sedation or cooperation."], "The MSE is a structured snapshot, not a substitute for the longitudinal history. Clearly distinguish what was observed from what the patient reported.", ["Command hallucinations with intent, severe disorganisation, catatonia, fluctuating attention or impaired consciousness."], ["Do not write simply 'MSE normal'.", "Do not conflate mood with affect.", "Do not record an inference as an observed fact."]),
      section("Risk assessment and protective factors", "Assess immediate and longer-term risks in a direct, respectful and documented manner.", ["Self-harm/suicide: thoughts, intent, plan, access to means, preparation, previous attempts, reasons for living and current supports.", "Risk to others: threats, intent, target, access to weapons, recent violence and triggers.", "Vulnerability: exploitation, neglect, homelessness, self-neglect, abuse, financial risk and inability to meet basic needs.", "Substance-related risk: intoxication, withdrawal, overdose and unsafe combinations.", "Protective factors: relationships, responsibilities, beliefs, coping strategies, engagement and willingness to accept help."], ["Specific thoughts, intent, plan, means, history and protective factors.", "Immediate safety measures, senior review and agreed management.", "Sources of collateral and any discrepancy in accounts."], "Risk is dynamic and should be linked to an individualised management and safety plan. A score alone cannot establish safety.", ["Current suicidal intent or plan, recent serious attempt, credible threats, command hallucinations, severe self-neglect or inability to maintain safety."], ["Do not use 'low risk' as a substitute for describing findings.", "Do not rely solely on denial of suicidal thoughts.", "Do not promise confidentiality when serious risk requires escalation."]),
      section("Substance, medication, physical and collateral history", "Identify substances and physical conditions that may cause, worsen or mimic psychiatric symptoms.", ["Alcohol, cannabis, stimulants, opioids, sedatives, hallucinogens and other substances: amount, frequency, last use, withdrawal and consequences.", "Prescribed medicines, recent dose changes, steroids, dopaminergic medicines, anticholinergics and other relevant exposures.", "Neurological symptoms, head injury, seizures, infection, endocrine/metabolic symptoms, sleep disorder and cognitive change.", "Previous psychiatric diagnoses, admissions, therapy, medication response and adverse effects.", "With consent or under the appropriate legal/safeguarding basis, obtain collateral from family/carers and review previous records."], ["Substances, timing, quantity, route and withdrawal symptoms.", "Relevant physical history, medicines and recent changes.", "Collateral source, consent/basis and key information."], "Acute behavioural change may be due to delirium, intoxication, withdrawal, neurological disease or medication. A physical assessment remains essential.", ["Fluctuating attention, acute confusion, fever, head injury, seizure, autonomic instability or suspected withdrawal complications."], ["Do not attribute all symptoms to a psychiatric diagnosis before considering physical causes.", "Do not obtain collateral casually without considering consent, confidentiality and legal basis."]),
      section("Capacity, consent, treatment engagement and formulation", "Assess decision-specific capacity where needed and formulate the case in a biopsychosocial framework.", ["Can the person understand, retain, use/weigh relevant information and communicate a choice for this specific decision?", "What are the patient's goals, preferences, concerns and understanding of treatment?", "Explore biological, psychological and social predispositions, precipitating factors, perpetuating factors and protective factors.", "What support, crisis plan, follow-up and safeguarding arrangements are needed?"], ["Decision being assessed, information provided, functional capacity findings and outcome.", "Patient preference, agreed plan, support and follow-up.", "Biopsychosocial formulation and uncertainties."], "Capacity is decision-specific and time-specific. Diagnosis alone does not establish incapacity; legal requirements vary by jurisdiction.", ["Immediate risk with impaired decision-making, inability to meet basic needs or a safeguarding concern requiring urgent action."], ["Do not equate disagreement with incapacity.", "Do not make legal conclusions without following local law and senior guidance."])
    ]
  },
  "community-medicine": {
    title: "Community Medicine",
    overview: "Community health assessment moves beyond an individual patient's symptoms to examine populations, households, environments, health determinants, service access and preventable risk. The unit guide should support both individual and community-level assessment.",
    learningOutcomes: ["Describe the person within household, community and environmental context.", "Identify exposures, social determinants and barriers to care.", "Use an epidemiological approach to define a health problem and target population.", "Develop prevention, screening, health-promotion and evaluation plans."],
    unitSections: [
      section("Household, family and social context", "Understand household structure, resources, relationships and vulnerability.", ["Who lives in the household and who provides care?", "What are the main sources of income, food, water and transport?", "What are the housing conditions, crowding, ventilation, sanitation and waste-disposal arrangements?", "Who makes health decisions and how are costs managed?", "Are there older adults, young children, pregnant people, people with disabilities or chronically ill members requiring support?"], ["Household composition and relevant dependency needs.", "Housing, water, sanitation, food security and access barriers.", "Caregiver support and vulnerability, with confidentiality."], "Household conditions can create shared exposure and determine whether prevention and treatment plans are feasible.", ["Unsafe water, severe food insecurity, child protection concerns, domestic violence or inability to access urgent care."], ["Do not equate household income with the individual's resources.", "Do not collect identifiable household details unnecessarily."]),
      section("Environmental and occupational assessment", "Identify environmental exposures and workplace hazards linked to health outcomes.", ["Water source, treatment, storage and reliability.", "Sanitation, drainage, refuse disposal, vectors, pests and stagnant water.", "Cooking fuel, ventilation, indoor air pollution, road traffic and ambient exposures.", "Occupation, tasks, protective equipment, chemical/dust/noise exposure and injury risks.", "Seasonal changes, flooding, heat, housing quality and community infrastructure."], ["Specific exposure, frequency, duration and affected population.", "Environmental observations and protective measures.", "Workplace hazards and access to occupational health support."], "The exposure pathway and population affected are more useful than a generic statement that the environment is poor.", ["Ongoing toxic exposure, unsafe water outbreak, occupational injury cluster or vector-borne disease risk."], ["Do not assume an exposure from job title alone.", "Distinguish observed conditions from information reported by residents."]),
      section("Epidemiological problem definition", "Define the health problem, denominator, time period and affected population.", ["What outcome or condition is being measured?", "Who is included in the population at risk, and what is the denominator?", "What is the time period, place and case definition?", "Are there differences by age, sex, occupation, geography or socioeconomic group?", "What data source is being used, and what are its limitations or missing values?"], ["Case definition, person-place-time distribution and denominator.", "Data source, date, coverage and limitations.", "Incidence/prevalence or other measure only when the numerator and denominator are appropriate."], "Epidemiological measures are only interpretable when the population, time period, case definition and denominator are clear.", ["Evidence of a cluster, rising severe outcomes or an outbreak requiring immediate notification under local procedures."], ["Do not confuse incidence with prevalence.", "Do not compare populations with different case definitions or ascertainment without qualification."]),
      section("Prevention, screening and health promotion", "Choose interventions appropriate to risk, evidence and the level of prevention.", ["Which risk factors are modifiable at individual, household, community or policy level?", "Is the activity primordial, primary, secondary or tertiary prevention?", "Who is eligible for screening under current local guidance?", "How will informed choice, acceptability, referral and follow-up be assured?", "What communication methods and languages are accessible to the target group?"], ["Target population, intervention, eligibility criteria and referral route.", "Behavioural, environmental and service-level actions.", "Follow-up, uptake, adverse effects and evaluation measures."], "Screening is beneficial only when the target population, test, follow-up and treatment pathway are suitable. Local guidance must be checked.", ["A screening programme without confirmatory testing or accessible treatment, or a public health threat requiring urgent action."], ["Do not describe mass testing as screening without an evidence-based pathway.", "Do not use outdated eligibility criteria or schedules."]),
      section("Health services, equity and community engagement", "Assess the health system from the community user's perspective and identify equity gaps.", ["Where do people seek care first and why?", "What are the barriers: distance, cost, opening hours, language, stigma, disability, trust or medicine availability?", "How do referral, follow-up, preventive services and emergency transport work?", "Which community groups are under-served or excluded?", "Who should be involved in planning and delivering an intervention?"], ["Service availability, accessibility, acceptability and continuity.", "Equity concerns and affected groups.", "Community partners, feedback and accountability."], "An effective intervention must be acceptable and reachable by the intended population. Community participation improves relevance and sustainability.", ["A serious access gap affecting urgent care, outbreaks or a highly vulnerable group."], ["Do not blame individuals for barriers created by the system.", "Do not design an intervention without engaging the target community."]),
      section("Programme planning and evaluation", "Translate findings into a measurable, feasible and accountable public health plan.", ["What is the priority problem and why is it prioritised?", "What is the objective, target group, timeframe and expected outcome?", "What resources, partners and delivery channels are needed?", "Which process, output and outcome indicators will be monitored?", "How will data quality, unintended effects and sustainability be assessed?"], ["Problem statement, objective, activities and responsible partners.", "Inputs, outputs, outcomes and indicators.", "Monitoring schedule, data source and evaluation limitations."], "A programme should be measurable, realistic and adaptable. Process indicators show delivery; outcome indicators show whether health changed.", ["A programme with no referral/safety pathway, poor data protection or an intervention likely to widen inequity."], ["Do not set targets without a baseline or denominator.", "Do not report activity counts as proof of health impact."])
    ]
  },
  orthopaedics: {
    title: "Orthopaedics",
    overview: "Orthopaedic clerking is anatomy- and function-focused. Document mechanism, deformity, pain, mobility and neurovascular status. In trauma, assess and protect life and limb before a detailed musculoskeletal examination.",
    learningOutcomes: ["Take a structured musculoskeletal and trauma history.", "Perform a focused limb, joint and spinal assessment.", "Document distal neurovascular status and red flags.", "Assess function, rehabilitation needs and complications."],
    unitSections: [
      section("Musculoskeletal symptom analysis", "Characterise the affected bone, joint, muscle or spinal region and the effect on function.", ["Site: ask the patient to identify the exact joint, bone or region; unilateral or bilateral?", "Onset and mechanism: injury, repetitive use, spontaneous onset, infection or systemic illness?", "Pain: severity, character, radiation, night pain, rest pain, movement-related pain and analgesic response.", "Function: weight-bearing, range of movement, grip, walking distance, stairs, work and activities of daily living.", "Associated symptoms: swelling, redness, warmth, stiffness, locking, instability, fever, weight loss or neurological symptoms."], ["Exact anatomical site, onset, mechanism and functional effect.", "Pain pattern, swelling, stiffness and associated systemic symptoms.", "Previous injury, operation, inflammatory disease and treatment."], "Anatomical localisation and functional impairment help distinguish traumatic, degenerative, inflammatory, infectious and referred causes.", ["Hot swollen joint with fever, inability to bear weight, severe pain at rest or rapidly progressive neurological deficit."], ["Do not describe a limb complaint without naming the site and side.", "Do not omit functional limitation or systemic symptoms."]),
      section("Trauma mechanism and fracture history", "Establish injury energy, pattern and risk of associated injuries.", ["Direct or indirect force, fall height, twist, collision, crush, penetrating injury or repetitive loading?", "Time of injury, immediate pain/deformity, ability to continue activity and progression of swelling.", "Open wound, bleeding, contamination, skin tenting or exposed bone?", "Other injuries, head/neck symptoms, loss of consciousness and anticoagulant use?", "Pre-hospital splinting, reduction, analgesia, circulation/sensation before and after intervention."], ["Mechanism, time, energy and associated injuries.", "Open/closed status only after examination; skin and wound description.", "Pre- and post-intervention neurovascular findings."], "Mechanism may predict fracture pattern and associated injury. Open injury, threatened skin or vascular compromise requires urgent escalation.", ["Open fracture, compartment syndrome concern, dislocation with neurovascular deficit, threatened skin or multiple trauma."], ["Do not assume a closed injury because the wound is small.", "Do not omit the neurovascular examination before and after splinting or reduction."]),
      section("Limb examination and neurovascular documentation", "Record a reproducible assessment of the affected limb and compare with the opposite side when appropriate.", ["Inspect deformity, swelling, bruising, wounds, skin colour, posture and muscle wasting.", "Palpate focal tenderness, temperature, compartments and bony landmarks without unnecessary force.", "Assess active and passive range of movement when safe; do not force a suspected fracture or dislocation.", "Check distal pulse, capillary refill, skin temperature, sensation and motor function in relevant nerve distributions.", "Document the exact time and repeat findings after intervention or change in symptoms."], ["Side, site, deformity, skin and tenderness.", "Distal pulses, capillary refill, sensation and motor function with named distributions where possible.", "Pre/post splint, reduction or procedure findings."], "Neurovascular compromise and compartment syndrome can threaten limb viability. Serial examination is often more valuable than a single normal finding.", ["Pain out of proportion, pain on passive stretch, tense compartments, progressive paraesthesia, pallor, pulselessness or paralysis."], ["Do not rely on the presence of a pulse to exclude compartment syndrome.", "Do not write 'neurovascularly intact' without documenting the components."]),
      section("Spine, back pain and neurological screening", "Identify spinal injury and neurological compromise while screening for serious non-musculoskeletal causes.", ["Back or neck pain: exact site, onset, trauma, radiation, aggravating factors and night pain.", "Weakness, numbness, gait change, balance, saddle sensory change and bladder/bowel dysfunction.", "Fever, weight loss, cancer history, immunosuppression, IV drug use, infection and steroid exposure.", "For trauma, ask about mechanism, spinal pain, limb symptoms and associated head/chest/abdominal injury.", "Baseline mobility, falls, osteoporosis, fragility fractures and previous spinal surgery."], ["Trauma mechanism and spinal precautions where indicated.", "Neurological symptoms and focused findings.", "Red flags and relevant cancer/infection/osteoporosis history."], "Spinal cord or cauda equina compression, infection, malignancy and unstable trauma must not be missed.", ["New bladder retention/incontinence, saddle anaesthesia, bilateral weakness, progressive neurological deficit, fever with spinal pain or significant trauma."], ["Do not reassure solely because pain is positional.", "Do not omit bladder/bowel and saddle sensory questions when indicated."]),
      section("Bone health, infection, inflammatory disease and rehabilitation", "Identify underlying disease and plan recovery and prevention.", ["Previous fractures, low-impact falls, osteoporosis, steroid use, nutrition, smoking and alcohol.", "Joint stiffness, pattern of swelling, morning stiffness, multiple joints, skin/eye/bowel features and systemic disease.", "Fever, wounds, recent surgery, implants, injections, bacteraemia risk and immunosuppression.", "Current mobility, aids, home setup, caregiver support, work and rehabilitation goals.", "Medication history including analgesics, anticoagulants, steroids and bone-protective treatment."], ["Fragility risk and previous fractures.", "Infection risks, implants and recent procedures.", "Baseline function, rehabilitation goals and home support."], "Orthopaedic care includes cause, stability, function, bone health and prevention of future injury, not merely radiographic alignment.", ["Suspected septic arthritis, infected implant, osteomyelitis, pathological fracture or inability to mobilise safely."], ["Do not treat pain relief as the entire management plan.", "Do not overlook osteoporosis and fragility risk in older or high-risk patients."])
    ]
  }
};
