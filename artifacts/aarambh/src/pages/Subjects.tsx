import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, FlaskConical, Globe, Languages, Lock, Sigma } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { loadCourseTree, resolveDefaultCourseId, flattenCourseTree, ancestorChain, CourseNode } from "@/lib/courseEngine";
import { classifySubject, isFreeSubject, SubjectId, SUBJECT_META } from "@/lib/subjectRecognition";
import { usePremium } from "@/contexts/PremiumContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { useSubjectPopup } from "@/contexts/SubjectPopupContext";

const SUBJECTS: Array<{ id: Exclude<SubjectId, "other">; label: string; desc: string; icon: typeof BookOpen; gradient: string; soft: string }> = [
  { id: "maths", label: "Mathematics", desc: "Algebra, Geometry, Trigonometry and more", icon: Sigma, gradient: "from-blue-500 to-cyan-500", soft: "text-blue-600 bg-blue-500/10" },
  { id: "science", label: "Science", desc: "Physics, Chemistry and Biology", icon: FlaskConical, gradient: "from-emerald-500 to-teal-500", soft: "text-emerald-600 bg-emerald-500/10" },
  { id: "sst", label: "Social Science", desc: "History, Geography, Political Science and Economics", icon: Globe, gradient: "from-violet-500 to-purple-500", soft: "text-violet-600 bg-violet-500/10" },
  { id: "english", label: "English", desc: "Reading, Writing, Grammar and Literature", icon: BookOpen, gradient: "from-amber-500 to-orange-500", soft: "text-amber-600 bg-amber-500/10" },
  { id: "hindi", label: "Hindi", desc: "Hindi course content and study material", icon: Languages, gradient: "from-rose-500 to-pink-500", soft: "text-rose-600 bg-rose-500/10" },
];

function isLecture(node: CourseNode) {
  return /\b(lecture|lectures|video|videos|live class|live session|livestream|live)\b/i.test(`${node.title} ${node.type} ${node.fileType}`);
}

function subjectCounts(tree: CourseNode[]) {
  const counts: Record<string, { files: number; lectures: number }> = {};
  for (const subject of SUBJECTS) counts[subject.id] = { files: 0, lectures: 0 };
  for (const node of flattenCourseTree(tree)) {
    if (node.isFolder) continue;
    const context = ancestorChain(tree, node.entityId).map((n) => n.title);
    const subject = classifySubject([node.title, ...context].join(" "));
    if (subject in counts) {
      if (isLecture(node)) counts[subject].lectures++;
      else counts[subject].files++;
    }
  }
  return counts;
}

export default function Subjects() {
  const [, navigate] = useLocation();
  const { isPremium } = usePremium();
  const { isAdmin } = useAuth();
  const { requestNavigation } = useSubjectPopup();
  const { setOpen: openPremium } = usePremiumModal();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [tree, setTree] = useState<CourseNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    resolveDefaultCourseId("176")
      .then(async (id) => {
        if (!id) throw new Error("No course content is available yet.");
        const courseTree = await loadCourseTree(id);
        if (!alive) return;
        setCourseId(id); setTree(courseTree);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Unable to load subjects."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => subjectCounts(tree), [tree]);
  const visible = useMemo(() => SUBJECTS.filter((s) => counts[s.id]?.files || counts[s.id]?.lectures), [counts]);

  const openSubject = (id: SubjectId) => {
    if (!isFreeSubject(id) && !isPremium && !isAdmin) {
      openPremium(true);
      return;
    }
    requestNavigation(id, `/subjects/${id}`);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={15} /> Back to Home
        </button>
        <div className="mb-7">
          <h1 className="text-3xl font-display font-bold text-foreground">Subjects</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Your course library, organized automatically.</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">{[1,2,3,4].map((i)=><div key={i} className="h-36 rounded-3xl bg-card border border-border animate-pulse" />)}</div>
        ) : error ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{error}</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {visible.map((s, i) => {
              const Icon=s.icon; const c=counts[s.id]; const locked=!isFreeSubject(s.id)&&!isPremium&&!isAdmin;
              return <button key={s.id} onClick={()=>openSubject(s.id)} className="text-left rounded-3xl border border-border bg-card p-5 hover-lift animate-fade-in-up" style={{animationDelay:`${i*55}ms`}}>
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-sm`}><Icon size={22} className="text-white"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1"><h2 className="text-base font-bold">{s.label}</h2><span className={`text-[10px] font-bold px-2 py-1 rounded-full ${s.soft}`}>{locked?<><Lock size={9} className="inline mr-1"/>Premium</>:isFreeSubject(s.id)?"Free":"Premium"}</span></div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    <div className="mt-3 text-xs text-muted-foreground flex items-center gap-3"><span>{c.files} study items</span>{c.lectures>0&&<span>{c.lectures} lectures</span>}</div>
                  </div>
                  <ChevronRight size={17} className="text-muted-foreground mt-1"/>
                </div>
              </button>;
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-card p-4 text-xs text-muted-foreground">Content is updated from the active course library automatically. Hindi and English are free for everyone; other subjects use the existing premium access system.</div>
      </div>
    </Layout>
  );
}
