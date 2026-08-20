import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronLeft, ChevronRight, Crown, FileText, FolderOpen, Languages, Lock, Play, Search, Sigma, FlaskConical, Globe, X } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import GuestSignInModal from "@/components/GuestSignInModal";
import { CoursePlayer } from "@/components/CoursePlayer";
import { CourseNode, ancestorChain, flattenCourseTree, loadCourseTree } from "@/lib/courseEngine";
import { classifyChapter, classifySubject, isFreeSubject, SUBJECT_META, SubjectId, ENGLISH, SST } from "@/lib/subjectRecognition";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";

const META: Record<Exclude<SubjectId, "other">, { label: string; icon: typeof BookOpen; gradient: string; soft: string }> = {
  maths: { label: "Mathematics", icon: Sigma, gradient: "from-blue-500 to-cyan-500", soft: "bg-blue-500/10 text-blue-600" },
  science: { label: "Science", icon: FlaskConical, gradient: "from-emerald-500 to-teal-500", soft: "bg-emerald-500/10 text-emerald-600" },
  sst: { label: "Social Science", icon: Globe, gradient: "from-violet-500 to-purple-500", soft: "bg-violet-500/10 text-violet-600" },
  english: { label: "English", icon: BookOpen, gradient: "from-amber-500 to-orange-500", soft: "bg-amber-500/10 text-amber-600" },
  hindi: { label: "Hindi", icon: Languages, gradient: "from-rose-500 to-pink-500", soft: "bg-rose-500/10 text-rose-600" },
};

interface CourseContentViewProps { subject: SubjectId; courseId: string; }

type FileEntry = { node: CourseNode; subject: SubjectId; chapter: string; section?: string; context: string[] };

const isLecture = (node: CourseNode) => /\b(lecture|lectures|video|videos|live class|live session|livestream|live)\b/i.test(`${node.title} ${node.type} ${node.fileType}`) || /\.m3u8(?:$|\?)/i.test(node.resolvedUrl);
const isHls = (url: string) => /\.m3u8(?:$|\?)/i.test(url) || /m3u8/i.test(url);
const isPdf = (node: CourseNode) => node.fileType.toLowerCase() === "pdf" || /\.pdf(?:$|\?)/i.test(node.resolvedUrl);

