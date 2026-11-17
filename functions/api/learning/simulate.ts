import { json, requireUser, isResponse, validSameOrigin, aiFailureResponse, type AppContext } from "../../_lib/auth";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const ALLOWED_UNITS = ["general-medicine","surgery","paediatrics","obstetrics-gynaecology","emergency","psychiatry","community-medicine","orthopaedics"];

type CaseProfile = {
  unit:string; title:string; complaint:string; name:string; age:string; sex:string;
  role:string; setting:string; opening:string; facts:string; diagnosis:string; safety:string[];
};
const make = (unit:string,title:string,complaint:string,name:string,age:string,sex:string,role:string,setting:string,opening:string,facts:string,diagnosis:string,safety:string[]):CaseProfile =>
  ({unit,title,complaint,name,age,sex,role,setting,opening,facts,diagnosis,safety});

const CASES:Record<string,CaseProfile> = {
  "med-chest-pain":make("general-medicine","Chest pain and sweating","Chest pain","Mr Chinedu Okafor","58 years","Male","Patient","Medical admissions","Doctor, I have had a heavy pain in my chest since this morning. It is worrying me.","Pain began two hours ago while walking. Central heavy pressure, persistent, radiates to left arm and jaw, with sweating and nausea. No pleuritic pain, fever, cough, haemoptysis, leg swelling or long travel. Hypertension and type 2 diabetes; takes amlodipine inconsistently and cannot recall diabetes medication. Smokes five cigarettes daily for 20 years. Father died suddenly in his early sixties. No previous diagnosed MI; no known allergy.","Suspected acute coronary syndrome; urgent assessment is required.",["Onset, duration and persistence of pain","Radiation and autonomic symptoms","Breathlessness, syncope and thromboembolic/aortic red flags","Cardiovascular risk factors and current medication"]),
  "med-heart-failure":make("general-medicine","Progressive breathlessness and swollen legs","Breathlessness","Mrs Ngozi Eze","67 years","Female","Patient","Medical clinic","I get breathless doing things I used to do easily, and both my feet have been swelling.","Three weeks progressive exertional dyspnoea, now after a short walk. Sleeps on three pillows and wakes gasping at night. Bilateral ankle swelling for two weeks, worse by evening. Occasional dry cough. No fever, purulent sputum, pleuritic pain or unilateral calf pain. Longstanding hypertension; stopped medicines a month ago. No known lung disease.","Possible decompensated heart failure.",["Orthopnoea and paroxysmal nocturnal dyspnoea","Functional limitation and progression","Chest pain, palpitations and syncope","Medication adherence and precipitating illness"]),
  "med-persistent-cough":make("general-medicine","Persistent cough, fever and weight loss","Chronic cough","Mr Musa Bello","32 years","Male","Patient","Medical outpatient clinic","I have been coughing for many weeks, and I am losing weight without trying.","Cough for seven weeks, initially dry then small sputum; two episodes blood-streaked sputum. Evening fever, drenching night sweats and weight loss. Cousin sharing room recently treated for pulmonary tuberculosis. No previous TB treatment. HIV status not recently tested. No severe dyspnoea at rest. Commercial driver.","Pulmonary tuberculosis is a major consideration; maintain a respiratory differential and infection-control awareness.",["Duration, sputum and haemoptysis","Fever, night sweats and weight loss","TB contact and previous treatment","HIV/immunosuppression and infection-control risks"]),
  "med-polyuria":make("general-medicine","Excessive thirst and frequent urination","Polyuria and polydipsia","Mrs Blessing Nwosu","45 years","Female","Patient","General medical clinic","I am always thirsty, and I pass urine many times, even at night.","Three months of thirst, large-volume frequent urination and nocturia three or four times nightly, increased appetite and weight loss. Intermittent blurred vision. No vomiting, abdominal pain, deep breathing or altered consciousness. Mother and brother have diabetes. No known diabetes diagnosis or glucose-lowering medicine.","New diabetes mellitus is likely; screen for metabolic decompensation and alternative causes.",["Volume/frequency and onset of urination","Thirst, appetite, weight and visual symptoms","Ketoacidosis/hyperosmolar symptoms","Family history, pregnancy possibility and drug causes"]),

  "surg-appendicitis":make("surgery","Abdominal pain moving to the right iliac fossa","Right iliac fossa pain","Miss Amara Ibe","19 years","Female","Patient","Surgical admissions","The pain started around my belly button yesterday and has moved to the lower right side.","Pain began 18 hours ago peri-umbilically and migrated to right iliac fossa; now constant and worse with walking/coughing. Anorexia, nausea, one vomit and low-grade fever. No diarrhoea, dysuria or vaginal discharge. LMP about two weeks ago; pregnancy status not tested. No previous abdominal surgery.","Acute appendicitis is likely; pregnancy-related, urinary and gynaecological causes must be considered.",["Pain chronology and migration","Anorexia, vomiting and fever","Peritonism or worsening pain","LMP and pregnancy possibility"]),
  "surg-obstruction":make("surgery","Abdominal distension and repeated vomiting","Vomiting and constipation","Mr Peter Amah","61 years","Male","Patient","Surgical emergency unit","My stomach has become swollen and I keep vomiting. I have not passed stool or wind.","Two days of progressive distension and intermittent colicky central pain. Repeated bilious vomiting, now foul smelling. No stool or flatus for 36 hours. Open abdominal surgery for perforated ulcer ten years ago. No known groin swelling. Weak and thirsty; no blood in vomit or stool.","Mechanical bowel obstruction is likely; assess dehydration, strangulation and perforation.",["Last stool/flatus and vomit character","Previous surgery and hernia symptoms","Constant pain, fever, peritonism or shock","Fluid loss and dehydration"]),
  "surg-breast-lump":make("surgery","A gradually enlarging breast lump","Breast lump","Mrs Aisha Ibrahim","48 years","Female","Patient","Surgical outpatient clinic","I found a lump in my left breast a few months ago. It seems to be getting bigger.","Painless left breast lump for three months, gradually enlarging. No nipple discharge or skin ulceration. No previous breast lump/biopsy. Menarche at 13; two children, first at 27; breastfed both. Not menopausal. No known breast/ovarian cancer family history. No weight loss or bone pain.","A new breast mass requires triple assessment; malignancy must be excluded.",["Duration and progression","Pain, skin/nipple change and discharge","Axillary symptoms and systemic symptoms","Personal, reproductive and family history"]),
  "surg-hernia":make("surgery","A painful groin swelling that will not reduce","Groin swelling","Mr Emmanuel Ojo","54 years","Male","Patient","Surgical emergency unit","I have had a lump in my right groin for a long time, but since last night it has become painful and will not go back in.","Right groin lump for two years, previously appeared standing/coughing and reduced lying down. Now painful, tense and irreducible for 12 hours. Vomited twice, increasing abdominal discomfort and no stool/flatus since morning. No previous hernia repair.","Incarcerated or strangulated inguinal hernia is a concern.",["Previous reducibility and sudden change","Pain, vomiting and obstruction symptoms","Fever, skin colour change and toxicity","Previous repair and comorbidities"]),

  "paed-fever-seizure":make("paediatrics","Fever followed by a convulsion","Fever and convulsion","Baby David","2 years","Male","Parent / caregiver","Paediatric emergency unit","My son had a fever yesterday and suddenly started shaking all over this morning.","Mother is informant. Fever since yesterday evening; generalized stiffening and rhythmic jerking for about five minutes with unresponsiveness. Single event, returned to normal interaction within 20 minutes. No focal weakness, neck stiffness, persistent drowsiness or previous seizure. Mild runny nose. Vaccines reportedly up to date; card at home.","First febrile seizure is possible; exclude serious infection and other causes.",["Duration, focality and recurrence","Recovery and postictal state","Meningism, rash, persistent altered consciousness or focal deficit","Immunisation, prior seizures and fever source"]),
  "paed-pneumonia":make("paediatrics","Cough, fever and fast breathing","Cough and difficulty breathing","Baby Zainab","18 months","Female","Parent / caregiver","Children's ward","My daughter has been coughing and breathing very fast since yesterday.","Mother is informant. Cough and fever for three days; fast breathing since yesterday. Feeding reduced but still drinks. No cyanosis, convulsion or inability to wake. No choking. Missed most recent scheduled immunisation. No known asthma or congenital heart disease.","Possible pneumonia; assess severity and age-specific danger signs.",["Progression of cough and breathing difficulty","Feeding, drinking, lethargy and convulsions","Cyanosis, grunting, chest indrawing or apnoea","Immunisation, nutrition and respiratory history"]),
  "paed-poor-growth":make("paediatrics","Poor weight gain in an infant","Poor weight gain","Baby Chika","9 months","Female","Parent / caregiver","Paediatric outpatient clinic","My baby is not gaining weight like other babies, and I am worried.","Mother is informant. Birth weight 3.1 kg; health-card weights show poor trajectory. Exclusive breastfeeding stopped at five months. Complementary feeding mainly thin pap two or three times daily. No chronic diarrhoea or persistent vomiting. Recurrent uncomplicated malaria. Sits unsupported and babbles; not yet crawling. Household has intermittent food insecurity.","Growth faltering needs nutritional, medical, developmental and social assessment.",["Serial growth measures and growth chart","Breastfeeding and complementary feeding","Chronic GI symptoms, infection and development","Food security and caregiver support"]),
  "paed-neonatal-jaundice":make("paediatrics","Jaundice in a five-day-old newborn","Neonatal jaundice","Baby Esther","5 days","Female","Parent / caregiver","Newborn unit","My baby has become yellow since the second day after birth, and she is not feeding as well.","Mother is informant. Term baby, uncomplicated vaginal delivery. Jaundice first noticed at 36 hours and increasing. Feeds less and is sleepy but rousable. No fever, abnormal movement or high-pitched cry. No known blood-group incompatibility. No bruising or cephalohaematoma. Urine not dark; stool not pale.","Neonatal jaundice requires prompt age-in-hours and bilirubin assessment.",["Age at onset and progression","Feeding, activity and hydration","Seizure, abnormal tone, high-pitched cry or lethargy","Gestation, birth trauma, blood groups, urine and stool colour"]),

  "og-pre-eclampsia":make("obstetrics-gynaecology","Headache and visual symptoms in late pregnancy","Headache in pregnancy","Mrs Adaeze Nnamani","28 years","Female","Patient","Antenatal assessment unit","I am 34 weeks pregnant. My head has been aching badly, and sometimes my vision becomes blurry.","G2P1 at 34 weeks by records. Severe persistent frontal headache three days, flashing spots/blurred vision one day and epigastric discomfort today. Bilateral leg swelling. Fetal movements present but reduced today. No bleeding or liquor leakage. Previous pregnancy had raised BP near term. No seizure.","Possible pre-eclampsia with severe features; urgent maternal and fetal assessment.",["Severe headache, visual symptoms and epigastric pain","Convulsion symptoms and BP history","Fetal movement, bleeding and liquor leakage","Gestational age, ANC and previous hypertensive pregnancy"]),
  "og-early-bleeding":make("obstetrics-gynaecology","Lower abdominal pain and bleeding in early pregnancy","Early pregnancy bleeding","Miss Ifeoma Nwankwo","24 years","Female","Patient","Gynaecological emergency unit","I missed my period, and now I have lower abdominal pain with some bleeding.","About seven weeks since LMP; home pregnancy test positive. Light bleeding one day, right-sided lower abdominal pain six hours and increasing. No shoulder-tip pain or fainting. Mild nausea. No previous ectopic, PID or tubal surgery. No scan yet.","Early pregnancy bleeding requires assessment for ectopic pregnancy and pregnancy loss.",["LMP and pregnancy confirmation","Bleeding amount and passage of tissue","Unilateral pain, shoulder-tip pain, dizziness or syncope","Previous ectopic, PID, tubal surgery and scan results"]),
  "og-labour":make("obstetrics-gynaecology","Painful contractions at term","Labour pains","Mrs Kemi Afolabi","26 years","Female","Patient","Labour ward","I am 39 weeks pregnant. I have been having painful tightening in my tummy since early this morning.","G1P0 at 39 weeks. Contractions began five hours ago, now every five minutes lasting about 45 seconds. Show present, membranes intact, no fluid leakage or bleeding. Fetal movements normal. ANC from 16 weeks, no major complication. No prior uterine surgery.","Assess labour progress, maternal/fetal wellbeing, membrane status and obstetric risks.",["Contraction frequency, duration and strength","Rupture of membranes and liquor colour","Bleeding and fetal movements","Gestational age, parity, booking and obstetric risks"]),
  "og-postpartum-bleeding":make("obstetrics-gynaecology","Heavy bleeding shortly after delivery","Postpartum bleeding","Mrs Rahila Yusuf","30 years","Female","Patient","Postnatal / labour ward","I delivered my baby about half an hour ago, but I am still bleeding heavily and I feel dizzy.","G3P3, vaginal delivery 30 minutes ago. Heavy continuous bleeding with clots, rapidly soaking pads. Dizzy, weak and palpitating. Placenta not yet confirmed complete. Previous deliveries vaginal; mild antenatal anaemia. Conscious and able to answer briefly.","Postpartum haemorrhage is an immediate emergency; do not delay resuscitation for routine history.",["Time and estimated amount of bleeding","Dizziness, fainting, palpitations and weakness","Placental delivery/completeness and birth details","Previous PPH, anaemia and bleeding disorders"]),

  "em-road-traffic-injury":make("emergency","Road traffic collision with chest and leg injuries","Multiple injuries after RTA","Mr Tunde Bakare","31 years","Male","Patient","Emergency resuscitation bay","I was on a motorcycle when a car hit us. My chest and left leg are hurting badly.","Motorcycle passenger, no helmet, thrown onto road about an hour ago. No definite loss of consciousness. Left chest pain worse on breathing, severe left leg pain/deformity and increasing breathlessness. No abdominal pain initially; abdomen not examined. No anticoagulants or known illness.","Major trauma: ABCDE and immediate life-threat management take priority over full history.",["Mechanism, speed, helmet/restraint and ejection","Loss of consciousness, head/neck symptoms and amnesia","Breathing difficulty, chest and abdominal pain","Bleeding, anticoagulants, allergies and tetanus"]),
  "em-hypoglycaemia":make("emergency","Confusion in a person using insulin","Altered consciousness","Mr Joseph Ekanem","53 years","Male","Spouse / caregiver","Emergency department","My husband became confused and sweaty this morning. He is diabetic and uses insulin.","Wife is informant. Type 2 diabetes on insulin. Took morning insulin but skipped breakfast. Sweaty, shaky and confused 45 minutes later. No witnessed seizure or trauma. Previous milder episodes improved with sweet drinks. Currently drowsy and unsafe to swallow.","Severe hypoglycaemia is likely; assess and treat immediately using a safe non-oral route if consciousness impaired.",["Diabetes treatment, timing and missed meals","Onset/progression of sweating, tremor and confusion","Seizure, trauma and ability to swallow safely","Prior episodes, renal disease and medication changes"]),
  "em-acute-asthma":make("emergency","Sudden severe breathlessness and wheeze","Acute breathlessness","Miss Precious Osei","22 years","Female","Patient","Emergency department","I am struggling to breathe. My chest is tight and I keep wheezing.","Asthma since childhood. Worsening over four hours after dusty cleaning. Wheeze, tight chest and difficulty completing sentences. Reliever ran out last week; no preventer for months. No fever or purulent sputum. Previous admission two years ago, never intubated.","Acute severe asthma requires prompt assessment and treatment; do not delay for a full history.",["Speech, exhaustion, altered consciousness and prior ICU/intubation","Onset, trigger and reliever response","Inhaler access/adherence and recent steroid use","Pneumothorax, anaphylaxis or infection features"]),
  "em-fever-confusion":make("emergency","Fever, severe headache and confusion","Fever with altered mental state","Mr Samuel Mensah","19 years","Male","Friend / caregiver","Emergency department","He has had a high fever and severe headache since yesterday, and now he is not making sense.","Friend is informant. Fever and severe headache 24 hours, repeated vomiting and confusion worsening over three hours. Neck pain when roused. No known head injury, seizure or chronic illness. Vaccination uncertain. Drowsy, unable to provide reliable history.","Meningitis/encephalitis and sepsis are urgent considerations; escalate promptly.",["Time course of fever, headache and confusion","Neck stiffness, photophobia, rash and seizure","Vomiting, reduced consciousness and focal deficit","Collateral source, comorbidities, medicines and immunisation"]),

  "psy-depression":make("psychiatry","Persistent low mood and loss of interest","Low mood","Miss Rita Johnson","27 years","Female","Patient","Psychiatric outpatient clinic","I have not felt like myself for some time. Nothing seems enjoyable anymore.","Low mood and anhedonia eight weeks, most days. Early waking, reduced appetite, fatigue, poor concentration and worthlessness. Work affected; relationship separation two months ago. Sometimes thinks life is not worth living, but denies plan or intent when asked. No mania, hallucinations or substance use. Sister supportive.","Possible depressive episode; assess suicide risk, function, bipolarity, psychosis, substances and physical causes.",["Mood/anhedonia and duration","Sleep, appetite, energy, concentration and function","Thoughts of death/self-harm, plan, intent, means and protective factors","Past mania, psychosis, substances and support"]),
  "psy-psychosis":make("psychiatry","Hearing voices and feeling watched","Hallucinations and suspiciousness","Mr Daniel Umeh","23 years","Male","Patient","Psychiatric assessment unit","People keep talking about me when nobody is there, and I feel someone is watching me.","Six weeks of hearing two voices commenting on actions, sometimes speaking to each other. Believes neighbours monitor him. Sleep reduced, stopped university and isolates. Voices not commanding harm currently. No clear mood episode. Denies cannabis/stimulants; assess carefully. No known neurological illness.","Possible first-episode psychosis; assess phenomenology, command content, risk and organic/substance causes.",["Onset, frequency, content and impact of hallucinations","Delusions, thought interference and disorganisation","Command content and risk to self/others","Substance use, mood, cognition and physical symptoms"]),
  "psy-mania":make("psychiatry","Very little sleep and unusually high energy","Overactivity and reduced sleep","Mrs Sandra Obi","30 years","Female","Patient","Psychiatric emergency unit","I have so many ideas at the moment. I only need two hours of sleep and I feel fantastic.","One week elevated/irritable mood, markedly increased energy, sleeping two hours without tiredness, rapid speech, racing thoughts and unrealistic business plans. Spent household savings on equipment. Family say unusually argumentative. Similar shorter episode after childbirth four years ago. No current substance use reported.","Possible manic episode; assess severity, psychosis, risk, function, past episodes and postpartum context.",["Duration and change from baseline","Reduced need for sleep, mood and increased activity","Impulsive spending, risk-taking and vulnerability","Psychosis, suicidality, past episodes and substance/medical causes"]),
  "psy-alcohol":make("psychiatry","Morning shakes and daily alcohol use","Alcohol use and tremor","Mr Francis Akin","44 years","Male","Patient","General hospital / liaison psychiatry","My hands shake in the morning, and I usually need a drink before I can settle.","Daily spirits for eight years, increasing to about half a bottle/day. Morning tremor and sweating improve after alcohol. Last drink 12 hours ago. Poor sleep, gastritis and missed work. Previous withdrawal tremor, no known seizure or delirium tremens. Wife concerned. No current suicidal thoughts.","Alcohol dependence with possible withdrawal; assess withdrawal severity and medical complications.",["Quantity, frequency, dependence and last drink","Withdrawal symptoms and previous seizures/delirium tremens","Other substances, nutrition and medical complications","Risk, family impact, motivation and support"]),

  "com-diarrhoea-cluster":make("community-medicine","Several households reporting acute diarrhoea","Cluster of diarrhoeal illness","Mr Ibrahim Danladi","36 years","Male","Community health worker / informant","Community health centre","Several families in our settlement have reported sudden diarrhoea over the last few days, and we are worried it may spread.","Informant reports 15 people from seven households with acute watery diarrhoea over three days. Most use the same shallow well after heavy rain. No confirmed deaths. Two children and one older adult dehydrated. No lab confirmation. Clinic has limited ORS. Can provide household dates, age groups and locations.","Possible waterborne outbreak: verify, define, line-list, notify and assess water/sanitation.",["Case definition, onset dates and person-place-time","Severity, dehydration and deaths","Shared water/food exposure and sanitation","Notification, line listing, infection prevention and risk communication"]),
  "com-immunisation":make("community-medicine","A child missing routine vaccinations","Missed immunisation","Mrs Maryam Sule","29 years","Female","Parent / caregiver","Primary healthcare centre","My child missed some injections because we could not come to the clinic on the last visit.","Mother of 14-month-old. Card shows BCG and early infant vaccines but missed later scheduled doses and measles-containing vaccine. Clinic 45 minutes away; transport costs and waiting time barriers. Grandmother believes vaccines cause infertility. No serious previous reaction. Child well.","Review reliable immunisation records against current national schedule and explore barriers without blame.",["Verify card, dates and missed doses","Reasons for missed visits and access barriers","Concerns, misinformation and prior adverse events","Catch-up plan, understanding and follow-up"]),
  "com-antenatal-access":make("community-medicine","Late antenatal booking in a rural community","Barriers to antenatal care","Mrs Hadiza Musa","25 years","Female","Patient","Community outreach","I am already several months pregnant, but I have not started antenatal care yet.","About 26 weeks pregnant by LMP. Not booked because centre is far, transport costly and partner works away. Family advised waiting. No current bleeding, severe headache, visual symptoms or reduced fetal movement. Second pregnancy; first delivered at home without skilled attendant. Wants care but worried about costs.","Antenatal access assessment: screen risk, explore barriers and link to respectful care.",["Gestational age and current danger signs","Previous pregnancy/delivery outcomes","Distance, transport, cost and decision-making barriers","Linkage to ANC and birth preparedness"]),
  "com-malaria-rise":make("community-medicine","A rise in fever cases after heavy rainfall","Increasing community fever cases","Mrs Beatrice Okon","40 years","Female","Primary healthcare nurse / informant","Local health office","Our clinic has seen many more patients with fever since the rains became heavy.","Clinic reports rise from about 10 febrile consultations/week to 28 over last month. Mainly children under five and pregnant women from three wards. RDT availability inconsistent; some receive antimalarials without testing. Stagnant water near homes. No line list or formal mortality signal.","Verify surveillance signal; assess denominator, testing, prevention and referral capacity.",["Baseline/current numbers and dates","Age, pregnancy, geography and severity","Testing, treatment and referral capacity","Vector exposure, prevention and data quality"]),

  "ortho-wrist-fracture":make("orthopaedics","Wrist pain and deformity after a fall","Wrist injury","Mrs Grace Nwachukwu","35 years","Female","Patient","Orthopaedic emergency clinic","I slipped and landed on my hand. My wrist is swollen and very painful.","Fall onto outstretched right hand three hours ago. Immediate pain, swelling and deformity. Can move fingers but pain limits movement. No open wound, numbness or tingling. Right-hand dominant. No previous wrist injury, osteoporosis or anticoagulant use.","Possible distal radius fracture; document skin and distal neurovascular status.",["Mechanism, time and hand dominance","Open wound, skin tenting and deformity","Distal sensation, movement, colour, warmth and pulses","Associated injuries and bone health"]),
  "ortho-hot-knee":make("orthopaedics","A hot, swollen knee with fever","Acute painful knee","Mr Patrick Eze","62 years","Male","Patient","Orthopaedic admissions","My right knee became swollen and very painful two days ago. I also have a fever.","Acute swollen hot right knee 48 hours, worsening; unable to bear weight. Fever and chills since yesterday. Type 2 diabetes with inconsistent treatment. No trauma, gout diagnosis, prosthetic joint, recent injection or surgery.","Septic arthritis must be considered urgently and excluded.",["Rapid onset, fever and inability to bear weight","Warmth, swelling and range-of-motion restriction","Diabetes, immunosuppression, skin infection and procedures","Gout, prosthetic joint and recent infection"]),
  "ortho-back-redflags":make("orthopaedics","Back pain with new bladder symptoms","Low back pain","Mr Lawrence Ekpo","51 years","Male","Patient","Emergency orthopaedic assessment","My lower back has been painful for days, and now I am struggling to pass urine.","Ten days low back pain after lifting. Now pain radiates down both posterior thighs. Difficulty initiating urination and reduced perineal sensation since this morning. New leg weakness. No known cancer, fever, major trauma or spinal surgery.","Possible cauda equina or another compressive spinal emergency; escalate immediately.",["Urinary retention/incontinence and bowel symptoms","Saddle/perineal sensory change","Bilateral radicular pain and progressive motor weakness","Cancer, infection, trauma, steroid use and immunosuppression"]),
  "ortho-leg-trauma":make("orthopaedics","Severe leg pain after a motorcycle collision","Lower limb injury","Mr Chima Nwafor","27 years","Male","Patient","Trauma unit","A motorcycle hit my leg. The pain is severe, and my lower leg has become swollen.","Motorcycle collision two hours ago. Closed right lower leg injury with deformity and severe pain. Increasing tightness, pain on passive toe stretch and foot tingling. No open wound or other reported injury. No anticoagulants or known comorbidity.","Possible tibial fracture with compartment syndrome risk.",["Mechanism and associated injuries","Open/closed injury and skin condition","Distal pulses, perfusion, sensation and motor function","Pain out of proportion and pain on passive stretch"])
};

