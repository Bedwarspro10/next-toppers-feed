import { useEffect, useState, useRef, Component, useCallback } from "react";
import type { ReactNode } from "react";
import { useRoute, useLocation, Link } from "wouter";
import GuestSignInModal from "@/components/GuestSignInModal";
import {
  collection, query, where, getDocs, onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { Layout } from "@/components/layout/Layout";
import { ContentRating, RatingPopup } from "@/components/ContentRating";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  FileText, Video, FolderOpen, ExternalLink, Play, X,
  BookOpen, Sigma, FlaskConical, Globe, Languages, Monitor, Brain,
  ChevronRight, ChevronLeft, Download, Eye, AlertTriangle, Lock, Crown,
  Bookmark, BookmarkCheck, Minimize2, SkipBack, SkipForward, CheckCircle2
} from "lucide-react";
import Hls from "hls.js";
import { getCourseDataForSubject, type CourseFolder, type CourseResource } from "@/lib/courseEngine";

/* ─── bookmark helpers (localStorage) ───────────────────────── */
interface BMItem {
  id: string; type: "lecture" | "file";
  title: string; subject: string;
  hlsUrl?: string; link?: string;
  thumbnail?: string; savedAt: number;
}
function getBookmarks(): BMItem[] {
  try { return JSON.parse(localStorage.getItem("nt_bookmarks") ?? "[]"); } catch { return []; }
}
function saveBookmarks(items: BMItem[]) {
  try { localStorage.setItem("nt_bookmarks", JSON.stringify(items)); } catch {}
}
function isBookmarked(id: string): boolean {
  return getBookmarks().some((b) => b.id === id);
}
function toggleBookmark(item: BMItem): boolean {
  const list = getBookmarks();
  const idx = list.findIndex((b) => b.id === item.id);
  if (idx >= 0) { list.splice(idx, 1); saveBookmarks(list); return false; }
  list.unshift({ ...item, savedAt: Date.now() });
  saveBookmarks(list.slice(0, 100));
  return true;
}

/* ─── continue watching helpers ──────────────────────────────── */
interface CWItem { lectureId: string; title: string; hlsUrl: string; subject: string; progress: number; lastWatched: number; }
function saveCW(item: CWItem) {
  try {
    const key = "nt_cw_list";
    const list: CWItem[] = JSON.parse(localStorage.getItem(key) ?? "[]");
    const filtered = list.filter((x) => x.lectureId !== item.lectureId);
    filtered.unshift(item);
    localStorage.setItem(key, JSON.stringify(filtered.slice(0, 15)));
  } catch {}
}

/* ─── types ─────────────────────────────────────────────── */
interface Folder {
  id: string; name: string; subject: string;
  order: number; parentFolderId?: string;
}
interface FileDoc {
  id: string; name: string; link: string; folderId?: string;
  subject: string; type?: string; thumbnail?: string; category?: string; order: number;
  isPremium?: boolean;
}
interface LectureDoc {
  id: string; title: string; hlsUrl?: string; folderId?: string;
  subject: string; thumbnail?: string; category?: string; order: number;
  isPremium?: boolean;
}
type Resource = ({ kind: "file" } & FileDoc) | ({ kind: "lecture" } & LectureDoc);

/* ─── subject config ─────────────────────────────────────── */
const SUBJECT_META: Record<string, { label: string; icon: React.ElementType; gradient: string; bg: string; text: string; border: string }> = {
  maths:   { label: "Mathematics",                icon: Sigma,        gradient: "from-blue-500 to-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/40",    text: "text-blue-600",   border: "border-blue-100 dark:border-blue-900/60" },
  science: { label: "Science",                    icon: FlaskConical, gradient: "from-emerald-500 to-teal-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600", border: "border-emerald-100 dark:border-emerald-900/60" },
  sst:     { label: "Social Studies",             icon: Globe,        gradient: "from-violet-500 to-purple-600",bg: "bg-violet-50 dark:bg-violet-950/40",  text: "text-violet-600", border: "border-violet-100 dark:border-violet-900/60" },
  english: { label: "English",                    icon: BookOpen,     gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-950/40",   text: "text-amber-600",  border: "border-amber-100 dark:border-amber-900/60" },
  hindi:   { label: "Hindi",                      icon: Languages,    gradient: "from-rose-500 to-pink-600",    bg: "bg-rose-50 dark:bg-rose-950/40",     text: "text-rose-600",   border: "border-rose-100 dark:border-rose-900/60" },
  it:      { label: "Information & Technology",   icon: Monitor,      gradient: "from-cyan-500 to-sky-600",     bg: "bg-cyan-50 dark:bg-cyan-950/40",     text: "text-cyan-600",   border: "border-cyan-100 dark:border-cyan-900/60" },
  ai:      { label: "Artificial Intelligence",    icon: Brain,        gradient: "from-indigo-500 to-violet-600",bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-600", border: "border-indigo-100 dark:border-indigo-900/60" },
};

/* ─── file type detection ─────────────────────────────────── */
type FileType = "pdf" | "image" | "video" | "hls" | "external";

function detectFileType(url: string, category?: string): FileType {
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".m3u8")) return "hls";
  if (u.endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|gif|webp|svg|avif)$/.test(u)) return "image";
  if (/\.(mp4|webm|ogg|mov)$/.test(u)) return "video";
  const cat = (category ?? "").toLowerCase();
  if (["pdf", "notes", "dpp", "assignment", "module", "test"].includes(cat)) return "pdf";
  return "external";
}

/* ─── HLS player (upgraded) ───────────────────────────────── */
interface HlsLevel { index: number; height: number; bitrate: number; }

/* ─── video download system ──────────────────────────────── */
type DlPhase = "idle" | "quality" | "warn" | "downloading" | "done" | "error";

interface DlState { phase: DlPhase; progress: number; statusText: string; cancelled: boolean; }

interface QualityVariant {
  label: string;       // e.g. "720p", "480p", "360p", "240p"
  bandwidth: number;
  url: string;         // absolute URL to variant playlist
}