export function CourseContentView({ subject, courseId }: CourseContentViewProps) {
  const [, navigate] = useLocation();
  const { user, isAdmin } = useAuth();
  const { isPremium } = usePremium();
  const { setOpen: openPremium } = usePremiumModal();
  const [tree, setTree] = useState<CourseNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activePlayer, setActivePlayer] = useState<{ url: string; title: string } | null>(null);
  const [pdf, setPdf] = useState<{ url: string; title: string } | null>(null);
  const [search, setSearch] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestAction, setGuestAction] = useState("view this content");
  const [path, setPath] = useState<CourseNode[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    loadCourseTree(courseId).then((value) => { if (active) setTree(value); }).catch((e) => { if (active) setError("Content is temporarily unavailable. Please try again."); console.error(e); }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [courseId]);

  const all = useMemo(() => flattenCourseTree(tree), [tree]);
  const accessible = isAdmin || isFreeSubject(subject) || isPremium;

  const subjectRoots = useMemo(() => {
    const direct = tree.filter((node) => classifySubject(node.title) === subject);
    if (direct.length) return direct;
    return tree.filter((node) => node.children.some((child) => classifySubject(child.title) === subject));
  }, [tree, subject]);

  const files: FileEntry[] = useMemo(() => {
    const result: FileEntry[] = [];
    for (const node of all) {
      if (node.isFolder) continue;
      if (!accessible && isLecture(node)) continue;
      const chain = ancestorChain(tree, node.entityId).slice(0, -1);
      const titles = chain.map((c) => c.title);
      const combined = [...titles, node.title].join(" ");
      const detected = classifySubject(combined);
      const effectiveSubject = detected === "other" ? subject : detected;
      if (effectiveSubject !== subject) continue;
      const match = classifyChapter(subject, node.title, titles);
      result.push({ node, subject, chapter: match.chapter, section: match.section, context: titles });
    }
    return result;
  }, [all, tree, subject, accessible]);
  const meta = META[subject];
  const Icon = meta.icon;

  const subjectsInPath = path.map((node) => node.title).filter(Boolean);
  const rootCategories = subjectRoots.flatMap((root) => root.children.length ? root.children : [root]);
  const currentChildren = (path.length ? path[path.length - 1].children : rootCategories)
    .filter((node) => accessible || !isLecture(node));

  const openPdfOrSignIn = (node: CourseNode) => {
    if (!user) { setGuestAction("view this file"); setGuestOpen(true); return; }
    if (!accessible) { openPremium(true); return; }
    if (isPdf(node) && node.resolvedUrl) setPdf({ url: node.resolvedUrl, title: node.title });
    else if (node.resolvedUrl) window.open(node.resolvedUrl, "_blank", "noopener,noreferrer");
  };

  const openLecture = (node: CourseNode) => {
    if (!user) { setGuestAction("play this lecture"); setGuestOpen(true); return; }
    if (!accessible) { openPremium(true); return; }
    if (!node.resolvedUrl) return;
    if (isHls(node.resolvedUrl)) setActivePlayer({ url: node.resolvedUrl, title: node.title });
    else window.open(node.resolvedUrl, "_blank", "noopener,noreferrer");
  };

  const folderSearch = search.trim().toLowerCase();
  const matchingFiles = folderSearch ? files.filter((f) => f.node.title.toLowerCase().includes(folderSearch)) : files;

  const chapters = useMemo(() => {
    const map = new Map<string, FileEntry[]>();
    for (const entry of matchingFiles) {
      const key = `${entry.section ?? ""}::${entry.chapter}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return map;
  }, [matchingFiles]);

  if (loading) return <Layout><div className="max-w-4xl mx-auto px-4 py-12"><div className="rounded-3xl border border-border bg-card p-8 text-center animate-pulse">Loading content…</div></div></Layout>;
  if (error) return <Layout><div className="max-w-4xl mx-auto px-4 py-12"><div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center text-sm text-muted-foreground">{error}</div></div></Layout>;

  const openFolder = (node: CourseNode) => setPath((prev) => [...prev, node]);
  const goUp = () => setPath((prev) => prev.slice(0, -1));
  const goHome = () => setPath([]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <button onClick={() => navigate("/subjects")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={15} /> Subjects
        </button>

        <section className="course-hero rounded-[28px] border border-border overflow-hidden mb-5">
          <div className={`bg-gradient-to-br ${meta.gradient} p-5 sm:p-7 text-white relative overflow-hidden`}>
            <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
            <div className="relative flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur"><Icon size={23} /></div>
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold tracking-[.18em] uppercase text-white/70">Course Content</p><h1 className="text-2xl sm:text-3xl font-black mt-1">{meta.label}</h1><p className="text-sm text-white/75 mt-1">Organized automatically from your course library.</p></div>
              {!isFreeSubject(subject) && <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/15 border border-white/15 text-xs font-bold"><Crown size={12} /> Premium</div>}
            </div>
          </div>
          <div className="bg-card px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
              <button onClick={goHome} className="hover:text-foreground">Home</button>
              {subjectsInPath.length > 0 && <><ChevronRight size={13} />{subjectsInPath.map((title, i)=><span key={`${title}-${i}`} className="inline-flex items-center gap-2"><span className={i===subjectsInPath.length-1?"text-foreground font-semibold":""}>{title}</span>{i<subjectsInPath.length-1&&<ChevronRight size={13}/>}</span>)}</>}
            </div>
            {path.length>0 && <button onClick={goUp} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-xs font-semibold"><ChevronLeft size={13}/>Back</button>}
          </div>
        </section>

        {path.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {currentChildren.map((node) => node.isFolder ? (
              <button key={node.entityId} onClick={() => openFolder(node)} className="text-left rounded-2xl border border-border bg-card p-4 hover-lift flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"><FolderOpen size={19} className="text-primary" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{node.title}</p><p className="text-xs text-muted-foreground mt-0.5">Open folder</p></div><ChevronRight size={16} className="text-muted-foreground" />
              </button>
            ) : (
              <button key={node.entityId} onClick={() => isLecture(node) ? openLecture(node) : openPdfOrSignIn(node)} className="text-left rounded-2xl border border-border bg-card p-4 hover-lift flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isLecture(node)?"bg-violet-500/10":"bg-red-500/10"}`}>{isLecture(node)?<Play size={18} className="text-violet-500" />:<FileText size={18} className="text-red-500" />}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{node.title}</p><p className="text-xs text-muted-foreground mt-0.5">{isLecture(node)?(accessible?"Lecture":"Premium lecture"):"Study material"}</p></div>{!accessible&& !isFreeSubject(subject)?<Lock size={15} className="text-amber-500"/>:<ChevronRight size={16} className="text-muted-foreground"/>}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search in this subject…" className="w-full pl-9 pr-4 py-3 rounded-2xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"/></div>
              <div className="px-4 py-3 rounded-2xl bg-card border border-border text-xs text-muted-foreground flex items-center justify-center">{files.length} items</div>
            </div>

            {currentChildren.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[.12em] mb-3">Categories</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {currentChildren.map((node) => <button key={node.entityId} onClick={() => openFolder(node)} className="text-left rounded-2xl border border-border bg-card p-4 hover-lift flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><FolderOpen size={18} className="text-primary"/></div><div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{node.title}</p><p className="text-xs text-muted-foreground mt-0.5">Explore</p></div><ChevronRight size={16} className="text-muted-foreground"/></button>)}
                </div>
              </div>
            )}

            {subject === "english" ? (
              <EnglishSections chapters={chapters} openSection={openSection} setOpenSection={setOpenSection} onOpen={(entry)=> isLecture(entry.node)?openLecture(entry.node):openPdfOrSignIn(entry.node)} accessible={accessible} />
            ) : subject === "sst" ? (
              <SstSections chapters={chapters} openSection={openSection} setOpenSection={setOpenSection} onOpen={(entry)=>isLecture(entry.node)?openLecture(entry.node):openPdfOrSignIn(entry.node)} accessible={accessible}/>
            ) : (
              <SimpleChapters subject={subject} chapters={chapters} openSection={openSection} setOpenSection={setOpenSection} onOpen={(entry)=>isLecture(entry.node)?openLecture(entry.node):openPdfOrSignIn(entry.node)} accessible={accessible}/>
            )}
          </>
        )}
      </div>

      <CoursePlayer src={activePlayer?.url ?? ""} title={activePlayer?.title ?? "Lecture"} open={!!activePlayer} onClose={()=>setActivePlayer(null)} />
      {pdf && <div className="fixed inset-0 z-[85] bg-black/80 flex items-center justify-center p-2 sm:p-5"><div className="hyperos-panel open bg-background w-full h-full sm:rounded-[28px] overflow-hidden flex flex-col"><div className="h-14 flex items-center gap-3 px-4 border-b border-border"><button onClick={()=>setPdf(null)} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center"><X size={16}/></button><p className="font-semibold text-sm truncate">{pdf.title}</p></div><iframe src={pdf.url} title={pdf.title} className="flex-1 w-full border-0 bg-white" /></div></div>}
      <GuestSignInModal open={guestOpen} onClose={()=>setGuestOpen(false)} action={guestAction} />
    </Layout>
  );
}