const clean = (value:unknown,max:number) => typeof value === "string" ? value.trim().slice(0,max) : "";
const list = (value:unknown,limit:number,max:number) => Array.isArray(value) ? value.map(v=>clean(v,max)).filter(Boolean).slice(0,limit) : [];
function parseResult(value:unknown):Record<string,unknown>{
  const outer=value as {response?:unknown;result?:{response?:unknown}};
  const raw=outer?.response ?? outer?.result?.response ?? value;
  if(typeof raw==="object" && raw!==null) return raw as Record<string,unknown>;
  if(typeof raw!=="string") throw new Error("The case service returned an unexpected response.");
  const trimmed=raw.trim().replace(/^\u0060{3}(?:json)?\s*/i,"").replace(/\s*\u0060{3}$/i,"");
  const start=trimmed.indexOf("{"),end=trimmed.lastIndexOf("}");
  return JSON.parse(start>=0&&end>start?trimmed.slice(start,end+1):trimmed) as Record<string,unknown>;
}

const UNIT_FOCUS:Record<string,string>={
  "general-medicine":"Use comprehensive symptom analysis, associated symptoms, systems review, comorbidities and medication safety.",
  surgery:"Focus on surgical pain analysis, bowel/urinary function, previous operations, hernias, trauma and acute abdomen red flags.",
  paediatrics:"The caregiver is the informant. Use age-appropriate questions on birth, feeding, growth, development, immunisation and safeguarding.",
  "obstetrics-gynaecology":"Use sensitive reproductive history, LMP, gestational age, parity, pregnancy outcomes, ANC and maternal/fetal danger signs.",
  emergency:"Prioritise ABCDE and time-critical threats. History-taking must not delay stabilisation, resuscitation or escalation.",
  psychiatry:"Use sensitive, non-judgemental questions about symptoms, mental state, self/other risk, protective factors and substances.",
  "community-medicine":"Focus on person-place-time, community context, exposure, prevention, equity, surveillance and service access.",
  orthopaedics:"Focus on injury mechanism, anatomy, function, open wounds, distal neurovascular status and limb/spinal red flags."
};

