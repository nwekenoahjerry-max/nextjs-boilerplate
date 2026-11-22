"use client";

import { useEffect, useMemo, useState } from "react";
import { readXlsxWorkbook, type XlsxWorksheet } from "../lib/file-text";

type Props = { sourceUrl: string; fileName: string };

function getError(status: number) {
  if (status === 401 || status === 403) return "Your session has expired. Sign in again to read this spreadsheet.";
  if (status === 404) return "The original spreadsheet is not available. Re-upload it to restore the source file.";
  return "ClerkME could not retrieve this spreadsheet. Please try again.";
}

export default function XlsxSourceReader({ sourceUrl, fileName }: Props) {
  const [sheets, setSheets] = useState<XlsxWorksheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSheets([]);
    setActiveSheet(0);
    const open = async () => {
      try {
        const response = await fetch(sourceUrl, { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error(getError(response.status));
        const buffer = await response.arrayBuffer();
        if (cancelled) return;
        const result = await readXlsxWorkbook(buffer);
        if (!result.length) throw new Error("No readable worksheets were found in this spreadsheet.");
        if (!cancelled) setSheets(result);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "The spreadsheet could not be opened.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void open();
    return () => { cancelled = true; };
  }, [sourceUrl, retry]);

  const sheet = sheets[activeSheet];
  const maxColumns = useMemo(() => Math.max(0, ...(sheet?.rows || []).map(row => row.length)), [sheet]);
  const columnLabels = useMemo(() => Array.from({ length: maxColumns }, (_, index) => {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      const remainder = (value - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      value = Math.floor((value - 1) / 26);
    }
    return label;
  }), [maxColumns]);

  return (
    <section className="xlsx-source-reader" aria-label={"Excel workbook: " + fileName}>
      <div className="xlsx-source-toolbar">
        <div><strong>Workbook preview</strong><small>{sheets.length} {sheets.length === 1 ? "worksheet" : "worksheets"} · {fileName}</small></div>
        <span className="xlsx-source-format">XLSX</span>
      </div>
      {loading && <div className="source-preview-loading" role="status">Opening your original Excel workbook…</div>}
      {error && <div className="source-preview-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      {!loading && !error && sheet && <>
        {sheets.length > 1 && <div className="xlsx-source-tabs" role="tablist" aria-label="Worksheets">
          {sheets.map((item, index) => <button type="button" role="tab" key={item.name + index} aria-selected={activeSheet === index} className={activeSheet === index ? "active" : ""} onClick={() => setActiveSheet(index)}>{item.name}</button>)}
        </div>}
        <div className="xlsx-source-table-wrap" role="region" aria-label={sheet.name + " worksheet. Scroll horizontally and vertically to inspect cells."} tabIndex={0}>
          <table className="xlsx-source-table">
            <thead><tr><th className="xlsx-source-row-number">#</th>{columnLabels.map(label => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>
              {sheet.rows.map((row, rowIndex) => <tr key={rowIndex}>
                <th className="xlsx-source-row-number">{rowIndex + 1}</th>
                {columnLabels.map((label, columnIndex) => <td key={label}>{row[columnIndex] || ""}</td>)}
              </tr>)}
            </tbody>
          </table>
          {!sheet.rows.length && <p className="xlsx-source-empty">This worksheet contains no populated rows.</p>}
        </div>
        <div className="xlsx-source-footer"><span>{sheet.rows.length} rows · {maxColumns} columns</span><span>Original workbook · read-only preview</span></div>
      </>}
    </section>
  );
}
