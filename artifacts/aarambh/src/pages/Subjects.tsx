import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useSubjectPopup } from "@/contexts/SubjectPopupContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { isFreeSubject } from "@/lib/subjectRecognition";
import { Layout } from "@/components/layout/Layout";
import { BookOpen, FlaskConical, Globe, Languages, Sigma, ChevronRight, ChevronLeft, FolderOpen, FileText, Video, Monitor, Brain, Crown } from "lucide-react";

const SUBJECTS = [
  {
    id: "maths", label: "Mathematics", desc: "Algebra, Geometry, Trigonometry, Calculus",
    icon: Sigma, gradient: "from-blue-500 to-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/50", border: "border-blue-100 dark:border-blue-900/60",
    iconBg: "bg-blue-100 dark:bg-blue-900/60", text: "text-blue-600 dark:text-blue-400",
    tag: "Core Subject",
  },
  {
    id: "science", label: "Science", desc: "Physics, Chemistry, Biology — theory & practicals",
    icon: FlaskConical, gradient: "from-emerald-500 to-teal-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-emerald-100 dark:border-emerald-900/60",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/60", text: "text-emerald-600 dark:text-emerald-400",
    tag: "Core Subject",
  },
  {
    id: "sst", label: "Social Studies", desc: "History, Geography, Civics & Economics",
    icon: Globe, gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50 dark:bg-violet-950/50", border: "border-violet-100 dark:border-violet-900/60",
    iconBg: "bg-violet-100 dark:bg-violet-900/60", text: "text-violet-600 dark:text-violet-400",
    tag: "Core Subject",
  },
  {
    id: "english", label: "English", desc: "Grammar, Literature, Comprehension & Writing",
    icon: BookOpen, gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 dark:bg-amber-950/50", border: "border-amber-100 dark:border-amber-900/60",
    iconBg: "bg-amber-100 dark:bg-amber-900/60", text: "text-amber-600 dark:text-amber-400",
    tag: "Language",
  },
  {
    id: "hindi", label: "Hindi", desc: "Vyakaran, Sahitya, Nibandh & Comprehension",
    icon: Languages, gradient: "from-rose-500 to-pink-600",
    bg: "bg-rose-50 dark:bg-rose-950/50", border: "border-rose-100 dark:border-rose-900/60",
    iconBg: "bg-rose-100 dark:bg-rose-900/60", text: "text-rose-600 dark:text-rose-400",
    tag: "Language",
  },
  {
    id: "it", label: "Information & Technology", desc: "Computers, Networking, Software & Digital Literacy",
    icon: Monitor, gradient: "from-cyan-500 to-sky-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/50", border: "border-cyan-100 dark:border-cyan-900/60",
    iconBg: "bg-cyan-100 dark:bg-cyan-900/60", text: "text-cyan-600 dark:text-cyan-400",
    tag: "Technology",
  },
  {
    id: "ai", label: "Artificial Intelligence", desc: "Machine Learning, Neural Networks & AI Concepts",
    icon: Brain, gradient: "from-indigo-500 to-violet-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/50", border: "border-indigo-100 dark:border-indigo-900/60",
    iconBg: "bg-indigo-100 dark:bg-indigo-900/60", text: "text-indigo-600 dark:text-indigo-400",
    tag: "Technology",
  },
];

interface SubjectCounts { folders: number; files: number; lectures: number; }

export default function Subjects() {
  const [, navigate] = useLocation();
  const { requestNavigation } = useSubjectPopup();
  const { isPremium } = usePremium();
  const { setOpen: openPremiumModal } = usePremiumModal();
  const [counts, setCounts] = useState<Record<string, SubjectCounts>>({});

  useEffect(() => {
    Promise.all(
      SUBJECTS.map(async (s) => {
        const [folders, files, lectures] = await Promise.all([
          getDocs(query(collection(db, "lecture_folders"), where("subject", "==", s.id))).catch(() => null),
          getDocs(query(collection(db, "files"), where("subject", "==", s.id))).catch(() => null),
          getDocs(query(collection(db, "lectures"), where("subject", "==", s.id))).catch(() => null),
        ]);
        return {
          id: s.id,
          counts: {
            folders: folders?.size ?? 0,
            files: files?.size ?? 0,
            lectures: lectures?.size ?? 0,
          },
        };
      })
    ).then((results) => {
      const map: Record<string, SubjectCounts> = {};
      results.forEach((r) => { map[r.id] = r.counts; });
      setCounts(map);
    }).catch(() => {});
  }, []);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors"
          >
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </button>
          <h1 className="text-3xl font-display font-bold text-foreground">Subjects</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Select a subject to access all files, lectures, and study resources.
          </p>
        </div>

        {/* Subject grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {SUBJECTS.map((s, i) => {
            const Icon = s.icon;
            const c = counts[s.id];
            const resources = (c?.files ?? 0) + (c?.lectures ?? 0);
            // Lock rule only applies to the 5 recognized course-content subjects —
            // "it" / "ai" aren't part of the free/premium split and stay as before.
            const inCourseSystem = ["maths", "science", "sst", "english", "hindi"].includes(s.id);
            const free = isFreeSubject(s.id);
            const locked = inCourseSystem && !free && !isPremium;
            const handleClick = () => {
              if (locked) { openPremiumModal(true); return; }
              requestNavigation(s.id, `/subjects/${s.id}`);
            };
            return (
              <div key={s.id} onClick={handleClick}>
                <div
                  className={`relative rounded-2xl border p-5 cursor-pointer card-hover group h-full ${s.bg} ${s.border} animate-fade-in-up`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className={`text-base font-display font-bold ${s.text}`}>{s.label}</h2>
                        {free ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400">
                            Free
                          </span>
                        ) : locked ? (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                            <Crown size={9} /> Premium
                          </span>
                        ) : (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.iconBg} ${s.text} opacity-80`}>
                            {s.tag}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
                      {/* Live counts */}
                      <div className="flex items-center gap-3">
                        {c ? (
                          <>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                              <FolderOpen size={11} />
                              {c.folders} folder{c.folders !== 1 ? "s" : ""}
                            </span>
                            {resources > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                                <FileText size={10} />
                                {c.files > 0 && `${c.files} file${c.files !== 1 ? "s" : ""}`}
                                {c.files > 0 && c.lectures > 0 && " · "}
                                {c.lectures > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Video size={10} />
                                    {c.lectures} lecture{c.lectures !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/50 animate-pulse">Loading…</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className={`${s.text} opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info strip */}
        <div className="mt-8 bg-card border border-border rounded-2xl px-6 py-5 flex flex-wrap items-center gap-4 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BookOpen size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">All resources are free for enrolled students</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDFs, lecture recordings, DPPs and more — curated by your teachers.</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
