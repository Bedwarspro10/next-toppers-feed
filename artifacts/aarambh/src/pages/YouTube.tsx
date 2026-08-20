import { Component, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { getChannelVideos, hasYouTubeKey } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";
import {
  Youtube, ExternalLink, Eye, PlayCircle,
  AlertTriangle, ChevronLeft, Key, X,
} from "lucide-react";

interface YtChannel { id: string; name: string; url: string; }

class YouTubeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: unknown) {
    return { hasError: true, message: err instanceof Error ? err.message : "An unexpected error occurred." };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card border border-border rounded-2xl px-6 py-10 text-center">
          <AlertTriangle size={32} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">Something went wrong</p>
          <p className="text-xs text-muted-foreground">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function fmtViews(count: string | null | undefined) {
  if (!count) return null;
  const n = parseInt(count);
  if (isNaN(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function parseDuration(iso: string | null | undefined) {
  if (!iso) return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = m[1] ? `${m[1]}:` : "";
  const mins = m[2]?.padStart(h ? 2 : 1, "0") ?? "0";
  const secs = (m[3] ?? "0").padStart(2, "0");
  return `${h}${mins}:${secs}`;
}

function NoApiKeyBanner() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl px-6 py-8 text-center mb-8">
      <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mx-auto mb-3">
        <Key size={22} className="text-amber-600" />
      </div>
      <p className="font-semibold text-foreground mb-1">YouTube API key not configured</p>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Add <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-xs">VITE_YOUTUBE_API_KEY</code> to
        your Cloudflare Pages environment variables to enable YouTube video loading.
      </p>
    </div>
  );
}

function VideoPlayer({ video, onClose }: { video: YTVideo; onClose: () => void }) {
  const embedUrl = `https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 " onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[51] max-w-3xl mx-auto">
        <div className="bg-black rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 bg-black/80">
            <p className="text-white text-sm font-semibold truncate pr-4">{video.title}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
                <ExternalLink size={12} /> YouTube
              </a>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white">
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="aspect-video w-full">
            <iframe
              src={embedUrl}
              title={video.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </>
  );
}

function ChannelSection({ channel }: { channel: YtChannel }) {
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<YTVideo | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getChannelVideos(channel.url, 8)
      .then((vids) => { if (!cancelled) { setVideos(vids); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to load"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [channel.url]);

  return (
    <section className="mb-12">
      {playing && <VideoPlayer video={playing} onClose={() => setPlaying(null)} />}

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center flex-shrink-0">
            <Youtube size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">{channel.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Latest uploads</p>
          </div>
        </div>
        <a
          href={channel.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Open channel <ExternalLink size={12} />
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="bg-card border border-border rounded-2xl px-6 py-8 text-center">
          <AlertTriangle size={28} className="text-yellow-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground mb-1">Could not load videos</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-6 py-8 text-center">
          <Youtube size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No videos found for this channel.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {videos.map((video) => {
            const duration = parseDuration(video.duration);
            const views = fmtViews(video.viewCount);
            return (
              <button
                key={video.id}
                onClick={() => setPlaying(video)}
                className="group bg-card border border-border rounded-xl overflow-hidden card-hover block text-left w-full"
              >
                <div className="relative aspect-video overflow-hidden bg-muted">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                      <PlayCircle size={22} className="text-red-600" />
                    </div>
                  </div>
                  {duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {duration}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug mb-1.5">
                    {video.title}
                  </p>
                  {views && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Eye size={10} /> {views} views
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function YouTubePage() {
  const [, navigate] = useLocation();
  const [channels, setChannels] = useState<YtChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const noKey = !hasYouTubeKey();

  useEffect(() => {
    getDocs(collection(db, "yt_channels"))
      .then((snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as YtChannel))
          .filter((ch) => ch && typeof ch.url === "string" && ch.url.trim() !== "");
        setChannels(docs);
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 group transition-colors"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center flex-shrink-0">
            <Youtube size={22} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">YouTube Lectures</h1>
            <p className="text-sm text-muted-foreground">Latest videos from your batch channels</p>
          </div>
        </div>

        {noKey && <NoApiKeyBanner />}

        {loading ? (
          <div className="space-y-10">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-7 w-48 mb-4 rounded-lg" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="aspect-video rounded-xl" />)}
                </div>
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-yellow-500" />
            </div>
            <p className="font-semibold text-foreground mb-1">Could not load channels</p>
            <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-4">
              <Youtube size={28} className="text-red-600/60" />
            </div>
            <p className="font-semibold text-foreground mb-1">No channels added yet</p>
            <p className="text-sm text-muted-foreground">An admin can add YouTube channels from the Admin Dashboard.</p>
          </div>
        ) : (
          channels.map((ch) => (
            <YouTubeErrorBoundary key={ch.id}>
              <ChannelSection channel={ch} />
            </YouTubeErrorBoundary>
          ))
        )}
      </div>
    </Layout>
  );
}