function FileLine({ entry, onOpen, accessible }: { entry: FileEntry; onOpen: () => void; accessible: boolean }) {
  const lecture = isLecture(entry.node);
  const locked = !accessible;
  return <button onClick={onOpen} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-secondary/30 transition-all">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${lecture?"bg-violet-500/10":"bg-red-500/10"}`}>{lecture?<Play size={17} className="text-violet-500"/>:<FileText size={17} className="text-red-500"/>}</div>
    <div className="min-w-0 flex-1"><p className="font-semibold text-sm truncate">{entry.node.title}</p><p className="text-xs text-muted-foreground mt-0.5">{lecture?(locked?"Premium lecture":"Lecture"):"PDF"}</p></div>
    {locked?<Lock size={15} className="text-amber-500"/>:<ChevronRight size={16} className="text-muted-foreground"/>}
  </button>;
}

function SimpleChapters({ subject, chapters, openSection, setOpenSection, onOpen, accessible }: { subject: SubjectId; chapters: Map<string, FileEntry[]>; openSection: string|null; setOpenSection: (v:string|null)=>void; onOpen:(entry:FileEntry)=>void; accessible:boolean }) {
  const ordered = subject === "science" ? SCI_ORDER : subject === "maths" ? MATH_ORDER : [...new Set([...chapters.values()].flat().map(x=>x.chapter))];
  return <div className="space-y-3"><h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[.12em]">Chapters</h2>{ordered.map((title,index)=>{const key=[...chapters.keys()].find(k=>k.endsWith(`::${title}`));const items=key?chapters.get(key)??[]:[];const open=openSection===`simple-${title}`;return <div key={title} className="rounded-2xl border border-border bg-card overflow-hidden"><button onClick={()=>setOpenSection(open?null:`simple-${title}`)} className="w-full text-left px-4 py-4 flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{index+1}</span><span className="font-bold text-sm flex-1">{title}</span><span className="text-xs text-muted-foreground">{items.length}</span><ChevronRight size={16} className={`text-muted-foreground transition-transform ${open?"rotate-90":""}`}/></button>{open&&<div className="p-3 pt-0 space-y-2">{items.length?items.map((entry)=><FileLine key={entry.node.entityId} entry={entry} onOpen={()=>onOpen(entry)} accessible={accessible}/>):<p className="text-xs text-muted-foreground italic px-2 py-3">No content yet.</p>}</div>}</div>})}</div>;
}

