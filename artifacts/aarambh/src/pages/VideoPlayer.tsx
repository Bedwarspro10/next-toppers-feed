import { useState, useEffect, useCallback } from "react";
import { useLocation, useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { CoursePlayer } from "@/components/CoursePlayer";
import {
  ArrowLeft, Share2, Bookmark, ThumbsUp, Play, ExternalLink, Clock, Eye,
  Copy, Check, X,
} from "lucide-react";

function extractYouTubeId(url: string): { id: string; isLive: boolean } | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return { id: m[1], isLive: url.includes("/live/") || url.includes("live=1") };
  }
  return null;
}

function getYouTubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

export default function VideoPlayer() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const videoId = params.get("v") ?? "";
  const hlsUrl = params.get("url") ?? "";
  const title = params.get("title") ?? "Video";
  const isLive = params.get("live") === "1";

  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&cc_load_policy=1${isLive ? "&live_stream=1" : ""}`
    : "";

  const shareUrl = videoId
    ? `${window.location.origin}/watch?v=${videoId}&title=${encodeURIComponent(title)}`
    : "";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [shareUrl]);

  useEffect(() => {
    const bm = JSON.parse(localStorage.getItem("nt_bookmarked_videos") ?? "[]") as string[];
    setBookmarked(bm.includes(videoId));
  }, [videoId]);

  const toggleBookmark = () => {
    const bm = JSON.parse(localStorage.getItem("nt_bookmarked_videos") ?? "[]") as string[];
    const next = bookmarked ? bm.filter(id => id !== videoId) : [...bm, videoId];
    localStorage.setItem("nt_bookmarked_videos", JSON.stringify(next));
    setBookmarked(!bookmarked);
  };

  if (hlsUrl && /\.m3u8(?:$|\?)/i.test(hlsUrl)) {
    return (
      <Layout>
        <CoursePlayer src={hlsUrl} title={title} open onClose={() => window.history.back()} />
      </Layout>
    );
  }

  if (!videoId) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <X size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Video not found</h2>
          <p className="text-sm text-muted-foreground mb-6">No video ID was provided.</p>
          <Link href="/">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
              <ArrowLeft size={14} /> Go Home
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-0 sm:px-4 py-0 sm:py-6 animate-fade-in-up">

        {/* Back button (mobile) */}
        <div className="flex items-center gap-3 px-4 py-3 sm:px-0 sm:py-0 sm:mb-4">
          <Link href="/">
            <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <ArrowLeft size={16} className="text-foreground" />
            </button>
          </Link>
          {isLive && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-white"
              style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 2px 8px rgba(239,68,68,0.4)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
        </div>

        {/* Player */}
        <div className="relative w-full overflow-hidden sm:rounded-2xl"
          style={{
            aspectRatio: "16/9",
            background: "#000",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          }}>
          <iframe
            src={embedUrl}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
            style={{ border: "none" }}
          />
        </div>

        {/* Info */}
        <div className="px-4 sm:px-0 mt-4 space-y-4">

          {/* Title + badges */}
          <div>
            {isLive && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">🔴 Live Stream</span>
              </div>
            )}
            <h1 className="text-lg font-black text-foreground leading-snug">{title}</h1>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setLiked(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: liked ? "rgba(99,102,241,0.15)" : "hsl(var(--secondary))",
                border: liked ? "1px solid rgba(99,102,241,0.3)" : "1px solid hsl(var(--border))",
                color: liked ? "#818cf8" : "hsl(var(--foreground))",
              }}>
              <ThumbsUp size={14} className={liked ? "fill-current" : ""} />
              {liked ? "Liked" : "Like"}
            </button>

            <button
              onClick={toggleBookmark}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: bookmarked ? "rgba(245,158,11,0.12)" : "hsl(var(--secondary))",
                border: bookmarked ? "1px solid rgba(245,158,11,0.3)" : "1px solid hsl(var(--border))",
                color: bookmarked ? "#f59e0b" : "hsl(var(--foreground))",
              }}>
              <Bookmark size={14} className={bookmarked ? "fill-current" : ""} />
              {bookmarked ? "Saved" : "Save"}
            </button>

            <button
              onClick={() => setShowShare(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: "hsl(var(--secondary))",
                border: "1px solid hsl(var(--border))",
              }}>
              <Share2 size={14} />
              Share
            </button>

            <a
              href={`https://youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ml-auto"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
              }}>
              <ExternalLink size={13} />
              YouTube
            </a>
          </div>

          {/* Share panel */}
          {showShare && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
              <div className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "hsl(var(--border))" }}>
                <p className="text-sm font-bold text-foreground">Share this video</p>
                <button onClick={() => setShowShare(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-secondary text-muted-foreground font-mono outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: copied ? "rgba(16,185,129,0.12)" : "rgba(99,102,241,0.12)",
                      border: copied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(99,102,241,0.3)",
                      color: copied ? "#10b981" : "#818cf8",
                    }}>
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="rounded-2xl p-4 space-y-2"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Player Tips</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "⚙️", text: "Change quality via ⚙ in player" },
                { icon: "📺", text: "Fullscreen: tap expand icon" },
                { icon: "🔤", text: "Subtitles: CC button in player" },
                { icon: "⚡", text: "Speed: ⚙ → Playback speed" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
