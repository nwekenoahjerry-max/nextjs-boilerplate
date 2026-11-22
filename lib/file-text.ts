export type ExtractedStudyFile = { name: string; text: string };
export const STUDY_FILE_ACCEPT = ".pdf,.pptx,.docx,.xlsx,.txt,.md,.csv,.rtf,.html,.htm,.json,.png,.jpg,.jpeg,.webp,.heic,.heif";
export const STUDY_FILE_TYPES = "PDF, PowerPoint, Word, Excel, text, CSV, RTF, HTML, JSON and common image files";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 120000;
const MIN_USABLE_TEXT = 100;

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

let pdfJsPromise: Promise<PdfJsLibrary> | null = null;

function getPdfJsGlobal(): PdfJsLibrary | undefined {
  return (window as unknown as Record<string, unknown>).pdfjsLib as PdfJsLibrary | undefined;
}

async function loadPdfJs(): Promise<PdfJsLibrary> {
  const available = getPdfJsGlobal();
  if (available) return available;
  if (!pdfJsPromise) {
    pdfJsPromise = new Promise<PdfJsLibrary>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-clerkme-pdfjs="true"]');
      const script = existing || document.createElement("script");
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        if (error) { reject(error); return; }
        const library = getPdfJsGlobal();
        if (!library) { reject(new Error("The PDF reader loaded but did not initialise. Please retry.")); return; }
        library.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(library);
      };
      const timeout = window.setTimeout(() => finish(new Error("The PDF reader took too long to load. Check your connection and retry.")), 20000);
      script.addEventListener("load", () => finish(), { once: true });
      script.addEventListener("error", () => finish(new Error("The PDF reader could not load. Check your connection and retry.")), { once: true });
      if (!existing) {
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.async = true;
        script.dataset.clerkmePdfjs = "true";
        document.head.appendChild(script);
      } else if (getPdfJsGlobal()) {
        finish();
      }
    }).catch(error => {
      pdfJsPromise = null;
      throw error;
    });
  }
  return pdfJsPromise;
}

async function unzipTextFiles(
  buffer: ArrayBuffer,
  predicate: (name: string) => boolean
): Promise<Array<{ name: string; text: string }>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = Math.max(0, bytes.length - 65557); i <= bytes.length - 22; i++) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This file is not a readable Office Open XML document. Please try saving it as PPTX, DOCX or XLSX.");
  const entries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const output: Array<{ name: string; text: string }> = [];
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
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("A document or spreadsheet section could not be read.");
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.slice(dataStart, dataStart + compressedSize);
      let uncompressed: Uint8Array;
      if (method === 0) uncompressed = compressed;
      else if (method === 8) {
        if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack this Office file. Please save it as PDF and upload it again.");
        const payload = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength) as ArrayBuffer;
        const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
        uncompressed = new Uint8Array(await new Response(stream).arrayBuffer());
      } else {
        offset += 46 + nameLength + extraLength + commentLength;
        continue;
      }
      output.push({ name, text: new TextDecoder().decode(uncompressed) });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return output;
}

function parseXml(xml: string): Document {
  const documentValue = new DOMParser().parseFromString(xml, "application/xml");
  if (documentValue.querySelector("parsererror")) throw new Error("A section of this document contains invalid XML and could not be read.");
  return documentValue;
}