function EnglishSections({ chapters, openSection, setOpenSection, onOpen, accessible }: any) {
  const groups = [{label:"Reading", values:EN_ORDER_READING},{label:"Writing & Grammar", values:[...EN_ORDER_WRITING,...EN_ORDER_GRAMMAR]},{label:"Prose", values:EN_PROSE},{label:"Poetry", values:EN_POETRY},{label:"Supplementary", values:EN_SUPP}];
  return <div className="space-y-6"><h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[.12em]">English</h2>{groups.map((g:any)=><div key={g.label}><h3 className="text-sm font-bold mb-2">{g.label}</h3><SimpleChapterList titles={g.values} chapters={chapters} openSection={openSection} setOpenSection={setOpenSection} onOpen={onOpen} accessible={accessible} prefix={`en-${g.label}`}/></div>)}</div>;
}

function SstSections({ chapters, openSection, setOpenSection, onOpen, accessible }: any) { return <div className="space-y-5"><h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[.12em]">Social Science</h2>{Object.entries(SST).map(([section, titles])=><div key={section}><h3 className="text-sm font-bold mb-2">{section}</h3><SimpleChapterList titles={titles as string[]} chapters={chapters} openSection={openSection} setOpenSection={setOpenSection} onOpen={onOpen} accessible={accessible} prefix={`sst-${section}`}/></div>)}</div>; }
function SimpleChapterList({titles,chapters,openSection,setOpenSection,onOpen,accessible,prefix}:{titles:string[];chapters:Map<string,FileEntry[]>;openSection:string|null;setOpenSection:(v:string|null)=>void;onOpen:(e:FileEntry)=>void;accessible:boolean;prefix:string}){return <div className="space-y-2">{titles.map((title,index)=>{const key=[...chapters.keys()].find(k=>k.endsWith(`::${title}`));const items=key?chapters.get(key)??[]:[];const id=`${prefix}-${title}`;const open=openSection===id;return <div key={title} className="rounded-2xl border border-border bg-card overflow-hidden"><button onClick={()=>setOpenSection(open?null:id)} className="w-full text-left px-4 py-3.5 flex items-center gap-3"><span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">{index+1}</span><span className="font-semibold text-sm flex-1">{title}</span><span className="text-xs text-muted-foreground">{items.length}</span><ChevronRight size={15} className={`transition-transform ${open?"rotate-90":""}`}/></button>{open&&<div className="p-3 pt-0 space-y-2">{items.length?items.map((e)=><FileLine key={e.node.entityId} entry={e} onOpen={()=>onOpen(e)} accessible={accessible}/>):<p className="text-xs text-muted-foreground italic px-2 py-3">No content yet.</p>}</div>}</div>})}</div>}

const SCI_ORDER=["Chemical Reactions and Equations","Acids, Bases and Salts","Metals and Non-metals","Carbon and its Compounds","Life Processes","Control and Coordination","How do Organisms Reproduce?","Heredity","Light – Reflection and Refraction","The Human Eye and the Colourful World","Electricity","Magnetic Effects of Electric Current","Our Environment"];
const MATH_ORDER=["Real Numbers","Polynomials","Pair of Linear Equations in Two Variables","Quadratic Equations","Arithmetic Progressions","Triangles","Coordinate Geometry","Introduction to Trigonometry","Some Applications of Trigonometry","Circles","Areas Related to Circles","Surface Areas and Volumes","Statistics","Probability","Appendix A1 — Proofs in Mathematics","Appendix A2 — Mathematical Modelling"];
const EN_ORDER_READING=ENGLISH.reading; const EN_ORDER_WRITING=ENGLISH.writing; const EN_ORDER_GRAMMAR=ENGLISH.grammar; const EN_PROSE=ENGLISH.prose; const EN_POETRY=ENGLISH.poetry; const EN_SUPP=ENGLISH.supplementary;
