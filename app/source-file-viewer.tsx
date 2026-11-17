"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  materialId: string;
  fileName: string;
  mimeType: string | null;
  originalSizeBytes?: number | null;
};

type ViewerMode = "pdf" | "powerpoint" | "word" | "text" | "image" | "download";

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes < 1) return "";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function SourceFileViewer({ materialId, fileName, mimeType, originalSizeBytes }: Props) {
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
    setTextContent("");
    setError("");
    if (mode !== "text") return;
    setLoading(true);
    fetch(sourceUrl, { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "The original file could not be loaded.");
        }
        return response.text();
      })
      .then(content => { if (!cancelled) setTextContent(content); })
      .catch(problem => {
        if (!cancelled) setError(problem instanceof Error ? problem.message : "The original document could not be previewed.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, sourceUrl]);

  return (
    <div className="source-original-panel">
      <div className="source-original-toolbar">
        <div>
          <span className="eyebrow">ORIGINAL UPLOADED FILE</span>
          <strong>{fileName}</strong>
          <small>{formatBytes(originalSizeBytes) || "Original file"} · Stored privately; source file is not converted or overwritten</small>
        </div>
        <a className="secondary-button source-download-button" href={downloadUrl} download={fileName}>Download original</a>
      </div>

      {mode === "pdf" && (
        <iframe
          className="source-pdf-frame"
          title={"Original PDF: " + fileName}
          src={sourceUrl + "#toolbar=1&navpanes=0&view=FitH"}
        />
      )}
      {mode === "image" && (
        <div className="source-image-frame"><img src={sourceUrl} alt={"Original image file: " + fileName} /></div>
      )}
      {mode === "powerpoint" && (
        <div className="source-office-file-preview">
          <div className="source-office-file-icon" aria-hidden="true">PPT</div>
          <div>
            <strong>Your original PowerPoint presentation is preserved</strong>
            <p>ClerkMe stores this exact .{extension} file. It does not turn your slides into plain text, PDF pages or screenshots. Download the original presentation to open it in Microsoft PowerPoint with its original slide design, images, fonts, animations and transitions.</p>
            <a className="secondary-button" href={downloadUrl} download={fileName}>Download original PowerPoint</a>
          </div>
        </div>
      )}
      {mode === "word" && (
        <div className="source-office-file-preview">
          <div className="source-office-file-icon source-word-file-icon" aria-hidden="true">DOC</div>
          <div>
            <strong>Your original Word document is preserved</strong>
            <p>ClerkMe stores the original .{extension} file without rewriting its page layout or formatting. Download it to open in Microsoft Word.</p>
            <a className="secondary-button" href={downloadUrl} download={fileName}>Download original Word document</a>
          </div>
        </div>
      )}
      {loading && <div className="source-preview-loading">Loading your original text file…</div>}
      {error && <div className="source-preview-error" role="alert">{error}</div>}
      {mode === "text" && !loading && !error && <pre className="source-text-frame">{textContent}</pre>}
      {mode === "download" && (
        <div className="source-preview-fallback">
          <p>This file is kept in its original format. Download it to open with a compatible application.</p>
        </div>
      )}
      <p className="source-preview-note">PDF files can be viewed in ClerkMe. PowerPoint and Word files remain in their native Office formats and are downloaded unchanged for viewing in their original applications.</p>
    </div>
  );
}
