const LATEX_SYMBOLS: Record<string, string> = {
  longrightarrow:"⟶", rightarrow:"→", to:"→", Longrightarrow:"⟹", Rightarrow:"⇒",
  longleftarrow:"⟵", leftarrow:"←", Leftarrow:"⇐", leftrightarrow:"↔", Leftrightarrow:"⇔",
  mapsto:"↦", uparrow:"↑", downarrow:"↓", updownarrow:"↕",
  times:"×", cdot:"·", div:"÷", pm:"±", mp:"∓",
  leq:"≤", le:"≤", geq:"≥", ge:"≥", neq:"≠", ne:"≠",
  approx:"≈", sim:"∼", propto:"∝", infty:"∞",
  alpha:"α", beta:"β", gamma:"γ", delta:"δ", Delta:"Δ",
  epsilon:"ε", theta:"θ", lambda:"λ", mu:"μ", pi:"π",
  rho:"ρ", sigma:"σ", tau:"τ", phi:"φ", omega:"ω",
  degree:"°", circ:"°", ell:"ℓ"
};

const HTML_ENTITIES: Record<string,string> = {
  amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ",
  rarr:"→", larr:"←", harr:"↔", rArr:"⇒", lArr:"⇐",
  hellip:"…", ndash:"–", mdash:"—", minus:"−", times:"×",
  middot:"·", deg:"°", alpha:"α", beta:"β", gamma:"γ",
  delta:"δ", mu:"μ", pi:"π"
};

function decodeStudyEntity(entity:string):string {
  const value=entity.slice(1,-1);
  if(value.startsWith("#")){
    const hex=value[1]?.toLowerCase()==="x";
    const codePoint=Number.parseInt(value.slice(hex?2:1),hex?16:10);
    if(!Number.isFinite(codePoint)||codePoint<0||codePoint>0x10ffff||(codePoint>=0xd800&&codePoint<=0xdfff))return " ";
    try{return String.fromCodePoint(codePoint);}catch{return " ";}
  }
  if(value==="Delta")return "Δ";
  return HTML_ENTITIES[value.toLowerCase()]??entity;
}

/** Repairs common OCR, HTML-entity and LaTeX artefacts; output remains safely escaped plain text. */
export function normaliseStudyText(value:unknown):string {
  if(typeof value!=="string")return "";
  let text=value
    .replace(/\r\n?/g,"\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF\uFFFD]/g,"")
    .replace(/[\uFB00-\uFB06]/g,character=>({
      "\uFB00":"ff","\uFB01":"fi","\uFB02":"fl","\uFB03":"ffi",
      "\uFB04":"ffl","\uFB05":"st","\uFB06":"st"
    }[character]||character))
    .replace(/&(?:#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi,decodeStudyEntity);

  text=text
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr|section|article|pre)>/gi,"\n")
    .replace(/<\/?(?:p|div|span|strong|b|em|i|u|ul|ol|li|h[1-6]|code|pre|section|article|table|thead|tbody|tr|td|th)\b[^>]*>/gi,"");

  text=text
    .replace(/\\begin\{(?:aligned|align\*?|equation\*?|gathered)\}/g,"\n")
    .replace(/\\end\{(?:aligned|align\*?|equation\*?|gathered)\}/g,"\n")
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|mbox)\s*\{([^{}]*)\}/g,"$1");
  for(let pass=0;pass<2;pass++)text=text.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,"($1)/($2)");

  text=text
    .replace(/\\(?:displaystyle|left|right|quad|qquad)\b/g,"")
    .replace(/\\[,;:!]/g,"")
    .replace(/\\\(/g,"").replace(/\\\)/g,"")
    .replace(/\\\[/g,"").replace(/\\\]/g,"")
    .replace(/\$\$([\s\S]*?)\$\$/g,"$1")
    .replace(/\$([^$\n]+)\$/g,"$1")
    .replace(/\\\$/g,"$");

  const commandNames=Object.keys(LATEX_SYMBOLS).sort((a,b)=>b.length-a.length).join("|");
  const commandPattern=new RegExp("\\\\+("+commandNames+")\\b","g");
  text=text.replace(commandPattern,(_match,command:string)=>LATEX_SYMBOLS[command]||command);
  return text
    .replace(/->/g,"→").replace(/<-/g,"←")
    .replace(/[ \t]+/g," ")
    .replace(/ *\n */g,"\n")
    .replace(/ +([,.;:!?])/g,"$1")
    .replace(/[ \t]{2,}/g," ")
    .replace(/[ \t]*(→|←|↔|⇒|⇔|⟶|⟵|⟹|↦)[ \t]*/g," $1 ")
    .replace(/ {2,}/g," ")
    .trim();
}

/** Normalises each textual leaf in a JSON value without mutating the original object. */
export function normaliseStudyStringsDeep<T>(value:T):T {
  if(typeof value==="string")return normaliseStudyText(value) as T;
  if(Array.isArray(value))return value.map(item=>normaliseStudyStringsDeep(item)) as T;
  if(value&&typeof value==="object"){
    const output:Record<string,unknown>={};
    for(const [key,item] of Object.entries(value as Record<string,unknown>))output[key]=normaliseStudyStringsDeep(item);
    return output as T;
  }
  return value;
}