function xmlText(xml: string, tag: string) {
  const doc = parseXml(xml);
  return Array.from(doc.getElementsByTagName("*"))
    .filter(node => node.localName === tag)
    .map(node => node.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");
}

function paragraphText(element: Element) {
  return Array.from(element.getElementsByTagName("*"))
    .filter(node => node.localName === "t")
    .map(node => node.textContent || "")
    .join("")
    .trim();
}

function extractPptxSlide(xml: string) {
  const doc = parseXml(xml);
  const textBodies = Array.from(doc.getElementsByTagName("*")).filter(node => node.localName === "txBody");
  const blocks = textBodies.map((body, index) => {
    const paragraphs = Array.from(body.getElementsByTagName("*"))
      .filter(node => node.localName === "p")
      .map(paragraphText)
      .filter(Boolean);
    return paragraphs.length ? "TEXT BLOCK " + (index + 1) + "\n" + paragraphs.join("\n") : "";
  }).filter(Boolean);
  return blocks.join("\n\n") || xmlText(xml, "t");
}

function extractDocx(xml: string) {
  const doc = parseXml(xml);
  const body = Array.from(doc.getElementsByTagName("*")).find(node => node.localName === "body");
  if (!body) return xmlText(xml, "t");
  const blocks = Array.from(body.children).map(child => {
    if (child.localName === "p") return paragraphText(child);
    if (child.localName !== "tbl") return "";
    const rows = Array.from(child.getElementsByTagName("*")).filter(node => node.localName === "tr");
    return rows.map(row => {
      const cells = Array.from(row.children).filter(cell => cell.localName === "tc")
        .map(cell => Array.from(cell.getElementsByTagName("*")).filter(node => node.localName === "p").map(paragraphText).filter(Boolean).join(" "));
      return cells.length ? "| " + cells.join(" | ") + " |" : "";
    }).filter(Boolean).join("\n");
  }).filter(Boolean);
  return blocks.join("\n\n");
}

function extractXlsx(entries: Array<{ name: string; text: string }>) {
  const entry = (name: string) => entries.find(item => item.name.toLowerCase() === name.toLowerCase())?.text || "";
  const sharedXml = entry("xl/sharedStrings.xml");
  const sharedStrings = sharedXml
    ? Array.from(parseXml(sharedXml).getElementsByTagName("*"))
        .filter(node => node.localName === "si")
        .map(node => Array.from(node.getElementsByTagName("*")).filter(child => child.localName === "t").map(child => child.textContent || "").join(""))
    : [];
  const sheetFiles = entries
    .filter(item => /^xl\/worksheets\/sheet\d+\.xml$/i.test(item.name))
    .sort((a, b) => Number(a.name.match(/sheet(\d+)/i)?.[1] || 0) - Number(b.name.match(/sheet(\d+)/i)?.[1] || 0));
  const workbookXml = entry("xl/workbook.xml");
  const sheetNames = workbookXml
    ? Array.from(parseXml(workbookXml).getElementsByTagName("*")).filter(node => node.localName === "sheet").map(node => node.getAttribute("name") || "")
    : [];
  if (!sheetFiles.length) throw new Error("No readable worksheets were found in this Excel file.");
  return sheetFiles.map((sheet, sheetIndex) => {
    const doc = parseXml(sheet.text);
    const rows = Array.from(doc.getElementsByTagName("*")).filter(node => node.localName === "row");
    const rowText = rows.map((row, rowIndex) => {
      const cells = Array.from(row.getElementsByTagName("*")).filter(node => node.localName === "c");
      const values = cells.map(cell => {
        const ref = cell.getAttribute("r") || "";
        const type = cell.getAttribute("t") || "";
        const valueNode = Array.from(cell.getElementsByTagName("*")).find(node => node.localName === "v");
        const inlineNode = Array.from(cell.getElementsByTagName("*")).filter(node => node.localName === "t").map(node => node.textContent || "").join("");
        const raw = valueNode?.textContent || "";
        const formula = Array.from(cell.getElementsByTagName("*")).find(node => node.localName === "f")?.textContent || "";
        const value = type === "s" ? (sharedStrings[Number(raw)] ?? raw) : type === "inlineStr" ? inlineNode : raw;
        const displayed = value || (formula ? "=" + formula : "");
        return displayed ? (ref ? ref + ": " : "") + displayed : "";
      }).filter(Boolean);
      return values.length ? "ROW " + (row.getAttribute("r") || String(rowIndex + 1)) + " · " + values.join(" | ") : "";
    }).filter(Boolean);
    return "SHEET: " + (sheetNames[sheetIndex] || "Sheet " + (sheetIndex + 1)) + "\n" + rowText.join("\n");
  }).join("\n\n");
}

function extractRtf(value: string) {
  return value
    .replace(/\\par[d]?\b/g, "\n")
    .replace(/\\line\b/g, "\n")
    .replace(/\\tab\b/g, "\t")
    .replace(/\\u(-?\d+)\??/g, (_match, code: string) => String.fromCharCode(Number(code) < 0 ? Number(code) + 65536 : Number(code)))
    .replace(/\\'[0-9a-f]{2}/gi, match => String.fromCharCode(parseInt(match.slice(2), 16)))
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/\\[^a-zA-Z]/g, " ")
    .replace(/[{}]/g, "")
    .replace(/\n[ \t]+/g, "\n");
}

function extractHtml(value: string) {
  const doc = new DOMParser().parseFromString(value, "text/html");
  doc.querySelectorAll("script,style,noscript,svg,iframe,object").forEach(node => node.remove());
  doc.querySelectorAll("br").forEach(node => node.replaceWith("\n"));
  doc.querySelectorAll("td,th").forEach(node => node.append("\t"));
  doc.querySelectorAll("p,div,section,article,li,tr,h1,h2,h3,h4,h5,h6").forEach(node => node.append("\n"));
  return (doc.body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inferredImageMime(file: File, extension: string) {
  if (file.type && file.type.startsWith("image/")) return file.type;
  const known: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
    heic: "image/heic", heif: "image/heif"
  };
  return known[extension] || "";
}

async function requestVisualExtraction(file: File, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("mimeType", mimeType);
  const response = await fetch("/api/learning/extract", {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    body: form
  });
  const data = await response.json().catch(() => ({ error: "The document extraction service returned an unreadable response." }));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "ClerkME could not read the scanned document.");
  return typeof data.text === "string" ? data.text.trim() : "";
}

async function extractPdfText(file: File): Promise<{ text: string; numPages: number; imageOnlyPages: number }> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > 200) throw new Error("This PDF contains more than 200 pages. Split it into smaller sections so ClerkMe can preserve the complete source.");
  const pages: string[] = [];
  let imageOnlyPages = 0;
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str || "").join(" ").trim();
    if (pageText.length < 20) imageOnlyPages++;
    pages.push("PAGE " + pageNumber + "\n" + pageText);
  }
  return { text: pages.join("\n\n"), numPages: pdf.numPages, imageOnlyPages };
}
export async function extractStudyFile(file: File): Promise<ExtractedStudyFile> {
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new Error("This file is larger than 20 MB. Please compress it or split it into smaller parts.");
  const name = file.name;
  const extension = name.split(".").pop()?.toLowerCase() || "";
  let text = "";

  if (["txt", "md", "csv"].includes(extension)) {
    text = await file.text();
  } else if (extension === "json") {
    const raw = await file.text();
    try { text = JSON.stringify(JSON.parse(raw), null, 2); }
    catch { throw new Error("This JSON file is not valid. Please correct it and upload it again."); }
  } else if (["html", "htm"].includes(extension)) {
    text = extractHtml(await file.text());
  } else if (extension === "rtf") {
    text = extractRtf(await file.text());
  } else if (extension === "pptx") {
    const entries = await unzipTextFiles(await file.arrayBuffer(), entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry));
    entries.sort((a, b) => Number(a.name.match(/slide(\d+)/i)?.[1] || 0) - Number(b.name.match(/slide(\d+)/i)?.[1] || 0));
    text = entries.map((entry, index) => "SLIDE " + (index + 1) + "\n" + extractPptxSlide(entry.text)).join("\n\n");
    if (!text.trim()) throw new Error("No readable text was found in this PowerPoint. Try exporting the slides as PDF if they contain images or scanned text.");
  } else if (extension === "docx") {
    const entries = await unzipTextFiles(await file.arrayBuffer(), entry => entry === "word/document.xml");
    text = entries.map(entry => extractDocx(entry.text)).join("\n");
    if (!text.trim()) throw new Error("No readable text was found in this Word document. Try saving it as PDF and upload again.");
  } else if (extension === "xlsx") {
    const entries = await unzipTextFiles(await file.arrayBuffer(), entry => entry === "xl/sharedStrings.xml" || entry === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry));
    text = extractXlsx(entries);
  } else if (extension === "pdf") {
    try {
      const extracted = await extractPdfText(file);
      text = extracted.text;
      // Some PDFs mix selectable pages with scans. Do not silently drop the
      // image-only pages from the study guide.
      if (extracted.imageOnlyPages > 0) text = await requestVisualExtraction(file, "application/pdf");
    } catch (error) {
      if (error instanceof Error && /more than 200 pages/.test(error.message)) throw error;
      // Scanned PDFs contain page images rather than selectable text. Let the
      // authenticated server-side Gemini OCR path read the original PDF.
      text = await requestVisualExtraction(file, "application/pdf");
    }

  } else {
    const imageMime = inferredImageMime(file, extension);
    if (imageMime) {
      text = await requestVisualExtraction(file, imageMime);
    } else {
      throw new Error("This file format is not supported yet. Use PDF, PPTX, DOCX, XLSX, TXT, MD, CSV, RTF, HTML, JSON, PNG, JPG, WEBP, HEIC or HEIF. Legacy PPT, DOC and XLS files should be saved as their modern format or PDF.");
    }
  }

  text = text.replace(/\x00/g, " ").trim();
  if (text.length > MAX_EXTRACTED_CHARS) {
    throw new Error("This document contains more than 120,000 extracted characters. Split it into smaller files so ClerkME can preserve and analyse the complete source.");
  }
  if (text.length < MIN_USABLE_TEXT) {
    throw new Error("ClerkME could not extract enough readable text from this file to generate a reliable study guide. For image-only documents, check that the pages are clear and try a PDF or image export.");
  }
  return { name, text };
}

export function loadPdfJsLibrary() { return loadPdfJs(); }
