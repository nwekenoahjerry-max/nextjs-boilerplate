"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Student = { id: string; name: string; university?: string; level?: string; lastSeenAt?: number | null };
type Conversation = {
  id: string; otherId: string; otherName: string; otherUniversity?: string; otherLevel?: string;
  otherLastSeenAt?: number | null; lastMessagePreview?: string; lastMessageAt?: number | null;
  unreadCount: number;
};
type ChatMessage = {
  id: number; public_id?: string; conversation_id: string; sender_id: string;
  client_message_id?: string; body: string; created_at: number; delivered_at?: number | null;
  deliveryState?: "sending" | "sent" | "failed";
  reply_to_status_id?: string | null; edited_at?: number | null;
};
type SocketEvent = {
  type: string; message?: ChatMessage | string; messageId?: number; deliveredAt?: number;
  userId?: string; isOnline?: boolean; isTyping?: boolean; lastReadMessageId?: number;
  clientMessageId?: string; signal?: RTCSessionDescriptionInit | RTCIceCandidateInit;
};

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "CM";
const timeLabel = (timestamp?: number | null) => {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return date.toDateString() === new Date().toDateString()
    ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(date);
};
const isOnline = (lastSeen?: number | null) => Boolean(lastSeen && Date.now() / 1000 - lastSeen <= 90);
const socketUrl = (id: string) => (window.location.protocol === "https:" ? "wss://" : "ws://") +
  window.location.host + "/api/messages/" + encodeURIComponent(id) + "/socket";
const getVoiceNote = (body:string) => {
  const match = /^\[\[CLERKME_VOICE_NOTE_V1\|(voice-[0-9a-f-]{36}\.(?:webm|ogg|m4a|mp3|wav|aac))\|([0-9]{1,2})\]\]$/.exec(body);
  return match ? { key:match[1], duration:Number(match[2]) } : null;
};
const durationLabel = (seconds:number) => String(Math.floor(seconds/60)).padStart(2,"0") + ":" + String(seconds%60).padStart(2,"0");
const conversationPreview = (body:string) => getVoiceNote(body) ? "🎙 Voice note" : body;
const notifyUnreadMessagesChanged = () => window.dispatchEvent(new Event("clerkme:messages-unread-refresh"));


