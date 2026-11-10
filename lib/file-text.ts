export type ExtractedStudyFile = { name: string; text: string };

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 42000;

async function unzipTextFiles(buffer: ArrayBuffer, predicate: (name: string) => boolean): Promise<Array<{name:string;text:string}>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This file is not a readable Office Open XML document. Please use .pptx or .docx.");
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const output: Array<{name:string;text:string}> = [];
  for (let i = 0; i < entries; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    if (predicate(name)) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("A slide or document entry could not be read.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let uncompressed: Uint8Array;
      if (method === 0) uncompressed = compressed;
      else if (method === 8) {
        const payload = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
        const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
        uncompressed = new Uint8Array(await new Response(stream).arrayBuffer());
      } else continue;
      output.push({ name, text: new TextDecoder().decode(uncompressed) });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return output;
}

function xmlText(xml: string, tag: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return "";
  return Array.from(doc.getElementsByTagName("*"))
    .filter(node => node.localName === tag)
    .map(node => node.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

type PdfJsLibrary = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (config: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (page: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
      }>;
    }>;
  };
};

async function loadPdfJs(): Promise<PdfJsLibrary> {
  const getLibrary = () => (window as unknown as Record<string, unknown>).pdfjsLib as PdfJsLibrary | undefined;
  const existingLibrary = getLibrary();
  if (existingLibrary) return existingLibrary;
  await new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-clerkme-pdfjs="true"]');
    if(existing){existing.addEventListener("load",()=>resolve(),{once:true});existing.addEventListener("error",()=>reject(new Error("PDF reader could not load. Try a PPTX or text file.")),{once:true});return;}
    const script=document.createElement("script");
    script.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async=true;script.dataset.clerkmePdfjs="true";
    script.onload=()=>resolve();script.onerror=()=>reject(new Error("PDF reader could not load. Try a PPTX or text file."));
    document.head.appendChild(script);
  });
  const library=getLibrary();
  if(!library) throw new Error("PDF reader did not initialise. Try a PPTX or text file.");
  library.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return library;
}

export async function extractStudyFile(file: File): Promise<ExtractedStudyFile> {
  if(file.size===0) throw new Error("The selected file is empty.");
  if(file.size>MAX_FILE_BYTES) throw new Error("This file is larger than 20 MB. Please compress it or split it into smaller parts.");
  const name=file.name;
  const extension=name.split(".").pop()?.toLowerCase() || "";
  let text="";
  if(["txt","md","csv"].includes(extension)) {
    text=await file.text();
  } else if(extension==="pptx") {
    const entries=await unzipTextFiles(await file.arrayBuffer(),n=>/^ppt\/slides\/slide\d+\.xml$/i.test(n));
    entries.sort((a,b)=>Number(a.name.match(/slide(\d+)/i)?.[1]||0)-Number(b.name.match(/slide(\d+)/i)?.[1]||0));
    text=entries.map((entry,i)=>"SLIDE "+(i+1)+"\n"+xmlText(entry.text,"t")).join("\n\n");
  } else if(extension==="docx") {
    const entries=await unzipTextFiles(await file.arrayBuffer(),n=>n==="word/document.xml");
    text=entries.map(entry=>xmlText(entry.text,"t")).join("\n");
  } else if(extension==="pdf") {
    const pdfjs=await loadPdfJs();
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    const pages:string[]=[];
    for(let pageNumber=1;pageNumber<=Math.min(pdf.numPages,200);pageNumber++){
      const page=await pdf.getPage(pageNumber);
      const content=await page.getTextContent();
      pages.push("PAGE "+pageNumber+"\n"+content.items.map(item=>item.str||"").join(" "));
    }
    text=pages.join("\n\n");
  } else {
    throw new Error("Use a .pptx, .pdf, .docx, .txt or .md file. Older .ppt files should first be saved as .pptx.");
  }
  text=text.replace(/\u0000/g," ").replace(/[ \t]+/g," ").replace(/\n{3,}/g,"\n\n").trim();
  if(text.length<100) throw new Error("Very little selectable text was found. This may be a scanned/image-only slide deck. Upload a text-based file or paste the slide text.");
  return {name,text:text.slice(0,MAX_EXTRACTED_CHARS)};
}
