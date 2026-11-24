"use client";
import { useCallback, useEffect, useState } from "react";
type ReminderPreferences = { emailRemindersEnabled: boolean; vapidPublicKey: string };
function decodeApplicationServerKey(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
export default function ReminderSettings() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [vapidPublicKey, setVapidPublicKey] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pushSupported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/reminders/preferences", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("We could not load your reminder preferences.");
      const data = await response.json() as ReminderPreferences;
      setEmailEnabled(data.emailRemindersEnabled !== false); setVapidPublicKey(data.vapidPublicKey || "");
      if (pushSupported) {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        setPushEnabled(Boolean(await registration.pushManager.getSubscription()));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Reminder settings are temporarily unavailable."); }
    finally { setLoading(false); }
  }, [pushSupported]);
  useEffect(() => { void load(); }, [load]);
  const updateEmail = async (enabled: boolean) => {
    setBusy(true); setError(""); setNotice(""); const previous = emailEnabled; setEmailEnabled(enabled);
    try {
      const response = await fetch("/api/reminders/preferences", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ emailRemindersEnabled: enabled }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your email preference could not be saved.");
      setNotice(enabled ? "Email reminders are on. We will keep them gentle." : "Email reminders are switched off.");
    } catch (reason) { setEmailEnabled(previous); setError(reason instanceof Error ? reason.message : "Your preference could not be saved."); }
    finally { setBusy(false); }
  };
  const enablePush = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (!pushSupported) throw new Error("This browser does not support web push. Email reminders are still available.");
      if (!vapidPublicKey) throw new Error("Phone notifications are not configured yet. Please try again later.");
      if (Notification.permission === "denied") throw new Error("Notifications are blocked by your browser. Open this site's browser permissions and allow notifications first.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Phone notifications were not enabled. You can change this choice in your browser settings.");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeApplicationServerKey(vapidPublicKey) as BufferSource });
      const response = await fetch("/api/push/subscriptions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Your phone could not be registered for notifications.");
      setPushEnabled(true); setNotice("Phone reminders are on. ClerkMe will keep the little notes occasional and kind.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Phone notifications could not be enabled."); }
    finally { setBusy(false); }
  };
  const disablePush = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/push/subscriptions", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || "Your phone preference could not be updated.");
        await subscription.unsubscribe();
      }
      setPushEnabled(false); setNotice("Phone reminders are switched off on this device.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Phone reminders could not be switched off."); }
    finally { setBusy(false); }
  };
  const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  return <article className="panel account-settings-group reminder-settings-card">
    <div className="account-settings-group-heading"><span className="account-settings-icon" aria-hidden="true">♡</span><div><h3>A little note from ClerkMe</h3><p>Stay connected, even when you are away studying elsewhere.</p></div></div>
    <div className="reminder-intro-note"><span aria-hidden="true">💙</span><p>We know life and medical school can get busy. When we have not seen you for 48 hours, ClerkMe can send a gentle hello and remind you that your study space is right where you left it. No guilt, just encouragement.</p></div>
    <div className="reminder-setting-row"><div className="reminder-setting-copy"><strong>Email reminders</strong><small>Receive one warm email after 48 hours away. You can turn this off whenever you like.</small></div><button type="button" className="reminder-switch" role="switch" aria-checked={emailEnabled} aria-label="Email reminders" disabled={loading || busy} onClick={() => void updateEmail(!emailEnabled)}><span/></button></div>
    <div className="reminder-setting-row"><div className="reminder-setting-copy"><strong>Phone notifications</strong><small>Let ClerkMe send a notification to your device, even when the website is closed.</small></div><span aria-hidden="true" style={{fontSize:11,fontWeight:750,color:pushEnabled?"#16804b":"var(--clerkme-muted)"}}>{pushEnabled ? "ON" : "OFF"}</span></div>
    {pushSupported ? <button type="button" className="reminder-push-button" disabled={loading || busy} onClick={() => void (pushEnabled ? disablePush() : enablePush())}>{busy ? "Saving your choice…" : pushEnabled ? "Turn off phone notifications" : "Enable phone notifications"}</button> : <p className="reminder-settings-footnote">This browser does not support background phone notifications. Email reminders can still reach you.</p>}
    {isIos && !isStandalone && <p className="reminder-settings-footnote">On iPhone or iPad, first add ClerkMe to your Home Screen, open it from that icon, then enable notifications here.</p>}
    {error && <p className="reminder-feedback is-error" role="alert">{error}</p>}{notice && <p className="reminder-feedback is-success" role="status">{notice}</p>}
    <p className="reminder-settings-footnote">Your choices are private. Phone notifications require your permission. We send at most one reminder per channel until you visit ClerkMe again.</p>
  </article>;
}
