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
};
type SocketEvent = {
  type: string; message?: ChatMessage | string; messageId?: number; deliveredAt?: number;
  userId?: string; isOnline?: boolean; isTyping?: boolean; lastReadMessageId?: number;
  clientMessageId?: string;
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

export default function DirectMessagesPanel({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerReadMessageId, setPeerReadMessageId] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState("");
  const [connection, setConnection] = useState<"connecting" | "connected" | "reconnecting" | "offline">("offline");
  const [peerOnline, setPeerOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);
  const keepScroll = useRef(true);

  const selected = useMemo(() => conversations.find(item => item.id === selectedId) || null, [conversations, selectedId]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/messages", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { window.location.href = "/login"; return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Your conversations could not be loaded.");
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Your conversations could not be loaded.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
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
      await fetch("/api/messages/" + encodeURIComponent(conversationId) + "/read", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId })
      });
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "read", messageId }));
      setConversations(current => current.map(item => item.id === conversationId ? { ...item, unreadCount: 0 } : item));
    } catch { /* Reconciled on the next inbox refresh. */ }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]); setPeerReadMessageId(0); setNextCursor(null); setHasMore(false); setPeerOnline(false);
      return;
    }
    let cancelled = false;
    setMessages([]);
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
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN && document.visibilityState === "visible") {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      socket.onmessage = event => {
        let data: SocketEvent;
        try { data = JSON.parse(String(event.data)) as SocketEvent; } catch { return; }

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
              ...item, lastMessagePreview: incoming.body, lastMessageAt: incoming.created_at,
              unreadCount: incoming.sender_id === userId || nearBottom ? item.unreadCount : item.unreadCount + 1
            } : item);
            return updated.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
          });
          if (incoming.sender_id !== userId) {
            if (nearBottom) void markRead(selectedId, incoming.id);
            window.dispatchEvent(new Event("clerkme:notifications-refresh"));
          }
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
      socket.onclose = () => {
        window.clearInterval(heartbeatTimer);
        if (socketRef.current === socket) socketRef.current = null;
        if (!stopped) scheduleReconnect();
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
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldHeight;
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Earlier messages could not be loaded.");
    } finally { setLoadingEarlier(false); }
  };

  const sendTyping = (isTyping: boolean) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: isTyping }));
  };

  const sendMessage = () => {
    const body = draft.trim();
    const socket = socketRef.current;
    if (!body || body.length > 4000 || !selectedId) return;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setNotice("Reconnecting to this conversation. Please try again when the connection is restored.");
      return;
    }
    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: -Date.now(), conversation_id: selectedId, sender_id: userId, client_message_id: clientMessageId,
      body, created_at: Math.floor(Date.now() / 1000), deliveryState: "sending"
    };
    keepScroll.current = true;
    setMessages(current => [...current, optimistic]);
    setDraft("");
    setNotice("");
    try { socket.send(JSON.stringify({ type: "message", clientMessageId, body })); }
    catch {
      setMessages(current => current.map(item => item.client_message_id === clientMessageId
        ? { ...item, deliveryState: "failed" } : item));
      setNotice("The connection was interrupted. Your message was not sent.");
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
        <button className="dm-new-button" type="button" onClick={() => { setShowNew(true); setSelectedId(""); setSearch(""); }}><span aria-hidden="true">＋</span> New message</button>
      </div>
      {notice && <div className="dm-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

      <div className={"dm-workspace" + (selectedId ? " has-selection" : "")}>
        <aside className={"dm-inbox" + (selectedId ? " dm-mobile-hidden" : "")}>
          <div className="dm-inbox-heading"><strong>{showNew ? "New conversation" : "Your conversations"}</strong><button type="button" className="dm-inbox-action" onClick={() => { setShowNew(value => !value); setSearch(""); }} aria-label={showNew ? "Close search" : "New conversation"}>{showNew ? "×" : "＋"}</button></div>
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
          {!showNew && <div className="dm-conversation-list">
            {loading ? <div className="dm-empty-list">Loading conversations…</div> : conversations.length === 0 ? <div className="dm-empty-list">
              <span className="dm-empty-icon">✉</span><strong>No conversations yet</strong><p>Start a private academic conversation with another ClerkMe student.</p><button type="button" onClick={() => setShowNew(true)}>Find a student</button>
            </div> : conversations.map(item => <button type="button" key={item.id} className={"dm-conversation" + (selectedId === item.id ? " is-active" : "")} onClick={() => { setSelectedId(item.id); setShowNew(false); }}>
              <span className="dm-avatar">{initials(item.otherName)}</span>
              <span className="dm-conversation-copy"><span className="dm-conversation-top"><strong>{item.otherName}</strong><time>{timeLabel(item.lastMessageAt)}</time></span>
                <span className="dm-conversation-bottom"><small>{item.lastMessagePreview || "Start a conversation"}</small>{item.unreadCount > 0 && <b>{item.unreadCount > 9 ? "9+" : item.unreadCount}</b>}</span>
              </span>
            </button>)}
          </div>}
        </aside>

        <main className={"dm-thread" + (!selectedId ? " dm-mobile-hidden" : "")}>
          {selected && selectedId ? <>
            <header className="dm-thread-header">
              <button className="dm-back-button" type="button" onClick={() => setSelectedId("")} aria-label="Back to conversations">‹</button>
              <span className="dm-avatar dm-header-avatar">{initials(selected.otherName)}</span>
              <div className="dm-thread-person"><strong>{selected.otherName}</strong><small>{peerOnline || isOnline(selected.otherLastSeenAt) ? "Online" : selected.otherLastSeenAt ? "Last seen " + timeLabel(selected.otherLastSeenAt) : "ClerkMe student"}</small></div>
              <span className={"dm-connection" + (connection === "connected" ? " is-connected" : "")}>{connection === "connected" ? "Live" : connection === "offline" ? "Offline" : "Reconnecting"}</span>
              <div className="dm-thread-menu-wrap"><button type="button" className="dm-menu-button" onClick={() => setMenuOpen(value => !value)} aria-label="Conversation options">⋯</button>
                {menuOpen && <div className="dm-menu"><button type="button" onClick={() => void blockStudent()}>Block student</button></div>}
              </div>
            </header>
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
                    <p>{message.body}</p><div className="dm-message-meta"><time>{timeLabel(message.created_at)}</time>
                      {own && <span>{message.deliveryState === "sending" ? "Sending…" : message.deliveryState === "failed" ? "Not sent" : read ? "Read" : message.delivered_at ? "Delivered" : "Sent"}</span>}
                      {!own && message.id > 0 && <button type="button" onClick={() => setReportTarget(message)}>Report</button>}
                    </div>
                  </div></div>
                </div>;
              })}
              {typing && <div className="dm-typing-indicator"><i/><i/><i/><span>Typing…</span></div>}
            </div>
            <form className="dm-composer" onSubmit={event => { event.preventDefault(); sendMessage(); }}>
              <textarea value={draft} maxLength={4000} rows={1} onChange={event => { setDraft(event.target.value); const socket = socketRef.current; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: true })); }} onBlur={() => { const socket = socketRef.current; if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "typing", body: false })); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Write a message…" aria-label="Write a message"/>
              <div className="dm-composer-footer"><small>{draft.length}/4000 · Keep conversations respectful and academic.</small><button type="submit" disabled={!draft.trim() || draft.length > 4000 || connection !== "connected"}>Send <span>↗</span></button></div>
            </form>
          </> : <div className="dm-welcome"><div className="dm-welcome-icon">✉</div><h2>Your academic conversations, together.</h2><p>Choose a conversation or start a private message with another verified ClerkMe student.</p><button type="button" onClick={() => { setShowNew(true); setSelectedId(""); setSearch(""); }}>Start a conversation <span>→</span></button><small>Messages are private to the two participants. Do not share identifiable patient information.</small></div>}
        </main>
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