async function parseMasterPlaylist(masterUrl: string): Promise<QualityVariant[]> {
  const base = masterUrl.substring(0, masterUrl.lastIndexOf("/") + 1);
  const res = await fetch(masterUrl);
  if (!res.ok) throw new Error("Failed to fetch master playlist");
  const text = await res.text();
  const lines = text.split("\n").map(l => l.trim());

  const variants: QualityVariant[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("#EXT-X-STREAM-INF")) continue;
    const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
    const resolutionMatch = line.match(/RESOLUTION=\d+x(\d+)/);
    const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;
    const height = resolutionMatch ? parseInt(resolutionMatch[1]) : 0;
    const uri = lines[i + 1];
    if (!uri || uri.startsWith("#")) continue;
    const url = uri.startsWith("http") ? uri : base + uri;
    const label = height ? `${height}p` : `${Math.round(bandwidth / 1000)}kbps`;
    variants.push({ label, bandwidth, url });
  }
  // Sort descending by bandwidth (best first)
  return variants.sort((a, b) => b.bandwidth - a.bandwidth);
}

async function downloadHlsStream(
  playlistUrl: string,
  title: string,
  setState: (s: Partial<DlState>) => void,
  cancelRef: { current: boolean },
) {
  try {
    setState({ phase: "downloading", progress: 0, statusText: "Fetching playlist…" });
    const base = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);
    const res = await fetch(playlistUrl);
    if (!res.ok) throw new Error("Failed to fetch playlist");
    const text = await res.text();
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // If this is still a master playlist, pick the selected (first) variant
    let segmentLines = lines;
    const streamLines = lines.filter(l => !l.startsWith("#") && l.includes(".m3u8"));
    if (streamLines.length > 0) {
      const variantUrl = streamLines[0].startsWith("http")
        ? streamLines[0]
        : base + streamLines[0];
      const vRes = await fetch(variantUrl);
      const vText = await vRes.text();
      segmentLines = vText.split("\n").map(l => l.trim()).filter(Boolean);
    }

    const segments = segmentLines.filter(l =>
      !l.startsWith("#") && (l.endsWith(".ts") || l.endsWith(".aac") || l.endsWith(".fmp4") || l.endsWith(".m4s") || !l.includes("."))
    );
    if (segments.length === 0) throw new Error("No segments found in playlist");

    setState({ statusText: `Downloading 0 / ${segments.length} chunks…`, progress: 2 });

    const buffers: Uint8Array[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (cancelRef.current) return;
      const segUrl = segments[i].startsWith("http") ? segments[i] : base + segments[i];
      const segRes = await fetch(segUrl);
      if (!segRes.ok) throw new Error(`Failed to fetch segment ${i + 1}`);
      const buf = new Uint8Array(await segRes.arrayBuffer());
      buffers.push(buf);
      const pct = Math.round(((i + 1) / segments.length) * 85) + 5;
      setState({ progress: pct, statusText: `Downloading ${i + 1} / ${segments.length} chunks…` });
    }
    if (cancelRef.current) return;

    setState({ progress: 92, statusText: "Merging video…" });
    const totalLen = buffers.reduce((s, b) => s + b.byteLength, 0);
    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const b of buffers) { merged.set(b, off); off += b.byteLength; }

    setState({ progress: 98, statusText: "Preparing download…" });
    // Use video/mp4 MIME type and .mp4 extension — compatible with VLC, MX Player, Android
    const blob = new Blob([merged], { type: "video/mp4" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "lecture"}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    setState({ phase: "done", progress: 100, statusText: "Download started!" });
  } catch (err) {
    if (!cancelRef.current) {
      setState({ phase: "error", statusText: (err instanceof Error ? err.message : "Download failed. Try again.") });
    }
  }
}