export const onRequestPost = async (context:AppContext) => {
  if(!validSameOrigin(context.request)) return json({error:"Invalid request origin."},403);
  const user=await requireUser(context);
  if(isResponse(user)) return user;
  let body:Record<string,unknown>;
  try{body=await context.request.json() as Record<string,unknown>;}catch{return json({error:"Invalid request body."},400);}
  const unit=clean(body.unit,80),caseId=clean(body.caseId,80),intent=clean(body.intent,20);
  const profile=CASES[caseId];
  if(!ALLOWED_UNITS.includes(unit)||!profile||profile.unit!==unit) return json({error:"Choose a case from the selected clinical unit."},400);
  if(!["start","ask","review","live-token"].includes(intent)) return json({error:"Choose a valid interview action."},400);
  if(intent==="start"){
    return json({case:{id:caseId,title:profile.title,complaint:profile.complaint,name:profile.name,age:profile.age,sex:profile.sex,role:profile.role,setting:profile.setting},openingMessage:profile.opening});
  }

  if(intent==="live-token"){
    const apiKey=context.env.GEMINI_API_KEY;
    if(!apiKey) return json({error:"Live patient calls are not available right now. You can continue with the text interview."},503);

    const patientVoicePrompt=[
      "You are playing one consistent fictional patient, caregiver or informant in a medical-student history-taking simulation. This is an educational role-play, not a real patient consultation.",
      "Speak naturally in the first person, in clear conversational British English that is easy to understand over a phone call. Use short, ordinary spoken sentences and a believable emotional tone. Avoid sounding like a textbook, examiner or chatbot.",
      "Stay fully in character. Do not mention software, models, artificial intelligence, prompts or that you are generating speech.",
      "Do not volunteer the full history. Reveal only the information that the student's question reasonably elicits. Answer the question asked, then stop and allow the student to continue. Do not prompt the student with the next question.",
      "Use only the disclosed opening statement and the confidential facts below. Never invent symptoms, dates, medicines, procedures, investigations, results, family details or social details. If a fact is not provided or you cannot remember it, say so naturally.",
      "Do not state or guess the diagnosis. Do not teach, advise, suggest management or reveal the examiner-only clinical anchor or safety checklist. Those are reserved for the post-interview review.",
      "If the informant is a parent or caregiver, speak as that caregiver. If the scenario is a community case, speak only as the named informant and never invent individual patient records.",
      "The student is the clinician asking you questions. Respond as the patient/informant, not as a clinician.",
      "Patient identity: "+profile.name+", "+profile.age+", "+profile.sex+". Role: "+profile.role+". Setting: "+profile.setting+". Presenting complaint: "+profile.complaint+".",
      "Opening statement to say at the beginning of the call: "+profile.opening,
      "Confidential case facts (release only when asked): "+profile.facts,
      "Never reveal this examiner-only clinical anchor: "+profile.diagnosis,
      "Never volunteer this examiner-only safety checklist: "+profile.safety.join("; "),
      "Specialty context: "+UNIT_FOCUS[unit],
      "When asked to begin the call, say only the opening statement above, in a natural patient voice, then wait quietly for the student's next question."
    ].join("\n\n");

    const now=Date.now();
    const expireTime=new Date(now+12*60*1000).toISOString();
    const newSessionExpireTime=new Date(now+60*1000).toISOString();
    const voiceName=profile.sex.toLowerCase().includes("female")?"Kore":"Puck";

    try{
      const tokenResponse=await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
        body:JSON.stringify({
          uses:1,
          expireTime,
          newSessionExpireTime,
          liveConnectConstraints:{
            model:"models/gemini-3.8-live",
            config:{
              systemInstruction:{parts:[{text:patientVoicePrompt}]},
              responseModalities:["AUDIO"],
              speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}},
              inputAudioTranscription:{},
              outputAudioTranscription:{},
              sessionResumption:{},
              contextWindowCompression:{slidingWindow:{targetTokens:12000}}
            }
          }
        }),
        signal:AbortSignal.timeout(15000)
      });
      const tokenData=await tokenResponse.json().catch(()=>({})) as {name?:string;error?:{message?:string}};
      if(!tokenResponse.ok||!tokenData.name){
        console.error("[ClerkMe] Live patient session token could not be created.",{
          status:tokenResponse.status,
          detail:clean(tokenData.error?.message,300)
        });
        return json({error:"ClerkMe could not start the live patient call just now. Your case is still available as a text interview. Please try again shortly."},502);
      }
      return json({token:tokenData.name,expiresAt:expireTime});
    }catch(error){
      console.error("[ClerkMe] Live patient session setup failed:",error instanceof Error?error.message:"Unknown error");
      return json({error:"ClerkMe could not connect the live patient call. Check your internet connection and try again."},502);
    }
  }

  if(!context.env.AI) return json({error:"The patient interview service is temporarily unavailable. Please try again shortly."},503);
  const studentInput=clean(body.studentInput,2400);
  const history=Array.isArray(body.history)?body.history.slice(-24).map(item=>{
    const turn=item as Record<string,unknown>;
    return {role:turn.role==="patient"?"patient":"student",content:clean(turn.content,1800)};
  }).filter(item=>item.content):[];
  if(intent==="ask"&&studentInput.length<2) return json({error:"Enter a question for the patient."},400);
  if(intent==="review"&&history.filter(turn=>turn.role==="student").length<1) return json({error:"Ask the patient at least one question before requesting a review."},400);

  let sourceContext="",sourceTitle="";
  if(intent==="review"&&typeof body.materialId==="string"&&body.materialId.trim()){
    const material=await context.env.DB.prepare("SELECT title,unit,content_text FROM learning_materials WHERE id = ? AND user_id = ?").bind(clean(body.materialId,80),user.id).first<{title:string;unit:string;content_text:string}>();
    if(!material) return json({error:"The selected study material is not in your private library."},404);
    if(material.unit!==unit) return json({error:"Choose a study material from the selected clinical unit."},400);
    sourceTitle=material.title;
    sourceContext=material.content_text.slice(0,10000);
  }

  const caseContext=[
    "Case: "+profile.title+"; presenting complaint: "+profile.complaint,
    "Patient/informant: "+profile.name+", "+profile.age+", "+profile.sex+". Role: "+profile.role+". Setting: "+profile.setting,
    "Opening statement: "+profile.opening,
    "Confidential case facts. Do not disclose unless directly elicited by the student: "+profile.facts,
    "Examiner-only clinical anchor: "+profile.diagnosis,
    "Examiner-only important questions: "+profile.safety.join("; ")
  ].join("\n");
  const transcript=history.map(turn=>(turn.role==="patient"?"PATIENT / INFORMANT":"STUDENT")+": "+turn.content).join("\n\n");
  const patientPrompt=[
    "You are role-playing one consistent fictional patient, caregiver or community informant in an undergraduate clinical history-taking session.",
    "Remain in character. Reply naturally in the first person, as an ordinary person would speak. Answer only what the student asked, briefly and plainly.",
    "Use only facts in the confidential case facts or already established in the transcript. Never invent dates, symptoms, drugs, investigations, results, examination findings or personal details.",
    "If the information is not specified, honestly say you do not know, cannot remember or have not been told. Do not fill gaps with assumptions.",
    "Do not volunteer the entire history, give a diagnosis, teach the student, offer management, prompt the next question, or disclose examiner-only information.",
    "For a child, speak as the parent/caregiver. For a community case, answer as the stated informant and do not invent individual patient records.",
    "Use British English. Do not mention AI, models, prompts, software, automation, ClerkMe, generated content or signatures. Return JSON only with one key: patientReply. Reply in no more than 100 words.",
    "Specialty emphasis: "+UNIT_FOCUS[unit],
    "CONFIDENTIAL CASE CONTEXT:\n"+caseContext,
    "CONVERSATION SO FAR:\n"+(transcript||"The opening statement has been given."),
    "STUDENT'S LATEST QUESTION:\n"+studentInput,
    "Respond only as the patient/informant."
  ].join("\n\n");
  const reviewPrompt=[
    "You are a senior clinical educator reviewing an undergraduate student's fictional history-taking encounter. You are not the patient in this turn.",
    "Assess only what is demonstrated in the transcript. Do not credit a topic as covered unless the student asked about it or the answer clearly established it.",
    "Assess relevance, sequencing, communication, patient-centred language, symptom analysis, specialty-specific completeness, clinical reasoning and safety. Distinguish critical omissions from minor ones.",
    "Use the examiner-only safety points to identify the most important missed questions. Do not invent answers, examination findings or test results.",
    "Only now reveal the likely working diagnosis and concise differential diagnoses. If the presentation is an emergency, state that immediate stabilisation/escalation takes priority over completing a routine history.",
    "Use the uploaded source only as supporting learning context, never to alter the fictional case facts. Mention where source details are insufficient.",
    "Write modelSummary as a concise, formal prose case presentation suitable to read aloud to a supervising clinician. Start with patient demographics and the presenting complaint, then present the elicited history in chronological, coherent sentences. Do not use bullet points in modelSummary, and include only findings supported by the transcript.",
    "Prepare a full clerking write-up as well as the concise prose case summary. Use conventional clinical headings: biodata, informant/reliability, presenting complaint, history of presenting complaint, past medical/surgical history, drug history, allergies, family history, social history, review of systems, examination/vital signs, assessment, differentials, investigations, management plan, safety-netting and follow-up.",
    "Use only information disclosed in the interview transcript plus the stated biodata and presenting complaint. Do not reveal confidential case facts that the student did not elicit. Do not invent symptoms, findings, examination, vital signs, test results or management. Clearly mark each heading as 'Not elicited in this interview' or 'Not assessed' when the transcript does not support it. Do not interpret an unasked symptom as a negative finding.",
    "Write fullClerking as a readable, structured clinical document with a heading and a separate paragraph for each section. Keep British English, professional clinical language and clear chronology. The full report is an educational record of this simulation, not a real patient record.",
    "Do not mention AI, models, prompts, software, automation, ClerkMe, generated content or signatures. Use British English. Return JSON only.",
    "Specialty emphasis: "+UNIT_FOCUS[unit],
    "CONFIDENTIAL CASE CONTEXT:\n"+caseContext,
    "STUDENT/PATIENT TRANSCRIPT:\n"+(transcript||"No interview."),
    sourceContext?"OPTIONAL STUDY SOURCE: "+sourceTitle+"\n"+sourceContext:"",
    "Return exactly: {score,scoreLabel,feedback,strengths,corrections,redFlagsMissed,clinicalReasoning,workingDiagnosis,differentialDiagnoses,modelSummary,fullClerking,nextSteps,safetyNote}. Score integer 0-100. Keep feedback specific, fair and useful. fullClerking must be the complete sectioned write-up, not a list of recommendations."
  ].filter(Boolean).join("\n\n");

  try{
    const result=await context.env.AI.run(MODEL,{
      messages:[
        {role:"system",content:intent==="ask"?patientPrompt:reviewPrompt},
        {role:"user",content:intent==="ask"?"Respond to the student's latest history question as the patient/informant.":"Review the student's history-taking performance and return structured feedback."}
      ],
      response_format:{type:"json_object"},
      max_tokens:intent==="ask"?420:3400
    });
    const parsed=parseResult(result);
    if(intent==="ask"){
      const patientReply=clean(parsed.patientReply,900);
      if(!patientReply) throw new Error("The patient response was empty. Please try again.");
      return json({patientReply});
    }
    const score=Number(parsed.score);
    const response={
      score:Number.isFinite(score)?Math.max(0,Math.min(100,Math.round(score))):0,
      scoreLabel:clean(parsed.scoreLabel,80)||"History-taking review",
      feedback:clean(parsed.feedback,2200),
      strengths:list(parsed.strengths,8,420),
      corrections:list(parsed.corrections,10,520),
      redFlagsMissed:list(parsed.redFlagsMissed,8,420),
      clinicalReasoning:clean(parsed.clinicalReasoning,1800),
      workingDiagnosis:clean(parsed.workingDiagnosis,260),
      differentialDiagnoses:list(parsed.differentialDiagnoses,6,220),
      modelSummary:clean(parsed.modelSummary,1800),
      fullClerking:clean(parsed.fullClerking,10000),
      nextSteps:list(parsed.nextSteps,8,420),
      safetyNote:clean(parsed.safetyNote,900)
    };
    if(!response.feedback) throw new Error("The history review was incomplete. Please try again.");
    return json(response);
  }catch(error){
    return aiFailureResponse(error, "The patient interview is temporarily unavailable. Please try again later.");
  }
};
