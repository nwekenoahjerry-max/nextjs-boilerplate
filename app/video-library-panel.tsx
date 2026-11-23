"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { clinicalUnits } from "../lib/learning-content";

type Video = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: number;
  likeCount?: number;
};

type SavedVideo = Video & {
  savedId: string;
  folder: string;
  createdAt: number;
};

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: "The server returned an unreadable response." }));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function compactNumber(value?: number) {
  if (!value) return "";
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatSavedDate(timestamp: number) {
  if (!timestamp) return "Saved recently";
  return "Saved " + new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(timestamp * 1000));
}

export default function VideoLibraryPanel() {
  const [activeTab, setActiveTab] = useState<"discover" | "saved">("discover");
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("all");
  const [sort, setSort] = useState("relevance");
  const [folderChoice, setFolderChoice] = useState("General Medicine");
  const [customFolder, setCustomFolder] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState("");
  const [savedFilter, setSavedFilter] = useState("all");
  const [savedSearch, setSavedSearch] = useState("");
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const playerRef = useRef<HTMLElement>(null);
  const [movingId, setMovingId] = useState("");

  const unitName = (id: string) => clinicalUnits.find(item => item.id === id)?.name || id;
  const folders = useMemo(() => Array.from(new Set(savedVideos.map(video => video.folder))).sort((a, b) => a.localeCompare(b)), [savedVideos]);
  const visibleSaved = useMemo(() => savedVideos.filter(video =>
    (savedFilter === "all" || video.folder === savedFilter) &&
    (!savedSearch.trim() || (video.title + " " + video.channelTitle + " " + video.description).toLowerCase().includes(savedSearch.trim().toLowerCase()))
  ), [savedVideos, savedFilter, savedSearch]);
  const groupedSaved = useMemo(() => {
    return visibleSaved.reduce<Record<string, SavedVideo[]>>((groups, video) => {
      (groups[video.folder] ||= []).push(video);
      return groups;
    }, {});
  }, [visibleSaved]);
  const savedIds = useMemo(() => new Set(savedVideos.map(video => video.id)), [savedVideos]);

  const loadSavedVideos = async () => {
    setSavedLoading(true);
    setSavedError("");
    try {
      const response = await fetch("/api/learning/saved-videos", { credentials: "same-origin", cache: "no-store" });
      const data = await readResponse(response);
      setSavedVideos(Array.isArray(data.videos) ? data.videos as SavedVideo[] : []);
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Could not load your saved videos.");
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => { void loadSavedVideos(); }, []);
  useEffect(() => {
    if (!activeVideo) return;
    const frame = window.requestAnimationFrame(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeVideo?.id, activeTab]);

  const searchVideos = async (event?: FormEvent) => {
    event?.preventDefault();
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setSearchError("Enter at least two characters to search for a lecture.");
      return;
    }
    const subject = unit === "all" ? "" : unitName(unit);
    const finalQuery = [cleanQuery, subject].filter(Boolean).join(" ");
    setLoading(true);
    setSearchError("");
    setNotice("");
    setSearched(true);
    setActiveVideo(null);
    setVideos([]);
    try {
      const response = await fetch("/api/learning/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ query: finalQuery, order: sort })
      });
      const data = await readResponse(response);
      const results = Array.isArray(data.videos) ? data.videos as Video[] : [];
      setVideos(results);
      if (!results.length) setSearchError("No embeddable lectures were found. Try a more specific topic or a different search phrase.");
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Video search is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const saveVideo = async (video: Video) => {
    const folder = customFolder.trim() || folderChoice || "Unsorted";
    setSavingId(video.id);
    setNotice("");
    setSavedError("");
    try {
      const response = await fetch("/api/learning/saved-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration || "",
          durationSeconds: video.durationSeconds || 0,
          viewCount: video.viewCount || 0,
          likeCount: video.likeCount || 0,
          folder
        })
      });
      const data = await readResponse(response);
      const saved = data.video as SavedVideo;
      setSavedVideos(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      setNotice("Saved to " + folder + ".");
      setCustomFolder("");
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Could not save this video.");
    } finally {
      setSavingId("");
    }
  };

  const moveVideo = async (video: SavedVideo, folder: string) => {
    if (!folder || folder === video.folder) return;
    setMovingId(video.savedId);
    setSavedError("");
    try {
      const response = await fetch("/api/learning/saved-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          description: video.description,
          channelTitle: video.channelTitle,
          thumbnailUrl: video.thumbnailUrl,
          duration: video.duration || "",
          durationSeconds: video.durationSeconds || 0,
          viewCount: video.viewCount || 0,
          likeCount: video.likeCount || 0,
          folder
        })
      });
      const data = await readResponse(response);
      const updated = data.video as SavedVideo;
      setSavedVideos(current => current.map(item => item.savedId === video.savedId ? updated : item));
      setNotice("Moved to " + folder + ".");
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Could not move this video.");
    } finally {
      setMovingId("");
    }
  };

  const removeVideo = async (video: SavedVideo) => {
    if (!window.confirm("Remove this video from your saved library?")) return;
    setSavedError("");
    try {
      const response = await fetch("/api/learning/saved-videos?id=" + encodeURIComponent(video.savedId), {
        method: "DELETE",
        credentials: "same-origin"
      });
      await readResponse(response);
      setSavedVideos(current => current.filter(item => item.savedId !== video.savedId));
      if (activeVideo?.id === video.id) setActiveVideo(null);
      setNotice("Video removed from your library.");
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Could not remove this video.");
    }
  };

  useEffect(() => { if (activeVideo) window.dispatchEvent(new Event("clerkme:video-playing")); }, [activeVideo?.id]);
  useEffect(() => {
    const stopLecture = () => setActiveVideo(null);
    window.addEventListener("clerkme:focus-music-playing", stopLecture);
    return () => window.removeEventListener("clerkme:focus-music-playing", stopLecture);
  }, []);

  const player = activeVideo && (
    <section className="video-library-player" aria-label="Video player" ref={playerRef} tabIndex={-1}>
      <div className="video-library-player-heading">
        <div><span className="eyebrow">NOW PLAYING IN CLERKME</span><strong>{activeVideo.title}</strong><small>{activeVideo.channelTitle}</small></div>
        <div className="video-library-player-actions" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <a className="video-library-youtube-link" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minHeight:36,padding:"7px 12px",border:"1px solid #d8e2da",borderRadius:8,background:"#fff",color:"#102D5A",fontSize:12,fontWeight:700,textDecoration:"none"}} href={"https://www.youtube.com/watch?v=" + activeVideo.id} target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
          <button type="button" className="video-library-close" onClick={() => setActiveVideo(null)}>Close player ×</button>
        </div>
      </div>
      <div className="video-library-player-frame">
        <iframe src={"https://www.youtube-nocookie.com/embed/" + activeVideo.id + "?rel=0&playsinline=1"} title={activeVideo.title + " — YouTube video player"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy" />
      </div>
      <p className="video-library-player-note">Playback stays in ClerkMe using YouTube’s embedded player. ClerkMe can save the lecture to your personal library, but cannot download YouTube-hosted video files. For offline viewing, open the video on YouTube and use its own download feature where it is available for your account and region.</p>
    </section>
  );

  return (
    <div className="video-library-page">
      <div className="page-intro">
        <div className="eyebrow">LECTURES WITHOUT LEAVING YOUR WORKSPACE</div>
        <h1>Video library</h1>
        <p>Search for medical lectures at any time, play them in ClerkMe, and keep useful videos organised in your personal collections.</p>
      </div>

      <div className="video-library-tabs" role="tablist" aria-label="Video library sections">
        <button type="button" role="tab" aria-selected={activeTab === "discover"} className={activeTab === "discover" ? "active" : ""} onClick={() => setActiveTab("discover")}>Discover videos</button>
        <button type="button" role="tab" aria-selected={activeTab === "saved"} className={activeTab === "saved" ? "active" : ""} onClick={() => { setActiveTab("saved"); void loadSavedVideos(); }}>My saved videos <span>{savedVideos.length}</span></button>
      </div>

      {activeTab === "discover" && (
        <>
          <section className="video-library-search panel">
            <div className="video-library-section-heading"><div><span className="eyebrow">SEARCH YOUTUBE</span><h2>What are you studying today?</h2><p>Search by disease, clinical topic, procedure, examination or lecture title. You do not need to upload a document first.</p></div><span className="video-library-mark">▶</span></div>
            <form onSubmit={searchVideos}>
              <label htmlFor="video-library-query">Search topic or lecture</label>
              <div className="video-library-query-row">
                <input id="video-library-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. childhood tumours, nephrotic syndrome, ECG interpretation" maxLength={120} />
                <button type="submit" className="primary-button" disabled={loading || query.trim().length < 2}>{loading ? "Searching…" : "Search lectures →"}</button>
              </div>
              <div className="video-library-filters">
                <label>Clinical unit
                  <select value={unit} onChange={event => setUnit(event.target.value)}>
                    <option value="all">All subjects</option>
                    {clinicalUnits.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <label>Sort results
                  <select value={sort} onChange={event => setSort(event.target.value)}>
                    <option value="relevance">Most relevant</option>
                    <option value="viewCount">Most viewed</option>
                    <option value="date">Recently published</option>
                  </select>
                </label>
                <label>Save new videos in
                  <select value={folderChoice} onChange={event => setFolderChoice(event.target.value)}>
                    <option>General Medicine</option>
                    {clinicalUnits.filter(item => item.name !== "General Medicine").map(item => <option key={item.id}>{item.name}</option>)}
                    <option>Exam Revision</option>
                    <option>Watch Later</option>
                  </select>
                </label>
              </div>
              <label htmlFor="video-library-custom-folder" className="video-library-custom-label">Or create a collection for this search</label>
              <input id="video-library-custom-folder" className="video-library-custom-folder" value={customFolder} onChange={event => setCustomFolder(event.target.value)} maxLength={60} placeholder="e.g. Paediatric oncology, Cardiology finals" />
            </form>
            <p className="video-library-quality-note">Results are drawn from YouTube and filtered for embedding. Compare the lecturer, length and view count, and use trusted clinical sources for exam preparation.</p>
          </section>

          {notice && <p className="video-library-notice" role="status">{notice}</p>}
          {savedError && <p className="video-library-error" role="alert">{savedError}</p>}
          {searchError && <p className="video-library-error" role="alert">{searchError}</p>}
          {player}

          {loading && <div className="video-library-empty"><span className="video-library-spinner" />Searching for relevant, playable lectures…</div>}
          {!loading && videos.length > 0 && (
            <section className="video-library-results">
              <div className="video-library-results-heading"><div><span className="eyebrow">SEARCH RESULTS</span><h2>Lectures matching “{query.trim()}”</h2></div><span>{videos.length} videos</span></div>
              <div className="video-library-grid">
                {videos.map(video => (
                  <article className="video-library-card" key={video.id}>
                    <button type="button" className="video-library-thumb" onClick={() => setActiveVideo(video)} aria-label={"Play " + video.title}>
                      <img src={video.thumbnailUrl} alt="" loading="lazy" /><span>▶ Play</span>
                    </button>
                    <div className="video-library-card-body">
                      <h3>{video.title}</h3>
                      <p className="video-library-channel">{video.channelTitle}</p>
                      <p className="video-library-meta">{[video.duration, compactNumber(video.viewCount) ? compactNumber(video.viewCount) + " views" : "", compactNumber(video.likeCount) ? compactNumber(video.likeCount) + " likes" : ""].filter(Boolean).join(" · ") || "YouTube lecture"}</p>
                      {video.description && <p className="video-library-description">{video.description}</p>}
                      <div className="video-library-card-actions">
                        <button type="button" className="video-library-play-button" onClick={() => setActiveVideo(video)}>Play in ClerkMe</button>
                        <button type="button" className="video-library-save-button" disabled={savingId === video.id || savedIds.has(video.id)} onClick={() => void saveVideo(video)}>{savingId === video.id ? "Saving…" : savedIds.has(video.id) ? "✓ Saved" : "＋ Save"}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
          {!loading && !searched && (
            <section className="video-library-empty-start">
              <div className="video-library-empty-icon">▶</div><h2>Your next lecture is one search away.</h2><p>Try “neonatal jaundice”, “heart failure”, “uterine rupture” or “upper limb anatomy”.</p>
            </section>
          )}
        </>
      )}

      {activeTab === "saved" && (
        <section className="video-library-saved">
          <div className="video-library-section-heading"><div><span className="eyebrow">YOUR PERSONAL COLLECTIONS</span><h2>Saved lectures</h2><p>Keep revision videos together by clinical unit, exam or any collection name you choose.</p></div><span className="video-library-saved-count">{savedVideos.length} saved</span></div>
          <div className="video-library-saved-toolbar">
            <input aria-label="Search saved videos" value={savedSearch} onChange={event => setSavedSearch(event.target.value)} placeholder="Search your saved videos…" />
            <select aria-label="Filter by collection" value={savedFilter} onChange={event => setSavedFilter(event.target.value)}>
              <option value="all">All collections</option>
              {folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}
            </select>
            <button type="button" className="secondary-button" onClick={() => void loadSavedVideos()} disabled={savedLoading}>{savedLoading ? "Refreshing…" : "Refresh"}</button>
          </div>
          {savedLoading && <div className="video-library-empty">Loading your saved videos…</div>}
          {savedError && <p className="video-library-error" role="alert">{savedError}</p>}
          {!savedLoading && !savedVideos.length && <div className="video-library-empty"><h3>Your video library is ready.</h3><p>Search for a lecture, save it and choose the collection where it belongs.</p><button type="button" className="primary-button" onClick={() => setActiveTab("discover")}>Find your first lecture →</button></div>}
          {!savedLoading && savedVideos.length > 0 && !visibleSaved.length && <div className="video-library-empty">No saved videos match this search or collection.</div>}
          {!savedLoading && Object.entries(groupedSaved).map(([folder, items]) => (
            <section className="video-library-folder" key={folder}>
              <div className="video-library-folder-heading"><span>▣</span><h3>{folder}</h3><small>{items.length} {items.length === 1 ? "video" : "videos"}</small></div>
              <div className="video-library-grid">
                {items.map(video => (
                  <article className="video-library-card" key={video.savedId}>
                    <button type="button" className="video-library-thumb" onClick={() => setActiveVideo(video)} aria-label={"Play " + video.title}>
                      <img src={video.thumbnailUrl} alt="" loading="lazy" /><span>▶ Play</span>
                    </button>
                    <div className="video-library-card-body">
                      <h3>{video.title}</h3>
                      <p className="video-library-channel">{video.channelTitle}</p>
                      <p className="video-library-meta">{[video.duration, compactNumber(video.viewCount) ? compactNumber(video.viewCount) + " views" : "", formatSavedDate(video.createdAt)].filter(Boolean).join(" · ")}</p>
                      <div className="video-library-card-actions">
                        <button type="button" className="video-library-play-button" onClick={() => setActiveVideo(video)}>Play in ClerkMe</button>
                        <button type="button" className="video-library-remove-button" onClick={() => void removeVideo(video)}>Remove</button>
                      </div>
                      <label className="video-library-move-label">Move to collection
                        <select value={video.folder} disabled={movingId === video.savedId} onChange={event => void moveVideo(video, event.target.value)}>
                          {folders.map(folderName => <option key={folderName} value={folderName}>{folderName}</option>)}
                          <option value="Watch Later">Watch Later</option>
                          <option value="Exam Revision">Exam Revision</option>
                        </select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {notice && <p className="video-library-notice" role="status">{notice}</p>}
          {player}
        </section>
      )}
    </div>
  );
}
