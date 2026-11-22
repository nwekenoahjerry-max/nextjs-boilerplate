"use client";

import { useEffect, useRef, useState } from "react";
import { loadPdfJsLibrary } from "../lib/file-text";

type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void>; cancel?: () => void };
};
type PdfDocument = { numPages: number; getPage: (page: number) => Promise<PdfPage> };
type PdfRuntime = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (config: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
};

type Props = { sourceUrl: string; fileName: string };

function readError(status: number) {
  if (status === 401 || status === 403) return "Your session has expired. Sign in again to read this file.";
  if (status === 404) return "The original PDF is not available. Re-upload it to restore the source file.";
  return "ClerkME could not retrieve this PDF. Please try again.";
}

export default function PdfSourceReader({ sourceUrl, fileName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderSequence = useRef(0);
  const renderTask = useRef<{ cancel?: () => void } | null>(null);
  const [documentFile, setDocumentFile] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(760);
  const [zoom, setZoom] = useState("fit");
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setDocumentFile(null);
    setPageCount(0);
    setPageNumber(1);

    const open = async () => {
      try {
        const response = await fetch(sourceUrl, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(readError(response.status));
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const pdfjs = await loadPdfJsLibrary() as PdfRuntime;
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
        if (cancelled) return;
        if (!pdf.numPages) throw new Error("No pages were found in this PDF.");
        setDocumentFile(pdf);
        setPageCount(pdf.numPages);
        setLoading(false);
      } catch (reason) {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "ClerkME could not open this PDF.");
        setLoading(false);
      }
    };
    void open();
    return () => {
      cancelled = true;
      renderSequence.current += 1;
      renderTask.current?.cancel?.();
      renderTask.current = null;
    };
  }, [sourceUrl]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => setContainerWidth(Math.max(280, Math.floor(element.clientWidth)));
    updateWidth();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (!documentFile || !canvasRef.current || !containerRef.current) return;
    let cancelled = false;
    const sequence = ++renderSequence.current;
    renderTask.current?.cancel?.();
    setRendering(true);

    const draw = async () => {
      try {
        const page = await documentFile.getPage(pageNumber);
        if (cancelled || sequence !== renderSequence.current) return;
        const base = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(260, containerWidth - 28);
        const fitScale = Math.min(1.8, Math.max(0.35, availableWidth / base.width));
        const cssScale = zoom === "fit" ? fitScale : Number(zoom) / 100;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        canvas.style.width = Math.round(base.width * cssScale) + "px";
        canvas.style.height = Math.round(base.height * cssScale) + "px";
        canvas.style.maxWidth = "none";
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Your browser could not prepare the PDF page.");
        const task = page.render({ canvasContext: context, viewport: renderViewport });
        renderTask.current = task;
        await task.promise;
        if (!cancelled && sequence === renderSequence.current) setRendering(false);
      } catch (reason) {
        if (cancelled || sequence !== renderSequence.current) return;
        const message = reason instanceof Error ? reason.message : "The PDF page could not be rendered.";
        if (!/cancel/i.test(message)) setError(message);
        setRendering(false);
      }
    };
    void draw();
    return () => {
      cancelled = true;
      renderTask.current?.cancel?.();
    };
  }, [documentFile, pageNumber, containerWidth, zoom]);

  const goToPage = (next: number) => setPageNumber(Math.max(1, Math.min(pageCount, next)));
  const percentage = pageCount ? Math.round((pageNumber / pageCount) * 100) : 0;

  return (
    <section className="pdf-source-reader" aria-label={"PDF reader: " + fileName}>
      <div className="pdf-source-toolbar">
        <div className="pdf-source-page-controls">
          <button type="button" onClick={() => goToPage(pageNumber - 1)} disabled={loading || pageNumber <= 1} aria-label="Previous PDF page">‹</button>
          <span aria-live="polite">Page <strong>{loading ? "—" : pageNumber}</strong> of {pageCount || "—"}</span>
          <button type="button" onClick={() => goToPage(pageNumber + 1)} disabled={loading || pageNumber >= pageCount} aria-label="Next PDF page">›</button>
        </div>
        <label className="pdf-source-zoom">Zoom
          <select value={zoom} onChange={event => setZoom(event.target.value)} disabled={loading}>
            <option value="fit">Fit width</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
          </select>
        </label>
      </div>
      <div className="pdf-source-progress" aria-hidden="true"><span style={{ width: percentage + "%" }} /></div>
      <div className="pdf-source-canvas-wrap" ref={containerRef}>
        {loading && <div className="source-preview-loading" role="status">Opening your original PDF…</div>}
        {error && <div className="source-preview-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => window.location.reload()}>Refresh ClerkME</button></div>}
        {!loading && !error && <div className="pdf-source-canvas-inner">
          <canvas ref={canvasRef} aria-label={"Page " + pageNumber + " of " + pageCount} />
          {rendering && <span className="pdf-source-rendering" role="status">Rendering page…</span>}
        </div>}
      </div>
      <div className="pdf-source-footer"><span>Original PDF · {pageCount ? pageCount + " pages" : "Loading page count…"}</span><span>Use the page arrows or swipe/scroll to read.</span></div>
    </section>
  );
}
