import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  Bookmark, Video, FileText, Trash2, Play, ExternalLink, Clock
} from "lucide-react";

interface BMItem {
  id: string; type: "lecture" | "file";
  title: string; subject: string;
  hlsUrl?: string; link?: string;
  thumbnail?: string; savedAt: number;
}

function getBookmarks(): BMItem[] {
  try { return JSON.parse(localStorage.getItem("nt_bookmarks") ?? "[]"); } catch { return []; }
}
function removeBookmark(id: string) {
  try {
    const list = getBookmarks().filter((b) => b.id !== id);
    localStorage.setItem("nt_bookmarks", JSON.stringify(list));
  } catch {}
}

function timeAgo(ts: number) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function BookmarksPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [bookmarks, setBookmarks] = useState<BMItem[]>([]);

  useEffect(() => { setBookmarks(getBookmarks()); }, []);

  const handleRemove = (id: string) => {
    removeBookmark(id);
    setBookmarks(getBookmarks());
  };

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
            <Bookmark size={22} className="text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground mb-1">Sign in to see bookmarks</p>
          <p className="text-sm text-muted-foreground mb-5">Your bookmarked lectures and files will appear here.</p>
          <button onClick={() => navigate("/login")}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
            Sign in
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bookmark size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Bookmarks</h1>
            <p className="text-xs text-muted-foreground">{bookmarks.length} saved item{bookmarks.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {bookmarks.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
              <Bookmark size={22} className="text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground/70 mb-1">No bookmarks yet</p>
            <p className="text-sm text-muted-foreground mb-5">
              Tap the bookmark icon on any lecture or file to save it here.
            </p>
            <Link href="/subjects">
              <span className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer hover:bg-primary/90 transition-colors">
                Browse Subjects
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-2.5">
            {bookmarks.map((bm) => (
              <div key={bm.id}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all animate-fade-in-up">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden ${
                  bm.type === "lecture" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-violet-50 dark:bg-violet-950/40"
                }`}>
                  {bm.thumbnail
                    ? <img src={bm.thumbnail} alt="" className="w-full h-full object-cover" />
                    : bm.type === "lecture"
                      ? <Video size={15} className="text-blue-500" />
                      : <FileText size={15} className="text-violet-500" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{bm.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {bm.subject && <span className="text-[10px] text-muted-foreground capitalize">{bm.subject}</span>}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                      <Clock size={9} /> {timeAgo(bm.savedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {bm.type === "lecture" && bm.hlsUrl && bm.subject && (
                    <Link href={`/subjects/${bm.subject}`}>
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/15 transition-colors">
                        <Play size={10} /> Play
                      </button>
                    </Link>
                  )}
                  {bm.type === "file" && bm.link && (
                    <a href={bm.link} target="_blank" rel="noopener noreferrer">
                      <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-600 border border-violet-500/20 text-xs font-semibold hover:bg-violet-500/15 transition-colors">
                        <ExternalLink size={10} /> Open
                      </button>
                    </a>
                  )}
                  <button onClick={() => handleRemove(bm.id)}
                    className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 flex items-center justify-center transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