function VideoDownloadModal({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const [state, setState_] = useState<DlState>({ phase: "quality", progress: 0, statusText: "", cancelled: false });
  const [variants, setVariants] = useState<QualityVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<QualityVariant | null>(null);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const cancelRef = useRef(false);
  const setState = (s: Partial<DlState>) => setState_(prev => ({ ...prev, ...s }));

  // Parse master playlist on mount
  useEffect(() => {
    let cancelled = false;
    const isMaster = async () => {
      try {
        const base = url.substring(0, url.lastIndexOf("/") + 1);
        const res = await fetch(url);
        const text = await res.text();
        const lines = text.split("\n").map(l => l.trim());
        const hasMaster = lines.some(l => l.startsWith("#EXT-X-STREAM-INF"));
        if (hasMaster && !cancelled) {
          const parsed = await parseMasterPlaylist(url);
          if (!cancelled) {
            setVariants(parsed);
            setSelectedVariant(parsed[0] ?? null);
          }
        } else if (!cancelled) {
          // Already a media playlist — direct download, no quality selection
          const fallback: QualityVariant = { label: "Original", bandwidth: 0, url };
          setVariants([fallback]);
          setSelectedVariant(fallback);
        }
      } catch {
        if (!cancelled) {
          const fallback: QualityVariant = { label: "Original", bandwidth: 0, url };
          setVariants([fallback]);
          setSelectedVariant(fallback);
        }
      } finally {
        if (!cancelled) setLoadingVariants(false);
      }
    };
    isMaster();
    return () => { cancelled = true; };
  }, [url]);

  const start = () => {
    cancelRef.current = false;
    setState({ cancelled: false, phase: "downloading" });
    const dlUrl = selectedVariant?.url ?? url;
    downloadHlsStream(dlUrl, title, setState, cancelRef);
  };

  const cancel = () => {
    cancelRef.current = true;
    setState({ phase: "idle", cancelled: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget && state.phase !== "downloading") onClose(); }}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6">

        {/* Quality selector step */}
        {state.phase === "quality" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <Download size={18} className="text-violet-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Choose Quality</p>
                <p className="text-xs text-muted-foreground">Select video quality before downloading</p>
              </div>
            </div>
            {loadingVariants ? (
              <div className="space-y-2 mb-5">
                {[1,2,3].map(i => <div key={i} className="h-11 bg-secondary rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2 mb-5">
                {variants.map((v) => (
                  <button key={v.url} onClick={() => setSelectedVariant(v)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      selectedVariant?.url === v.url
                        ? "border-violet-500 bg-violet-500/10 text-violet-500"
                        : "border-border text-foreground hover:border-violet-300"
                    }`}>
                    <span>{v.label}</span>
                    {v.bandwidth > 0 && <span className="text-xs text-muted-foreground font-normal">{Math.round(v.bandwidth / 1000)} kbps</span>}
                    {selectedVariant?.url === v.url && <span className="text-[10px] font-bold text-violet-500">✓ Selected</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button onClick={() => setState({ phase: "warn" })} disabled={!selectedVariant || loadingVariants}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1)" }}>
                Continue
              </button>
            </div>
          </>
        )}

        {/* Warning step */}
        {state.phase === "warn" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Download size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-foreground">Download Lecture</p>
                <p className="text-xs text-muted-foreground">
                  {selectedVariant?.label && selectedVariant.label !== "Original" ? `Quality: ${selectedVariant.label}` : "Read before continuing"}
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-5">
              {[
                "Downloads video directly in your browser — no server storage used.",
                "Keep this tab open. Do not lock your screen during download.",
                "Battery usage will increase. Large lectures may use 100MB–500MB.",
                "Download on WiFi if possible. Slower devices may struggle.",
                "File saves as MP4 — playable in VLC, MX Player, or any video app.",
              ].map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                  <p className="text-xs leading-relaxed text-muted-foreground">{w}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setState({ phase: "quality" })}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                ← Back
              </button>
              <button onClick={start}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: "linear-gradient(135deg,#f59e0b,#f97316)" }}>
                Download MP4
              </button>
            </div>
          </>
        )}

        {state.phase === "downloading" && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Download size={18} className="text-blue-500 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm">Downloading…</p>
                <p className="text-xs text-muted-foreground truncate">{state.statusText}</p>
              </div>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                style={{ width: `${state.progress}%` }} />
            </div>
            <p className="text-xs text-center text-muted-foreground mb-4">{state.progress}% — Do not close this tab</p>
            <button onClick={cancel}
              className="w-full py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors">
              Cancel Download
            </button>
          </>
        )}

        {state.phase === "done" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3">
              <CheckCircle2 size={22} className="text-emerald-500" />
            </div>
            <p className="font-bold text-foreground mb-1">Download Complete!</p>
            <p className="text-xs text-muted-foreground mb-5">Your lecture has been saved as MP4. Open it with VLC, MX Player, or any video app.</p>
            <button onClick={onClose} className="px-8 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
              Done
            </button>
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center mb-3">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <p className="font-bold text-foreground mb-1">Download Failed</p>
            <p className="text-xs text-muted-foreground mb-5">{state.statusText}</p>
            <div className="flex gap-2 w-full">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground">Close</button>
              <button onClick={start} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>Retry</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoPlayer({ url, title, lectureId, subject, isPremium }: { url: string; title: string; lectureId?: string; subject?: string; isPremium?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [speed, setSpeed] = useState(1);
  const [levels, setLevels] = useState<HlsLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [isPiP, setIsPiP] = useState(false);
  const [showDlModal, setShowDlModal] = useState(false);
  const lastSave = useRef<number>(0);
  const tsKey = `nt_vp_${url.replace(/[^a-zA-Z0-9]/g, "").slice(-50)}`;

  const saveProg = useCallback(() => {
    const v = ref.current;
    if (!v || v.duration < 5) return;
    try { localStorage.setItem(tsKey, JSON.stringify({ ts: v.currentTime, dur: v.duration })); } catch {}
    if (lectureId) {
      saveCW({ lectureId, title, hlsUrl: url, subject: subject ?? "", progress: v.currentTime / v.duration, lastWatched: Date.now() });
    }
  }, [tsKey, title, url, lectureId, subject]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const isHls = url.includes(".m3u8") || url.includes("m3u8");
    const restoreTs = () => {
      try {
        const saved = localStorage.getItem(tsKey);
        if (saved) {
          const { ts, dur } = JSON.parse(saved);
          if (dur && Math.abs(dur - video.duration) < 60 && ts > 5 && ts < dur - 5) {
            video.currentTime = ts;
          }
        }
      } catch {}
      video.play().catch(() => {});
    };
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 30, enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels.map((l, i) => ({ index: i, height: l.height, bitrate: l.bitrate })));
        setCurrentLevel(-1);
        restoreTs();
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.addEventListener("loadedmetadata", restoreTs);
      return () => video.removeEventListener("loadedmetadata", restoreTs);
    } else {
      video.src = url;
      video.addEventListener("loadedmetadata", restoreTs);
      return () => video.removeEventListener("loadedmetadata", restoreTs);
    }
  }, [url, tsKey]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const onTime = () => {
      const now = Date.now();
      if (now - lastSave.current > 5000) { lastSave.current = now; saveProg(); }
    };
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("pause", saveProg);
    video.addEventListener("ended", saveProg);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("pause", saveProg);
      video.removeEventListener("ended", saveProg);
      saveProg();
    };
  }, [saveProg]);

  useEffect(() => { if (ref.current) ref.current.playbackRate = speed; }, [speed]);

  useEffect(() => {
    const onPiP = () => setIsPiP(!!document.pictureInPictureElement);
    document.addEventListener("leavepictureinpicture", onPiP);
    document.addEventListener("enterpictureinpicture", onPiP);
    return () => {
      document.removeEventListener("leavepictureinpicture", onPiP);
      document.removeEventListener("enterpictureinpicture", onPiP);
    };
  }, []);

  const changeLevel = (idx: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = idx;
    setCurrentLevel(idx);
  };

  const skip = (secs: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + secs));
  };

  const togglePiP = async () => {
    const v = ref.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {}
  };

  const qualityLabel = (l: HlsLevel) => l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)}k`;

  return (
    <div>
      <video ref={ref} controls className="w-full rounded-xl bg-black aspect-video" title={title} />
      <div className="flex flex-wrap items-center gap-2 mt-3">
        {/* Skip controls */}
        <div className="flex items-center gap-1">
          <button onClick={() => skip(-10)}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
            <SkipBack size={9} /> 10s
          </button>
          <button onClick={() => skip(10)}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all">
            10s <SkipForward size={9} />
          </button>
        </div>
        {/* Speed */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Speed</span>
          <div className="flex gap-1 flex-wrap">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
              <button key={s} onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                  speed === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}>
                {s}×
              </button>
            ))}
          </div>
        </div>
        {/* Quality */}
        {levels.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quality</span>
            <div className="flex gap-1 flex-wrap">
              <button onClick={() => changeLevel(-1)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${currentLevel === -1 ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                Auto
              </button>
              {[...levels].reverse().map((l) => (
                <button key={l.index} onClick={() => changeLevel(l.index)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${currentLevel === l.index ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
                  {qualityLabel(l)}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* PiP */}
        {"pictureInPictureEnabled" in document && (
          <button onClick={togglePiP}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${isPiP ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"}`}>
            <Minimize2 size={9} /> PiP
          </button>
        )}
        {/* Download — premium only */}
        {isPremium && url.includes("m3u8") && (
          <button onClick={() => setShowDlModal(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all border-amber-500/40 text-amber-600 hover:bg-amber-500/10">
            <Download size={9} /> Download
          </button>
        )}
      </div>
      {showDlModal && <VideoDownloadModal title={title} url={url} onClose={() => setShowDlModal(false)} />}
    </div>
  );
}

/* ─── file preview modal ─────────────────────────────────── */
function FilePreviewModal({ url, title, category, onClose }: {
  url: string; title: string; category?: string; onClose: () => void;
}) {
  const type = detectFileType(url, category);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{title}</p>
            {category && <p className="text-xs text-muted-foreground">{category}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={url} target="_blank" rel="noopener noreferrer" download
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors">
              <Download size={12} /> Download
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-primary/5">
              <ExternalLink size={12} /> Open Original
            </a>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {type === "pdf" && (
            <iframe src={`${url}#view=FitH`} title={title}
              className="w-full h-full min-h-[60vh] rounded-xl border border-border" />
          )}
          {type === "image" && (
            <div className="flex items-center justify-center h-full min-h-[40vh]">
              <img src={url} alt={title} className="max-w-full max-h-[70vh] object-contain rounded-xl" />
            </div>
          )}
          {type === "video" && (
            <video src={url} controls className="w-full rounded-xl bg-black aspect-video" title={title} />
          )}
          {type === "hls" && <VideoPlayer url={url} title={title} />}
          {type === "external" && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <ExternalLink size={24} className="text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-2">{title}</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                This file opens in an external tab.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button className="gap-2"><ExternalLink size={14} /> Open File</Button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── error boundary ─────────────────────────────────────── */
class SubjectErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError)
      return (
        <div className="py-12 text-center">
          <AlertTriangle size={28} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Something went wrong loading this section.</p>
        </div>
      );
    return this.props.children;
  }
}

/* ─── premium lock overlay ────────────────────────────────── */
function PremiumLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <button
      onClick={onUpgrade}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
    >
      <Crown size={11} className="text-amber-500" />
      Premium
    </button>
  );
}

/* ─── bookmark button ─────────────────────────────────────── */
function BMButton({ id, bmItem }: { id: string; bmItem: Omit<BMItem, "savedAt"> }) {
  const [saved, setSaved] = useState(() => isBookmarked(id));
  return (
    <button
      onClick={(e) => { e.stopPropagation(); const next = toggleBookmark({ ...bmItem, savedAt: Date.now() }); setSaved(next); }}
      className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all border ${saved ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
      title={saved ? "Remove bookmark" : "Bookmark"}
    >
      {saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
    </button>
  );
}

/* ─── resource row ────────────────────────────────────────── */
function ResourceRow({ r, onPlay, onPreview, isLoggedIn, isPremiumUser, onUpgrade, onGuestSignIn, subject }: {
  r: Resource;
  onPlay: (l: LectureDoc) => void;
  onPreview: (url: string, title: string, id: string, contentType: "file" | "lecture", category?: string) => void;
  isLoggedIn: boolean;
  isPremiumUser: boolean;
  onUpgrade: () => void;
  onGuestSignIn: (action: string) => void;
  subject?: string;
}) {
  const locked = (r as any).isPremium && !isPremiumUser;

  if (r.kind === "file") {
    return (
      <div className={`bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm card-hover ${locked ? "opacity-80" : ""}`}>
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
          {r.thumbnail
            ? <img src={r.thumbnail} alt="" className="w-full h-full object-cover" />
            : <FileText size={16} className="text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{r.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {r.category && <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>}
            {(r as any).isPremium && <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/20 border">Premium</Badge>}
            <ContentRating contentId={r.id} contentType="file" compact />
          </div>
        </div>
        <BMButton id={`file_${r.id}`} bmItem={{ id: `file_${r.id}`, type: "file", title: r.name, subject: subject ?? "", link: r.link, thumbnail: r.thumbnail }} />
        {locked ? (
          <PremiumLock onUpgrade={onUpgrade} />
        ) : isLoggedIn ? (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs flex-shrink-0"
            onClick={() => r.link && onPreview(r.link, r.name, r.id, r.kind, r.category)} disabled={!r.link}>
            <Eye size={11} /> Preview
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs flex-shrink-0 text-muted-foreground border-dashed"
            onClick={() => onGuestSignIn("view this file")}>
            <Lock size={11} /> Sign in
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm card-hover ${locked ? "opacity-80" : ""}`}>
      <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {r.thumbnail
          ? <img src={r.thumbnail} alt="" className="w-full h-full object-cover" />
          : <Video size={16} className="text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{r.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {r.category && <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>}
          {(r as any).isPremium && <Badge className="text-[9px] bg-amber-500/15 text-amber-600 border-amber-500/20 border">Premium</Badge>}
          <ContentRating contentId={r.id} contentType="lecture" compact />
        </div>
      </div>
      <BMButton id={`lect_${r.id}`} bmItem={{ id: `lect_${r.id}`, type: "lecture", title: r.title, subject: subject ?? "", hlsUrl: r.hlsUrl, thumbnail: r.thumbnail }} />
      {locked ? (
        <PremiumLock onUpgrade={onUpgrade} />
      ) : isLoggedIn ? (
        <Button size="sm" className="gap-1.5 h-8 text-xs flex-shrink-0" onClick={() => onPlay(r)}>
          <Play size={11} /> Play
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs flex-shrink-0 text-muted-foreground border-dashed"
          onClick={() => onGuestSignIn("play this lecture")}>
          <Lock size={11} /> Sign in
        </Button>
      )}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-14 text-center">
      <div className="w-12 h-12 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
        <FolderOpen size={20} className="text-muted-foreground/40" />
      </div>
      <p className="font-semibold text-foreground/70 mb-1">No {label} yet</p>
      <p className="text-sm text-muted-foreground">Your teacher will add content here soon.</p>
    </div>
  );
}

/* ─── automatic Firestore course-scanner content (new system) ───────────── */
function courseFolderToFolder(f: CourseFolder): Folder {
  return { id: f.id, name: f.name, subject: f.subject, order: f.order, parentFolderId: "" };
}
function courseResourceToResource(r: CourseResource): Resource {
  return r.kind === "file"
    ? { kind: "file", id: r.id, name: r.name, link: r.link, folderId: r.folderId, subject: r.subject, category: r.category, order: r.order, isPremium: r.isPremium }
    : { kind: "lecture", id: r.id, title: r.title, hlsUrl: r.hlsUrl, folderId: r.folderId, subject: r.subject, category: r.category, order: r.order, isPremium: r.isPremium };
}

/* ─── helpers to load data ────────────────────────────────── */
async function loadPremiumLectures(subject: string): Promise<LectureDoc[]> {
  const snap = await getDocs(
    query(collection(db, "lectures"), where("subject", "==", subject), where("isPremium", "==", true))
  ).catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LectureDoc)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

async function loadFolders(subject: string, parentId: string | null): Promise<Folder[]> {
  const snap = await getDocs(
    query(collection(db, "lecture_folders"), where("subject", "==", subject))
  ).catch(() => null);
  const manual = snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() } as Folder)) : [];

  if (parentId !== null) {
    // Course-scanner chapters are flattened one level deep (see courseEngine.ts) —
    // they never have sub-folders, so only manually-created sub-folders apply here.
    return manual.filter((f) => f.parentFolderId === parentId)
                 .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }

  const manualRoots = manual.filter((f) => !f.parentFolderId || f.parentFolderId === "");
  const courseData = await getCourseDataForSubject(subject).catch(() => null);
  const courseRoots = (courseData?.folders ?? []).map(courseFolderToFolder);

  // De-dupe by normalized name so a manually-created "Chapter 1" and an
  // auto-recognized "Chapter 1" don't render as two separate cards.
  const seen = new Set(manualRoots.map((f) => f.name.trim().toLowerCase()));
  const merged = [...manualRoots, ...courseRoots.filter((f) => !seen.has(f.name.trim().toLowerCase()))];
  return merged.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

async function loadGeneralResources(subject: string): Promise<Resource[]> {
  const [fSnap, lSnap] = await Promise.all([
    getDocs(query(collection(db, "files"),    where("subject", "==", subject))).catch(() => null),
    getDocs(query(collection(db, "lectures"), where("subject", "==", subject))).catch(() => null),
  ]);
  const files = (fSnap?.docs ?? []).map((d) => ({ kind: "file"    as const, id: d.id, ...d.data() } as Resource));
  const lects = (lSnap?.docs ?? []).map((d) => ({ kind: "lecture" as const, id: d.id, ...d.data() } as Resource));
  // Exclude premium lectures — they belong ONLY in the dedicated Premium Lectures section
  const manual = [...files, ...lects].filter((r) =>
    (!(r as any).folderId || (r as any).folderId === "") && !(r as any).isPremium
  );

  const courseData = await getCourseDataForSubject(subject).catch(() => null);
  const courseGeneral = (courseData?.generalResources ?? [])
    .filter((r) => !r.isPremium)
    .map(courseResourceToResource);

  const all = [...manual, ...courseGeneral];
  all.sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999));
  return all;
}

async function loadFolderResources(subject: string, folderId: string): Promise<Resource[]> {
  // Course-scanner chapter folders are synthetic (see courseEngine.ts) — skip the
  // manual-collection query for those and read straight from the course engine.
  if (folderId.startsWith("course_")) {
    const courseData = await getCourseDataForSubject(subject).catch(() => null);
    const list = (courseData?.resourcesByFolder[folderId] ?? []).map(courseResourceToResource);
    return list.sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999));
  }

  const [fSnap, lSnap] = await Promise.all([
    getDocs(query(collection(db, "files"), where("subject", "==", subject), where("folderId", "==", folderId))).catch(() => null),
    getDocs(query(collection(db, "lectures"), where("subject", "==", subject), where("folderId", "==", folderId))).catch(() => null),
  ]);
  const files  = (fSnap?.docs ?? []).map((d) => ({ kind: "file"    as const, id: d.id, ...d.data() } as Resource));
  // Exclude premium lectures from folder view — they belong ONLY in the dedicated Premium Lectures section
  const lects  = (lSnap?.docs ?? []).map((d) => ({ kind: "lecture" as const, id: d.id, ...d.data() } as Resource))
    .filter((r) => !(r as any).isPremium);
  const all    = [...files, ...lects];
  all.sort((a, b) => ((a as any).order ?? 999) - ((b as any).order ?? 999));
  return all;
}

/* ─── main page ──────────────────────────────────────────── */
export default function SubjectDetail() {
  const [, params] = useRoute("/subjects/:subject");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { setOpen: openPremiumModal } = usePremiumModal();
  const isLoggedIn = !!user;
  const subject = params?.subject ?? "";
  const meta = SUBJECT_META[subject] ?? {
    label: subject, icon: BookOpen,
    gradient: "from-slate-500 to-slate-600", bg: "bg-muted",
    text: "text-foreground", border: "border-border",
  };
  const Icon = meta.icon;

  const [folderStack,    setFolderStack]    = useState<Folder[]>([]);
  const [rootFolders,    setRootFolders]    = useState<Folder[]>([]);
  const [subFolders,     setSubFolders]     = useState<Folder[]>([]);
  const [resources,      setResources]      = useState<Resource[]>([]);
  const [generalRes,     setGeneralRes]     = useState<Resource[]>([]);
  const [premiumLects,   setPremiumLects]   = useState<LectureDoc[]>([]);
  const [folderMap,      setFolderMap]      = useState<Record<string, { name: string; order: number }>>({});
  const [loading,        setLoading]        = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [activeVideo,    setActiveVideo]    = useState<LectureDoc | null>(null);
  const [preview,        setPreview]        = useState<{ url: string; title: string; id: string; contentType: "file" | "lecture"; category?: string } | null>(null);
  const [pendingRating,  setPendingRating]  = useState<{ id: string; name: string; contentType: "lecture" | "file" } | null>(null);
  const [filter,         setFilter]         = useState<"all" | "files" | "lectures">("all");
  const [guestModalOpen,   setGuestModalOpen]   = useState(false);
  const [guestModalAction, setGuestModalAction] = useState("access this content");

  const handleGuestSignIn = useCallback((action: string) => {
    setGuestModalAction(action);
    setGuestModalOpen(true);
  }, []);

  const currentFolder = folderStack[folderStack.length - 1] ?? null;

  useEffect(() => {
    if (!subject) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      loadFolders(subject, null),
      loadGeneralResources(subject),
      getDocs(query(collection(db, "lecture_folders"), where("subject", "==", subject))).catch(() => null),
    ]).then(([folders, gen, allFoldersSnap]) => {
      setRootFolders(folders as Folder[]);
      setGeneralRes(gen as Resource[]);
      if (allFoldersSnap) {
        const map: Record<string, { name: string; order: number }> = {};
        allFoldersSnap.docs.forEach((d) => {
          const data = d.data() as { name?: string; order?: number };
          map[d.id] = { name: data.name ?? d.id, order: data.order ?? 999 };
        });
        setFolderMap(map);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [subject]);

  useEffect(() => {
    if (!["maths", "science", "sst"].includes(subject ?? "")) {
      setPremiumLects([]);
      return;
    }
    const q = query(
      collection(db, "lectures"),
      where("subject", "==", subject),
      where("isPremium", "==", true),
    );
    const unsub = onSnapshot(q, (snap) => {
      const manualLects = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as LectureDoc));
      // Merge in premium lectures auto-discovered from the course scanner —
      // those live inside their chapter folders in courseEngine's output, so
      // pull the lecture-type ones back out for this dedicated section too.
      getCourseDataForSubject(subject).then((data) => {
        const courseLects: LectureDoc[] = Object.values(data.resourcesByFolder)
          .flat()
          .filter((r): r is CourseResource & { kind: "lecture" } => r.kind === "lecture" && !!r.isPremium)
          .map((r) => ({ id: r.id, title: r.title, hlsUrl: r.hlsUrl, folderId: r.folderId, subject: r.subject, category: r.category, order: r.order, isPremium: true }));
        setPremiumLects([...manualLects, ...courseLects].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
      }).catch(() => setPremiumLects(manualLects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999))));
    }, () => setPremiumLects([]));
    return unsub;
  }, [subject]);

  useEffect(() => {
    if (!currentFolder) { setSubFolders([]); setResources([]); return; }
    setLoadingContent(true);
    setActiveVideo(null);
    Promise.all([
      loadFolders(subject, currentFolder.id),
      loadFolderResources(subject, currentFolder.id),
    ]).then(([subs, res]) => {
      setSubFolders(subs);
      setResources(res);
      setLoadingContent(false);
    }).catch(() => setLoadingContent(false));
  }, [subject, currentFolder]);

  const openFolder = (f: Folder) => { setFolderStack((p) => [...p, f]); setFilter("all"); };
  const goBack     = () => { setFolderStack((p) => p.slice(0, -1)); setActiveVideo(null); setFilter("all"); };
  const goToRoot   = () => { setFolderStack([]); setActiveVideo(null); setFilter("all"); };
  const goToIndex  = (i: number) => { setFolderStack((p) => p.slice(0, i + 1)); setActiveVideo(null); setFilter("all"); };

  const displayedResources = resources.filter((r) => {
    if (filter === "files")    return r.kind === "file";
    if (filter === "lectures") return r.kind === "lecture";
    return true;
  });

  const handlePlay = (l: LectureDoc) => {
    if (!isLoggedIn) { handleGuestSignIn("play this lecture"); return; }
    if (l.isPremium && !isPremium) { openPremiumModal(true); return; }
    setActiveVideo(l);
  };

  const handlePreview = (url: string, title: string, id: string, contentType: "file" | "lecture", cat?: string) => {
    if (!isLoggedIn) { handleGuestSignIn("view this file"); return; }
    setPreview({ url, title, id, contentType, category: cat });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        <button
          onClick={() => navigate("/subjects")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          All Subjects
        </button>

        <div className={`rounded-2xl border px-5 py-4 mb-5 ${meta.bg} ${meta.border} animate-fade-in-up`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className={`text-lg font-display font-bold ${meta.text}`}>{meta.label}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? "Loading…" : `${rootFolders.length} folder${rootFolders.length !== 1 ? "s" : ""}`}
              </p>
            </div>
            {!isLoggedIn && (
              <button
                onClick={() => handleGuestSignIn("open files and lectures")}
                className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground bg-background/60 border border-border px-2.5 py-1.5 rounded-lg hover:text-foreground transition-colors flex-shrink-0"
              >
                <Lock size={11} /> Sign in to open files
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {folderStack.length > 0 && (
          <nav className="flex items-center gap-1 text-sm mb-5 flex-wrap">
            <button onClick={goToRoot}
              className="text-muted-foreground hover:text-foreground font-medium transition-colors capitalize">
              {meta.label}
            </button>
            {folderStack.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight size={13} className="text-muted-foreground/50" />
                {i < folderStack.length - 1 ? (
                  <button onClick={() => goToIndex(i)}
                    className="text-muted-foreground hover:text-foreground font-medium transition-colors">
                    {f.name}
                  </button>
                ) : (
                  <span className="text-foreground font-semibold">{f.name}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Active video player */}
        {activeVideo && (
          <div className="mb-5 bg-card border border-border rounded-2xl p-4 shadow-md animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-foreground truncate pr-2">{activeVideo.title}</h3>
              <button onClick={() => {
                  if (activeVideo) setPendingRating({ id: activeVideo.id, name: activeVideo.title, contentType: "lecture" });
                  setActiveVideo(null);
                }}
                className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
                <X size={13} />
              </button>
            </div>
            {activeVideo.hlsUrl
              ? <VideoPlayer url={activeVideo.hlsUrl} title={activeVideo.title} lectureId={activeVideo.id} subject={subject} isPremium={isPremium} />
              : <p className="text-sm text-muted-foreground py-6 text-center">No stream URL configured.</p>
            }
          </div>
        )}

        <SubjectErrorBoundary>
          {/* ── Root view ── */}
          {folderStack.length === 0 && (
            <>
              {loading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : rootFolders.length === 0 && generalRes.length === 0 ? (
                <Empty label="folders or resources" />
              ) : (
                <>
                  {rootFolders.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Folders</p>
                      <div className="space-y-2">
                        {rootFolders.map((f, i) => (
                          <button key={f.id} onClick={() => openFolder(f)}
                            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3.5 shadow-sm card-hover text-left animate-fade-in-up group"
                            style={{ animationDelay: `${i * 40}ms` }}>
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}>
                              <FolderOpen size={16} className="text-white" />
                            </div>
                            <p className="flex-1 font-semibold text-sm text-foreground">{f.name}</p>
                            <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {generalRes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">General Resources</p>
                      <div className="space-y-2">
                        {generalRes.map((r) => (
                          <ResourceRow key={r.id} r={r}
                            isLoggedIn={isLoggedIn}
                            isPremiumUser={isPremium}
                            onPlay={handlePlay}
                            onPreview={handlePreview}
                            onUpgrade={() => openPremiumModal(true)}
                            onGuestSignIn={handleGuestSignIn}
                            subject={subject}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Premium Lectures Section (maths / science / sst) ── */}
                  {["maths", "science", "sst"].includes(subject ?? "") && (
                    <div className="mt-6">
                      {/* Section heading */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                          <Crown size={12} className="text-white" />
                        </div>
                        <p className="text-xs font-bold text-foreground uppercase tracking-wider">Premium Lectures</p>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[9px] font-bold tracking-wide">
                          EXCLUSIVE
                        </span>
                      </div>

                      {isPremium ? (
                        /* ── Premium user: show real lectures grouped by folder ── */
                        <div className="relative rounded-2xl overflow-hidden"
                          style={{
                            background: "linear-gradient(135deg, #0f1623 0%, #0d1b3e 55%, #0a1628 100%)",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.2), 0 0 0 1px rgba(251,191,36,0.15)",
                          }}>
                          <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
                            style={{ background: "radial-gradient(circle at 70% 20%, rgba(251,191,36,0.12) 0%, transparent 60%)" }} />
                          <div className="relative px-5 py-5">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.35)" }}>
                                <Crown size={18} className="text-white" />
                              </div>
                              <div>
                                <p className="text-white font-bold text-sm">Premium Access Active</p>
                                <p className="text-white/50 text-[11px]">Full access to all {meta.label} premium lectures</p>
                              </div>
                            </div>
                            {premiumLects.length === 0 ? (
                              <p className="text-white/40 text-xs text-center py-3">Premium lectures will appear here once uploaded by admin.</p>
                            ) : (() => {
                              // Group lectures by folder
                              const folderIds = Object.keys(folderMap).sort((a, b) => (folderMap[a]?.order ?? 999) - (folderMap[b]?.order ?? 999));
                              const grouped: { folderId: string | null; name: string; lects: LectureDoc[] }[] = [];
                              // Build folder groups (only folders that have premium lectures)
                              folderIds.forEach((fid) => {
                                const inFolder = premiumLects.filter((l) => l.folderId === fid);
                                if (inFolder.length > 0) grouped.push({ folderId: fid, name: folderMap[fid].name, lects: inFolder });
                              });
                              // Uncategorized — no folderId or folderId not in map
                              const uncategorized = premiumLects.filter((l) => !l.folderId || !folderMap[l.folderId]);
                              const showFolders = grouped.length > 0;

                              const LectureRow = ({ lect }: { lect: LectureDoc }) => (
                                <button key={lect.id} onClick={() => { setActiveVideo(lect); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all hover:scale-[1.01]"
                                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                                    style={{ background: "linear-gradient(135deg, #f59e0b55, #d9770644)" }}>
                                    {lect.thumbnail
                                      ? <img src={lect.thumbnail} alt="" className="w-full h-full object-cover" />
                                      : <Play size={13} className="text-amber-400" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white/85 text-sm font-medium truncate">{lect.title}</p>
                                    {lect.category && <p className="text-white/35 text-[10px]">{lect.category}</p>}
                                  </div>
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white flex-shrink-0"
                                    style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                                    <Play size={9} /> Watch
                                  </div>
                                </button>
                              );

                              return (
                                <div className="space-y-4">
                                  {showFolders && grouped.map((grp) => (
                                    <div key={grp.folderId}>
                                      <div className="flex items-center gap-2 mb-2">
                                        <FolderOpen size={12} className="text-amber-400/60" />
                                        <p className="text-amber-400/80 text-[11px] font-bold uppercase tracking-wider">{grp.name}</p>
                                        <span className="text-amber-400/40 text-[10px]">{grp.lects.length}</span>
                                      </div>
                                      <div className="space-y-2">
                                        {grp.lects.map((l) => <LectureRow key={l.id} lect={l} />)}
                                      </div>
                                    </div>
                                  ))}
                                  {uncategorized.length > 0 && (
                                    <div>
                                      {showFolders && (
                                        <div className="flex items-center gap-2 mb-2">
                                          <p className="text-white/30 text-[11px] font-bold uppercase tracking-wider">Other</p>
                                        </div>
                                      )}
                                      <div className="space-y-2">
                                        {uncategorized.map((l) => <LectureRow key={l.id} lect={l} />)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        /* ── Free user: locked section with blurred preview ── */
                        <div className="relative rounded-2xl overflow-hidden"
                          style={{
                            background: "linear-gradient(135deg, #0f1623 0%, #0d1b3e 55%, #0a1628 100%)",
                            boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                          }}>
                          {/* Glow effects */}
                          <div className="absolute top-0 right-0 w-56 h-56 pointer-events-none"
                            style={{ background: "radial-gradient(circle at 75% 25%, rgba(139,92,246,0.15) 0%, transparent 60%)" }} />
                          <div className="absolute bottom-0 left-0 w-40 h-40 pointer-events-none"
                            style={{ background: "radial-gradient(circle at 20% 80%, rgba(37,99,235,0.1) 0%, transparent 60%)" }} />

                          {/* Blurred preview rows */}
                          <div className="relative px-5 pt-5">
                            <div className="space-y-2.5 mb-4" style={{ filter: "blur(3.5px)", userSelect: "none", pointerEvents: "none", opacity: 0.45 }}>
                              {(premiumLects.length > 0 ? premiumLects.slice(0, 4) : [
                                { id: "ph1", title: "Chapter 1 — Lecture 1", category: "Premium lecture • HD quality" },
                                { id: "ph2", title: "Chapter 1 — Lecture 2", category: "Premium lecture • HD quality" },
                                { id: "ph3", title: "Chapter 2 — Lecture 1", category: "Premium lecture • HD quality" },
                                { id: "ph4", title: "Chapter 2 — Lecture 2", category: "Premium lecture • HD quality" },
                              ] as Partial<LectureDoc>[]).map((lect) => (
                                <div key={lect.id} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(249,115,22,0.2))" }}>
                                    <Play size={14} className="text-amber-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white/70 text-sm font-medium">{lect.title}</p>
                                    <p className="text-white/35 text-[10px]">{lect.category ?? "Premium lecture • HD quality"}</p>
                                  </div>
                                  <Lock size={13} className="text-amber-500/50 flex-shrink-0" />
                                </div>
                              ))}
                            </div>

                            {/* Overlay unlock card */}
                            <div className="absolute inset-0 flex items-center justify-center px-5">
                              <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-xl"
                                  style={{ background: "linear-gradient(135deg, #b45309, #92400e)", boxShadow: "0 8px 24px rgba(180,83,9,0.4)" }}>
                                  <Lock size={24} className="text-amber-300" />
                                </div>
                                <p className="text-white font-bold text-base mb-1">Premium Content Locked</p>
                                <p className="text-white/50 text-xs mb-4 leading-relaxed">
                                  Unlock exclusive {meta.label} lectures<br />from just <span className="text-amber-400 font-semibold">₹3/day</span> or <span className="text-amber-400 font-semibold">₹39/month</span>
                                </p>
                                <button onClick={() => openPremiumModal(true)}
                                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto transition-all hover:-translate-y-0.5"
                                  style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)", boxShadow: "0 6px 20px rgba(245,158,11,0.4)" }}>
                                  <Crown size={14} /> Upgrade to Unlock
                                </button>
                              </div>
                            </div>

                            {/* Bottom padding for overlay */}
                            <div className="pb-5" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Inside a folder ── */}
          {folderStack.length > 0 && (
            <>
              <button onClick={goBack}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-5 group">
                <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                Back
              </button>

              {loadingContent ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
                </div>
              ) : (
                <>
                  {/* Subfolders */}
                  {subFolders.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sub-Folders</p>
                      <div className="space-y-2">
                        {subFolders.map((f, i) => (
                          <button key={f.id} onClick={() => openFolder(f)}
                            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-3.5 shadow-sm card-hover text-left group animate-fade-in-up"
                            style={{ animationDelay: `${i * 40}ms` }}>
                            <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${meta.gradient} opacity-70 flex items-center justify-center flex-shrink-0`}>
                              <FolderOpen size={16} className="text-white" />
                            </div>
                            <p className="flex-1 font-semibold text-sm text-foreground">{f.name}</p>
                            <ChevronRight size={15} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resources filter */}
                  {resources.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        {(["all", "files", "lectures"] as const).map((f) => (
                          <button key={f} onClick={() => setFilter(f)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              filter === f
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                            }`}>
                            {f === "all" ? "All" : f === "files" ? "Files" : "Lectures"}
                          </button>
                        ))}
                        <span className="ml-auto text-xs text-muted-foreground font-medium">{displayedResources.length} items</span>
                      </div>
                      <div className="space-y-2.5">
                        {displayedResources.map((r, i) => (
                          <div key={r.id} className="animate-fade-in-up flex items-center gap-2"
                            style={{ animationDelay: `${i * 35}ms` }}>
                            <span className="text-xs font-bold text-muted-foreground/50 w-5 text-right flex-shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <ResourceRow r={r}
                                isLoggedIn={isLoggedIn}
                                isPremiumUser={isPremium}
                                onPlay={handlePlay}
                                onPreview={handlePreview}
                                onUpgrade={() => openPremiumModal(true)}
                                onGuestSignIn={handleGuestSignIn}
                                subject={subject}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {subFolders.length === 0 && resources.length === 0 && (
                    <Empty label="content in this folder" />
                  )}
                </>
              )}
            </>
          )}
        </SubjectErrorBoundary>
      </div>

      {preview && (
        <FilePreviewModal url={preview.url} title={preview.title} category={preview.category}
          onClose={() => {
            setPendingRating({ id: preview.id, name: preview.title, contentType: preview.contentType });
            setPreview(null);
          }} />
      )}

      {pendingRating && (
        <RatingPopup
          contentId={pendingRating.id}
          contentType={pendingRating.contentType}
          contentName={pendingRating.name}
          onClose={() => setPendingRating(null)}
        />
      )}

      <GuestSignInModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        action={guestModalAction}
      />
    </Layout>
  );
}
