import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Video, FileText, Bell, FolderOpen, X } from "lucide-react";

function getUrlParam(name: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}

interface SearchResult {
  id: string;
  type: "lecture" | "file" | "announcement";
  title: string;
  subject?: string;
  category?: string;
  href?: string;
  hlsUrl?: string;
  link?: string;
  isPremium?: boolean;
}

let _cache: SearchResult[] | null = null;

async function loadAllData(): Promise<SearchResult[]> {
  if (_cache) return _cache;
  const [lSnap, fSnap, aSnap] = await Promise.all([
    getDocs(query(collection(db, "lectures"), orderBy("createdAt", "desc"), limit(500))).catch(() => null),
    getDocs(query(collection(db, "files"), orderBy("createdAt", "desc"), limit(500))).catch(() => null),
    getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(200))).catch(() => null),
  ]);
  const results: SearchResult[] = [];
  (lSnap?.docs ?? []).forEach((d) => {
    const data = d.data();
    results.push({ id: d.id, type: "lecture", title: data.title ?? "", subject: data.subject, category: data.category, href: data.subject ? `/subjects/${data.subject}` : undefined, hlsUrl: data.hlsUrl, isPremium: data.isPremium });
  });
  (fSnap?.docs ?? []).forEach((d) => {
    const data = d.data();
    results.push({ id: d.id, type: "file", title: data.name ?? "", subject: data.subject, category: data.category, href: data.subject ? `/subjects/${data.subject}` : undefined, link: data.link, isPremium: data.isPremium });
  });
  (aSnap?.docs ?? []).forEach((d) => {
    const data = d.data();
    results.push({ id: d.id, type: "announcement", title: data.title ?? "", href: "/announcements" });
  });
  _cache = results;
  return results;
}

const TYPE_META = {
  lecture: { icon: Video, label: "Lecture", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/40" },
  file: { icon: FileText, label: "File", color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40" },
  announcement: { icon: Bell, label: "Announcement", color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/40" },
};

export default function SearchPage() {
  const [q, setQ] = useState(() => getUrlParam("q"));
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData().then((data) => { setAllData(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const doSearch = useCallback((term: string) => {
    const t = term.trim().toLowerCase();
    if (!t) { setResults([]); return; }
    const found = allData.filter((r) =>
      r.title.toLowerCase().includes(t) ||
      (r.subject ?? "").toLowerCase().includes(t) ||
      (r.category ?? "").toLowerCase().includes(t)
    ).slice(0, 50);
    setResults(found);
  }, [allData]);

  useEffect(() => {
    const id = setTimeout(() => doSearch(q), 250);
    return () => clearTimeout(id);
  }, [q, doSearch]);

  const grouped = {
    lecture: results.filter((r) => r.type === "lecture"),
    file: results.filter((r) => r.type === "file"),
    announcement: results.filter((r) => r.type === "announcement"),
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-display font-bold text-foreground mb-1">Search</h1>
          <p className="text-sm text-muted-foreground">Find lectures, files, and announcements</p>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lectures, notes, DPP…"
            autoFocus
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        )}

        {!loading && !q && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
              <Search size={22} className="text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground/70 mb-1">Start searching</p>
            <p className="text-sm text-muted-foreground">Type a keyword to find lectures, notes, DPPs, and more.</p>
          </div>
        )}

        {!loading && q && results.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
              <FolderOpen size={22} className="text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground/70 mb-1">No results found</p>
            <p className="text-sm text-muted-foreground">Try different keywords or check the spelling.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-5">
            {(["lecture", "file", "announcement"] as const).map((type) => {
              const items = grouped[type];
              if (!items.length) return null;
              const meta = TYPE_META[type];
              const Icon = meta.icon;
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${meta.bg}`}>
                      <Icon size={13} className={meta.color} />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{meta.label}s</p>
                    <span className="text-xs text-muted-foreground/60 font-medium">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div key={r.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                          <Icon size={15} className={meta.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{r.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {r.subject && <span className="text-[10px] text-muted-foreground capitalize">{r.subject}</span>}
                            {r.category && <span className="text-[10px] text-muted-foreground/70">· {r.category}</span>}
                            {r.isPremium && <span className="text-[9px] font-bold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md">Premium</span>}
                          </div>
                        </div>
                        {r.href && (
                          <Link href={r.href}>
                            <span className="text-xs font-semibold text-primary hover:underline flex-shrink-0">Open →</span>
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
