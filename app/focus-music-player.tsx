"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FocusTrack = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: number;
};

const musicStyles = [
  { id: "lofi", label: "Lo-fi", query: "lofi hip hop beats for studying no lyrics long mix" },
  { id: "piano", label: "Piano", query: "soft piano instrumental music for studying long mix" },
  { id: "classical", label: "Classical", query: "classical music for concentration studying long mix" },
  { id: "ambient", label: "Ambient", query: "ambient instrumental music deep focus long mix" },
  { id: "rain", label: "Rain & nature", query: "rain sounds with soft instrumental study music long mix" },
  { id: "jazz", label: "Jazz", query: "instrumental jazz music for studying focus long mix" }
] as const;

async function readMusicResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: "YouTube returned an unreadable response." }));
  if (!response.ok) throw new Error(data.error || "YouTube music recommendations are unavailable.");
  return data as { videos?: FocusTrack[] };
}

export default function FocusMusicPlayer({ inVideoLibrary }: { inVideoLibrary: boolean }) {
  const [style, setStyle] = useState<string>("lofi");
  const [recommendations, setRecommendations] = useState<FocusTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTrack, setActiveTrack] = useState<FocusTrack | null>(null);
  const initialLoadStarted = useRef(false);

  const loadRecommendations = useCallback(async (styleId: string) => {
    const selectedStyle = musicStyles.find(item => item.id === styleId) || musicStyles[0];
    setStyle(selectedStyle.id);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/learning/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          query: selectedStyle.query,
          order: "relevance",
          mode: "focus-music"
        })
      });
      const data = await readMusicResponse(response);
      const videos = Array.isArray(data.videos) ? data.videos : [];
      setRecommendations(videos);
      if (!videos.length) setError("No long-form music recommendations were found in this category. Try another style.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load YouTube music recommendations. Please try again.");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!inVideoLibrary || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadRecommendations("lofi");
  }, [inVideoLibrary, loadRecommendations]);

  useEffect(() => {
    const stopForLecture = () => setActiveTrack(null);
    window.addEventListener("clerkme:video-playing", stopForLecture);
    return () => window.removeEventListener("clerkme:video-playing", stopForLecture);
  }, []);

  const playTrack = (track: FocusTrack) => {
    setActiveTrack(track);
    window.dispatchEvent(new Event("clerkme:focus-music-playing"));
  };

  const player = activeTrack && (
    <div className="focus-music-player" aria-label="YouTube music player">
      <div className="focus-music-player-heading">
        <div>
          <span className="focus-music-live"><i /> SELECTED FOR YOUR SESSION</span>
          <strong>{activeTrack.title}</strong>
          <small>{activeTrack.channelTitle}{activeTrack.duration ? " · " + activeTrack.duration : ""}</small>
        </div>
        <button type="button" className="focus-music-stop" onClick={() => setActiveTrack(null)}>Stop music</button>
      </div>
      <div className="focus-music-player-frame">
        <iframe
          src={"https://www.youtube-nocookie.com/embed/" + activeTrack.id + "?autoplay=1&controls=1&rel=0&playsinline=1"}
          title={activeTrack.title + " — YouTube music player"}
          allow="autoplay; encrypted-media; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <p className="focus-music-player-note">Playback is provided by YouTube. Use the player controls to pause, resume or adjust the volume.</p>
    </div>
  );

  if (!inVideoLibrary && !activeTrack) return null;

  if (!inVideoLibrary) {
    return (
      <section className="focus-music-dock" aria-label="YouTube focus music">
        <div className="focus-music-dock-heading">
          <span><strong>Focus music</strong><small>{activeTrack?.title}</small></span>
          <div>
            <button type="button" onClick={() => setActiveTrack(null)}>Stop</button>
            <button type="button" className="focus-music-return" onClick={() => window.dispatchEvent(new CustomEvent("clerkme:navigate", { detail: { section: "videos" } }))}>Library</button>
          </div>
        </div>
        {player}
      </section>
    );
  }

  return (
    <section className="focus-music-panel" aria-label="ClerkME focus music">
      <div className="focus-music-heading">
        <div>
          <span className="eyebrow">YOUTUBE MUSIC FOR STUDY</span>
          <h2>Focus music</h2>
          <p>Choose a long-form mix for revision, quiet study or a focused session.</p>
        </div>
        <span className="focus-music-note" aria-hidden="true">♫</span>
      </div>

      <div className="focus-music-style-row" role="group" aria-label="Choose a music style">
        {musicStyles.map(item => (
          <button
            key={item.id}
            type="button"
            className={style === item.id ? "is-active" : ""}
            aria-pressed={style === item.id}
            disabled={loading}
            onClick={() => void loadRecommendations(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {player}

      <div className="focus-music-recommendation-heading">
        <div>
          <strong>{style === "lofi" ? "Recommended for focus" : musicStyles.find(item => item.id === style)?.label + " recommendations"}</strong>
          <span>Long-form YouTube music · Updated when you choose a style</span>
        </div>
        <button type="button" onClick={() => void loadRecommendations(style)} disabled={loading}>
          {loading ? "Finding music…" : "Refresh"}
        </button>
      </div>

      {loading && (
        <div className="focus-music-loading" role="status">
          <span className="focus-music-spinner" />
          <span>Finding playable YouTube music for you…</span>
        </div>
      )}

      {error && !loading && <p className="focus-music-error" role="alert">{error}</p>}

      {!loading && recommendations.length > 0 && (
        <div className="focus-music-recommendations">
          {recommendations.map(track => (
            <article className={"focus-music-recommendation" + (activeTrack?.id === track.id ? " is-playing" : "")} key={track.id}>
              <div className="focus-music-thumbnail">
                <img src={track.thumbnailUrl} alt="" loading="lazy" />
                <span>{track.duration || "Long-form mix"}</span>
              </div>
              <div className="focus-music-recommendation-copy">
                <strong title={track.title}>{track.title}</strong>
                <small>{track.channelTitle}</small>
                <button type="button" onClick={() => playTrack(track)}>
                  {activeTrack?.id === track.id ? "Play again" : "Play music"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="focus-music-disclaimer">Videos play in YouTube’s embedded player. Some tracks may include visuals or adverts. Starting a lecture automatically stops focus music.</p>
    </section>
  );
}
