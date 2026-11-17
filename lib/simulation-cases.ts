export type SimulationCaseOption = {
  id: string;
  title: string;
  complaint: string;
  difficulty: "Core" | "Clinical" | "Advanced";
  setting: string;
};

export const simulationCaseOptions: Record<string, SimulationCaseOption[]> = {
  "general-medicine": [
    { id: "med-chest-pain", title: "Chest pain and sweating", complaint: "Chest pain", difficulty: "Core", setting: "Medical admissions" },
    { id: "med-heart-failure", title: "Progressive breathlessness and swollen legs", complaint: "Breathlessness", difficulty: "Clinical", setting: "Medical clinic" },
    { id: "med-persistent-cough", title: "Persistent cough, fever and weight loss", complaint: "Chronic cough", difficulty: "Clinical", setting: "Medical outpatient clinic" },
    { id: "med-polyuria", title: "Excessive thirst and frequent urination", complaint: "Polyuria and polydipsia", difficulty: "Core", setting: "General medical clinic" }
  ],
  surgery: [
    { id: "surg-appendicitis", title: "Abdominal pain moving to the right iliac fossa", complaint: "Right iliac fossa pain", difficulty: "Core", setting: "Surgical admissions" },
    { id: "surg-obstruction", title: "Abdominal distension and repeated vomiting", complaint: "Vomiting and constipation", difficulty: "Clinical", setting: "Surgical emergency unit" },
    { id: "surg-breast-lump", title: "A gradually enlarging breast lump", complaint: "Breast lump", difficulty: "Core", setting: "Surgical outpatient clinic" },
    { id: "surg-hernia", title: "A painful groin swelling that will not reduce", complaint: "Groin swelling", difficulty: "Advanced", setting: "Surgical emergency unit" }
  ],
  paediatrics: [
    { id: "paed-fever-seizure", title: "Fever followed by a convulsion", complaint: "Fever and convulsion", difficulty: "Clinical", setting: "Paediatric emergency unit" },
    { id: "paed-pneumonia", title: "Cough, fever and fast breathing", complaint: "Cough and difficulty breathing", difficulty: "Core", setting: "Children's ward" },
    { id: "paed-poor-growth", title: "Poor weight gain in an infant", complaint: "Poor weight gain", difficulty: "Clinical", setting: "Paediatric outpatient clinic" },
    { id: "paed-neonatal-jaundice", title: "Jaundice in a five-day-old newborn", complaint: "Neonatal jaundice", difficulty: "Advanced", setting: "Newborn unit" }
  ],
  "obstetrics-gynaecology": [
    { id: "og-pre-eclampsia", title: "Headache and visual symptoms in late pregnancy", complaint: "Headache in pregnancy", difficulty: "Advanced", setting: "Antenatal assessment unit" },
    { id: "og-early-bleeding", title: "Lower abdominal pain and bleeding in early pregnancy", complaint: "Early pregnancy bleeding", difficulty: "Advanced", setting: "Gynaecological emergency unit" },
    { id: "og-labour", title: "Painful contractions at term", complaint: "Labour pains", difficulty: "Core", setting: "Labour ward" },
    { id: "og-postpartum-bleeding", title: "Heavy bleeding shortly after delivery", complaint: "Postpartum bleeding", difficulty: "Advanced", setting: "Postnatal / labour ward" }
  ],
  emergency: [
    { id: "em-road-traffic-injury", title: "Road traffic collision with chest and leg injuries", complaint: "Multiple injuries after RTA", difficulty: "Advanced", setting: "Emergency resuscitation bay" },
    { id: "em-hypoglycaemia", title: "Confusion in a person using insulin", complaint: "Altered consciousness", difficulty: "Core", setting: "Emergency department" },
    { id: "em-acute-asthma", title: "Sudden severe breathlessness and wheeze", complaint: "Acute breathlessness", difficulty: "Clinical", setting: "Emergency department" },
    { id: "em-fever-confusion", title: "Fever, severe headache and confusion", complaint: "Fever with altered mental state", difficulty: "Advanced", setting: "Emergency department" }
  ],
  psychiatry: [
    { id: "psy-depression", title: "Persistent low mood and loss of interest", complaint: "Low mood", difficulty: "Core", setting: "Psychiatric outpatient clinic" },
    { id: "psy-psychosis", title: "Hearing voices and feeling watched", complaint: "Hallucinations and suspiciousness", difficulty: "Clinical", setting: "Psychiatric assessment unit" },
    { id: "psy-mania", title: "Very little sleep and unusually high energy", complaint: "Overactivity and reduced sleep", difficulty: "Clinical", setting: "Psychiatric emergency unit" },
    { id: "psy-alcohol", title: "Morning shakes and daily alcohol use", complaint: "Alcohol use and tremor", difficulty: "Advanced", setting: "General hospital / liaison psychiatry" }
  ],
  "community-medicine": [
    { id: "com-diarrhoea-cluster", title: "Several households reporting acute diarrhoea", complaint: "Cluster of diarrhoeal illness", difficulty: "Clinical", setting: "Community health centre" },
    { id: "com-immunisation", title: "A child missing routine vaccinations", complaint: "Missed immunisation", difficulty: "Core", setting: "Primary healthcare centre" },
    { id: "com-antenatal-access", title: "Late antenatal booking in a rural community", complaint: "Barriers to antenatal care", difficulty: "Clinical", setting: "Community outreach" },
    { id: "com-malaria-rise", title: "A rise in fever cases after heavy rainfall", complaint: "Increasing community fever cases", difficulty: "Advanced", setting: "Local health office" }
  ],
  orthopaedics: [
    { id: "ortho-wrist-fracture", title: "Wrist pain and deformity after a fall", complaint: "Wrist injury", difficulty: "Core", setting: "Orthopaedic emergency clinic" },
    { id: "ortho-hot-knee", title: "A hot, swollen knee with fever", complaint: "Acute painful knee", difficulty: "Advanced", setting: "Orthopaedic admissions" },
    { id: "ortho-back-redflags", title: "Back pain with new bladder symptoms", complaint: "Low back pain", difficulty: "Advanced", setting: "Emergency orthopaedic assessment" },
    { id: "ortho-leg-trauma", title: "Severe leg pain after a motorcycle collision", complaint: "Lower limb injury", difficulty: "Clinical", setting: "Trauma unit" }
  ]
};
