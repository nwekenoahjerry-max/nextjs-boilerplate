"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallAppButton({
  variant = "card",
  promptEvent: sharedPromptEvent = null,
  onPromptConsumed
}: {
  variant?: "card" | "menu";
  promptEvent?: InstallPromptEvent | null;
  onPromptConsumed?: () => void;
}) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Installation remains available online even if service-worker registration fails.
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (installed) return;
    const prompt = installPrompt || sharedPromptEvent;
    if (!prompt) {
      setShowHelp(value => !value);
      return;
    }
    try {
      onPromptConsumed?.();
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setShowHelp(false);
      } else {
        setShowHelp(true);
      }
    } catch {
      setShowHelp(true);
    } finally {
      setInstallPrompt(null);
    }
  };

  return (
    <div className={`install-app-wrap install-app-${variant}`}>
      <button className="install-app-trigger" type="button" onClick={handleInstall} aria-expanded={showHelp}>
        <span className="install-app-icon"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></svg></span>
        <span>{installed ? "ClerkMe is installed" : "Install ClerkMe"}</span>
        {variant === "card" && <small>Use it like an app on your device</small>}
      </button>
      {showHelp && !installed && <div className="install-app-help" role="status">
        <strong>Install ClerkMe on this device</strong>
        <p><b>Android:</b> Open the browser menu and choose “Install app” or “Add to Home screen”.</p>
        <p><b>iPhone / iPad:</b> Open this page in Safari, tap Share, then “Add to Home Screen”.</p>
        <p><b>Windows / Chromebook:</b> In Chrome or Edge, use the install icon in the address bar or choose “Install ClerkMe” from the browser menu.</p><p><b>Mac:</b> In Safari 17 or later, use File → Add to Dock. Chrome and Edge also provide an install option.</p>
      </div>}
    </div>
  );
}
