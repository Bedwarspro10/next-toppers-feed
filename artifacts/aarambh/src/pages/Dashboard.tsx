import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, FileText, Video, BookOpen, ArrowRight, GraduationCap, ChevronRight, ExternalLink, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";

interface FileDoc { id: string; name: string; subject: string; category?: string; link: string; }
interface LectureDoc { id: string; title: string; subject: string; thumbnail?: string; }
interface Announcement { id: string; title: string; message: string; createdAt: { seconds: number }; }

const SUBJECT_META: Record<string, { text: string; bg: string; gradient: string }> = {
  maths:   { text: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/50",   gradient: "from-blue-500 to-blue-600" },
  science: { text: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/50", gradient: "from-emerald-500 to-teal-600" },
  sst:     { text: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-900/50",  gradient: "from-violet-500 to-purple-600" },
  english: { text: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-900/50",   gradient: "from-amber-500 to-orange-500" },
  hindi:   { text: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-900/50",    gradient: "from-rose-500 to-pink-600" },
};

const SUBJECTS = [
  { id: "maths", label: "Maths" }, { id: "science", label: "Science" },
  { id: "sst", label: "SST" }, { id: "english", label: "English" }, { id: "hindi", label: "Hindi" },
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [lectures, setLectures] = useState<LectureDoc[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const firstName = user?.displayName?.split(" ")[0] ?? "Student";

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, "files"), orderBy("createdAt", "desc"), limit(5))),
      getDocs(query(collection(db, "lectures"), orderBy("createdAt", "desc"), limit(5))),
    ]).then(([f, l]) => {
      setFiles(f.docs.map((d) => ({ id: d.id, ...d.data() } as FileDoc)));
      setLectures(l.docs.map((d) => ({ id: d.id, ...d.data() } as LectureDoc)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3)),
      (snap) => setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)))
    );
  }, []);

  const SubjectDot = ({ subject }: { subject: string }) => {
    const m = SUBJECT_META[subject];
    if (!m) return <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center"><FileText size={14} className="text-muted-foreground" /></div>;
    return (
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${m.gradient} flex items-center justify-center flex-shrink-0`}>
        <FileText size={13} className="text-white" />
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground group transition-colors"
        >
          <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Home
        </button>

        {/* Welcome card */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 py-8 sm:py-10 animate-fade-in-up">
          <div className="absolute top-0 right-0 w-56 h-56 bg-blue-500/20 rounded-full opacity-60 -translate-y-1/3 translate-x-1/3 pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-14 h-14 rounded-2xl border-2 border-white/20 object-cover flex-shrink-0 shadow-lg" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {firstName.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-white/60 text-sm font-medium mb-0.5">Welcome back,</p>
              <h1 className="text-2xl font-display font-extrabold text-white tracking-tight">{firstName}</h1>
              <div className="flex items-center gap-1.5 mt-1.5">
                <GraduationCap size={13} className="text-blue-400" />
                <span className="text-white/50 text-xs font-medium">Aarambh Batch 2026–27</span>
                {isAdmin && (
                  <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                    Admin
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Subject quick-access */}
        <div className="animate-fade-in-up delay-75">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <BookOpen size={16} className="text-primary" /> Quick Access
            </h2>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {SUBJECTS.map((s) => {
              const m = SUBJECT_META[s.id];
              return (
                <Link key={s.id} href={`/subjects/${s.id}`}>
                  <div className={`rounded-xl p-3 text-center text-xs font-semibold cursor-pointer card-hover border ${m?.bg ?? "bg-muted"} ${m?.text ?? "text-foreground"} border-transparent hover:border-current/20`}>
                    {s.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Announcements */}
        {announcements.length > 0 && (
          <div className="animate-fade-in-up delay-150">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-foreground flex items-center gap-2">
                <Bell size={16} className="text-primary" /> Latest Announcements
              </h2>
              <Link href="/announcements">
                <span className="text-xs text-primary font-semibold flex items-center gap-1 cursor-pointer hover:gap-1.5 transition-all">
                  All <ChevronRight size={13} />
                </span>
              </Link>
            </div>
            <div className="space-y-2.5">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-start gap-3 shadow-sm card-hover">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bell size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{ann.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ann.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Files */}
        <div className="animate-fade-in-up delay-225">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Recent Files
            </h2>
            <Link href="/subjects">
              <span className="text-xs text-primary font-semibold flex items-center gap-1 cursor-pointer hover:gap-1.5 transition-all">
                Browse all <ChevronRight size={13} />
              </span>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : files.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-10 text-center">
              <FileText size={28} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm card-hover">
                  <SubjectDot subject={f.subject} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{f.subject}{f.category ? ` · ${f.category}` : ""}</p>
                  </div>
                  <button onClick={() => window.open(f.link, "_blank")}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline flex-shrink-0">
                    Open <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Lectures */}
        <div className="animate-fade-in-up delay-300">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-foreground flex items-center gap-2">
              <Video size={16} className="text-primary" /> Recent Lectures
            </h2>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : lectures.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl py-10 text-center">
              <Video size={28} className="text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No lectures added yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lectures.map((l) => (
                <Link key={l.id} href={`/subjects/${l.subject}`}>
                  <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm card-hover cursor-pointer">
                    {l.thumbnail ? (
                      <img src={l.thumbnail} alt={l.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${SUBJECT_META[l.subject]?.gradient ?? "from-slate-400 to-slate-500"} flex items-center justify-center flex-shrink-0`}>
                        <Video size={13} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{l.subject}</p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Admin link */}
        {isAdmin && (
          <Link href="/admin">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-2xl px-5 py-4 flex items-center gap-3 card-hover cursor-pointer">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">⚡</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Admin Dashboard</p>
                <p className="text-xs text-white/50">Manage content, announcements, and platform settings</p>
              </div>
              <ArrowRight size={15} className="text-white/40" />
            </div>
          </Link>
        )}
      </div>
    </Layout>
  );
}
