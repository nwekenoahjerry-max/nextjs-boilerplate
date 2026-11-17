"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const PowerPointViewer = dynamic(
  () => import("pptx-react-viewer").then(module => module.PowerPointViewer),
  { ssr: false, loading: () => <div className="source-preview-loading">Preparing the PowerPoint viewer…</div> }
);
const WordEditor = dynamic(
  () => import("docx-react-viewer").then(module => module.WordEditor),
  { ssr: false, loading: () => <div className="source-preview-loading">Preparing the Word viewer…</div> }
);

type Props = { materialId: string; fileName: string; mimeType: string | null; };
type ViewerMode = "pdf" | "powerpoint" | "word" | "text" | "image" | "download";

export default function SourceFileViewer({ materialId, fileName, mimeType }: Props) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [wordModel, setWordModel] = useState<any>(null);
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sourceUrl = useMemo(
    () => "/api/learning/materials/source?id=" + encodeURIComponent(materialId),
    [materialId]
  );
  const downloadUrl = sourceUrl + "&download=1";
  const extension = (fileName.split(".").pop() || "").toLowerCase();
  const mode: ViewerMode =
    extension === "pdf" ? "pdf" :
    ["pptx", "ppt", "ppsx", "pptm", "potx"].includes(extension) ? "powerpoint" :
    ["docx", "doc"].includes(extension) ? "word" :
    ["txt", "md", "csv"].includes(extension) ? "text" :
    (mimeType || "").startsWith("image/") ? "image" : "download";

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    setWordModel(null);
    setTextContent("");
    setError("");
    if (mode === "pdf" || mode === "image" || mode === "download") return;
    setLoading(true);
    fetch(sourceUrl, { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "The original file could not be loaded.");
        }
        return response.arrayBuffer();
      })
      .then(async buffer => {
        if (cancelled) return;
        const fileBytes = new Uint8Array(buffer);
        if (mode === "powerpoint") {
          setBytes(fileBytes);
        } else if (mode === "text") {
          setTextContent(new TextDecoder().decode(fileBytes));
        } else if (mode === "word") {
          const parser = await import("docx-vanilla-viewer");
          const loaded = await parser.loadDocument(fileBytes);
          if (!cancelled) setWordModel(loaded.model);
        }
      })
      .catch(problem => {
        if (!cancelled) setError(problem instanceof Error ? problem.message : "The original document could not be previewed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [mode, sourceUrl]);

  return (
    <div className="source-original-panel">
      <div className="source-original-toolbar">
        <div>
          <span className="eyebrow">ORIGINAL UPLOADED FILE</span>
          <strong>{fileName}</strong>
          <small>Stored in private R2 storage · Original file is not converted or overwritten</small>
        </div>
        <a className="secondary-button source-download-button" href={downloadUrl}>Download original</a>
      </div>

      {mode === "pdf" && <iframe className="source-pdf-frame" title={"Original PDF: " + fileName} src={sourceUrl + "#toolbar=1&navpanes=0&view=FitH"} />}
      {mode === "image" && <div className="source-image-frame"><img src={sourceUrl} alt={"Original image file: " + fileName} /></div>}
      {loading && <div className="source-preview-loading">Loading your original document…</div>}
      {error && <div className="source-preview-error" role="alert">{error}</div>}
      {mode === "powerpoint" && bytes && !loading && !error && (
        <div className="source-powerpoint-frame"><PowerPointViewer content={bytes} fileName={fileName} /></div>
      )}
      {mode === "word" && wordModel && !loading && !error && (
        <div className="source-word-frame"><WordEditor documentModel={wordModel} readOnly /></div>
      )}
      {mode === "text" && !loading && !error && <pre className="source-text-frame">{textContent}</pre>}
      {mode === "download" && <div className="source-preview-fallback"><p>This file is stored in its original format. Use the button above to open it with a compatible application.</p></div>}
      <p className="source-preview-note">The preview is rendered by your browser. Download the original file whenever you need the exact desktop PowerPoint, Word or PDF experience.</p>
    </div>
  );
}
