"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PptxRenderer from "../lib/pptx-browser/index.js";
import { formatSourceTextPreview } from "../lib/file-text";
import PdfSourceReader from "./pdf-source-reader";
import XlsxSourceReader from "./xlsx-source-reader";

type Props = {
  materialId: string;
  fileName: string;
  mimeType: string | null;
  originalSizeBytes?: number | null;
  extractedText?: string;
};

type ViewerMode = "pdf" | "powerpoint" | "word" | "spreadsheet" | "text" | "image" | "download";

type PptxRendererInstance = InstanceType<typeof PptxRenderer>;

type DocxFrameMessage = {
  type?: string;
  message?: string;
};

const DOCX_PREVIEW_FRAME = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ClerkMe Word document preview</title>
  <style>
    html, body { margin: 0; min-height: 100%; background: #F5F8FC; color: #102D5A; }
    body { padding: 16px 0 32px; overflow-x: auto; }
    #docx-preview { min-height: 80vh; }
    .docx-wrapper { padding: 18px 0 30px !important; background: #F5F8FC !important; }
    .docx { margin: 0 auto 18px !important; box-shadow: 0 3px 16px rgba(16,45,90,.12); }
    @media(max-width:640px) {
      body { padding: 8px 0 20px; }
      .docx-wrapper { padding: 8px 0 18px !important; }
    }
  </style>
  <script src="/vendor/jszip.min.js"></script>
  <script src="/vendor/docx-preview.min.js"></script>
</head>
<body>
  <main id="docx-preview" aria-live="polite"></main>
  <script>
    window.addEventListener("message", async function (event) {
      if (event.source !== window.parent || !event.data || event.data.type !== "CLERKME_RENDER_DOCX") return;
      const host = document.getElementById("docx-preview");
      try {
        if (!window.JSZip || !window.docx || typeof window.docx.renderAsync !== "function") {
          throw new Error("The Word document reader did not load. Refresh the page and try again.");
        }
        host.replaceChildren();
        await window.docx.renderAsync(
          event.data.buffer,
          host,
          document.head,
          {
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            renderComments: false,
            renderChanges: false,
            renderAltChunks: false,
            useBase64URL: true
          }
        );
        window.parent.postMessage({ type: "CLERKME_DOCX_RENDERED" }, "*");
      } catch (error) {
        window.parent.postMessage({
          type: "CLERKME_DOCX_ERROR",
          message: String(error && error.message ? error.message : error).slice(0, 450)
        }, "*");
      }
    });
  </script>
</body>
</html>`;

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes < 1) return "";
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function readableFileError(responseStatus: number) {
  if (responseStatus === 401 || responseStatus === 403) return "Your session has expired. Sign in again to read this material.";
  if (responseStatus === 404) return "The original file is not available. Re-upload this material to restore its original document.";
  return "ClerkMe could not retrieve the original file. Please try again.";
}

export default function SourceFileViewer({ materialId, fileName, mimeType, originalSizeBytes, extractedText = "" }: Props) {
  const [textContent, setTextContent] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState("");
  const [imagePreviewError, setImagePreviewError] = useState(false);

  const [pptxLoading, setPptxLoading] = useState(false);
  const [pptxProgress, setPptxProgress] = useState(0);
  const [pptxMessage, setPptxMessage] = useState("Preparing the PowerPoint reader…");
  const [pptxError, setPptxError] = useState("");
  const [pptxReady, setPptxReady] = useState(false);
  const [pptxSlideCount, setPptxSlideCount] = useState(0);
  const [pptxCurrentSlide, setPptxCurrentSlide] = useState(0);
  const [pptxRendering, setPptxRendering] = useState(false);
  const [pptxViewportWidth, setPptxViewportWidth] = useState(960);
  const [pptxViewportHeight, setPptxViewportHeight] = useState(600);
  const [pptxSlideAspectRatio, setPptxSlideAspectRatio] = useState(16 / 9);
  const [pptxRetry, setPptxRetry] = useState(0);
  const [pptxZoom, setPptxZoom] = useState<"fit" | "width" | "100" | "125" | "150" | "200">("width");
  const [pptxPlaying, setPptxPlaying] = useState(false);
  const [pptxSlideInterval, setPptxSlideInterval] = useState(6);
  const [pptxShowSlides, setPptxShowSlides] = useState(false);
  const [pptxFullscreen, setPptxFullscreen] = useState(false);
  const [pptxPresentationError, setPptxPresentationError] = useState("");

  const [docxFrameReady, setDocxFrameReady] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState("");
  const [docxRetry, setDocxRetry] = useState(0);

  const pptxRendererRef = useRef<PptxRendererInstance | null>(null);
  const pptxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pptxCanvasContainerRef = useRef<HTMLDivElement | null>(null);
  const pptxRenderSequenceRef = useRef(0);
  const pptxSwipeStartRef = useRef<{ x:number; y:number; pointerId:number } | null>(null);
  const pptxReaderRef = useRef<HTMLElement | null>(null);
  const docxFrameRef = useRef<HTMLIFrameElement | null>(null);

  const sourceUrl = useMemo(
    () => "/api/learning/materials/source?id=" + encodeURIComponent(materialId),
    [materialId]
  );
  const downloadUrl = sourceUrl + "&download=1";
  useEffect(() => { setImagePreviewError(false); }, [sourceUrl]);
  const extension = (fileName.split(".").pop() || "").toLowerCase();

  const mode: ViewerMode =
    extension === "pdf" ? "pdf" :
    extension === "pptx" ? "powerpoint" :
    extension === "docx" ? "word" :
    extension === "xlsx" ? "spreadsheet" :
    ["txt", "md", "csv", "rtf", "html", "htm", "json"].includes(extension) ? "text" :
    (mimeType || "").startsWith("image/") ? "image" : "download";

  useEffect(() => {
    if (!pptxPlaying || !pptxReady || pptxSlideCount < 1) return;
    if (pptxCurrentSlide >= pptxSlideCount - 1) {
      setPptxPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setPptxCurrentSlide(current => Math.min(pptxSlideCount - 1, current + 1));
    }, pptxSlideInterval * 1000);
    return () => window.clearTimeout(timer);
  }, [pptxPlaying, pptxReady, pptxCurrentSlide, pptxSlideCount, pptxSlideInterval]);

  useEffect(() => {
    const updateFullscreen = () => {
      setPptxFullscreen(document.fullscreenElement === pptxReaderRef.current);
    };
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const togglePptxFullscreen = async () => {
    const reader = pptxReaderRef.current;
    if (!reader) return;
    setPptxPresentationError("");
    try {
      if (document.fullscreenElement === reader) await document.exitFullscreen();
      else await reader.requestFullscreen();
    } catch {
      setPptxPresentationError("Full-screen presentation is not available in this browser. You can still use the enlarged slide view.");
    }
  };

  // PowerPoint is parsed and rendered in the student's browser. The original
  // PPTX is fetched only from ClerkMe's authenticated, private R2 endpoint.
  useEffect(() => {
    if (mode !== "powerpoint") return;
    let cancelled = false;
    const renderer = new PptxRenderer();
    pptxRendererRef.current = renderer;
    setPptxLoading(true);
    setPptxReady(false);
    setPptxError("");
    setPptxProgress(0);
    setPptxMessage("Loading the original PowerPoint file…");
    setPptxSlideCount(0);
    setPptxCurrentSlide(0);

    const load = async () => {
      try {
        const response = await fetch(sourceUrl, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!response.ok) throw new Error(readableFileError(response.status));
        const fileBuffer = await response.arrayBuffer();
        if (cancelled) return;

        setPptxMessage("Reading the presentation structure…");
        await renderer.load(new Uint8Array(fileBuffer), (progress, message) => {
          if (cancelled) return;
          setPptxProgress(Math.round(progress * 100));
          setPptxMessage(message || "Preparing slides…");
        });

        if (cancelled) return;
        if (!renderer.slideCount) throw new Error("No readable slides were found in this PowerPoint file.");
        setPptxSlideCount(renderer.slideCount);
        const slideInfo = renderer.getInfo();
        setPptxSlideAspectRatio(
          Number.isFinite(slideInfo.aspectRatio) && slideInfo.aspectRatio > 0
            ? slideInfo.aspectRatio
            : 16 / 9
        );
        setPptxCurrentSlide(0);
        setPptxReady(true);
        setPptxLoading(false);
      } catch (problem) {
        if (cancelled) return;
        setPptxError(problem instanceof Error ? problem.message : "The PowerPoint could not be opened.");
        setPptxLoading(false);
        setPptxReady(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      pptxRenderSequenceRef.current += 1;
      if (pptxRendererRef.current === renderer) pptxRendererRef.current = null;
      renderer.destroy();
    };
  }, [mode, sourceUrl, pptxRetry]);

  // Render one slide at a time to keep memory use predictable for large lectures.
  useEffect(() => {
    if (mode !== "powerpoint" || !pptxReady || pptxSlideCount < 1) return;
    const renderer = pptxRendererRef.current;
    const visibleCanvas = pptxCanvasRef.current;
    if (!renderer || !visibleCanvas) return;

    const sequence = ++pptxRenderSequenceRef.current;
    setPptxRendering(true);
    const render = async () => {
      try {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
        // Fit the complete slide inside both the available width and viewing height.
        const maxSlideHeight = Math.min(820, Math.max(320, pptxViewportHeight));
        const maxWidthForHeight = Math.round(maxSlideHeight * pptxSlideAspectRatio);
        const fittedWidth = Math.min(pptxViewportWidth, maxWidthForHeight);
        const fitToWindow = pptxZoom === "fit";
        const zoomFactor = fitToWindow || pptxZoom === "width" ? 1 : Number(pptxZoom) / 100;
        const baseWidth = fitToWindow ? fittedWidth : pptxViewportWidth;
        const displayWidth = Math.round(baseWidth * zoomFactor);
        const renderWidth = Math.min(3600, Math.max(320, Math.round(displayWidth * pixelRatio)));
        const slideCanvas = document.createElement("canvas");
        await renderer.renderSlide(pptxCurrentSlide, slideCanvas, renderWidth);
        if (sequence !== pptxRenderSequenceRef.current) return;

        visibleCanvas.width = slideCanvas.width;
        visibleCanvas.height = slideCanvas.height;
        visibleCanvas.style.width = displayWidth + "px";
        visibleCanvas.style.maxWidth = fitToWindow ? "100%" : "none";
        visibleCanvas.style.maxHeight = fitToWindow ? "min(72vh, 820px)" : "none";
        const context = visibleCanvas.getContext("2d");
        if (!context) throw new Error("Your browser could not prepare the slide canvas.");
        context.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
        context.drawImage(slideCanvas, 0, 0);
        setPptxRendering(false);
      } catch (problem) {
        if (sequence !== pptxRenderSequenceRef.current) return;
        setPptxError(problem instanceof Error ? problem.message : "This slide could not be rendered.");
        setPptxRendering(false);
      }
    };

    void render();
    return () => {
      if (sequence === pptxRenderSequenceRef.current) pptxRenderSequenceRef.current += 1;
    };
  }, [mode, pptxReady, pptxSlideCount, pptxCurrentSlide, pptxViewportWidth, pptxViewportHeight, pptxSlideAspectRatio, pptxZoom]);

  useEffect(() => {
    if (mode !== "powerpoint") return;
    const container = pptxCanvasContainerRef.current;
    if (!container) return;
    const updateDimensions = () => {
      const styles = window.getComputedStyle(container);
      const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      setPptxViewportWidth(Math.max(280, Math.round((container.clientWidth || 960) - horizontalPadding)));
      setPptxViewportHeight(Math.max(320, Math.round(window.innerHeight * 0.72)));
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    window.addEventListener("resize", updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [mode, pptxReady]);

  // The DOCX reader lives in an opaque-origin iframe: it can run the renderer,
  // but it cannot read ClerkMe cookies, local storage, or the parent app DOM.
  useEffect(() => {
    if (mode !== "word") return;
    const frame = docxFrameRef.current;
    if (!frame) return;

    const onMessage = (event: MessageEvent<DocxFrameMessage>) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === "CLERKME_DOCX_RENDERED") {
        setDocxLoading(false);
        setDocxError("");
      } else if (event.data?.type === "CLERKME_DOCX_ERROR") {
        setDocxLoading(false);
        setDocxError(event.data.message || "The Word document could not be rendered.");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mode, docxRetry]);

  useEffect(() => {
    if (mode !== "word" || !docxFrameReady) return;
    let cancelled = false;
    setDocxLoading(true);
    setDocxError("");

    const load = async () => {
      try {
        const response = await fetch(sourceUrl, {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!response.ok) throw new Error(readableFileError(response.status));
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const frameWindow = docxFrameRef.current?.contentWindow;
        if (!frameWindow) throw new Error("The secure Word reading frame is unavailable.");
        frameWindow.postMessage({ type: "CLERKME_RENDER_DOCX", buffer }, "*", [buffer]);
      } catch (problem) {
        if (cancelled) return;
        setDocxLoading(false);
        setDocxError(problem instanceof Error ? problem.message : "The Word document could not be opened.");
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [mode, sourceUrl, docxFrameReady, docxRetry]);

  useEffect(() => {
    if (mode !== "text") return;
    let cancelled = false;
    setTextContent("");
    setTextError("");
    setTextLoading(true);
    fetch(sourceUrl, { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(readableFileError(response.status));
        return response.text();
      })
      .then(content => { if (!cancelled) setTextContent(formatSourceTextPreview(content, extension)); })
      .catch(problem => {
        if (!cancelled) setTextError(problem instanceof Error ? problem.message : "The text file could not be opened.");
      })
      .finally(() => { if (!cancelled) setTextLoading(false); });
    return () => { cancelled = true; };
  }, [mode, sourceUrl]);

  const handlePptxKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" && pptxCurrentSlide > 0) {
      event.preventDefault();
      setPptxCurrentSlide(value => Math.max(0, value - 1));
    } else if (event.key === "ArrowRight" && pptxCurrentSlide < pptxSlideCount - 1) {
      event.preventDefault();
      setPptxCurrentSlide(value => Math.min(pptxSlideCount - 1, value + 1));
    } else if (event.key === " " && pptxReady) {
      event.preventDefault();
      setPptxPlaying(value => !value);
    } else if (event.key === "Home") {
      event.preventDefault();
      setPptxCurrentSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setPptxCurrentSlide(Math.max(0, pptxSlideCount - 1));
    }
  };

  const handlePptxPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || event.button !== 0) return;
    pptxSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
  };

  const handlePptxPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pptxSwipeStartRef.current;
    pptxSwipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    // Horizontal swipes navigate at every zoom level. The reader uses touch-action: pan-y,
    // so ordinary vertical document scrolling remains native to the browser.
    // Ignore taps and vertical gestures; only a deliberate horizontal swipe changes slides.
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
    if (deltaX < 0 && pptxCurrentSlide < pptxSlideCount - 1) {
      setPptxPlaying(false);
      setPptxCurrentSlide(value => Math.min(pptxSlideCount - 1, value + 1));
    } else if (deltaX > 0 && pptxCurrentSlide > 0) {
      setPptxPlaying(false);
      setPptxCurrentSlide(value => Math.max(0, value - 1));
    }
  };

  const clearPptxPointer = () => {
    pptxSwipeStartRef.current = null;
  };

  return (
    <div className="source-original-panel">
      <div className="source-original-toolbar">
        <div>
          <span className="eyebrow">ORIGINAL UPLOADED FILE</span>
          <strong>{fileName}</strong>
          <small>{formatBytes(originalSizeBytes) || "Original file"} · Stored privately; the uploaded file is never overwritten</small>
        </div>
        <a className="secondary-button source-download-button" href={downloadUrl} download={fileName} title="Download the original uploaded file">Download original file</a>
      </div>

      {mode === "pdf" && <PdfSourceReader sourceUrl={sourceUrl} fileName={fileName}/ >}

      {mode === "image" && (
        <div className="source-image-frame">
          {imagePreviewError
            ? <div className="source-preview-fallback"><p>This browser cannot display this image format. The original file is still available. ClerkME has also extracted readable text from the image where possible.</p><a className="secondary-button" href={downloadUrl} download={fileName}>Download original image</a>{extractedText.trim()&&<section className="source-image-extracted-text"><strong>Readable text from this image</strong><pre>{extractedText}</pre></section>}</div>
            : <img src={sourceUrl} alt={"Original image file: " + fileName} onError={() => setImagePreviewError(true)} />}
        </div>
      )}

      {mode === "powerpoint" && (
        <section ref={pptxReaderRef} className={"source-pptx-reader" + (pptxFullscreen ? " is-fullscreen" : "")} aria-label="PowerPoint slide reader">
          {pptxLoading && (
            <div className="source-preview-loading" role="status">
              <strong>{pptxMessage}</strong>
              <div className="source-pptx-progress"><span style={{ width: Math.max(4, pptxProgress) + "%" }} /></div>
              <small>{pptxProgress}%</small>
            </div>
          )}
          {pptxError && (
            <div className="source-preview-error" role="alert">
              <p>{pptxError}</p>
              <button className="secondary-button" type="button" onClick={() => setPptxRetry(value => value + 1)}>Try again</button>
            </div>
          )}
          {pptxReady && !pptxError && (
            <>
              <div className="source-pptx-controls">
                <span className="source-pptx-counter" aria-live="polite">
                  Slide {pptxCurrentSlide + 1} of {pptxSlideCount}
                </span>
                <div className="source-pptx-slide-progress" aria-hidden="true">
                  <span style={{ width: ((pptxCurrentSlide + 1) / pptxSlideCount * 100) + "%" }} />
                </div>
                <small>Play to advance automatically · Present for full screen</small>
              </div>
              <div className="source-pptx-toolbar" role="toolbar" aria-label="PowerPoint presentation controls">
                <div className="source-pptx-toolbar-group">
                  <button type="button" className="source-pptx-tool-button" onClick={() => { setPptxPlaying(false); setPptxCurrentSlide(value => Math.max(0, value - 1)); }} disabled={pptxCurrentSlide === 0} aria-label="Previous slide">‹</button>
                  <button type="button" className="source-pptx-tool-button" onClick={() => { setPptxPlaying(false); setPptxCurrentSlide(value => Math.min(pptxSlideCount - 1, value + 1)); }} disabled={pptxCurrentSlide >= pptxSlideCount - 1} aria-label="Next slide">›</button>
                  <button type="button" className="source-pptx-tool-button source-pptx-play-button" onClick={() => setPptxPlaying(value => !value)} aria-pressed={pptxPlaying}>
                    {pptxPlaying ? "Ⅱ Pause" : "▶ Play"}
                  </button>
                  <label className="source-pptx-tool-select">Advance
                    <select value={pptxSlideInterval} onChange={event => setPptxSlideInterval(Number(event.target.value))}>
                      <option value={3}>3 sec</option><option value={5}>5 sec</option><option value={6}>6 sec</option>
                      <option value={8}>8 sec</option><option value={10}>10 sec</option><option value={15}>15 sec</option>
                    </select>
                  </label>
                </div>
                <div className="source-pptx-toolbar-group">
                  <label className="source-pptx-tool-select">Zoom
                    <select value={pptxZoom} onChange={event => setPptxZoom(event.target.value as typeof pptxZoom)}>
                      <option value="fit">Fit to window</option><option value="width">Fit width · read text</option><option value="100">100%</option>
                      <option value="125">125%</option><option value="150">150%</option><option value="200">200%</option>
                    </select>
                  </label>
                  <button type="button" className={"source-pptx-tool-button" + (pptxShowSlides ? " is-active" : "")} onClick={() => setPptxShowSlides(value => !value)} aria-expanded={pptxShowSlides}>
                    {pptxShowSlides ? "Hide slides" : "Slides"}
                  </button>
                  <button type="button" className="source-pptx-tool-button source-pptx-present-button" onClick={() => void togglePptxFullscreen()}>
                    {pptxFullscreen ? "Exit full screen" : "Present"}
                  </button>
                </div>
              </div>
              {pptxPresentationError && <p className="source-preview-note" role="status">{pptxPresentationError}</p>}
              {pptxShowSlides && (
                <nav className="source-pptx-slide-grid" aria-label="Jump to a slide">
                  {Array.from({ length: pptxSlideCount }, (_, index) => (
                    <button
                      type="button"
                      key={index}
                      className={index === pptxCurrentSlide ? "is-current" : ""}
                      aria-current={index === pptxCurrentSlide ? "page" : undefined}
                      onClick={() => { setPptxPlaying(false); setPptxCurrentSlide(index); }}
                    >
                      <span className="source-pptx-slide-thumb">{String(index + 1).padStart(2, "0")}</span>
                      <small>Slide {index + 1}</small>
                    </button>
                  ))}
                </nav>
              )}
              <div
                className={"source-pptx-canvas-wrap" + (pptxZoom !== "fit" ? " is-zoomed" : "")}
                ref={pptxCanvasContainerRef}
                onKeyDown={handlePptxKeyDown}
                onPointerDown={handlePptxPointerDown}
                onPointerUp={handlePptxPointerUp}
                onPointerCancel={clearPptxPointer}
                onLostPointerCapture={clearPptxPointer}
                tabIndex={0}
                aria-label="Presentation slides. Use arrow keys or swipe to move between slides. Press Space to play or pause."
              >
                <canvas
                  ref={pptxCanvasRef}
                  className={"source-pptx-canvas" + (pptxZoom !== "fit" ? " is-zoomed" : "")}
                  role="img"
                  aria-label={"PowerPoint slide " + (pptxCurrentSlide + 1) + " of " + pptxSlideCount}
                />
                {pptxRendering && <div className="source-pptx-rendering" aria-live="polite">Rendering slide…</div>}
              </div>
              <div className="source-preview-note">
                Use Play to advance slides automatically, Present for a full-screen view, or Zoom to enlarge dense slides. Download the original PowerPoint above to use Microsoft PowerPoint's full editing, animation and transition features.
              </div>
            </>
          )}
        </section>
      )}

      {mode === "word" && (
        <section className="source-docx-reader" aria-label="Word document reader">
          {docxLoading && <div className="source-preview-loading" role="status">Opening the original Word document…</div>}
          {docxError && (
            <div className="source-preview-error" role="alert">
              <p>{docxError}</p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDocxFrameReady(false);
                  setDocxRetry(value => value + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}
          <iframe
            key={docxRetry}
            ref={docxFrameRef}
            className="source-docx-frame"
            title={"Original Word document: " + fileName}
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={DOCX_PREVIEW_FRAME}
            onLoad={() => setDocxFrameReady(true)}
          />
          <p className="source-preview-note">The Word pages are rendered in ClerkMe for reading. Page breaks, fonts and some advanced Word features can vary slightly from Microsoft Word; download the original DOCX for the exact desktop layout.</p>
        </section>
      )}

      {mode === "spreadsheet" && <XlsxSourceReader sourceUrl={sourceUrl} fileName={fileName}/>}

      {mode === "text" && (
        textLoading
          ? <div className="source-preview-loading">Loading your original text file…</div>
          : textError
            ? <div className="source-preview-error" role="alert">{textError}</div>
            : <pre className="source-text-frame">{textContent}</pre>
      )}

      {mode === "download" && (
        <div className="source-preview-fallback">
          <p>This file is stored in its original format. It is not a supported in-browser preview format, so download it to open with a compatible application.</p>
        </div>
      )}
    </div>
  );
}
