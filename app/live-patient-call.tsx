"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { LiveAudioGate } from "../lib/live-audio-gate";

export type LivePatientTurn = { role: "patient" | "student"; content: string };
export type LiveCallStatus = "idle" | "connecting" | "connected";
export type LivePatientCallHandle = { endCall: (notifyParent?: boolean) => LivePatientTurn[] };

type Props = {
  unit: string;
  caseId: string;
  sex: string;
  openingMessage: string;
  onTurns: (turns: LivePatientTurn[]) => void;
  onStatusChange?: (status: LiveCallStatus) => void;
};

function resampleTo16k(input: Float32Array, inputRate: number): Int16Array {
  if (!input.length || !Number.isFinite(inputRate) || inputRate <= 0) return new Int16Array(0);
  const ratio = inputRate / 16000;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const left = Math.min(input.length - 1, Math.floor(position));
    const right = Math.min(input.length - 1, left + 1);
    const fraction = position - left;
    const sample = Math.max(-1, Math.min(1, input[left] * (1 - fraction) + input[right] * fraction));
    output[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return output;
}

function pcmToBase64(pcm: Int16Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return window.btoa(binary);
}

function base64ToPcm(value: string): Int16Array {
  const binary = window.atob(value);
  const evenLength = binary.length - (binary.length % 2);
  const bytes = new Uint8Array(evenLength);
  for (let i = 0; i < evenLength; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

function appendText(current: string, next: string): string {
  const trimmed = next.trim();
  if (!trimmed) return current;
  return current.trim() ? current.trimEnd() + " " + trimmed : trimmed;
}

function callTime(seconds: number): string {
  return Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
}

const LIVE_PATIENT_MODEL = "models/gemini-3.8-live";

const LivePatientCall = forwardRef<LivePatientCallHandle, Props>(function LivePatientCall(
  { unit, caseId, sex, openingMessage, onTurns, onStatusChange },
  ref
) {
  const [status, setStatus] = useState<LiveCallStatus>("idle");
  const [notice, setNotice] = useState("");
  const [muted, setMuted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioGateRef = useRef(new LiveAudioGate());
  const pendingAudioFramesRef = useRef<Int16Array[]>([]);
  const pendingAudioSamplesRef = useRef(0);
  const studentTurnPendingRef = useRef(false);
  const studentTurnTranscriptReceivedRef = useRef(false);
  const silentGainRef = useRef<GainNode | null>(null);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlaybackTimeRef = useRef(0);
  const setupCompleteRef = useRef(false);
  const endingRef = useRef(false);
  const mutedRef = useRef(false);
  const startedAtRef = useRef(0);
  const studentTranscriptRef = useRef("");
  const patientTranscriptRef = useRef("");
  const patientHasSpokenOpeningRef = useRef(false);
  const callAttemptRef = useRef(0);
  const transcriptFlushTimerRef = useRef<number|null>(null);
  const connectionTimeoutRef = useRef<number|null>(null);
  const responseTimeoutRef = useRef<number|null>(null);

  const clearConnectionTimeout = () => {
    if (connectionTimeoutRef.current !== null) {
      window.clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  };

  const clearResponseTimeout = () => {
    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  };

  const armResponseTimeout = (kind: "opening" | "answer") => {
    clearResponseTimeout();
    responseTimeoutRef.current = window.setTimeout(() => {
      responseTimeoutRef.current = null;
      if (endingRef.current || !setupCompleteRef.current) return;
      if (kind === "answer" && studentTurnPendingRef.current && !studentTurnTranscriptReceivedRef.current) {
        studentTranscriptRef.current = appendText(studentTranscriptRef.current, "[Spoken question]");
        studentTurnPendingRef.current = false;
        scheduleTranscriptFlush();
      }
      setNotice(kind === "opening"
        ? "The patient has not spoken yet. Check your connection and retry the call, or continue with the text interview."
        : "The patient has not replied yet. Please repeat your question or continue with the text interview.");
    }, 15000);
  };

  // Gemini 3.8 Live can stall on streamed realtimeInput turns. Submit each
  // completed, locally detected utterance as one committed PCM audio turn.
  const sendCapturedStudentTurn = (socket: WebSocket) => {
    if (socket.readyState !== WebSocket.OPEN || !setupCompleteRef.current) return false;
    const sampleCount = pendingAudioSamplesRef.current;
    if (sampleCount < 1600) {
      pendingAudioFramesRef.current = [];
      pendingAudioSamplesRef.current = 0;
      setNotice("I did not catch enough speech. Please ask your question again.");
      return false;
    }

    const utterance = new Int16Array(sampleCount);
    let offset = 0;
    for (const frame of pendingAudioFramesRef.current) {
      utterance.set(frame, offset);
      offset += frame.length;
    }

    try {
      socket.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{
              inlineData: {
                mimeType: "audio/pcm;rate=16000",
                data: pcmToBase64(utterance)
              }
            }]
          }],
          turnComplete: true
        }
      }));
    } catch {
      pendingAudioFramesRef.current = [];
      pendingAudioSamplesRef.current = 0;
      studentTurnPendingRef.current = false;
      clearResponseTimeout();
      setNotice("Your question could not be sent. Check the connection and try again.");
      return false;
    }

    pendingAudioFramesRef.current = [];
    pendingAudioSamplesRef.current = 0;
    studentTurnPendingRef.current = true;
    studentTurnTranscriptReceivedRef.current = false;
    setNotice("Question sent. Waiting for the patient…");
    armResponseTimeout("answer");
    return true;
  };

  const updateStatus = (next: LiveCallStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const clearPlayback = () => {
    outputSourcesRef.current.forEach(source => { try { source.stop(); } catch {} });
    outputSourcesRef.current.clear();
    nextPlaybackTimeRef.current = 0;
  };

  const takePendingTurns = (): LivePatientTurn[] => {
    const student = studentTranscriptRef.current.trim();
    const patient = patientTranscriptRef.current.trim();
    studentTranscriptRef.current = "";
    patientTranscriptRef.current = "";
    const turns: LivePatientTurn[] = [];
    if (student) turns.push({ role: "student", content: student });
    if (patient) {
      if (!patientHasSpokenOpeningRef.current) {
        patientHasSpokenOpeningRef.current = true;
        const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
        const spokenStart = simplify(patient).slice(0, 80);
        const openingStart = simplify(openingMessage).slice(0, 80);
        const repeatsOpening = spokenStart.length >= 24 && openingStart.length >= 24
          && (spokenStart.startsWith(openingStart.slice(0, 48)) || openingStart.startsWith(spokenStart.slice(0, 48)));
        if (!repeatsOpening) turns.push({ role: "patient", content: patient });
      } else {
        turns.push({ role: "patient", content: patient });
      }
    }
    return turns;
  };

  const scheduleTranscriptFlush = () => {
    if (transcriptFlushTimerRef.current !== null) {
      window.clearTimeout(transcriptFlushTimerRef.current);
    }
    transcriptFlushTimerRef.current = window.setTimeout(() => {
      transcriptFlushTimerRef.current = null;
      const completedTurns = takePendingTurns();
      if (completedTurns.length) onTurns(completedTurns);
    }, 650);
  };

  const clearTranscriptFlush = () => {
    if (transcriptFlushTimerRef.current !== null) {
      window.clearTimeout(transcriptFlushTimerRef.current);
      transcriptFlushTimerRef.current = null;
    }
  };

  const releaseMedia = () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    clearPlayback();
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") void audioContext.close();
  };

  const stopCall = (notifyParent = true): LivePatientTurn[] => {
    callAttemptRef.current += 1;
    clearConnectionTimeout();
    clearResponseTimeout();
    clearTranscriptFlush();
    if (studentTurnPendingRef.current && !studentTurnTranscriptReceivedRef.current) {
      studentTranscriptRef.current = appendText(studentTranscriptRef.current, "[Spoken question]");
    }
    studentTurnPendingRef.current = false;
    const pending = takePendingTurns();
    endingRef.current = true;
    setupCompleteRef.current = false;
    const socket = socketRef.current;
    audioGateRef.current.reset();
    pendingAudioFramesRef.current = [];
    pendingAudioSamplesRef.current = 0;
    socketRef.current = null;
    try {
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Call ended");
    } catch {}
    releaseMedia();
    mutedRef.current = false;
    setMuted(false);
    updateStatus("idle");
    if (notifyParent && pending.length) onTurns(pending);
    if (notifyParent) setNotice("Call ended. Your spoken questions and the patient's replies are now in the interview transcript.");
    return pending;
  };

  useImperativeHandle(ref, () => ({ endCall: stopCall }), [stopCall]);

  useEffect(() => {
    if (status !== "connected") return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    endingRef.current = true;
    setupCompleteRef.current = false;
    clearTranscriptFlush();
    clearResponseTimeout();
    audioGateRef.current.reset();
    try { socketRef.current?.close(); } catch {}
    socketRef.current = null;
    releaseMedia();
  }, []);

  const startCall = async () => {
    if (status !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === "undefined" || typeof AudioContext === "undefined") {
      setNotice("Live calling needs microphone access and an up-to-date browser. You can continue with the text interview.");
      return;
    }

    const callAttempt = ++callAttemptRef.current;
    updateStatus("connecting");
    setNotice("Allow microphone access to start the patient call…");
    setElapsedSeconds(0);
    endingRef.current = false;
    setupCompleteRef.current = false;
    studentTranscriptRef.current = "";
    patientTranscriptRef.current = "";
    patientHasSpokenOpeningRef.current = false;
    audioGateRef.current.reset();
    pendingAudioFramesRef.current = [];
    pendingAudioSamplesRef.current = 0;
    studentTurnPendingRef.current = false;
    studentTurnTranscriptReceivedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
      });
      if (callAttempt !== callAttemptRef.current || endingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;

      const audioContext = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = audioContext;
      await audioContext.resume();
      if (callAttempt !== callAttemptRef.current || endingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        if (audioContext.state !== "closed") void audioContext.close();
        return;
      }

      const microphone = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      sourceRef.current = microphone;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = event => {
        const socket = socketRef.current;
        if (!setupCompleteRef.current || mutedRef.current || !socket || socket.readyState !== WebSocket.OPEN) return;
        const samples = event.inputBuffer.getChannelData(0);
        const pcm = resampleTo16k(samples, audioContext.sampleRate);
        if (!pcm.length) return;
        const gated = audioGateRef.current.process(pcm, samples, audioContext.sampleRate);
        try {
          if (gated.activityStart) {
            clearResponseTimeout();
            pendingAudioFramesRef.current = [];
            pendingAudioSamplesRef.current = 0;
            studentTurnPendingRef.current = false;
            studentTurnTranscriptReceivedRef.current = false;
            setNotice("Listening to your question…");
          }
          for (const chunk of gated.chunks) {
            pendingAudioFramesRef.current.push(chunk);
            pendingAudioSamplesRef.current += chunk.length;
          }
          if (gated.activityEnd) {
            sendCapturedStudentTurn(socket);
          } else if (pendingAudioSamplesRef.current >= 16000 * 30) {
            sendCapturedStudentTurn(socket);
            audioGateRef.current.reset();
          }
        } catch {
          clearResponseTimeout();
          audioGateRef.current.reset();
          pendingAudioFramesRef.current = [];
          pendingAudioSamplesRef.current = 0;
          studentTurnPendingRef.current = false;
          setNotice("The audio connection paused. Check your internet connection.");
        }
      };

      microphone.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      setNotice("Connecting securely to your patient…");
      const tokenResponse = await fetch("/api/learning/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ unit, caseId, intent: "live-token" })
      });
      const tokenData = await tokenResponse.json().catch(() => ({ error: "The live-call service returned an unreadable response." }));
      if (callAttempt !== callAttemptRef.current || endingRef.current) return;
      if (!tokenResponse.ok || typeof tokenData.token !== "string" || !tokenData.token) {
        throw new Error(tokenData.error || "The live patient call could not be authorised.");
      }

      const endpoint = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(tokenData.token);
      const socket = new WebSocket(endpoint);
      socketRef.current = socket;
      connectionTimeoutRef.current = window.setTimeout(() => {
        if (callAttempt !== callAttemptRef.current || setupCompleteRef.current) return;
        stopCall(false);
        setNotice("Gemini did not complete the call setup in time. Check your connection and try again, or continue with the text interview.");
      }, 20000);

      socket.onopen = () => {
        const voiceName = sex.toLowerCase().includes("female") ? "Kore" : "Puck";
        const liveModel = typeof tokenData.model === "string" && tokenData.model.startsWith("models/")
          ? tokenData.model
          : LIVE_PATIENT_MODEL;
        socket.send(JSON.stringify({
          setup: {
            model: liveModel,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {}
          }
        }));
      };

      socket.onmessage = async event => {
        let rawMessage = "";
        try {
          if (typeof event.data === "string") rawMessage = event.data;
          else if (event.data instanceof ArrayBuffer) rawMessage = new TextDecoder().decode(event.data);
          else if (event.data instanceof Blob) rawMessage = await event.data.text();
          else return;
        } catch {
          setNotice("The patient call sent a message ClerkMe could not read. Please retry the call.");
          return;
        }
        let message: Record<string, any>;
        try { message = JSON.parse(rawMessage) as Record<string, any>; }
        catch {
          setNotice("The patient call returned an unreadable response. Please retry the call.");
          return;
        }

        const serverContent = message.serverContent as Record<string, any> | undefined;
        const inputTranscript = message.inputTranscription?.text ?? serverContent?.inputTranscription?.text;
        const outputTranscript = message.outputTranscription?.text ?? serverContent?.outputTranscription?.text;
        if (inputTranscript) {
          studentTurnTranscriptReceivedRef.current = true;
          studentTranscriptRef.current = appendText(studentTranscriptRef.current, String(inputTranscript));
          scheduleTranscriptFlush();
        }
        if (outputTranscript) {
          clearResponseTimeout();
          patientTranscriptRef.current = appendText(patientTranscriptRef.current, String(outputTranscript));
          scheduleTranscriptFlush();
        }

        if (message.error) {
          const providerMessage = typeof message.error.message === "string" ? message.error.message : "Gemini rejected the live-call setup.";
          clearConnectionTimeout();
          stopCall(false);
          setNotice("The live patient call could not be established. " + providerMessage.slice(0,220));
          return;
        }

        if (message.setupComplete) {
          clearConnectionTimeout();
          setupCompleteRef.current = true;
          startedAtRef.current = Date.now();
          updateStatus("connected");
          setNotice("Connected. Your patient will introduce the complaint, then listen to your questions.");
          socket.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: "user",
                parts: [{ text: "Begin the phone call now. Say this opening statement naturally, in character: " + openingMessage + ". Then pause and wait for the student's next question." }]
              }],
              turnComplete: true
            }
          }));
          armResponseTimeout("opening");
          return;
        }

        if (message.goAway) {
          setNotice("The call is approaching its connection limit. Finish your current question, then end the call to review your transcript.");
        }

        if (!serverContent) return;
        if (serverContent.interrupted) clearPlayback();

        const parts = Array.isArray(serverContent.modelTurn?.parts) ? serverContent.modelTurn.parts : [];
        for (const part of parts) {
          const audioData = part.inlineData?.data;
          if (typeof audioData !== "string" || audioData.length < 8) continue;
          clearResponseTimeout();
          const activeAudioContext = audioContextRef.current;
          if (!activeAudioContext || activeAudioContext.state === "closed") continue;
          try {
            const pcm = base64ToPcm(audioData);
            if (pcm.length < 8) continue;
            const buffer = activeAudioContext.createBuffer(1, pcm.length, 24000);
            const channel = buffer.getChannelData(0);
            for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
            const player = activeAudioContext.createBufferSource();
            player.buffer = buffer;
            player.connect(activeAudioContext.destination);
            const startAt = Math.max(activeAudioContext.currentTime + 0.025, nextPlaybackTimeRef.current);
            nextPlaybackTimeRef.current = startAt + buffer.duration;
            outputSourcesRef.current.add(player);
            player.onended = () => outputSourcesRef.current.delete(player);
            player.start(startAt);
          } catch {
            setNotice("The patient's audio could not be played. Check your speaker or headphone output.");
          }
        }

        if (serverContent.turnComplete) {
          clearResponseTimeout();
          if (studentTurnPendingRef.current && !studentTurnTranscriptReceivedRef.current) {
            studentTranscriptRef.current = appendText(studentTranscriptRef.current, "[Spoken question]");
          }
          studentTurnPendingRef.current = false;
          scheduleTranscriptFlush();
          setNotice("Connected · Listening for your next question");
        }
      };

      socket.onerror = () => {
        setNotice("The live-call connection encountered a problem. Check your internet connection and retry, or continue with the text interview.");
        if (!setupCompleteRef.current) {
          clearConnectionTimeout();
          stopCall(false);
          setNotice("Gemini could not establish the live call. Please retry or continue with the text interview.");
        }
      };

      socket.onclose = event => {
        if (endingRef.current) return;
        clearConnectionTimeout();
        clearTranscriptFlush();
        const completedTurns = takePendingTurns();
        if (completedTurns.length) onTurns(completedTurns);
        stopCall(false);
        setNotice(event.code === 1000
          ? "Call ended. Your completed transcript is available for review."
          : `The live call disconnected unexpectedly (connection code ${event.code}). Your completed transcript is still available; please retry.`);
      };
    } catch (reason) {
      if (callAttempt !== callAttemptRef.current || endingRef.current) return;
      stopCall(false);
      const name = reason instanceof DOMException ? reason.name : "";
      const messages: Record<string, string> = {
        NotAllowedError: "Microphone access was denied. Allow microphone access in your browser settings, then try again.",
        NotFoundError: "No microphone was found. Connect or enable a microphone, then try again.",
        NotReadableError: "The microphone is busy or unavailable. Close other apps using it and try again.",
        SecurityError: "Microphone access requires a secure HTTPS connection. Open the secure ClerkMe address."
      };
      setNotice(messages[name] || (reason instanceof Error ? reason.message : "ClerkMe could not start the live call. Please try again."));
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    const socket = socketRef.current;
    if (next) {
      const wasSpeaking = audioGateRef.current.finish();
      if (wasSpeaking && socket?.readyState === WebSocket.OPEN && setupCompleteRef.current) {
        sendCapturedStudentTurn(socket);
      } else {
        pendingAudioFramesRef.current = [];
        pendingAudioSamplesRef.current = 0;
      }
    }
    mutedRef.current = next;
    setMuted(next);
    setNotice(next ? "Microphone muted. The patient cannot hear you." : "Microphone on. Continue speaking naturally.");
  };

  return (
    <section className="simulation-live-call-card" aria-label="Live patient phone call">
      <div className="simulation-live-call-main">
        <div className="simulation-live-call-icon" aria-hidden="true">{status === "connected" ? "☎" : "◉"}</div>
        <div className="simulation-live-call-copy">
          <div className="eyebrow">LIVE VOICE ENCOUNTER</div>
          <strong>{status === "connected" ? "You are on a call with the patient" : status === "connecting" ? "Connecting your patient call…" : "Speak directly with your patient"}</strong>
          <p>{status === "connected" ? "Ask questions naturally. The patient will answer aloud, and the conversation transcript will be added to your interview." : "Use your microphone and speaker for a phone-call-style history-taking encounter. Headphones are recommended to reduce echo."}</p>
        </div>
        {status === "connected" && <div className="simulation-live-call-timer" aria-live="off">{callTime(elapsedSeconds)}</div>}
      </div>

      <div className="simulation-live-call-actions">
        {status === "idle" ? (
          <button type="button" className="simulation-live-call-start" onClick={() => void startCall()}>
            <span aria-hidden="true">☎</span> Start phone call
          </button>
        ) : status === "connecting" ? (
          <button type="button" className="simulation-live-call-start" disabled>
            <span aria-hidden="true">…</span> Connecting…
          </button>
        ) : (
          <>
            <button type="button" className={muted ? "simulation-live-call-mute is-muted" : "simulation-live-call-mute"} onClick={toggleMute}>
              {muted ? "Unmute microphone" : "Mute microphone"}
            </button>
            <button type="button" className="simulation-live-call-end" onClick={() => stopCall(true)}>End call</button>
          </>
        )}
      </div>
      {!!notice && <p className="simulation-live-call-notice" role="status">{notice}</p>}
      <p className="simulation-live-call-privacy">Fictional teaching encounter. Live microphone audio is processed for the conversation; the spoken transcript is added to this interview. Do not share identifiable real-patient information.</p>
    </section>
  );
});

export default LivePatientCall;
