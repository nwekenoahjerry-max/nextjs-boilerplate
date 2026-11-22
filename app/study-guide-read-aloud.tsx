"use client";

import { useEffect, useRef, useState } from "react";

type PlaybackState = "idle" | "speaking" | "paused";

function splitSpeech(text: string, maxLength = 1000): string[] {
  const chunks: string[] = [];
  let remaining = text.replace(/\\u0000/g, " ").replace(/\\s+/g, " ").trim();
  while (remaining.length > maxLength) {
    const sentence = remaining.lastIndexOf(". ", maxLength);
    const word = remaining.lastIndexOf(" ", maxLength);
    const splitAt = sentence > maxLength * 0.55 ? sentence + 1 : word > 0 ? word : maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export default function StudyGuideReadAloud({ targetId }: { targetId: string }) {
  const [supported, setSupported] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [rate, setRate] = useState(1);
  const [notice, setNotice] = useState("");
  const chunksRef = useRef<string[]>([]);
  const runRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined");
    return () => {
      runRef.current += 1;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const speakChunk = (run: number, index: number, speed: number) => {
    if (run !== runRef.current) return;
    if (index >= chunksRef.current.length) {
      utteranceRef.current = null;
      setPlayback("idle");
      setNotice("Finished reading the Study Guide.");
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunksRef.current[index]);
    utterance.rate = speed;
    utterance.onend = () => { if (run === runRef.current) speakChunk(run, index + 1, speed); };
    utterance.onerror = () => {
      if (run !== runRef.current) return;
      utteranceRef.current = null;
      setPlayback("idle");
      setNotice("Voice playback stopped. Select Read aloud to try again.");
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const start = () => {
    if (!supported || !("speechSynthesis" in window)) return;
    const target = document.getElementById(targetId);
    if (!target) {
      setNotice("The Study Guide text is not available yet.");
      return;
    }
    const clone = target.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".study-guide-toolbar, .study-guide-read-aloud, .study-contents, button").forEach(node => node.remove());
    clone.querySelectorAll("details").forEach(node => { (node as HTMLDetailsElement).open = true; });
    clone.querySelectorAll("[hidden]").forEach(node => node.removeAttribute("hidden"));
    const text = (clone.innerText || clone.textContent || "").replace(/\\s+/g, " ").trim();
    const chunks = splitSpeech(text);
    if (!chunks.length) {
      setNotice("There is no Study Guide text ready to read yet.");
      return;
    }
    window.speechSynthesis.cancel();
    const run = ++runRef.current;
    chunksRef.current = chunks;
    setPlayback("speaking");
    setNotice("Reading your Study Guide.");
    speakChunk(run, 0, rate);
  };

  const pause = () => {
    if (playback !== "speaking" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setPlayback("paused");
    setNotice("Reading paused.");
  };
  const resume = () => {
    if (playback !== "paused" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setPlayback("speaking");
    setNotice("Reading resumed.");
  };
  const stop = () => {
    runRef.current += 1;
    chunksRef.current = [];
    utteranceRef.current = null;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlayback("idle");
    setNotice("Reading stopped.");
  };

  return (
    <section className="study-guide-read-aloud" aria-label="Read the Study Guide aloud">
      <button type="button" className="primary" onClick={start} disabled={!supported || playback === "speaking"}>▶ Read aloud</button>
      {playback === "speaking" && <button type="button" onClick={pause}>Ⅱ Pause</button>}
      {playback === "paused" && <button type="button" onClick={resume}>▶ Resume</button>}
      <button type="button" onClick={stop} disabled={playback === "idle"}>Stop</button>
      <label>Speed
        <select value={rate} onChange={event => setRate(Number(event.target.value))}>
          <option value={0.8}>0.8×</option><option value={1}>1×</option><option value={1.15}>1.15×</option><option value={1.3}>1.3×</option>
        </select>
      </label>
      {(notice || !supported) && <small className="study-guide-read-aloud-status" role="status">{notice || "Read aloud is not supported by this browser."}</small>}
    </section>
  );
}