export default function DirectMessagesPanel({ userId, initialConversationId = "", initialStatusReplyId = "", initialDraft = "" }: { userId: string; initialConversationId?: string; initialStatusReplyId?: string; initialDraft?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerReadMessageId, setPeerReadMessageId] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [replyingStatusId, setReplyingStatusId] = useState(initialStatusReplyId);
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "offline">("offline");
  const [peerOnline, setPeerOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [recording,setRecording] = useState(false);
  const [recordingSeconds,setRecordingSeconds] = useState(0);
  const [voiceDraft,setVoiceDraft] = useState<{blob:Blob;url:string;duration:number}|null>(null);
  const [voiceUploading,setVoiceUploading] = useState(false);
  const [callState,setCallState] = useState<"idle"|"calling"|"incoming"|"connecting"|"active">("idle");
  const [callMuted,setCallMuted] = useState(false);
  const [callAudioNeedsTap,setCallAudioNeedsTap] = useState(false);
  const [callSeconds,setCallSeconds] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const keepScroll = useRef(true);
  const recorderRef = useRef<MediaRecorder|null>(null);
  const recorderStreamRef = useRef<MediaStream|null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const callPeerConnectionRef = useRef<RTCPeerConnection|null>(null);
  const callStreamRef = useRef<MediaStream|null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit|null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement|null>(null);
  const callStartedAtRef = useRef(0);

  useEffect(() => {
    if (initialConversationId) setSelectedId(initialConversationId);
    if (initialStatusReplyId) setReplyingStatusId(initialStatusReplyId);
    if (initialDraft) setDraft(initialDraft);
  }, [initialConversationId, initialStatusReplyId, initialDraft]);


  const sendCallSignal = (type:string, signal?:RTCSessionDescriptionInit|RTCIceCandidateInit) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(signal ? {type,signal} : {type}));
      return true;
    } catch { return false; }
  };

  const endVoiceCall = (notifyPeer=true, message="") => {
    if (notifyPeer) sendCallSignal("call:hangup");
    const pc = callPeerConnectionRef.current;
    callPeerConnectionRef.current = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      try { pc.close(); } catch { /* already closed */ }
    }
    callStreamRef.current?.getTracks().forEach(track=>track.stop());
    callStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setCallAudioNeedsTap(false);
    incomingOfferRef.current = null;
    pendingIceRef.current = [];
    callStartedAtRef.current = 0;
    setCallState("idle");
    setCallMuted(false);
    setCallSeconds(0);
    if (message) setNotice(message);
  };

  const flushPendingIce = async (pc:RTCPeerConnection) => {
    const queued = pendingIceRef.current.splice(0);
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch { /* Ignore stale ICE candidates. */ }
    }
  };

  const createCallPeerConnection = (stream:MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers:[
        {urls:"stun:stun.l.google.com:19302"},
        {urls:"stun:stun1.l.google.com:19302"}
      ]
    });
    stream.getAudioTracks().forEach(track=>pc.addTrack(track,stream));
    pc.onicecandidate = event => {
      if (event.candidate) sendCallSignal("call:ice",event.candidate.toJSON());
    };
    pc.ontrack = event => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        void remoteAudioRef.current.play().then(()=>setCallAudioNeedsTap(false)).catch(()=>setCallAudioNeedsTap(true));
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        callStartedAtRef.current = Date.now();
        setCallSeconds(0);
        setCallState("active");
      } else if (pc.connectionState === "failed") {
        endVoiceCall(false,"The call could not connect. This network may not allow direct voice calls.");
      }
    };
    callPeerConnectionRef.current = pc;
    return pc;
  };

  const startVoiceCall = async () => {
    if (!selectedId) return;
    if (connection !== "connected") {
      setNotice("Reconnect to this conversation before starting a call.");
      return;
    }
    if (recording || voiceDraft || voiceUploading) {
      setNotice("Finish or discard the voice note before starting a call.");
      return;
    }
    if (callPeerConnectionRef.current || incomingOfferRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice("Voice calls are not supported by this browser. Open ClerkMe in an up-to-date browser over HTTPS.");
      return;
    }
    setNotice("");
    setCallState("calling");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
        video:false
      });
      callStreamRef.current = stream;
      const pc = createCallPeerConnection(stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (!sendCallSignal("call:offer",pc.localDescription || offer)) {
        throw new Error("The chat connection was interrupted before the call could start.");
      }
    } catch (error) {
      endVoiceCall(false);
      setNotice(error instanceof Error ? error.message : "The voice call could not be started. Check your microphone permission.");
    }
  };

  const acceptIncomingCall = async () => {
    const offer = incomingOfferRef.current;
    if (!offer || !navigator.mediaDevices?.getUserMedia) {
      setNotice("This browser cannot start a voice call. Check microphone support and permission.");
      return;
    }
    setCallState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},
        video:false
      });
      callStreamRef.current = stream;
      const pc = createCallPeerConnection(stream);
      await pc.setRemoteDescription(offer);
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (!sendCallSignal("call:answer",pc.localDescription || answer)) {
        throw new Error("The chat connection was interrupted while answering.");
      }
    } catch (error) {
      endVoiceCall(true);
      setNotice(error instanceof Error ? error.message : "The call could not be answered. Check microphone permission.");
    }
  };

  const declineIncomingCall = () => {
    sendCallSignal("call:decline");
    endVoiceCall(false);
  };

  const toggleCallMute = () => {
    const next = !callMuted;
    callStreamRef.current?.getAudioTracks().forEach(track=>{track.enabled=!next;});
    setCallMuted(next);
  };

  const startVoiceRecording = async () => {
    if (!selectedId || connection !== "connected") {
      setNotice("Reconnect to this conversation before recording a voice note.");
      return;
    }
    if (callState !== "idle") {
      setNotice("End the voice call before recording a voice note.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Voice notes are not supported by this browser. Try an up-to-date Chrome, Edge or Safari browser.");
      return;
    }
    if (voiceDraft) {
      setNotice("Send or discard your current voice note first.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      recorderStreamRef.current = stream;
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      const formats = ["audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/mp4"];
      const mimeType = formats.find(format=>MediaRecorder.isTypeSupported(format));
      const recorder = mimeType ? new MediaRecorder(stream,{mimeType}) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setNotice("The microphone recording stopped unexpectedly. Please try again.");
        setRecording(false);
      };
      recorder.onstop = () => {
        const duration = Math.max(1,Math.min(60,Math.round((Date.now()-recordingStartedAtRef.current)/1000)));
        const blob = new Blob(recordingChunksRef.current,{type:recorder.mimeType || recordingChunksRef.current[0]?.type || "audio/webm"});
        recordingChunksRef.current = [];
        recorderStreamRef.current?.getTracks().forEach(track=>track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setRecordingSeconds(duration);
        if (!blob.size) {
          setNotice("No audio was captured. Please record your voice note again.");
          return;
        }
        const url = URL.createObjectURL(blob);
        setVoiceDraft({blob,url,duration});
        setNotice("");
      };
      recorder.start(250);
      setRecordingSeconds(0);
      setRecording(true);
      setNotice("");
    } catch (error) {
      recorderStreamRef.current?.getTracks().forEach(track=>track.stop());
      recorderStreamRef.current = null;
      setNotice(error instanceof Error && error.name === "NotAllowedError"
        ? "Microphone permission was denied. Allow microphone access in your browser settings and try again."
        : "ClerkMe could not access your microphone. Check that it is connected and not being used by another app.");
    }
  };

  const stopVoiceRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const discardVoiceDraft = () => {
    setVoiceDraft(null);
    setRecordingSeconds(0);
  };

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = Math.min(60,Math.floor((Date.now()-recordingStartedAtRef.current)/1000));
      setRecordingSeconds(elapsed);
      if (elapsed >= 60 && recorderRef.current?.state === "recording") recorderRef.current.stop();
    },250);
    return () => window.clearInterval(timer);
  },[recording]);

  useEffect(() => {
    if (callState !== "active") return;
    const timer = window.setInterval(() => {
      if (callStartedAtRef.current) setCallSeconds(Math.floor((Date.now()-callStartedAtRef.current)/1000));
    },1000);
    return () => window.clearInterval(timer);
  },[callState]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      if (recorder.state === "recording") recorder.stop();
    }
    recorderStreamRef.current?.getTracks().forEach(track=>track.stop());
    callStreamRef.current?.getTracks().forEach(track=>track.stop());
    try { callPeerConnectionRef.current?.close(); } catch { /* already closed */ }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  },[]);

  useEffect(() => {
    if (!voiceDraft) return;
    return () => URL.revokeObjectURL(voiceDraft.url);
  },[voiceDraft]);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase();
    if (!query) return conversations;
    return conversations.filter(item => item.otherName.toLocaleLowerCase().includes(query) || (item.lastMessagePreview || "").toLocaleLowerCase().includes(query));
  }, [conversations, conversationSearch]);

  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { window.location.href = "/login"; return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your conversations could not be loaded.");
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      notifyUnreadMessagesChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your conversations could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void loadConversations();
    const refresh = () => {
      if (document.visibilityState === "visible") void loadConversations();
    };
    const interval = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadConversations]);
  useEffect(() => {
    setPeerOnline(isOnline(selected?.otherLastSeenAt));
  }, [selected?.otherLastSeenAt]);

  useEffect(() => {
    if (!showNew || search.trim().length < 2) { setSearchResults([]); setSearching(false); return; }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/messages/users?q=" + encodeURIComponent(search.trim()), {
          credentials: "same-origin", cache: "no-store"
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Student search is unavailable.");
        if (!cancelled) setSearchResults(Array.isArray(data.users) ? data.users : []);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Student search is unavailable.");
      } finally { if (!cancelled) setSearching(false); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, showNew]);

  const markRead = useCallback(async (conversationId: string, messageId: number) => {
    if (!messageId || messageId < 1) return;
    try {
      const response = await fetch("/api/messages/" + encodeURIComponent(conversationId) + "/read", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId })
      });
      if (!response.ok) throw new Error("Read status could not be updated.");
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "read", messageId }));
      setConversations(current => current.map(item => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
      notifyUnreadMessagesChanged();
    } catch { /* Reconciled on the next inbox refresh. */ }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]); setPeerReadMessageId(0); setNextCursor(null); setHasMore(false); setPeerOnline(false);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setEditingMessageId(null);
    setEditDraft("");
    keepScroll.current = true;
    const load = async () => {
      try {
        const response = await fetch("/api/messages/" + encodeURIComponent(selectedId), { credentials: "same-origin", cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "This conversation could not be opened.");
        if (cancelled) return;
        const history = Array.isArray(data.messages) ? data.messages as ChatMessage[] : [];
        setPeerOnline(isOnline(selected?.otherLastSeenAt));
        setMessages(history);
        setPeerReadMessageId(Number(data.otherLastReadMessageId) || 0);
        setHasMore(Boolean(data.hasMore));
        setNextCursor(data.nextCursor ? Number(data.nextCursor) : null);
        const newest = history.at(-1);
        if (newest) await markRead(selectedId, newest.id);
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "This conversation could not be opened.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedId, markRead]);

  useEffect(() => {
    if (!selectedId) { setConnection("offline"); return; }
    let stopped = false;
    let active: WebSocket | null = null;
    let reconnectTimer = 0;
    let heartbeatTimer = 0;
    let retries = 0;

    const connect = () => {
      if (stopped) return;
      setConnection(retries === 0 ? "connecting" : "reconnecting");
      let socket: WebSocket;
      try { socket = new WebSocket(socketUrl(selectedId)); }
      catch { scheduleReconnect(); return; }
      active = socket;
      socketRef.current = socket;

      socket.onopen = () => {
        if (stopped) { socket.close(); return; }
        retries = 0;
        setConnection("connected");
        socket.send(JSON.stringify({ type: "ping" }));

        // Reconcile any optimistic messages after a reconnect. The D1 history is
        // authoritative if a send acknowledgement was lost while the network dropped.
        void fetch("/api/messages/" + encodeURIComponent(selectedId), {
          credentials: "same-origin", cache: "no-store"
        }).then(async response => {
          if (!response.ok) return null;
          return await response.json();
        }).then(data => {
          if (stopped || !data || !Array.isArray(data.messages)) return;
          const persisted = data.messages as ChatMessage[];
          const nearBottom = !scrollRef.current ||
            scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 100;
          setMessages(current => {
            const pending = current.filter(item =>
              item.id < 0 && item.client_message_id &&
              !persisted.some(saved => saved.client_message_id === item.client_message_id)
            );
            return [...persisted, ...pending];
          });
          setPeerReadMessageId(Number(data.otherLastReadMessageId) || 0);
          setHasMore(Boolean(data.hasMore));
          setNextCursor(data.nextCursor ? Number(data.nextCursor) : null);
          keepScroll.current = nearBottom;
        }).catch(() => { /* The current message list remains available offline. */ });

        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN && document.visibilityState === "visible") {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      socket.onmessage = event => {
        let data: SocketEvent;
        try { data = JSON.parse(String(event.data)) as SocketEvent; } catch { return; }


        if (data.type === "call:offer" && data.userId !== userId && data.signal) {
          if (callPeerConnectionRef.current || incomingOfferRef.current) {
            sendCallSignal("call:busy");
          } else {
            incomingOfferRef.current = data.signal as RTCSessionDescriptionInit;
            pendingIceRef.current = [];
            setCallState("incoming");
            setNotice("");
          }
          return;
        }
        if (data.type === "call:answer" && data.userId !== userId && data.signal && callPeerConnectionRef.current) {
          const pc = callPeerConnectionRef.current;
          void (async()=>{
            try {
              await pc.setRemoteDescription(data.signal as RTCSessionDescriptionInit);
              await flushPendingIce(pc);
              setCallState("connecting");
            } catch {
              endVoiceCall(true,"The call setup failed. Please try again.");
            }
          })();
          return;
        }
        if (data.type === "call:ice" && data.userId !== userId && data.signal) {
          const candidate = data.signal as RTCIceCandidateInit;
          const pc = callPeerConnectionRef.current;
          if (pc?.remoteDescription) {
            void pc.addIceCandidate(candidate).catch(()=>undefined);
          } else {
            pendingIceRef.current.push(candidate);
          }
          return;
        }
        if (data.type === "call:decline" && data.userId !== userId) {
          endVoiceCall(false,"The voice call was declined.");
          return;
        }
        if (data.type === "call:busy" && data.userId !== userId) {
          endVoiceCall(false,"This student is already on another call.");
          return;
        }
        if (data.type === "call:unavailable") {
          endVoiceCall(false,"This student is not currently in this chat. Ask them to open the conversation before calling.");
          return;
        }
        if (data.type === "call:hangup" && data.userId !== userId) {
          endVoiceCall(false,"The voice call has ended.");
          return;
        }
        if (data.type === "call:ringing") return;
        if (data.type === "message:new" && data.message && typeof data.message === "object") {
          const incoming = data.message;
          const nearBottom = !scrollRef.current ||
            scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 100;
          setMessages(current => {
            const exists = current.some(item => item.id === incoming.id ||
              Boolean(incoming.client_message_id && item.client_message_id === incoming.client_message_id));
            if (exists) return current.map(item =>
              item.id === incoming.id || (incoming.client_message_id && item.client_message_id === incoming.client_message_id)
                ? { ...incoming, deliveryState: "sent" as const } : item
            );
            return [...current, incoming];
          });
          keepScroll.current = nearBottom;
          setConversations(current => {
            const updated = current.map(item => item.id === selectedId ? {
              ...item, lastMessagePreview: conversationPreview(incoming.body), lastMessageAt: incoming.created_at,
              unreadCount: incoming.sender_id === userId || nearBottom ? item.unreadCount : item.unreadCount + 1
            } : item);
            return updated.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
          });
          if (incoming.sender_id !== userId) {
            notifyUnreadMessagesChanged();
            if (nearBottom) void markRead(selectedId, incoming.id);
            window.dispatchEvent(new Event("clerkme:notifications-refresh"));
          }
          void loadConversations();
          return;
        }
        if (data.type === "message:updated" && data.message && typeof data.message === "object") {
          const updated = data.message;
          setMessages(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item));
          void loadConversations();
          return;
        }
        if (data.type === "message:delivery-updated" && data.messageId) {
          setMessages(current => current.map(item => item.id === data.messageId
            ? { ...item, delivered_at: data.deliveredAt || Math.floor(Date.now() / 1000) } : item));
          return;
        }
        if (data.type === "receipt:read" && data.userId !== userId && data.lastReadMessageId) {
          setPeerReadMessageId(current => Math.max(current, data.lastReadMessageId || 0));
          return;
        }
        if (data.type === "presence:update" && data.userId === selected?.otherId) {
          setPeerOnline(Boolean(data.isOnline));
          return;
        }
        if (data.type === "typing" && data.userId === selected?.otherId) {
          setTyping(Boolean(data.isTyping));
          if (typingTimer.current) window.clearTimeout(typingTimer.current);
          if (data.isTyping) typingTimer.current = window.setTimeout(() => setTyping(false), 2500);
          return;
        }
        if (data.type === "error") {
          setNotice(typeof data.message === "string" ? data.message : "Your message could not be sent.");
          if (data.clientMessageId) setMessages(current => current.map(item =>
            item.client_message_id === data.clientMessageId ? { ...item, deliveryState: "failed" } : item
          ));
        }
      };

      socket.onerror = () => { if (!stopped) setConnection("reconnecting"); };
      socket.onclose = event => {
        window.clearInterval(heartbeatTimer);
        if (socketRef.current === socket) socketRef.current = null;
        if (stopped) return;
        if (callPeerConnectionRef.current || incomingOfferRef.current) {
          endVoiceCall(false,"The call ended because the chat connection was lost.");
        }
        if (event.code === 1008) {
          setConnection("offline");
          setNotice("This conversation is no longer available. Refresh your inbox.");
          return;
        }
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      retries += 1;
      reconnectTimer = window.setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(retries, 4)) + Math.floor(Math.random() * 350));
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (active && active.readyState < WebSocket.CLOSING) active.close(1000, "Conversation changed");
      if (socketRef.current === active) socketRef.current = null;
    };
  }, [selectedId, selected?.otherId, userId, markRead, loadConversations]);

  useEffect(() => {
    if (scrollRef.current && keepScroll.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      keepScroll.current = false;
    }
  }, [messages, typing]);

  const openConversation = async (student: Student) => {
    setNotice("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId: student.id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This conversation could not be created.");
      const other = data.conversation.other as Student;
      setConversations(current => {
        if (current.some(item => item.id === data.conversation.id)) return current;
        return [{
          id: data.conversation.id, otherId: other.id, otherName: other.name,
          otherUniversity: other.university, otherLevel: other.level, otherLastSeenAt: other.lastSeenAt,
          lastMessagePreview: "", lastMessageAt: null, unreadCount: 0
        }, ...current];
      });
      setSelectedId(data.conversation.id);
      setShowNew(false);
      setSearch("");
      setSearchResults([]);
      void loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "This conversation could not be created.");
    }
  };

  const loadEarlier = async () => {
    if (!selectedId || !nextCursor || loadingEarlier) return;
    setLoadingEarlier(true);
    const oldHeight = scrollRef.current?.scrollHeight || 0;
    const oldScrollTop = scrollRef.current?.scrollTop || 0;
    try {
      const response = await fetch("/api/messages/" + encodeURIComponent(selectedId) + "?before=" + nextCursor, {
        credentials: "same-origin", cache: "no-store"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Earlier messages could not be loaded.");
      const older = Array.isArray(data.messages) ? data.messages as ChatMessage[] : [];
      setMessages(current => [...older, ...current]);
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor ? Number(data.nextCursor) : null);
      keepScroll.current = false;
      requestAnimationFrame(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;
        const addedHeight = scroller.scrollHeight - oldHeight;
        scroller.scrollTop = oldScrollTop + Math.max(0, addedHeight);
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Earlier messages could not be loaded.");
    } finally { setLoadingEarlier(false); }
  };

  const sendTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: isTyping }));
  };

  const sendMessageBody = (body:string) => {
    const socket = socketRef.current;
    if (!body || body.length > 4000 || !selectedId) return false;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Reconnecting to this conversation. Your message has not been sent yet.");
      return false;
    }
    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: -Date.now(), conversation_id: selectedId, sender_id: userId, client_message_id: clientMessageId,
      body, created_at: Math.floor(Date.now() / 1000), deliveryState: "sending",
      reply_to_status_id: replyingStatusId || null
    };
    keepScroll.current = true;
    setMessages(current => [...current, optimistic]);
    setNotice("");
    try {
      socket.send(JSON.stringify({ type: "message", clientMessageId, body, replyToStatusId: replyingStatusId || undefined }));
      setReplyingStatusId("");
      return true;
    } catch {
      setMessages(current => current.map(item => item.client_message_id === clientMessageId
        ? { ...item, deliveryState: "failed" } : item));
      setNotice("The connection was interrupted. Your message was not sent.");
      return false;
    }
  };

  const sendMessage = () => {
    const body = draft.trim();
    if (!body || body.length > 4000) return;
    if (sendMessageBody(body)) setDraft("");
  };

  const sendVoiceNote = async () => {
    if (!voiceDraft || !selectedId || voiceUploading) return;
    if (connection !== "connected") {
      setNotice("Reconnect to this conversation before sending your voice note.");
      return;
    }
    setVoiceUploading(true);
    setNotice("");
    try {
      const mimeType = voiceDraft.blob.type.split(";")[0] || "audio/webm";
      const extension = mimeType === "audio/ogg" ? "ogg" : mimeType === "audio/mp4" ? "m4a" :
        mimeType === "audio/mpeg" ? "mp3" : mimeType === "audio/wav" ? "wav" :
        mimeType === "audio/aac" ? "aac" : "webm";
      const form = new FormData();
      form.append("conversationId",selectedId);
      form.append("durationSeconds",String(voiceDraft.duration));
      form.append("file",new File([voiceDraft.blob],"voice-note."+extension,{type:mimeType}));
      const response = await fetch("/api/messages/media",{
        method:"POST",credentials:"same-origin",body:form
      });
      const data = await response.json();
      if (!response.ok || !data.mediaKey) throw new Error(data.error || "Your voice note could not be uploaded.");
      const body = "[[CLERKME_VOICE_NOTE_V1|" + data.mediaKey + "|" + voiceDraft.duration + "]]";
      if (sendMessageBody(body)) discardVoiceDraft();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your voice note could not be sent. Please try again.");
    } finally { setVoiceUploading(false); }
  };

  const saveEditedMessage = async (message: ChatMessage) => {
    const body = editDraft.trim();
    if (!selectedId || message.sender_id !== userId || message.id < 1 || !body || body.length > 4000) return;
    setSavingEdit(true);
    setNotice("");
    try {
      const response = await fetch("/api/messages/" + encodeURIComponent(selectedId) + "/" + message.id, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      const data = await response.json();
      if (!response.ok || !data.message) throw new Error(data.error || "Your message could not be edited.");
      setMessages(current => current.map(item => item.id === message.id ? { ...item, ...data.message } : item));
      setEditingMessageId(null);
      setEditDraft("");
      void loadConversations();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your message could not be edited.");
    } finally { setSavingEdit(false); }
  };

  const startEditingMessage = (message: ChatMessage) => {
    if (message.sender_id !== userId || message.id < 1) return;
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };

  const retryMessage = (message: ChatMessage) => {
    const socket = socketRef.current;
    if (!selectedId || !message.client_message_id || !socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Reconnect to this conversation before retrying the message.");
      return;
    }
    setMessages(current => current.map(item => item.client_message_id === message.client_message_id
      ? { ...item, deliveryState: "sending" } : item));
    setNotice("");
    try {
      socket.send(JSON.stringify({
        type: "message",
        clientMessageId: message.client_message_id,
        body: message.body,
        replyToStatusId: message.reply_to_status_id || undefined
      }));
    } catch {
      setMessages(current => current.map(item => item.client_message_id === message.client_message_id
        ? { ...item, deliveryState: "failed" } : item));
      setNotice("The connection was interrupted. Please retry when it reconnects.");
    }
  };

  const blockStudent = async () => {
    if (!selectedId || !selected || !window.confirm("Block " + selected.otherName + "? They will no longer be able to message you.")) return;
    try {
      const response = await fetch("/api/messages/" + encodeURIComponent(selectedId) + "/block", { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "This student could not be blocked.");
      setConversations(current => current.filter(item => item.id !== selectedId));
      setSelectedId("");
      setMenuOpen(false);
      setNotice("Student blocked. You can no longer exchange messages in this conversation.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "This student could not be blocked."); }
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setReporting(true);
    try {
      const response = await fetch("/api/messages/reports", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: reportTarget.id, reason: reportReason, details: reportDetails })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The message could not be reported.");
      setReportTarget(null); setReportDetails("");
      setNotice("Thank you. Your report has been submitted for review.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "The message could not be reported."); }
    finally { setReporting(false); }
  };

  return (
    <section className="clerkme-dm-page" aria-label="Private messages">
      <div className="dm-page-heading">
        <div><span className="dm-eyebrow">PRIVATE STUDENT MESSAGING</span><h1>Messages</h1><p>One-to-one conversations with verified ClerkMe students.</p></div>
        <button className="dm-new-button" type="button" onClick={() => { setShowNew(true); setSelectedId(""); setSearch(""); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>New message</span></button>
      </div>
      {notice && <div className="dm-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

      <div className={"dm-workspace" + (selectedId ? " has-selection" : "")}>
        <aside className={"dm-inbox" + (selectedId ? " dm-mobile-hidden" : "")}>
          <div className="dm-inbox-heading"><strong>{showNew ? "New conversation" : "Your conversations"}</strong><button type="button" className="dm-inbox-action" onClick={() => { setShowNew(value => !value); setSearch(""); }} aria-label={showNew ? "Close search" : "New conversation"}>{showNew ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>}</button></div>
          {showNew && <div className="dm-search-panel">
            <label htmlFor="dm-search">Find a ClerkMe student</label>
            <input id="dm-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name or university" autoComplete="off"/>
            <div className="dm-search-results">
              {searching && <p className="dm-muted">Searching students…</p>}
              {!searching && search.trim().length < 2 && <p className="dm-muted">Enter at least two characters.</p>}
              {!searching && search.trim().length >= 2 && searchResults.length === 0 && <p className="dm-muted">No verified student found.</p>}
              {searchResults.map(student => <button type="button" className="dm-student-result" key={student.id} onClick={() => void openConversation(student)}>
                <span className="dm-avatar">{initials(student.name)}</span><span><strong>{student.name}</strong><small>{student.university || "ClerkMe student"}{student.level ? " · " + student.level : ""}</small></span><b>›</b>
              </button>)}
            </div>
          </div>}
          {!showNew && <div className="dm-conversation-search" role="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg><input id="dm-conversation-search" type="search" value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} placeholder="Search conversations…" aria-label="Search conversations by student name or recent message preview" autoComplete="off"/></div>}
          {!showNew && <div className="dm-conversation-list">
            {loading ? <div className="dm-empty-list">Loading conversations…</div> : conversations.length === 0 ? <div className="dm-empty-list">
              <span className="dm-empty-icon">✉</span><strong>No conversations yet</strong><p>Start a private academic conversation with another ClerkMe student.</p><button type="button" onClick={() => setShowNew(true)}>Find a student</button>
            </div> : filteredConversations.length === 0 ? <div className="dm-empty-list">No conversations match that search.</div> : filteredConversations.map(item => <button type="button" key={item.id} className={"dm-conversation" + (selectedId === item.id ? " is-active" : "")} onClick={() => { setSelectedId(item.id); setShowNew(false); }}>
              <span className="dm-avatar">{initials(item.otherName)}</span>
              <span className="dm-conversation-copy"><span className="dm-conversation-top"><strong>{item.otherName}</strong><time>{timeLabel(item.lastMessageAt)}</time></span>
                <span className="dm-conversation-bottom"><small>{item.lastMessagePreview || "Start a conversation"}</small>{item.unreadCount > 0 && <b>{item.unreadCount > 9 ? "9+" : item.unreadCount}</b>}</span>
              </span>
            </button>)}
          </div>}
        </aside>

        <div className={"dm-thread" + (!selectedId ? " dm-mobile-hidden" : "")}>
          {selectedId && !selected ? <div className="dm-thread-loading"><span className="dm-loading-indicator"/>Opening conversation…</div> : selected && selectedId ? <>
            <header className="dm-thread-header">
              <button className="dm-back-button" type="button" onClick={() => setSelectedId("")} aria-label="Back to conversations"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
              <span className="dm-avatar dm-header-avatar">{initials(selected.otherName)}</span>
              <div className="dm-thread-person"><strong>{selected.otherName}</strong><small>{peerOnline || isOnline(selected.otherLastSeenAt) ? "Online" : selected.otherLastSeenAt ? "Last seen " + timeLabel(selected.otherLastSeenAt) : "ClerkMe student"}</small></div>
              <span className={"dm-connection" + (connection === "connected" ? " is-connected" : "")}>{connection === "connected" ? "Live" : connection === "offline" ? "Offline" : "Reconnecting"}</span>
              <button type="button" className="dm-call-button" onClick={() => void startVoiceCall()} disabled={connection !== "connected" || callState !== "idle" || recording || Boolean(voiceDraft)} aria-label="Start voice call" title="Start voice call">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-1.4 2.1a14 14 0 0 1-5.7-5.7L11 10 9 5 7 3Z"/></svg>
              </button>
              <div className="dm-thread-menu-wrap"><button type="button" className="dm-menu-button" onClick={() => setMenuOpen(value => !value)} aria-label="Conversation options">⋯</button>
                {menuOpen && <div className="dm-menu"><button type="button" onClick={() => void blockStudent()}>Block student</button></div>}
              </div>
            </header>
            {callState !== "idle" && <section className="dm-call-panel" role="status" aria-live="polite">
              <div className="dm-call-person"><span className="dm-call-avatar">{initials(selected.otherName)}</span><div>
                <strong>{callState === "incoming" ? selected.otherName + " is calling" : callState === "active" ? "Voice call with " + selected.otherName : callState === "calling" ? "Calling " + selected.otherName : "Connecting call…"}</strong>
                <small>{callState === "active" ? durationLabel(callSeconds) : callState === "incoming" ? "Incoming voice call" : callState === "calling" ? "Waiting for them to answer…" : "Setting up secure audio…"}</small>
              </div></div>
              <div className="dm-call-actions">
                {callState === "incoming" ? <>
                  <button type="button" className="dm-call-decline" onClick={declineIncomingCall}>Decline</button>
                  <button type="button" className="dm-call-answer" onClick={() => void acceptIncomingCall()}>Answer</button>
                </> : callState === "active" ? <>
                  <button type="button" className="dm-call-mute" onClick={toggleCallMute}>{callMuted ? "Unmute" : "Mute"}</button>
                  <button type="button" className="dm-call-decline" onClick={() => endVoiceCall(true)}>End call</button>
                </> : <button type="button" className="dm-call-decline" onClick={() => endVoiceCall(true)}>Cancel</button>}
              </div>
              <audio ref={remoteAudioRef} autoPlay playsInline/>
              {callAudioNeedsTap && <button type="button" className="dm-call-audio-enable" onClick={() => { void remoteAudioRef.current?.play().then(()=>setCallAudioNeedsTap(false)).catch(()=>setNotice("Call audio could not start. Check your speaker volume and browser permission.")); }}>Enable call audio</button>}
              <small className="dm-call-network-note">Both students need this conversation open. Some networks may block direct peer-to-peer calls.</small>
            </section>}
            <div className="dm-message-scroll" ref={scrollRef} onScroll={() => {
              const el = scrollRef.current;
              if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
                const newest = [...messages].reverse().find(item => item.sender_id !== userId);
                if (newest && newest.id > 0) void markRead(selectedId, newest.id);
              }
            }}>
              {hasMore && <button type="button" className="dm-load-earlier" onClick={() => void loadEarlier()} disabled={loadingEarlier}>{loadingEarlier ? "Loading…" : "Load earlier messages"}</button>}
              {messages.length === 0 && <div className="dm-thread-empty"><span>✦</span><strong>Start the conversation</strong><p>Ask a question, discuss an academic topic or exchange learning ideas.</p></div>}
              {messages.map((message, index) => {
                const own = message.sender_id === userId;
                const prev = messages[index - 1];
                const showDay = !prev || new Date(prev.created_at * 1000).toDateString() !== new Date(message.created_at * 1000).toDateString();
                const read = own && message.id > 0 && message.id <= peerReadMessageId;
                return <div className="dm-message-group" key={message.public_id || message.client_message_id || message.id}>
                  {showDay && <div className="dm-day-divider"><span>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(message.created_at * 1000))}</span></div>}
                  <div className={"dm-message-row" + (own ? " is-own" : "")}><div className={"dm-bubble" + (own ? " dm-own-bubble" : "")}>
                    {message.reply_to_status_id && <small className="dm-status-reply-marker">↩ Status reply</small>}
                    {editingMessageId === message.id ? <div className="dm-edit-box">
                      <textarea aria-label="Edit your message" value={editDraft} maxLength={4000} rows={3}
                        onChange={event => setEditDraft(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === "Escape") { event.preventDefault(); cancelEditingMessage(); }
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void saveEditedMessage(message); }
                        }}/>
                      <div className="dm-edit-actions"><small>{editDraft.length}/4000 · Ctrl/⌘ + Enter to save</small>
                        <button type="button" className="dm-edit-cancel" onClick={cancelEditingMessage} disabled={savingEdit}>Cancel</button>
                        <button type="button" className="dm-edit-save" onClick={() => void saveEditedMessage(message)} disabled={savingEdit || !editDraft.trim() || editDraft.trim() === message.body}>{savingEdit ? "Saving…" : "Save"}</button>
                      </div>
                    </div> : getVoiceNote(message.body) ? <div className="dm-voice-note">
                      <span>🎙 Voice note · {durationLabel(getVoiceNote(message.body)!.duration)}</span>
                      <audio controls preload="metadata" src={"/api/messages/media/" + encodeURIComponent(getVoiceNote(message.body)!.key)} aria-label="Play voice note"/>
                    </div> : <p>{message.body}</p>}
                    <div className="dm-message-meta"><time>{timeLabel(message.created_at)}</time>
                      {message.edited_at && <em>Edited</em>}
                      {own && <span>{message.deliveryState === "sending" ? "Sending…" : message.deliveryState === "failed" ? "Not sent" : read ? "Read" : message.delivered_at ? "Delivered" : "Sent"}</span>}
                      {own && message.id > 0 && message.deliveryState !== "failed" && editingMessageId !== message.id && !getVoiceNote(message.body) && <button type="button" className="dm-edit-action" onClick={() => startEditingMessage(message)}>Edit</button>}
                      {own && message.deliveryState === "failed" && <button type="button" onClick={() => retryMessage(message)}>Retry</button>}
                      {!own && message.id > 0 && <button type="button" onClick={() => setReportTarget(message)}>Report</button>}
                    </div>
                  </div></div>
                </div>;
              })}
              {typing && <div className="dm-typing-indicator"><i/><i/><i/><span>Typing…</span></div>}
            </div>
            <form className="dm-composer" aria-label="Write a message" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
              <div className="dm-composer-heading"><label htmlFor="dm-message-input">Message</label><span>Private chat</span></div>
              {replyingStatusId && <div className="dm-status-reply-context"><span>↩ Replying to a status</span><button type="button" onClick={() => setReplyingStatusId("")}>Cancel</button></div>}
              {recording ? <div className="dm-recording-row">
                <span className="dm-recording-dot" aria-hidden="true"/>
                <div><strong>Recording voice note</strong><small>{durationLabel(recordingSeconds)} / 01:00</small></div>
                <button type="button" className="dm-record-stop" onClick={stopVoiceRecording}>Stop</button>
              </div> : voiceDraft ? <div className="dm-voice-preview-row">
                <audio controls preload="metadata" src={voiceDraft.url} aria-label="Preview your voice note"/>
                <button type="button" className="dm-voice-discard" onClick={discardVoiceDraft} disabled={voiceUploading}>Discard</button>
                <button type="button" className="dm-voice-send" onClick={() => void sendVoiceNote()} disabled={voiceUploading || connection !== "connected"}>{voiceUploading ? "Uploading…" : "Send voice note"}</button>
              </div> : <div className="dm-composer-input-row">
                <textarea id="dm-message-input" value={draft} maxLength={4000} rows={2} onChange={event => { setDraft(event.target.value); const socket = socketRef.current; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: true })); }} onBlur={() => { const socket = socketRef.current; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: false })); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Type your message here…" aria-label="Type your message here"/>
                <button type="button" className="dm-voice-record" onClick={() => void startVoiceRecording()} disabled={connection !== "connected" || callState !== "idle"} aria-label="Record a voice note" title="Record a voice note">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span>Voice</span>
                </button>
                <button type="submit" className="dm-send-button" disabled={!draft.trim() || draft.length > 4000 || connection !== "connected"}><span>{connection === "connected" ? "Send" : "Connecting…"}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg></button>
              </div>}
              <div className="dm-composer-footer"><small id="dm-composer-hint">{recording ? "Keep your message clear and concise." : voiceDraft ? "Listen before sending. Voice notes are private to this conversation." : draft.length + "/4000 · " + (connection === "connected" ? "Enter to send, Shift + Enter for a new line." : "Your text is saved here while the chat reconnects.")}</small></div>
            </form>
          </> : <div className="dm-welcome"><div className="dm-welcome-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 7.4 7.4 0 0 1-3.7-1L4 20l1.6-4.2a7.4 7.4 0 0 1-1.1-4.3A7.5 7.5 0 0 1 12 4h.5a7.5 7.5 0 0 1 7.5 7.5Z"/><path d="M8 11h8M8 14.5h5"/></svg></div><h2>Your academic conversations, together.</h2><p>Choose a conversation or start a private message with another verified ClerkMe student.</p><button type="button" onClick={() => { setShowNew(true); setSelectedId(""); setSearch(""); }}>Start a conversation <span>→</span></button><small>Choose a student first. The message box appears at the bottom of the conversation. Messages are private to the two participants; never share identifiable patient information.</small></div>}
        </div>
      </div>

      {reportTarget && <div className="dm-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setReportTarget(null); }}>
        <section className="dm-report-modal" role="dialog" aria-modal="true" aria-labelledby="dm-report-title">
          <button type="button" className="dm-report-close" onClick={() => setReportTarget(null)} aria-label="Close report">×</button>
          <span className="dm-eyebrow">COMMUNITY SAFETY</span><h2 id="dm-report-title">Report this message</h2><p>Your report will be sent to the ClerkMe moderation team for review.</p>
          <label>Reason<select value={reportReason} onChange={event => setReportReason(event.target.value)}>
            <option value="harassment">Harassment or bullying</option><option value="spam">Spam or unwanted promotion</option><option value="inappropriate">Inappropriate content</option><option value="misinformation">Potentially harmful misinformation</option><option value="other">Other concern</option>
          </select></label>
          <label>Additional details (optional)<textarea value={reportDetails} onChange={event => setReportDetails(event.target.value)} maxLength={500} rows={3} placeholder="Add context for the moderation team…"/></label>
          <button type="button" className="dm-report-submit" onClick={() => void submitReport()} disabled={reporting}>{reporting ? "Submitting…" : "Submit report"}</button>
        </section>
      </div>}
    </section>
  );
}
