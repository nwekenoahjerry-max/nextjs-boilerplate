"use client";
import { useCallback, useEffect, useState } from "react";
type Notification = {
  id: string; kind: string; title: string; message: string;
  destination: "materials" | "qbank" | "study" | "you";
  isRead: boolean; createdAt: number;
};
const destinationLabels: Record<Notification["destination"], string> = {
  materials: "Open materials", qbank: "Open question bank", study: "Open study", you: "Open account"
};
function timeAgo(timestamp: number) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(timestamp * 1000));
}
function NotificationIcon({ kind }: { kind: string }) {
  if (kind.includes("failed")) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16.5v.1"/></svg>;
  if (kind.includes("sba")) return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h2M13 12h3M8 16h8"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z"/><path d="M5 18a2.5 2.5 0 0 1 2.5-2H19M9 7h6M9 11h6"/></svg>;
}
export default function NotificationCenter({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) return;
      if (!response.ok) throw new Error("Notifications are temporarily unavailable.");
      const data = await response.json() as { notifications?: Notification[]; unreadCount?: number };
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setLoaded(true);
    } catch {
      // Preserve the last known state while offline.
    } finally { if (!silent) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 45000);
    return () => window.clearInterval(timer);
  }, [load]);
  const markRead = async (id?: string) => {
    const previous = items;
    setItems(current => current.map(item => !id || item.id === id ? { ...item, isRead: true } : item));
    setUnreadCount(current => id ? Math.max(0, current - (items.some(item => item.id === id && !item.isRead) ? 1 : 0)) : 0);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(id ? { id } : { readAll: true })
      });
      if (!response.ok) throw new Error("Could not update notifications.");
    } catch { setItems(previous); void load(true); }
  };
  const activate = async (item: Notification) => {
    if (!item.isRead) await markRead(item.id);
    setOpen(false);
    onNavigate(item.destination);
  };
  return (
    <div className="notification-center">
      <button type="button" className="notification-trigger"
        aria-label={unreadCount ? "Notifications, " + unreadCount + " unread" : "Notifications"}
        aria-expanded={open} aria-haspopup="dialog"
        onClick={() => { setOpen(value => !value); if (!open) void load(true); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && <>
        <button type="button" className="notification-dismiss-layer" aria-label="Close notifications" onClick={() => setOpen(false)}/>
        <section className="notification-popover" role="dialog" aria-label="Notifications">
          <div className="notification-popover-heading">
            <div><strong>Notifications</strong><small>{unreadCount ? unreadCount + " unread update" + (unreadCount === 1 ? "" : "s") : "You're all caught up"}</small></div>
            <div className="notification-heading-actions">
              {unreadCount > 0 && <button type="button" onClick={() => void markRead()}>Mark all read</button>}
              <button type="button" className="notification-close" aria-label="Close notifications" onClick={() => setOpen(false)}>×</button>
            </div>
          </div>
          <div className="notification-list">
            {loading && !loaded ? <div className="notification-empty">Checking for updates…</div> : items.length === 0 ? (
              <div className="notification-empty-state"><span><NotificationIcon kind="general"/></span><strong>No notifications yet</strong><small>Study updates and important account messages will appear here.</small></div>
            ) : items.map(item => (
              <button type="button" className={"notification-item" + (item.isRead ? "" : " is-unread")} key={item.id} onClick={() => void activate(item)}>
                <span className={"notification-item-icon" + (item.kind.includes("failed") ? " is-warning" : "")}><NotificationIcon kind={item.kind}/></span>
                <span className="notification-item-copy"><strong>{item.title}</strong><small>{item.message}</small><em>{timeAgo(item.createdAt)} · {destinationLabels[item.destination]}</em></span>
                {!item.isRead && <i className="notification-unread-dot" aria-label="Unread"/>}
              </button>
            ))}
          </div>
          <div className="notification-popover-footer">ClerkMe learning updates</div>
        </section>
      </>}
    </div>
  );
}
