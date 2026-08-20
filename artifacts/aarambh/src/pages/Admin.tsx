import { useState, useEffect, useCallback, useRef } from "react";
import { SurveyManagerTab } from "@/pages/admin/SurveyManagerTab";
import { CoinManagerTab } from "@/pages/admin/CoinManagerTab";
import {
  collection, addDoc, deleteDoc, doc, serverTimestamp,
  getDocs, query, orderBy, updateDoc, onSnapshot, where, limit, setDoc, Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { usePremium, PREMIUM_PLANS } from "@/contexts/PremiumContext";
import { parseQuizHtml, type ParsedQuiz } from "@/lib/parseQuizHtml";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, FileText, FolderOpen, Bell, Youtube, Trash2,
  Settings, Plus, CheckCircle, ExternalLink, ChevronUp,
  ChevronDown, Pencil, Check, X, BookOpen, MessageSquare,
  Mail, Eye, ArrowRight, RefreshCw, Video, CheckSquare,
  Crown, Clock, User, AlertCircle, Tag, Wrench, ToggleLeft, ToggleRight, Gift, Search,
  Image as ImageIcon, Upload, Layers, FileQuestion, Link2, Globe, Sigma, Languages, Star,
  FlaskConical, ToggleLeft as ToggleOff, Sparkles, BarChart2, ChevronRight, Smartphone, Monitor, Brain,
  ClipboardList, Coins,
} from "lucide-react";

/* ─── constants ──────────────────────────────────────────── */
const DEFAULT_SUBJECTS = [
  { id: "maths",   name: "Maths",   slug: "maths",   color: "#3b82f6" },
  { id: "science", name: "Science", slug: "science", color: "#10b981" },
  { id: "sst",     name: "SST",     slug: "sst",     color: "#8b5cf6" },
  { id: "english", name: "English", slug: "english", color: "#f59e0b" },
  { id: "hindi",   name: "Hindi",   slug: "hindi",   color: "#ef4444" },
  { id: "it",      name: "Information & Technology", slug: "it",  color: "#06b6d4" },
  { id: "ai",      name: "Artificial Intelligence",  slug: "ai",  color: "#6366f1" },
];
const SUBJECTS = ["maths", "science", "sst", "english", "hindi", "it", "ai"];

/* ─── url field with optional image preview ──────────────── */
function UrlField({ label, value, onChange, placeholder, hint, showPreview }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; showPreview?: boolean;
}) {
  const isImg = showPreview && value.trim() &&
    /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(value.trim());
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      {hint && <p className="text-[11px] text-muted-foreground mb-1">{hint}</p>}
      <Input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "https://…"} className="h-9 text-sm" />
      {isImg && (
        <img src={value} alt="preview"
          className="mt-1.5 rounded-xl max-h-28 object-contain border border-border bg-muted"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
    </div>
  );
}

/* ─── inline editable item row ───────────────────────────── */
function ItemRow({ item, labelField, onDelete, onMoveUp, onMoveDown, canMove, extraInfo }: {
  item: Record<string, string | undefined>;
  labelField: string;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMove?: boolean;
  extraInfo?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item[labelField] ?? "");
  const { toast } = useToast();

  const saveEdit = async () => {
    if (!val.trim()) return;
    const collName = item._collection as string;
    const itemId = item.id as string;
    if (collName && itemId) {
      await updateDoc(doc(db, collName, itemId), { [labelField]: val.trim() });
      toast({ title: "Renamed" });
    }
    setEditing(false);
  };

  return (
    <div className="bg-secondary/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
      {canMove && (
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onMoveUp} disabled={!onMoveUp}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5 rounded">
            <ChevronUp size={12} />
          </button>
          <button onClick={onMoveDown} disabled={!onMoveDown}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5 rounded">
            <ChevronDown size={12} />
          </button>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input value={val} onChange={(e) => setVal(e.target.value)} className="h-7 text-xs" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }} />
            <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground truncate">{item[labelField] ?? item.id}</p>
            {extraInfo && <p className="text-[10px] text-muted-foreground">{extraInfo}</p>}
          </div>
        )}
      </div>
      {item.link && !editing && (
        <button onClick={() => window.open(item.link, "_blank")} className="text-primary hover:text-primary/80 flex-shrink-0">
          <ExternalLink size={12} />
        </button>
      )}
      {!editing && (
        <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <Pencil size={12} />
        </button>
      )}
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ─── ordered list manager ────────────────────────────────── */
function OrderedList({ collectionName, labelField, filterField, filterValue, refresh }: {
  collectionName: string; labelField: string;
  filterField?: string; filterValue?: string; refresh: number;
}) {
  type AdminItem = { id: string; _collection: string; order?: string; [key: string]: string | undefined };
  const [items, setItems] = useState<AdminItem[]>([]);
  const { toast } = useToast();

  const load = useCallback(() => {
    const base = filterField && filterValue
      ? getDocs(query(collection(db, collectionName), where(filterField, "==", filterValue)))
      : getDocs(collection(db, collectionName));
    base.then((snap) => {
      const raw: AdminItem[] = snap.docs.map((d) => ({ id: d.id, _collection: collectionName, ...(d.data() as Record<string, string>) }));
      raw.sort((a, b) => (Number(a.order) || 999) - (Number(b.order) || 999));
      setItems(raw);
    }).catch(() => {});
  }, [collectionName, filterField, filterValue]);

  useEffect(() => { load(); }, [load, refresh]);

  const reorder = async (fromIdx: number, toIdx: number) => {
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItems(next);
    await Promise.all(next.map((item, i) => updateDoc(doc(db, collectionName, item.id), { order: i })));
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, collectionName, id));
    toast({ title: "Deleted" });
    load();
  };

  if (!items.length) return <p className="text-xs text-muted-foreground py-4 text-center">Nothing here yet.</p>;

  return (
    <div className="space-y-1.5 mt-3">
      {items.map((item, i) => (
        <ItemRow key={item.id} item={item} labelField={labelField} canMove
          onMoveUp={i > 0 ? () => reorder(i, i - 1) : undefined}
          onMoveDown={i < items.length - 1 ? () => reorder(i, i + 1) : undefined}
          onDelete={() => handleDelete(item.id)}
          extraInfo={item.subject ? `Subject: ${item.subject}` : item.folderId ? `Folder: ${item.folderId}` : undefined}
        />
      ))}
    </div>
  );
}

/* ─── shared wrappers ─────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
      <h3 className="font-display font-semibold text-foreground text-sm">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      <Input {...props} className="h-9 text-sm" />
    </div>
  );
}

/* ─── subjects tab ────────────────────────────────────────── */
function SubjectsTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [form, setForm] = useState({ name: "", slug: "", color: "#3b82f6" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const add = async () => {
    if (!form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    await addDoc(collection(db, "subjects"), { ...form, order: 999, createdAt: serverTimestamp() });
    toast({ title: "Subject added" });
    setForm({ name: "", slug: "", color: "#3b82f6" });
    bump();
    setSaving(false);
  };

  return (
    <>
      <Section title="Add New Subject">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Display Name" placeholder="e.g. Physics" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="Slug (URL)" placeholder="e.g. physics" value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })} />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Color</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent" />
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 text-sm font-mono" />
            </div>
          </div>
        </div>
        <Button disabled={saving || !form.name || !form.slug} onClick={add} className="gap-2">
          <Plus size={14} /> Add Subject
        </Button>
      </Section>

      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Default Subjects</p>
        <div className="space-y-1.5">
          {DEFAULT_SUBJECTS.map((s) => (
            <div key={s.id} className="bg-secondary/40 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <p className="text-sm font-medium text-foreground flex-1">{s.name}</p>
              <span className="text-xs text-muted-foreground font-mono">/{s.slug}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Default</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Custom Subjects</p>
        <OrderedList collectionName="subjects" labelField="name" refresh={refresh} />
      </div>
    </>
  );
}

/* ─── folders tab ─────────────────────────────────────────── */
function FoldersTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [form, setForm]       = useState({ name: "", subject: "__unset__", parentId: "none" });
  const [saving, setSaving]   = useState(false);
  const [filterSubject, setFilterSubject] = useState("all");
  const [existingFolders, setExistingFolders] = useState<{ id: string; name: string; subject: string }[]>([]);
  const { toast } = useToast();

  // Load folders when subject changes (for parent selection)
  useEffect(() => {
    if (!form.subject || form.subject === "__unset__") { setExistingFolders([]); return; }
    getDocs(query(collection(db, "lecture_folders"), where("subject", "==", form.subject))).then((snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; subject: string; parentFolderId?: string }));
      // All folders can be parents — unlimited nesting depth supported
      setExistingFolders(all);
    }).catch(() => {});
  }, [form.subject]);

  const add = async () => {
    if (!form.name.trim() || !form.subject || form.subject === "__unset__") return;
    setSaving(true);
    await addDoc(collection(db, "lecture_folders"), {
      name: form.name.trim(),
      subject: form.subject,
      parentFolderId: form.parentId === "none" ? "" : form.parentId,
      order: 999,
      createdAt: serverTimestamp(),
    });
    toast({ title: form.parentId === "none" ? "Folder created" : "Sub-folder created" });
    setForm({ name: "", subject: form.subject, parentId: "none" });
    bump();
    setSaving(false);
  };

  return (
    <>
      <Section title="Create Folder / Sub-folder">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Folder Name" placeholder="e.g. Chapter 1 — Motion" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Subject</Label>
            <Select value={form.subject === "__unset__" ? undefined : form.subject} onValueChange={(v) => setForm({ ...form, subject: v, parentId: "none" })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select subject" /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Parent folder (optional — creates a sub-folder) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">
            Parent Folder <span className="text-muted-foreground font-normal">(optional — creates a sub-folder inside it)</span>
          </Label>
          <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}
            disabled={!form.subject || form.subject === "__unset__"}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No parent (root folder)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">📂 No parent — root folder</SelectItem>
              {existingFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>📁 Inside: {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button disabled={saving || !form.name || !form.subject || form.subject === "__unset__"} onClick={add} className="gap-2">
          <Plus size={14} /> {form.parentId !== "none" ? "Create Sub-folder" : "Create Folder"}
        </Button>
      </Section>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Manage Folders</p>
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <OrderedList
          collectionName="lecture_folders" labelField="name"
          filterField={filterSubject !== "all" ? "subject" : undefined}
          filterValue={filterSubject !== "all" ? filterSubject : undefined}
          refresh={refresh}
        />
      </div>
    </>
  );
}

/* ─── resources tab ───────────────────────────────────────── */
function ResourcesTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [tab, setTab]           = useState<"file" | "lecture" | "organize">("file");
  const [file, setFile]         = useState({ name: "", link: "", subject: "__unset__", folderId: "none", category: "", thumbnail: "" });
  const [lecture, setLecture]   = useState({ title: "", subject: "__unset__", folderId: "none", hlsUrl: "", category: "", thumbnail: "", isPremium: false });
  const [folders, setFolders]   = useState<{ id: string; name: string; subject: string; parentFolderId?: string }[]>([]);
  const [saving, setSaving]     = useState(false);
  const [filterSubj, setFilterSubj] = useState("all");
  const { toast } = useToast();

  // Load folders for the currently selected subject
  useEffect(() => {
    const s = tab === "file" ? file.subject : lecture.subject;
    if (!s || s === "__unset__") { setFolders([]); return; }
    getDocs(query(collection(db, "lecture_folders"), where("subject", "==", s))).then((snap) => {
      setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; subject: string; parentFolderId?: string })));
    }).catch(() => {});
  }, [tab, file.subject, lecture.subject]);

  const saveFile = async () => {
    if (!file.name || !file.subject || file.subject === "__unset__" || !file.link) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "files"), {
        ...file, subject: file.subject, folderId: file.folderId === "none" ? "" : file.folderId,
        order: 999, createdAt: serverTimestamp(),
      });
      toast({ title: "File added" });
      setFile({ name: "", link: "", subject: "__unset__", folderId: "none", category: "", thumbnail: "" });
      bump();
    } finally { setSaving(false); }
  };

  const saveLecture = async () => {
    if (!lecture.title || !lecture.subject || lecture.subject === "__unset__") return;
    setSaving(true);
    try {
      await addDoc(collection(db, "lectures"), {
        ...lecture, subject: lecture.subject, folderId: lecture.folderId === "none" ? "" : lecture.folderId,
        isPremium: lecture.isPremium,
        order: 999, createdAt: serverTimestamp(),
      });
      toast({ title: lecture.isPremium ? "Premium Lecture added ⭐" : "Lecture added" });
      setLecture({ title: "", subject: "__unset__", folderId: "none", hlsUrl: "", category: "", thumbnail: "", isPremium: false });
      bump();
    } finally { setSaving(false); }
  };

  // Group folders: show flat with parent info (filter out empty IDs to avoid Radix Select error)
  const allFolderOptions = folders.filter((f) => !!f.id).map((f) => ({
    id: f.id,
    label: f.parentFolderId && f.parentFolderId !== ""
      ? `  ↳ ${f.name}` : f.name,
  }));

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["file", "lecture", "organize"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}>
            {t === "file" ? "📄 File / PDF" : t === "lecture" ? "🎬 Lecture" : "📂 Organize"}
          </button>
        ))}
      </div>

      {tab === "file" && (
        <Section title="Add Study File">
          <Field label="File Name" placeholder="e.g. Motion — Chapter Notes" value={file.name}
            onChange={(e) => setFile({ ...file, name: e.target.value })} />
          <UrlField label="File URL (PDF, Google Drive, Dropbox, etc.)" value={file.link}
            onChange={(v) => setFile({ ...file, link: v })}
            placeholder="https://drive.google.com/file/d/…"
            hint="Paste any direct link — PDF, Google Drive, Dropbox, Cloudinary, Firebase Storage, etc." />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Subject</Label>
              <Select value={file.subject === "__unset__" ? undefined : file.subject} onValueChange={(v) => setFile({ ...file, subject: v, folderId: "none" })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Folder (optional)</Label>
              <Select value={file.folderId} onValueChange={(v) => setFile({ ...file, folderId: v })} disabled={!file.subject || file.subject === "__unset__"}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {allFolderOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field label="Category" placeholder="Notes / DPP / Assignment / Module / Test" value={file.category}
            onChange={(e) => setFile({ ...file, category: e.target.value })} />
          <UrlField label="Thumbnail URL (optional)" value={file.thumbnail}
            onChange={(v) => setFile({ ...file, thumbnail: v })} placeholder="https://…/thumbnail.jpg" showPreview />
          <Button disabled={saving || !file.name || !file.subject || file.subject === "__unset__" || !file.link} onClick={saveFile} className="w-full gap-2">
            <Plus size={14} /> {saving ? "Saving…" : "Add File"}
          </Button>
        </Section>
      )}

      {tab === "lecture" && (
        <Section title="Add Lecture">
          <Field label="Title" placeholder="e.g. Motion — Lesson 1" value={lecture.title}
            onChange={(e) => setLecture({ ...lecture, title: e.target.value })} />
          <UrlField label="Video URL (HLS .m3u8, MP4, etc.)" value={lecture.hlsUrl}
            onChange={(v) => setLecture({ ...lecture, hlsUrl: v })}
            placeholder="https://…/stream.m3u8 or https://…/video.mp4"
            hint="Paste any video link — HLS stream, direct MP4, or hosted video URL." />
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Subject</Label>
              <Select value={lecture.subject === "__unset__" ? undefined : lecture.subject} onValueChange={(v) => setLecture({ ...lecture, subject: v, folderId: "none" })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground/80">Folder (optional)</Label>
              <Select value={lecture.folderId} onValueChange={(v) => setLecture({ ...lecture, folderId: v })} disabled={!lecture.subject || lecture.subject === "__unset__"}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No folder" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No folder</SelectItem>
                  {allFolderOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Field label="Category" placeholder="e.g. Chapter 1, Revision" value={lecture.category}
            onChange={(e) => setLecture({ ...lecture, category: e.target.value })} />
          <UrlField label="Thumbnail URL (optional)" value={lecture.thumbnail}
            onChange={(v) => setLecture({ ...lecture, thumbnail: v })} placeholder="https://…/thumbnail.jpg" showPreview />
          <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
            <input type="checkbox" checked={lecture.isPremium}
              onChange={(e) => setLecture({ ...lecture, isPremium: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">⭐ Mark as Premium Lecture</span>
            <span className="text-xs text-muted-foreground">(only visible to premium users)</span>
          </label>
          <Button disabled={saving || !lecture.title || !lecture.subject || lecture.subject === "__unset__"} onClick={saveLecture}
            className={`w-full gap-2 ${lecture.isPremium ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}`}>
            <Plus size={14} /> {saving ? "Saving…" : lecture.isPremium ? "Add Premium Lecture ⭐" : "Add Lecture"}
          </Button>
        </Section>
      )}

      {tab === "organize" && <OrganizeSection refresh={refresh} bump={bump} />}

      {tab !== "organize" && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Manage {tab === "file" ? "Files" : "Lectures"}
            </p>
            <Select value={filterSubj} onValueChange={setFilterSubj}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Filter" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <OrderedList
            collectionName={tab === "file" ? "files" : "lectures"}
            labelField={tab === "file" ? "name" : "title"}
            filterField={filterSubj !== "all" ? "subject" : undefined}
            filterValue={filterSubj !== "all" ? filterSubj : undefined}
            refresh={refresh}
          />
        </div>
      )}
    </>
  );
}

/* ─── organize section: move existing files/lectures to folder ─ */
function OrganizeSection({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [subject, setSubject]   = useState("__unset__");
  const [kind, setKind]         = useState<"files" | "lectures">("files");
  const [items, setItems]       = useState<{ id: string; label: string; folderId: string }[]>([]);
  const [folders, setFolders]   = useState<{ id: string; name: string; parentFolderId?: string }[]>([]);
  const [loading, setLoading]   = useState(false);
  const [pending, setPending]   = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    if (!subject || subject === "__unset__") return;
    setLoading(true);
    try {
      const [resSnap, folderSnap] = await Promise.all([
        getDocs(query(collection(db, kind), where("subject", "==", subject))),
        getDocs(query(collection(db, "lecture_folders"), where("subject", "==", subject))),
      ]);
      const labelField = kind === "files" ? "name" : "title";
      setItems(resSnap.docs.map((d) => ({
        id: d.id,
        label: (d.data()[labelField] as string) ?? d.id,
        folderId: (d.data().folderId as string) ?? "",
      })));
      setFolders(folderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; name: string; parentFolderId?: string })));
      setPending({});
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [subject, kind, refresh]);

  const move = async (itemId: string) => {
    const newFolderId = pending[itemId] ?? "";
    setSaving(itemId);
    try {
      await updateDoc(doc(db, kind, itemId), { folderId: newFolderId === "none" ? "" : newFolderId });
      toast({ title: "Moved successfully" });
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, folderId: newFolderId === "none" ? "" : newFolderId } : i));
      setPending((p) => { const n = { ...p }; delete n[itemId]; return n; });
      bump();
    } finally { setSaving(null); }
  };

  const applyAll = async () => {
    const entries = Object.entries(pending);
    if (!entries.length) return;
    setApplyingAll(true);
    try {
      await Promise.all(
        entries.map(([itemId, newFolderId]) =>
          updateDoc(doc(db, kind, itemId), { folderId: newFolderId === "none" ? "" : newFolderId }),
        ),
      );
      toast({ title: `${entries.length} item(s) moved successfully` });
      setPending({});
      await load();
      bump();
    } finally { setApplyingAll(false); }
  };

  const folderName = (id: string) => {
    if (!id) return "No folder";
    const f = folders.find((f) => f.id === id);
    return f ? f.name : id;
  };

  const folderOptions = folders.filter((f) => !!f.id).map((f) => ({
    id: f.id,
    label: f.parentFolderId && f.parentFolderId !== "" ? `  ↳ ${f.name}` : f.name,
  }));

  return (
    <div className="space-y-4">
      <Section title="Move Existing Files / Lectures to a Folder">
        <p className="text-xs text-muted-foreground -mt-2">
          Select a subject and type, then re-assign each item to any folder or sub-folder.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Subject</Label>
            <Select value={subject === "__unset__" ? undefined : subject} onValueChange={setSubject}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pick a subject" /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Type</Label>
            <div className="flex gap-2 h-9 items-center">
              {(["files", "lectures"] as const).map((k) => (
                <button key={k} onClick={() => setKind(k)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    kind === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}>
                  {k === "files" ? <><FileText size={11} /> Files</> : <><Video size={11} /> Lectures</>}
                </button>
              ))}
              <button onClick={load} className="ml-auto text-muted-foreground hover:text-foreground" title="Refresh">
                <RefreshCw size={13} />
              </button>
            </div>
          </div>
        </div>
      </Section>

      {loading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}

      {!loading && subject && subject !== "__unset__" && items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">No {kind} found for {subject}.</p>
      )}

      {!loading && items.length > 0 && (
        <div>
          {Object.keys(pending).length > 0 && (
            <div className="mb-3 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-foreground">
                {Object.keys(pending).length} change(s) pending
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                  onClick={() => setPending({})} disabled={applyingAll}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1.5"
                  onClick={applyAll} disabled={applyingAll}>
                  <CheckSquare size={12} />
                  {applyingAll ? "Applying…" : `Apply ${Object.keys(pending).length} Change(s)`}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => {
              const selectedFolder = pending[item.id] ?? (item.folderId || "none");
              const changed = pending[item.id] !== undefined;
              return (
                <div key={item.id} className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm transition-colors ${changed ? "border-primary/40 bg-primary/3" : "border-border"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">Currently: {folderName(item.folderId)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select value={selectedFolder}
                      onValueChange={(v) => setPending((p) => ({ ...p, [item.id]: v }))}>
                      <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No folder</SelectItem>
                        {folderOptions.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {changed && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Pending change" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── announcements tab ───────────────────────────────────── */
function AnnouncementsTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [ann, setAnn] = useState({ title: "", message: "", imageUrl: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!ann.title || !ann.message) return;
    setSaving(true);
    await addDoc(collection(db, "announcements"), { ...ann, createdAt: serverTimestamp() });
    toast({ title: "Announcement posted!" });
    setAnn({ title: "", message: "", imageUrl: "" });
    bump();
    setSaving(false);
  };

  return (
    <>
      <Section title="Post Announcement">
        <Field label="Title" placeholder="e.g. Exam Schedule Released" value={ann.title}
          onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Message</Label>
          <Textarea placeholder="Write your announcement…" rows={4} value={ann.message}
            onChange={(e) => setAnn({ ...ann, message: e.target.value })} className="text-sm resize-none" />
        </div>
        <UrlField label="Banner Image URL (optional)" value={ann.imageUrl}
          onChange={(v) => setAnn({ ...ann, imageUrl: v })} placeholder="https://…/banner.jpg"
          hint="Paste an image URL — shown above the announcement text." showPreview />
        <Button disabled={saving || !ann.title || !ann.message} onClick={save} className="w-full gap-2">
          <Plus size={14} /> Post Announcement
        </Button>
      </Section>
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Posted Announcements</p>
        <OrderedList collectionName="announcements" labelField="title" refresh={refresh} />
      </div>
    </>
  );
}

/* ─── youtube tab ─────────────────────────────────────────── */
function YouTubeTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [yt, setYt] = useState({ name: "", url: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!yt.name || !yt.url) return;
    setSaving(true);
    await addDoc(collection(db, "yt_channels"), { ...yt, createdAt: serverTimestamp() });
    toast({ title: "Channel added!" });
    setYt({ name: "", url: "" });
    bump();
    setSaving(false);
  };

  return (
    <>
      <Section title="Add YouTube Channel">
        <Field label="Channel Name" placeholder="e.g. NextToppers Maths" value={yt.name}
          onChange={(e) => setYt({ ...yt, name: e.target.value })} />
        <Field label="Channel URL" placeholder="https://youtube.com/@channelname" value={yt.url}
          onChange={(e) => setYt({ ...yt, url: e.target.value })} />
        <p className="text-xs text-muted-foreground -mt-2">Full YouTube channel URL — videos load via API automatically.</p>
        <Button disabled={saving || !yt.name || !yt.url} onClick={save} className="gap-2">
          <Plus size={14} /> Add Channel
        </Button>
      </Section>
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Channels</p>
        <OrderedList collectionName="yt_channels" labelField="name" refresh={refresh} />
      </div>
    </>
  );
}

/* ─── chat moderation tab ─────────────────────────────────── */
function ChatModerationTab() {
  const [messages, setMessages] = useState<{ id: string; message: string; senderName: string; senderId: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "communityMessages"), orderBy("createdAt", "desc"), limit(60));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; message: string; senderName: string; senderId: string })));
    }, () => {});
  }, []);

  const deleteMsg = async (id: string) => {
    await deleteDoc(doc(db, "communityMessages", id));
    toast({ title: "Message deleted" });
  };

  return (
    <div className="space-y-4">
      <Section title="Community Chat Moderation">
        <p className="text-xs text-muted-foreground">Showing latest 60 messages. You can delete any message.</p>
      </Section>
      <div className="space-y-2">
        {messages.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No community messages yet.</p>}
        {messages.map((m) => (
          <div key={m.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-muted-foreground mb-0.5">{m.senderName}</p>
              <p className="text-sm text-foreground">{m.message}</p>
            </div>
            <button onClick={() => deleteMsg(m.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── contact queries tab (Firestore-backed) ─────────────── */
function ContactQueriesTab() {
  interface ContactRow {
    id: string; name: string; email: string; subject?: string;
    message: string; createdAt: { seconds: number } | null; status: string;
  }
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "resolved">("all");
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(db, "contactMessages"), orderBy("createdAt", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactRow)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const markStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "contactMessages", id), { status }).catch(() => {});
    toast({ title: status === "resolved" ? "Marked as resolved" : "Reopened" });
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this query? Cannot be undone.")) return;
    await deleteDoc(doc(db, "contactMessages", id)).catch(() => {});
    toast({ title: "Deleted" });
  };

  const timeStr = (ts: { seconds: number } | null) => {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const filtered = contacts.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="space-y-4">
      <Section title="Contact Form Queries">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "resolved"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${
                filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/40"
              }`}>
              {f} ({f === "all" ? contacts.length : contacts.filter((c) => c.status === f).length})
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Real-time from Firestore. Showing latest 100 queries.</p>
      </Section>

      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-6 py-10 text-center">
          <Mail size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} queries.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-foreground text-sm">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={c.status === "resolved" ? "default" : "secondary"} className="text-[10px]">
                    {c.status === "resolved" ? "✓ resolved" : "pending"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{timeStr(c.createdAt)}</span>
                </div>
              </div>
              {c.subject && <p className="text-xs font-semibold text-foreground mb-1">Re: {c.subject}</p>}
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{c.message}</p>
              <div className="flex items-center gap-2">
                {c.status !== "resolved" ? (
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => markStatus(c.id, "resolved")}>
                    <CheckCircle size={11} /> Mark Resolved
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="gap-1.5 h-7 text-xs text-muted-foreground" onClick={() => markStatus(c.id, "pending")}>
                    <Eye size={11} /> Reopen
                  </Button>
                )}
                <a href={`mailto:${c.email}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline h-7 px-2">
                  <Mail size={11} /> Reply via email
                </a>
                <button onClick={() => del(c.id)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── branding tab ────────────────────────────────────────── */
function BrandingTab({ bump }: { bump: () => void }) {
  const [brand, setBrand] = useState({ siteName: "Next Toppers - Feed", logoUrl: "", faviconUrl: "", bannerUrl: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    await addDoc(collection(db, "branding"), { ...brand, createdAt: serverTimestamp() });
    toast({ title: "Branding saved!" });
    setSaving(false);
    bump();
  };

  return (
    <>
      <Section title="Site Branding">
        <Field label="Site Name" value={brand.siteName} onChange={(e) => setBrand({ ...brand, siteName: e.target.value })} />
        <UrlField label="Logo URL (square PNG/SVG)" value={brand.logoUrl}
          onChange={(v) => setBrand({ ...brand, logoUrl: v })} placeholder="https://…/logo.png"
          hint="Appears in sidebar, header, login page." showPreview />
        <UrlField label="Homepage Banner URL" value={brand.bannerUrl}
          onChange={(v) => setBrand({ ...brand, bannerUrl: v })} placeholder="https://…/banner.jpg" showPreview />
        <UrlField label="Favicon URL" value={brand.faviconUrl}
          onChange={(v) => setBrand({ ...brand, faviconUrl: v })} placeholder="https://…/favicon.ico" />
        <Button className="gap-2" disabled={saving} onClick={save}>
          <Plus size={14} /> Save Branding
        </Button>
      </Section>
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mt-4">
        <p className="text-sm font-semibold text-foreground mb-3">Current Logo</p>
        <div className="flex items-center gap-3">
          <img src={brand.logoUrl || "/logo.png"} alt="logo" className="w-12 h-12 rounded-xl object-cover border border-border" />
          <div>
            <p className="text-sm font-bold">Next Toppers – Feed</p>
            <p className="text-xs text-muted-foreground">Aarambh Batch 2026–27</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── screenshot preview with zoom modal ─────────────────── */
function ScreenshotPreview({ base64, url }: { base64?: string; url?: string }) {
  const [zoomed, setZoomed] = useState(false);
  const src = base64 || url;
  if (!src) return null;
  return (
    <>
      <button
        onClick={() => setZoomed(true)}
        className="mt-2 block rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors"
        style={{ maxWidth: 200 }}
      >
        <img src={src} alt="Payment screenshot" className="w-full h-auto max-h-28 object-cover" />
        <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground flex items-center gap-1 bg-secondary/60">
          <Eye size={9} /> Tap to view full screenshot
        </div>
      </button>
      {zoomed && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomed(false)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            >
              <X size={14} />
            </button>
            <img src={src} alt="Payment screenshot" className="w-full rounded-2xl shadow-2xl" />
            <p className="text-center text-white/40 text-xs mt-2">Tap outside to close</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── premium tab ─────────────────────────────────────────── */
interface PremiumRequest {
  id: string;
  uid: string;
  userName: string;
  userPhoto?: string | null;
  plan: "day" | "month";
  price: number;
  transactionId: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: { seconds: number } | null;
  // New payment fields
  originalAmount?: number;
  finalAmount?: number;
  couponCode?: string;
  utr?: string;
  screenshotBase64?: string;
  screenshotUrl?: string;
}
interface PremiumUser {
  uid: string;
  plan: "day" | "month";
  isPremium?: boolean;
  startTime: { seconds: number } | null;
  expiryTime: { seconds: number } | null;
  grantedBy?: string;
}

function fmtDate(ts: { seconds: number } | null) {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function PremiumTab() {
  const { toast } = useToast();
  const { grantPremium, revokePremium, approvePremiumRequest, rejectPremiumRequest } = usePremium();

  const [requests, setRequests] = useState<PremiumRequest[]>([]);
  const [contactRequests, setContactRequests] = useState<PremiumRequest[]>([]);
  const [activeUsers, setActiveUsers] = useState<PremiumUser[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loadingReq, setLoadingReq] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  // Grant free premium state
  const [grantUid, setGrantUid] = useState("");
  const [grantPlan, setGrantPlan] = useState<"day" | "month">("month");
  const [granting, setGranting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected" | "today" | "month" | "all">("pending");
  const [txnSearch, setTxnSearch] = useState("");

  // Load requests from premiumRequests (works after rules deployment)
  useEffect(() => {
    const q = query(collection(db, "premiumRequests"), orderBy("createdAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumRequest)));
      setLoadingReq(false);
    }, () => setLoadingReq(false));
    return unsub;
  }, []);

  // Also load from contactMessages fallback (works with current rules always)
  useEffect(() => {
    const q = query(
      collection(db, "contactMessages"),
      where("type", "==", "payment_proof"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsub = onSnapshot(q, (snap) => {
      setContactRequests(
        snap.docs.map((d) => ({ id: `contact_${d.id}`, ...d.data() } as PremiumRequest)),
      );
    }, () => {});
    return unsub;
  }, []);

  // Load active premium users in realtime — filter out revoked (isPremium: false)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "premiumUsers"), (pSnap) => {
      setActiveUsers(pSnap.docs.map((d) => d.data() as PremiumUser).filter(u => u.isPremium !== false));
      setLoadingUsers(false);
    }, () => setLoadingUsers(false));
    return unsub;
  }, []);

  // Load user names once (and refresh when actioning/granting)
  useEffect(() => {
    getDocs(collection(db, "users")).then((uSnap) => {
      const names: Record<string, string> = {};
      uSnap.docs.forEach((d) => { const u = d.data(); names[u.uid] = u.name ?? u.uid; });
      setUserNames(names);
    }).catch(() => {});
  }, [actioning, granting]);

  const handleApprove = async (req: PremiumRequest) => {
    setActioning(req.id);
    try {
      if (req.id.startsWith("contact_")) {
        const contactId = req.id.replace("contact_", "");
        await updateDoc(doc(db, "contactMessages", contactId), { status: "approved", reviewedAt: serverTimestamp() });
        await grantPremium(req.uid, req.plan, 0);
      } else {
        await approvePremiumRequest(req.id, req.uid, req.plan);
        // Update payment history status — clear screenshot to save storage
        await updateDoc(doc(db, "premiumRequests", req.id), {
          status: "approved",
          reviewedAt: serverTimestamp(),
          screenshotBase64: "",
        });
      }
      toast({ title: "✅ Premium approved", description: `${req.userName} gets ${req.plan} plan.` });
    } catch { toast({ title: "Error approving request", variant: "destructive" }); }
    finally { setActioning(null); }
  };

  const handleReject = async (req: PremiumRequest) => {
    if (!window.confirm(`Reject payment proof from ${req.userName}?`)) return;
    setActioning(req.id);
    try {
      if (req.id.startsWith("contact_")) {
        const contactId = req.id.replace("contact_", "");
        await updateDoc(doc(db, "contactMessages", contactId), { status: "rejected", reviewedAt: serverTimestamp() });
      } else {
        await rejectPremiumRequest(req.id);
        // Update payment history status — clear screenshot to save storage
        await updateDoc(doc(db, "premiumRequests", req.id), {
          status: "rejected",
          reviewedAt: serverTimestamp(),
          screenshotBase64: "",
        });
      }
      toast({ title: "Rejected", description: `${req.userName}'s request was rejected.` });
    } catch { toast({ title: "Error rejecting request", variant: "destructive" }); }
    finally { setActioning(null); }
  };

  const handleRevoke = async (uid: string) => {
    const name = userNames[uid] ?? uid;
    if (!window.confirm(`Revoke premium from ${name}?`)) return;
    setActioning(uid);
    try {
      await revokePremium(uid);
      setActiveUsers((p) => p.filter((u) => u.uid !== uid));
      toast({ title: "Premium revoked", description: `${name}'s premium removed.` });
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setActioning(null); }
  };

  const handleGrant = async () => {
    if (!grantUid.trim()) return;
    setGranting(true);
    try {
      await grantPremium(grantUid.trim(), grantPlan, 0);
      toast({ title: "Premium granted!", description: `${grantPlan} plan activated for ${grantUid.trim()}.` });
      setGrantUid("");
    } catch { toast({ title: "Error granting premium", variant: "destructive" }); }
    finally { setGranting(false); }
  };

  // Merge premiumRequests + contactMessages fallback (deduplicate by transactionId)
  const allRequests = [...requests, ...contactRequests].reduce<PremiumRequest[]>((acc, req) => {
    if (req.transactionId) {
      const dup = acc.find(r => r.transactionId === req.transactionId && r.uid === req.uid);
      if (dup) return acc;
    }
    return [...acc, req];
  }, []).sort((a, b) => {
    const aTs = (a.createdAt as { seconds?: number })?.seconds ?? 0;
    const bTs = (b.createdAt as { seconds?: number })?.seconds ?? 0;
    return bTs - aTs;
  });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const shownRequests = allRequests.filter((r) => {
    // Status filter
    if (filterStatus === "pending"  && r.status !== "pending")  return false;
    if (filterStatus === "approved" && r.status !== "approved") return false;
    if (filterStatus === "rejected" && r.status !== "rejected") return false;
    if (filterStatus === "today") {
      const ts = (r.createdAt as { seconds?: number })?.seconds ?? 0;
      if (new Date(ts * 1000) < todayStart) return false;
    }
    if (filterStatus === "month") {
      const ts = (r.createdAt as { seconds?: number })?.seconds ?? 0;
      if (new Date(ts * 1000) < monthStart) return false;
    }
    // TXN / name / email / UTR search
    if (txnSearch.trim()) {
      const q = txnSearch.trim().toLowerCase();
      const txn   = ((r as any).txnId ?? "").toLowerCase();
      const name  = (r.userName ?? "").toLowerCase();
      const email = ((r as any).userEmail ?? "").toLowerCase();
      const utr   = ((r as any).utr ?? r.transactionId ?? "").toLowerCase();
      if (!txn.includes(q) && !name.includes(q) && !email.includes(q) && !utr.includes(q)) return false;
    }
    return true;
  });

  const statusBadge = (s: string) => {
    if (s === "pending")  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 border border-amber-500/20">PENDING</span>;
    if (s === "approved") return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">APPROVED</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/20">REJECTED</span>;
  };

  return (
    <div className="space-y-6">

      {/* ── Grant Free Premium ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Crown size={15} className="text-amber-500" />
          </div>
          <h3 className="font-display font-bold text-foreground">Grant Free Premium</h3>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs mb-1.5 block">User UID</Label>
            <Input
              value={grantUid}
              onChange={(e) => setGrantUid(e.target.value)}
              placeholder="Paste Firebase UID here"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Plan</Label>
            <Select value={grantPlan} onValueChange={(v) => setGrantPlan(v as "day" | "month")}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">₹3 / 1 Day</SelectItem>
                <SelectItem value="month">₹39 / 1 Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 mb-3">
          Grant starts immediately (no delay). Find UID in Firebase Auth console.
        </p>
        <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleGrant} disabled={!grantUid.trim() || granting}>
          <Crown size={13} /> {granting ? "Granting…" : "Grant Premium Now"}
        </Button>
      </div>

      {/* ── Pending Requests ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <AlertCircle size={15} className="text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Payment Requests</h3>
                {allRequests.filter((r) => r.status === "pending").length > 0 && (
                  <span className="text-xs text-amber-600 font-semibold">
                    {allRequests.filter((r) => r.status === "pending").length} pending
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* TXN Search bar */}
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              placeholder="Search by TXN ID, name, email, or UTR…"
              className="pl-8 h-9 text-xs font-mono"
            />
            {txnSearch && (
              <button onClick={() => setTxnSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            )}
          </div>
          {/* Filter chips */}
          <div className="flex gap-1 flex-wrap">
            {(["pending", "approved", "rejected", "today", "month", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilterStatus(f)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                  filterStatus === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}>
                {f === "pending" ? "Pending" : f === "approved" ? "Approved" : f === "rejected" ? "Rejected" : f === "today" ? "Today" : f === "month" ? "This Month" : "All"}
              </button>
            ))}
          </div>
        </div>

        {loadingReq ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : shownRequests.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle size={28} className="text-emerald-500/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No {filterStatus === "pending" ? "pending" : ""} requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shownRequests.map((req) => (
              <div key={req.id} className="border border-border rounded-xl p-4">
                <div className="flex items-start gap-3">
                  {req.userPhoto
                    ? <img src={req.userPhoto} alt={req.userName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">{req.userName.charAt(0)}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm text-foreground">{req.userName}</p>
                      {statusBadge(req.status)}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Crown size={10} className="text-amber-500" />
                        {req.plan === "day" ? `₹${(req as any).finalAmount ?? 3} / 1 Day` : `₹${(req as any).finalAmount ?? 39} / 1 Month`}{(req as any).couponCode ? ` (Coupon: ${(req as any).couponCode})` : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(req.createdAt)}
                      </span>
                    </div>
                    {(req as any).txnId && (
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-semibold text-muted-foreground">TXN:</span>
                        <code className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-400 font-bold">{(req as any).txnId}</code>
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-muted-foreground">UTR:</span>
                      <code className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded text-foreground/80">{(req as any).utr || req.transactionId || "—"}</code>
                    </div>
                    {(req.screenshotBase64 || req.screenshotUrl || (req as any).screenshotURL) && (
                      <ScreenshotPreview
                        base64={req.screenshotBase64}
                        url={req.screenshotUrl || (req as any).screenshotURL}
                      />
                    )}
                    {req.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{req.note}"</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60 flex-wrap">
                  {req.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className="gap-1.5 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleApprove(req)}
                        disabled={actioning === req.id}
                      >
                        <Check size={11} /> {actioning === req.id ? "Approving…" : "Approve"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8 text-xs border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleReject(req)}
                        disabled={actioning === req.id}
                      >
                        <X size={11} /> Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => {
                      sessionStorage.setItem("nt_open_chat", JSON.stringify({
                        uid: req.uid,
                        name: req.userName,
                        photo: req.userPhoto ?? null,
                        role: "student",
                      }));
                      window.location.href = "/chat";
                    }}
                  >
                    <MessageSquare size={11} /> Open Chat
                  </Button>
                  {req.status === "pending" && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Activates immediately on approval
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active Premium Users ── */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <User size={15} className="text-emerald-600" />
          </div>
          <h3 className="font-display font-bold text-foreground">
            Active Premium Users
            {activeUsers.length > 0 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">({activeUsers.length})</span>
            )}
          </h3>
        </div>

        {loadingUsers ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 bg-secondary rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="py-8 text-center">
            <Crown size={24} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No active premium users yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeUsers.map((pu) => {
              const expired = pu.expiryTime ? new Date(pu.expiryTime.seconds * 1000) < new Date() : false;
              return (
                <div key={pu.uid} className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Crown size={14} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{userNames[pu.uid] ?? pu.uid}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${expired ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600"}`}>
                        {expired ? "EXPIRED" : pu.plan === "day" ? "DAILY" : "MONTHLY"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      {pu.startTime && <span>Start: {fmtDate(pu.startTime)}</span>}
                      {pu.expiryTime && <span className={expired ? "text-red-400" : ""}>Expiry: {fmtDate(pu.expiryTime)}</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7 text-[10px] border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
                    onClick={() => handleRevoke(pu.uid)}
                    disabled={actioning === pu.uid}
                  >
                    <X size={10} /> {actioning === pu.uid ? "…" : "Revoke"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── members / subscription management tab ───────────────── */
function MembersTab() {
  const { getAllMembers, grantPremium, revokePremium, extendPremium, setPremiumWithDates } = usePremium();
  const { toast } = useToast();
  const [members, setMembers] = useState<Awaited<ReturnType<typeof getAllMembers>>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "premium" | "expired" | "free">("all");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editActivatedAt, setEditActivatedAt] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPlan, setEditPlan] = useState<"day" | "month">("month");

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await getAllMembers();
      setMembers(data);
    } catch {
      toast({ title: "Failed to load members", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMembers(); }, []);

  const filtered = members.filter((m) => {
    const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()) || m.uid.includes(search);
    if (!matchSearch) return false;
    if (filter === "premium") return m.isPremium;
    if (filter === "free") return !m.isPremium && (!m.expiresAt || m.expiresAt > new Date() === false);
    if (filter === "expired") return !m.isPremium && m.expiresAt !== null;
    return true;
  });

  const activateUser = async (uid: string, plan: "day" | "month") => {
    setActing(uid);
    try {
      await grantPremium(uid, plan);
      toast({ title: "Premium activated!" });
      await loadMembers();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(null); }
  };

  const deactivateUser = async (uid: string) => {
    if (!window.confirm("Deactivate premium for this user?")) return;
    setActing(uid);
    try {
      await revokePremium(uid);
      toast({ title: "Premium deactivated" });
      await loadMembers();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(null); }
  };

  const extendUser = async (uid: string) => {
    const days = parseInt(extendDays[uid] ?? "7", 10);
    if (isNaN(days) || days < 1) { toast({ title: "Enter valid days", variant: "destructive" }); return; }
    setActing(uid);
    try {
      await extendPremium(uid, days);
      toast({ title: `Extended by ${days} day${days !== 1 ? "s" : ""}` });
      await loadMembers();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(null); }
  };

  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const openEdit = (m: typeof members[0]) => {
    setEditTarget(m.uid);
    setEditPlan(m.planType ?? "month");
    setEditActivatedAt(m.activatedAt ? toLocalISO(m.activatedAt) : toLocalISO(new Date()));
    setEditExpiresAt(m.expiresAt ? toLocalISO(m.expiresAt) : toLocalISO(new Date(Date.now() + 30 * 864e5)));
    setEditNotes(m.adminNotes ?? "");
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setActing(editTarget);
    try {
      await setPremiumWithDates(editTarget, editPlan, new Date(editActivatedAt), new Date(editExpiresAt), editNotes, "admin");
      toast({ title: "Membership updated!" });
      setEditTarget(null);
      await loadMembers();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setActing(null); }
  };

  const EXTEND_PRESETS = [1, 7, 15, 30];

  const counts = {
    all: members.length,
    premium: members.filter((m) => m.isPremium).length,
    expired: members.filter((m) => !m.isPremium && m.expiresAt !== null).length,
    free: members.filter((m) => !m.isPremium && m.expiresAt === null).length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
            <Crown size={18} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base">Subscription Management</h3>
            <p className="text-xs text-muted-foreground">Manage premium memberships for all users</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadMembers} className="ml-auto gap-1.5 h-8 text-xs">
            <RefreshCw size={11} /> Refresh
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(["all", "premium", "expired", "free"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:border-primary/40"}`}>
              {f} ({counts[f]})
            </button>
          ))}
        </div>

        {/* Search */}
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or UID…"
          className="h-9 text-sm" />
      </div>

      {/* Members List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-secondary rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl px-6 py-12 text-center">
          <User size={28} className="text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} members found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div key={m.uid} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              {/* Top row */}
              <div className="flex items-center gap-3 mb-3">
                {m.photoURL ? (
                  <img src={m.photoURL} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {(m.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-semibold text-sm text-foreground">{m.name ?? "Unknown"}</p>
                    {m.isPremium ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[9px] font-bold border border-amber-500/25">
                        <Crown size={8} /> PREMIUM
                      </span>
                    ) : m.expiresAt ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-bold border border-red-500/25">EXPIRED</span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[9px] font-medium border border-border">FREE</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                  {m.isPremium && m.expiresAt && (
                    <p className={`text-[10px] mt-0.5 font-medium ${m.daysRemaining <= 3 ? "text-orange-500" : "text-muted-foreground"}`}>
                      {m.daysRemaining === 0 ? "Expires today" : `${m.daysRemaining} day${m.daysRemaining !== 1 ? "s" : ""} left`}
                      {" · "}Expires {m.expiresAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                    </p>
                  )}
                  {m.adminNotes && (
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5 italic">"{m.adminNotes}"</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {editTarget === m.uid ? (
                <div className="border border-border rounded-xl p-3.5 space-y-3 bg-secondary/40">
                  <p className="text-xs font-bold text-foreground">Edit Membership</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Plan</Label>
                      <select value={editPlan} onChange={(e) => setEditPlan(e.target.value as "day" | "month")}
                        className="w-full h-8 text-xs border border-border rounded-lg px-2 bg-background text-foreground">
                        <option value="month">Monthly</option>
                        <option value="day">Daily</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Admin Notes</Label>
                      <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Optional note" className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Activated At</Label>
                      <Input type="datetime-local" value={editActivatedAt} onChange={(e) => setEditActivatedAt(e.target.value)} className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground mb-1 block">Expires At</Label>
                      <Input type="datetime-local" value={editExpiresAt} onChange={(e) => setEditExpiresAt(e.target.value)} className="h-8 text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={acting === m.uid} className="gap-1.5 h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white">
                      <Check size={11} /> {acting === m.uid ? "Saving…" : "Save"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(null)} className="h-8 text-xs">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {!m.isPremium ? (
                    <>
                      <Button size="sm" onClick={() => activateUser(m.uid, "month")} disabled={acting === m.uid}
                        className="gap-1.5 h-7 text-[11px] bg-amber-500 hover:bg-amber-600 text-white">
                        <Crown size={10} /> {acting === m.uid ? "…" : "Activate Monthly"}
                      </Button>
                      <Button size="sm" onClick={() => activateUser(m.uid, "day")} disabled={acting === m.uid}
                        className="gap-1.5 h-7 text-[11px] bg-amber-400 hover:bg-amber-500 text-white">
                        <Crown size={10} /> 1 Day
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => deactivateUser(m.uid)} disabled={acting === m.uid}
                      className="gap-1.5 h-7 text-[11px] border-red-300 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                      <X size={10} /> {acting === m.uid ? "…" : "Deactivate"}
                    </Button>
                  )}

                  {/* Extend */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {EXTEND_PRESETS.map((d) => (
                      <Button key={d} size="sm" variant="outline" onClick={() => { setExtendDays({ ...extendDays, [m.uid]: String(d) }); extendPremium(m.uid, d).then(loadMembers); }}
                        disabled={acting === m.uid}
                        className="h-7 text-[10px] px-2 border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30">
                        +{d}d
                      </Button>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input value={extendDays[m.uid] ?? ""} onChange={(e) => setExtendDays({ ...extendDays, [m.uid]: e.target.value })}
                        placeholder="days" className="h-7 w-14 text-[11px] px-2" />
                      <Button size="sm" variant="outline" onClick={() => extendUser(m.uid)} disabled={acting === m.uid}
                        className="h-7 text-[10px] px-2">
                        +
                      </Button>
                    </div>
                  </div>

                  <Button size="sm" variant="outline" onClick={() => openEdit(m)}
                    className="h-7 text-[10px] ml-auto gap-1 border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/30">
                    <Pencil size={10} /> Edit Subscription
                  </Button>
                </div>
              )}

              <p className="text-[9px] text-muted-foreground/40 mt-2 font-mono">{m.uid}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── premium lectures manager tab ───────────────────────────── */
const PREMIUM_SUBJECTS = ["maths", "science", "sst"] as const;
type PremiumSubject = typeof PREMIUM_SUBJECTS[number];
const SUBJECT_LABELS: Record<PremiumSubject, string> = { maths: "Maths", science: "Science", sst: "SST" };

function PremiumLecturesTab({ refresh, bump }: { refresh: number; bump: () => void }) {
  const [activeSubject, setActiveSubject] = useState<PremiumSubject>("maths");
  const [form, setForm] = useState({ title: "", hlsUrl: "", thumbnail: "", category: "", description: "", folderId: "" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", hlsUrl: "", thumbnail: "", category: "", description: "", folderId: "" });
  const [lectures, setLectures] = useState<{ id: string; title: string; hlsUrl?: string; thumbnail?: string; category?: string; description?: string; order?: number; folderId?: string }[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [subjectFolders, setSubjectFolders] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();

  const loadLectures = useCallback(async () => {
    setLoadingLectures(true);
    try {
      const snap = await getDocs(query(
        collection(db, "lectures"),
        where("subject", "==", activeSubject),
        where("isPremium", "==", true),
      ));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; title: string; hlsUrl?: string; thumbnail?: string; category?: string; description?: string; order?: number; folderId?: string }));
      items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      setLectures(items);
    } finally { setLoadingLectures(false); }
  }, [activeSubject]);

  const loadFolders = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "lecture_folders"), where("subject", "==", activeSubject))).catch(() => null);
    if (snap) setSubjectFolders(snap.docs.map((d) => ({ id: d.id, name: (d.data() as any).name ?? d.id })));
    else setSubjectFolders([]);
  }, [activeSubject]);

  useEffect(() => { loadLectures(); loadFolders(); }, [loadLectures, loadFolders, refresh]);

  const addLecture = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const { folderId, ...rest } = form;
      await addDoc(collection(db, "lectures"), {
        ...rest,
        subject: activeSubject,
        folderId: folderId || "",
        isPremium: true,
        order: lectures.length,
        createdAt: serverTimestamp(),
      });
      toast({ title: "⭐ Premium lecture added!" });
      setForm({ title: "", hlsUrl: "", thumbnail: "", category: "", description: "", folderId: "" });
      await loadLectures();
      bump();
    } finally { setSaving(false); }
  };

  const startEdit = (lect: typeof lectures[0]) => {
    setEditId(lect.id);
    setEditForm({ title: lect.title, hlsUrl: lect.hlsUrl ?? "", thumbnail: lect.thumbnail ?? "", category: lect.category ?? "", description: lect.description ?? "", folderId: lect.folderId ?? "" });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const { folderId, ...rest } = editForm;
      await updateDoc(doc(db, "lectures", editId), { ...rest, folderId: folderId || "", updatedAt: serverTimestamp() });
      toast({ title: "Lecture updated" });
      setEditId(null);
      await loadLectures();
    } finally { setSaving(false); }
  };

  const deleteLecture = async (id: string) => {
    if (!window.confirm("Delete this premium lecture?")) return;
    await deleteDoc(doc(db, "lectures", id));
    toast({ title: "Deleted" });
    await loadLectures();
    bump();
  };

  const moveUp = async (i: number) => {
    if (i === 0) return;
    const next = [...lectures];
    const [a, b] = [next[i - 1], next[i]];
    await Promise.all([
      updateDoc(doc(db, "lectures", a.id), { order: i }),
      updateDoc(doc(db, "lectures", b.id), { order: i - 1 }),
    ]);
    await loadLectures();
  };

  const moveDown = async (i: number) => {
    if (i === lectures.length - 1) return;
    const next = [...lectures];
    const [a, b] = [next[i], next[i + 1]];
    await Promise.all([
      updateDoc(doc(db, "lectures", a.id), { order: i + 1 }),
      updateDoc(doc(db, "lectures", b.id), { order: i }),
    ]);
    await loadLectures();
  };

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="relative rounded-2xl overflow-hidden p-5 shadow-sm"
        style={{ background: "linear-gradient(135deg, #0f1623 0%, #1a1f35 100%)", border: "1px solid rgba(251,191,36,0.2)" }}>
        <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
          style={{ background: "radial-gradient(circle at 80% 20%, rgba(251,191,36,0.12) 0%, transparent 60%)" }} />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 16px rgba(245,158,11,0.3)" }}>
            <Crown size={18} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Premium Lectures Manager</p>
            <p className="text-white/50 text-xs">Upload and manage exclusive premium content for Maths, Science & SST</p>
          </div>
        </div>
      </div>

      {/* Subject selector */}
      <div className="flex gap-2 flex-wrap">
        {PREMIUM_SUBJECTS.map((s) => (
          <button key={s} onClick={() => setActiveSubject(s)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              activeSubject === s
                ? "text-white border-amber-500/50"
                : "bg-card border-border text-muted-foreground hover:border-amber-500/30 hover:text-foreground"
            }`}
            style={activeSubject === s ? { background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 4px 12px rgba(245,158,11,0.25)" } : {}}>
            {SUBJECT_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Add lecture form */}
      <Section title={`Add Premium Lecture — ${SUBJECT_LABELS[activeSubject]}`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Lecture Title *" placeholder="e.g. Chapter 1 — Motion Basics" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Field label="Category / Chapter" placeholder="e.g. Chapter 1" value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </div>
        {/* Folder assignment */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">
            Folder <span className="text-muted-foreground font-normal">(optional — organises lectures into sections)</span>
          </Label>
          <Select value={form.folderId || "__none__"} onValueChange={(v) => setForm({ ...form, folderId: v === "__none__" ? "" : v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No folder (uncategorized)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">📂 No folder — uncategorized</SelectItem>
              {subjectFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>📁 {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subjectFolders.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No folders for {SUBJECT_LABELS[activeSubject]} yet — create them in the Folders tab first.</p>
          )}
        </div>
        <UrlField label="Video URL (HLS .m3u8, MP4, YouTube, etc.)" value={form.hlsUrl}
          onChange={(v) => setForm({ ...form, hlsUrl: v })}
          placeholder="https://…/stream.m3u8 or https://youtube.com/…"
          hint="Paste any video link — HLS stream, direct MP4, or YouTube." />
        <UrlField label="Thumbnail URL (optional)" value={form.thumbnail}
          onChange={(v) => setForm({ ...form, thumbnail: v })}
          placeholder="https://…/thumb.jpg" showPreview />
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Description (optional)</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description of this lecture…" className="h-16 text-sm resize-none" />
        </div>
        <Button
          disabled={saving || !form.title.trim()}
          onClick={addLecture}
          className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white">
          <Plus size={14} /> {saving ? "Adding…" : `Add Premium Lecture to ${SUBJECT_LABELS[activeSubject]}`}
        </Button>
      </Section>

      {/* Lecture list */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-bold text-foreground text-sm">
              {SUBJECT_LABELS[activeSubject]} Premium Lectures
              {lectures.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">({lectures.length})</span>}
            </p>
            <p className="text-[11px] text-muted-foreground">Visible only to premium subscribers</p>
          </div>
          <Button size="sm" variant="outline" onClick={loadLectures} className="h-7 text-xs gap-1.5">
            <RefreshCw size={11} /> Refresh
          </Button>
        </div>

        {loadingLectures ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}</div>
        ) : lectures.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #f59e0b22, #d9770622)" }}>
              <Crown size={20} className="text-amber-500/50" />
            </div>
            <p className="text-sm text-muted-foreground">No premium lectures for {SUBJECT_LABELS[activeSubject]} yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Add one above to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lect, i) => (
              <div key={lect.id} className="border border-amber-500/15 rounded-xl overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0f162388 0%, #1a1f3588 100%)" }}>
                {editId === lect.id ? (
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-bold text-amber-400">Edit Lecture</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-white/60 mb-1 block">Title *</Label>
                        <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          placeholder="Lecture title" className="h-8 text-xs bg-white/5 border-white/10 text-white" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-white/60 mb-1 block">Category</Label>
                        <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          placeholder="Chapter name" className="h-8 text-xs bg-white/5 border-white/10 text-white" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/60 mb-1 block">Folder</Label>
                      <Select value={editForm.folderId || "__none__"} onValueChange={(v) => setEditForm({ ...editForm, folderId: v === "__none__" ? "" : v })}>
                        <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10 text-white"><SelectValue placeholder="No folder" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">📂 No folder</SelectItem>
                          {subjectFolders.map((f) => (
                            <SelectItem key={f.id} value={f.id}>📁 {f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/60 mb-1 block">Video URL</Label>
                      <Input value={editForm.hlsUrl} onChange={(e) => setEditForm({ ...editForm, hlsUrl: e.target.value })}
                        placeholder="https://…" className="h-8 text-xs bg-white/5 border-white/10 text-white" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-white/60 mb-1 block">Thumbnail URL</Label>
                      <Input value={editForm.thumbnail} onChange={(e) => setEditForm({ ...editForm, thumbnail: e.target.value })}
                        placeholder="https://…" className="h-8 text-xs bg-white/5 border-white/10 text-white" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={saving}
                        className="gap-1.5 h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                        <Check size={11} /> {saving ? "Saving…" : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditId(null)}
                        className="h-8 text-xs border-white/10 text-white/70">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button onClick={() => moveUp(i)} disabled={i === 0}
                        className="text-white/30 hover:text-white/70 disabled:opacity-20 p-0.5 rounded transition-colors">
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => moveDown(i)} disabled={i === lectures.length - 1}
                        className="text-white/30 hover:text-white/70 disabled:opacity-20 p-0.5 rounded transition-colors">
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden"
                      style={{ background: "linear-gradient(135deg, #f59e0b33, #d9770622)" }}>
                      {lect.thumbnail
                        ? <img src={lect.thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <div className="w-full h-full flex items-center justify-center"><Crown size={14} className="text-amber-400/60" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm font-semibold truncate">{lect.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {lect.category && <span className="text-[10px] text-amber-400/70">{lect.category}</span>}
                        {lect.folderId && subjectFolders.find(f => f.id === lect.folderId) && (
                          <span className="text-[10px] text-white/40">📁 {subjectFolders.find(f => f.id === lect.folderId)?.name}</span>
                        )}
                        {lect.hlsUrl && <span className="text-[10px] text-white/30">· Video linked</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(lect)}
                        className="h-7 w-7 p-0 text-white/50 hover:text-white hover:bg-white/10">
                        <Pencil size={12} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteLecture(lect.id)}
                        className="h-7 w-7 p-0 text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── admin dashboard overview ───────────────────────────── */
function DashboardTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [stats, setStats] = useState({
    subjects: 0, folders: 0, premiumLectures: 0, members: 0,
    activePremium: 0, resources: 0, tests: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentActivity, setRecentActivity] = useState<{ id: string; type: string; title: string; sub: string; time: { seconds: number } | null }[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [subjectsSnap, foldersSnap, premiumSnap, usersSnap, filesSnap, testsSnap] = await Promise.all([
          getDocs(collection(db, "subjects")),
          getDocs(collection(db, "lecture_folders")),
          getDocs(query(collection(db, "lectures"), where("isPremium", "==", true))),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "files")),
          getDocs(collection(db, "tests")).catch(() => ({ size: 0 })),
        ]);
        setStats({
          subjects: subjectsSnap.size + DEFAULT_SUBJECTS.length,
          folders: foldersSnap.size,
          premiumLectures: premiumSnap.size,
          members: usersSnap.size,
          activePremium: 0,
          resources: filesSnap.size,
          tests: (testsSnap as any).size ?? 0,
        });
      } catch { /* non-fatal */ }
      finally { setLoadingStats(false); }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const q  = query(collection(db, "lectures"),     orderBy("createdAt", "desc"), limit(3));
    const q2 = query(collection(db, "announcements"),orderBy("createdAt", "desc"), limit(2));
    const q3 = query(collection(db, "users"),        orderBy("createdAt", "desc"), limit(2));
    Promise.all([getDocs(q).catch(() => null), getDocs(q2).catch(() => null), getDocs(q3).catch(() => null)])
      .then(([ls, as, us]) => {
        const items: typeof recentActivity = [];
        ls?.docs.forEach(d => { const dat = d.data(); items.push({ id: d.id, type: "lecture", title: dat.title ?? "New resource uploaded", sub: dat.subject ?? "", time: dat.createdAt ?? null }); });
        as?.docs.forEach(d => { const dat = d.data(); items.push({ id: d.id, type: "alert",   title: "New alert sent",                      sub: dat.title ?? "to all users",          time: dat.createdAt ?? null }); });
        us?.docs.forEach(d => { const dat = d.data(); items.push({ id: d.id, type: "member",  title: "New member joined",                    sub: dat.name ?? dat.email ?? "",          time: dat.createdAt ?? null }); });
        items.sort((a, b) => (b.time?.seconds ?? 0) - (a.time?.seconds ?? 0));
        setRecentActivity(items.slice(0, 6));
      });
  }, []);

  const timeAgoAdmin = (ts: { seconds: number } | null) => {
    if (!ts?.seconds) return "recently";
    const diff = Math.floor(Date.now() / 1000) - ts.seconds;
    if (diff < 60)    return "Just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const Num = ({ v }: { v: number | string }) =>
    loadingStats
      ? <div className="h-7 w-12 bg-muted/50 rounded-lg animate-pulse" />
      : <p className="text-2xl font-black text-foreground leading-none">{typeof v === "number" && v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}</p>;

  const QUICK_CATEGORIES = [
    {
      label: "CONTENT",
      color: "#3b82f6",
      items: [
        { label: "Subjects",          icon: BookOpen,    tab: "subjects",         color: "#3b82f6" },
        { label: "Resources",         icon: FileText,    tab: "resources",        color: "#10b981" },
        { label: "Folders",           icon: FolderOpen,  tab: "folders",          color: "#f59e0b" },
        { label: "Tests",             icon: CheckSquare, tab: "tests",            color: "#ef4444" },
        { label: "Premium\nLectures", icon: Video,       tab: "premium-lectures", color: "#8b5cf6" },
      ],
    },
    {
      label: "COMMUNICATION",
      color: "#f97316",
      items: [
        { label: "Alerts",   icon: Bell,          tab: "announcements", color: "#f97316" },
        { label: "YouTube",  icon: Youtube,       tab: "youtube",       color: "#ef4444" },
        { label: "Chat",     icon: MessageSquare, tab: "chat",          color: "#3b82f6" },
        { label: "Queries",  icon: Mail,          tab: "contacts",      color: "#10b981" },
        { label: "Polls",    icon: BarChart2,     tab: "resources",     color: "#8b5cf6" },
      ],
    },
    {
      label: "GROWTH",
      color: "#10b981",
      items: [
        { label: "Coupons", icon: Tag,      tab: "coupons",  color: "#10b981" },
        { label: "Popups",  icon: Sparkles, tab: "popups",   color: "#f59e0b" },
        { label: "Banners", icon: ImageIcon,tab: "banners",  color: "#f97316" },
      ],
    },
    {
      label: "SYSTEM",
      color: "#6b7280",
      items: [
        { label: "Maintenance", icon: Wrench,   tab: "maintenance", color: "#6b7280" },
        { label: "Users",       icon: User,     tab: "members",     color: "#06b6d4" },
        { label: "Settings",    icon: Settings, tab: "branding",    color: "#8b5cf6" },
      ],
    },
  ];

  const ACT_ICONS: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
    lecture: { icon: Video,    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    alert:   { icon: Bell,     color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    member:  { icon: User,     color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    coupon:  { icon: Tag,      color: "#ef4444", bg: "rgba(239,68,68,0.12)"  },
  };

  return (
    <div className="space-y-5 pb-20">

      {/* ── TOP METRIC CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Subjects",         value: stats.subjects,        icon: BookOpen,   tab: "subjects",         accent: "#3b82f6" },
          { label: "Folders",          value: stats.folders,         icon: FolderOpen, tab: "folders",          accent: "#10b981" },
          { label: "Premium Lectures", value: stats.premiumLectures, icon: Video,      tab: "premium-lectures", accent: "#8b5cf6" },
          { label: "Members",          value: stats.members,         icon: User,       tab: "members",          accent: "#f97316" },
        ].map(({ label, value, icon: Icon, tab, accent }) => (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className="group text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5 active:scale-[0.97]"
            style={{
              background: "hsl(var(--card))",
              border: `1.5px solid ${accent}30`,
              boxShadow: `0 2px 12px ${accent}0d`,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
            >
              <Icon size={18} style={{ color: accent }} />
            </div>
            <Num v={value} />
            <p className="text-[11px] text-muted-foreground font-medium mt-1">{label}</p>
            <p
              className="text-[10px] font-bold mt-2 flex items-center gap-0.5 group-hover:gap-1 transition-all"
              style={{ color: accent }}
            >
              View all <ChevronRight size={10} />
            </p>
          </button>
        ))}
      </div>

      {/* ── QUICK ACCESS ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-black text-foreground">Quick Access</p>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Pencil size={12} /> Edit
          </button>
        </div>

        <div className="p-4 space-y-5">
          {QUICK_CATEGORIES.map((cat) => (
            <div key={cat.label}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{cat.label}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {cat.items.map(({ label, icon: Icon, tab, color }) => (
                  <button
                    key={tab + label}
                    onClick={() => onNavigate(tab)}
                    className="flex flex-col items-center gap-2 p-2.5 rounded-xl transition-all hover:-translate-y-0.5 active:scale-95"
                    style={{
                      background: `${color}0d`,
                      border: `1px solid ${color}25`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}18` }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <p className="text-[10px] font-bold text-center leading-tight" style={{ color: "hsl(var(--foreground))" }}>
                      {label.split("\n").map((l, i) => <span key={i} className="block">{l}</span>)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW ANALYTICS ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-black text-foreground">Overview</p>
          <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-lg border border-border bg-secondary/40">This Month</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {[
            { label: "Users Active",    value: stats.members,         trend: "+18.6%", trendColor: "#10b981", icon: User,       accent: "#3b82f6" },
            { label: "Resources Added", value: stats.resources,       trend: "+12.5%", trendColor: "#10b981", icon: FileText,   accent: "#10b981" },
            { label: "Tests Created",   value: stats.tests,           trend: "+7.2%",  trendColor: "#10b981", icon: CheckSquare,accent: "#8b5cf6" },
            { label: "Queries Solved",  value: stats.activePremium,   trend: "+22.1%", trendColor: "#10b981", icon: Mail,       accent: "#f59e0b" },
          ].map(({ label, value, trend, trendColor, icon: Icon, accent }) => (
            <div
              key={label}
              className="rounded-xl p-3.5"
              style={{ background: "hsl(var(--muted)/0.3)", border: "1px solid hsl(var(--border))" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
                  <Icon size={13} style={{ color: accent }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: trendColor }}>▲ {trend}</span>
              </div>
              {loadingStats
                ? <div className="h-6 w-10 bg-muted/50 rounded animate-pulse mb-1" />
                : <p className="text-xl font-black text-foreground">{value >= 1000 ? `${(value/1000).toFixed(1)}K` : value}</p>
              }
              <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
              {/* Mini trend bar */}
              <div className="mt-2 flex items-end gap-0.5 h-5">
                {[40,55,45,70,60,80,65,90].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: `${accent}${i === 7 ? "cc" : "40"}` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-black text-foreground">Recent Activity</p>
          <button onClick={() => onNavigate("members")} className="text-xs font-bold text-primary hover:underline">View all</button>
        </div>
        <div className="divide-y divide-border">
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center">
              <RefreshCw size={20} className="text-muted-foreground/25 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No recent activity yet</p>
            </div>
          ) : recentActivity.map((act) => {
            const meta = ACT_ICONS[act.type] ?? ACT_ICONS.lecture;
            const IconComp = meta.icon;
            return (
              <div key={act.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: meta.bg }}>
                  <IconComp size={14} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{act.title}</p>
                  {act.sub && <p className="text-[10px] text-muted-foreground truncate">{act.sub}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgoAdmin(act.time)}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── coupon tab ──────────────────────────────────────────── */
function CouponTab() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<{ id: string; code: string; discountType: "percent" | "flat"; discountValue: number; maxUses: number; usedCount: number; planId: string; isActive: boolean; expiresAt?: { seconds: number } | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", discountType: "percent" as "percent" | "flat", discountValue: 10, maxUses: 0, perUserLimit: 1, planId: "all", expiresAt: "" });

  const loadCoupons = useCallback(async () => {
    const snap = await getDocs(query(collection(db, "coupons"), orderBy("createdAt", "desc"))).catch(() => null);
    if (snap) setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as any)));
    setLoading(false);
  }, []);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const addCoupon = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "coupons"), {
        code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxUses: Number(form.maxUses),
        perUserLimit: Number(form.perUserLimit),
        usedCount: 0,
        planId: form.planId,
        isActive: true,
        expiresAt: form.expiresAt ? Timestamp.fromDate(new Date(form.expiresAt)) : null,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Coupon created" });
      setForm({ code: "", discountType: "percent", discountValue: 10, maxUses: 0, perUserLimit: 1, planId: "all", expiresAt: "" });
      await loadCoupons();
    } finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateDoc(doc(db, "coupons", id), { isActive: !current });
    await loadCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await deleteDoc(doc(db, "coupons", id));
    await loadCoupons();
    toast({ title: "Coupon deleted" });
  };

  return (
    <div className="space-y-5">
      <Section title="Create Coupon">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Coupon Code" placeholder="e.g. SAVE20" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Discount Type</Label>
            <Select value={form.discountType} onValueChange={(v) => setForm({ ...form, discountType: v as any })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percent (%)</SelectItem>
                <SelectItem value="flat">Flat (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label={form.discountType === "percent" ? "Discount %" : "Discount ₹"}
            placeholder={form.discountType === "percent" ? "e.g. 20" : "e.g. 5"}
            value={String(form.discountValue)}
            onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} type="number" />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Applicable Plan</Label>
            <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="day">Daily Plan only</SelectItem>
                <SelectItem value="month">Monthly Plan only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Max Uses (0 = unlimited)" placeholder="0" value={String(form.maxUses)}
            onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })} type="number" />
          <Field label="Per-User Limit (0 = unlimited)" placeholder="1" value={String(form.perUserLimit)}
            onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })} type="number" />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Expires At (optional)</Label>
            <Input type="date" className="h-9 text-sm" value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <Button disabled={saving || !form.code.trim()} onClick={addCoupon} className="w-full gap-2">
          <Gift size={14} /> {saving ? "Creating…" : "Create Coupon"}
        </Button>
      </Section>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Existing Coupons</p>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>
        ) : coupons.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">No coupons yet.</div>
        ) : (
          <div className="space-y-2">
            {coupons.map((c) => (
              <div key={c.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.isActive ? "bg-emerald-500/10" : "bg-muted"}`}>
                  <Tag size={15} className={c.isActive ? "text-emerald-500" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-sm text-foreground">{c.code}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.discountType === "flat" ? `₹${c.discountValue}` : `${c.discountValue}%`} off · {c.planId === "all" ? "All plans" : `${c.planId} plan`} · Used {c.usedCount ?? 0}/{c.maxUses === 0 ? "∞" : c.maxUses} · User limit: {(c as any).perUserLimit === 0 ? "∞" : (c as any).perUserLimit ?? 1}
                    {c.expiresAt && ` · Exp ${new Date(c.expiresAt.seconds * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <button onClick={() => toggleActive(c.id, c.isActive)} className={`flex-shrink-0 transition-colors ${c.isActive ? "text-emerald-500 hover:text-muted-foreground" : "text-muted-foreground hover:text-emerald-500"}`}>
                  {c.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </button>
                <button onClick={() => deleteCoupon(c.id)} className="w-7 h-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 flex items-center justify-center transition-colors flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── maintenance tab ─────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   ANDROID APP SETTINGS TAB
─────────────────────────────────────────────────────────────── */
function AndroidAppSettingsTab() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "settings")).then((snap) => {
      const d = snap.docs.find((x) => x.id === "appConfig");
      if (d) setUrl(d.data().androidAppDownloadUrl ?? "");
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!url.trim()) {
      toast({ title: "Please enter a download URL", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "appConfig"), { androidAppDownloadUrl: url.trim() }, { merge: true });
      toast({ title: "Android App URL saved", description: "GET APP button will now use this URL." });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl overflow-hidden p-5 border space-y-4"
        style={{
          background: "linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(6,182,212,0.03) 100%)",
          borderColor: "rgba(16,185,129,0.25)",
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", boxShadow: "0 0 16px rgba(16,185,129,0.35)" }}
          >
            <Smartphone size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Android App Download URL</h3>
            <p className="text-sm text-muted-foreground">The URL used by the GET APP button on user profiles.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Download Link</Label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=…"
            className="h-10 text-sm font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            This can be a Play Store link, APK direct download, or any app distribution URL.
          </p>
        </div>
        {url && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981" }}>
            <CheckCircle size={13} /> Current URL set — users will be redirected here when they tap GET APP.
          </div>
        )}
      </div>
      <Button onClick={save} disabled={saving} className="w-full gap-2"
        style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", border: "none" }}>
        <CheckCircle size={14} /> {saving ? "Saving…" : "Save App URL"}
      </Button>
    </div>
  );
}

function MaintenanceTab() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDocs(collection(db, "siteSettings")).then((snap) => {
      const d = snap.docs.find((x) => x.id === "maintenance");
      if (d) { setEnabled(d.data().enabled ?? false); setMessage(d.data().message ?? ""); }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "siteSettings", "maintenance"), { enabled, message }, { merge: true });
      toast({ title: enabled ? "Maintenance mode ON" : "Maintenance mode OFF" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-5">
      <div className={`relative rounded-2xl overflow-hidden p-5 border transition-all ${enabled ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card"}`}>
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${enabled ? "bg-amber-500/15" : "bg-muted"}`}>
            <Wrench size={22} className={enabled ? "text-amber-500" : "text-muted-foreground"} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground">Maintenance Mode</h3>
            <p className="text-sm text-muted-foreground">
              {enabled ? "Site is currently in maintenance — non-admin users see the maintenance screen." : "Site is running normally."}
            </p>
          </div>
          <button onClick={() => setEnabled(!enabled)} className={`flex-shrink-0 transition-colors ${enabled ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}>
            {enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Maintenance Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="We're making improvements. Please check back shortly."
            className="text-sm resize-none"
            rows={3}
          />
          <p className="text-[11px] text-muted-foreground">This message is shown to students while maintenance is active.</p>
        </div>
        {enabled && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs font-semibold">
            <AlertCircle size={13} /> Maintenance is ON — students cannot access the site right now.
          </div>
        )}
      </div>
      <Button onClick={save} disabled={saving} className="w-full gap-2">
        <CheckCircle size={14} /> {saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   IMAGE COMPRESS UTIL (shared across popup/banner tabs)
─────────────────────────────────────────────────────────────── */
async function compressToBase64(file: File, maxBytes = 400_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      const MAX = 1200;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      let b64 = canvas.toDataURL("image/jpeg", 0.82);
      if (b64.length > maxBytes) b64 = canvas.toDataURL("image/jpeg", 0.65);
      if (b64.length > maxBytes) b64 = canvas.toDataURL("image/jpeg", 0.45);
      resolve(b64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img load failed")); };
    img.src = url;
  });
}

/* ─────────────────────────────────────────────────────────────
   SUBJECT POPUP MANAGER TAB
─────────────────────────────────────────────────────────────── */
type PopupMode = "always" | "once_session" | "once_day" | "disabled";

interface PopupForm {
  enabled: boolean;
  mode: PopupMode;
  title: string;
  subtitle: string;
  imageBase64: string;
}

const POPUP_SUBJECTS = [
  { id: "maths",   label: "Mathematics", icon: Sigma,        color: "text-blue-500",    bg: "bg-blue-50 dark:bg-blue-950/30" },
  { id: "science", label: "Science",     icon: FlaskConical, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { id: "sst",     label: "SST",         icon: Globe,        color: "text-violet-500",  bg: "bg-violet-50 dark:bg-violet-950/30" },
];

function PopupManagerTab() {
  const { toast } = useToast();
  const [forms, setForms] = useState<Record<string, PopupForm>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [compressing, setCompressing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubs = POPUP_SUBJECTS.map(({ id }) =>
      onSnapshot(doc(db, "subjectPopups", id), (snap) => {
        setForms((prev) => ({
          ...prev,
          [id]: snap.exists()
            ? (snap.data() as PopupForm)
            : { enabled: false, mode: "once_session", title: "", subtitle: "", imageBase64: "" },
        }));
      }, () => {
        setForms((prev) => ({
          ...prev,
          [id]: prev[id] ?? { enabled: false, mode: "once_session", title: "", subtitle: "", imageBase64: "" },
        }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const setField = (id: string, field: keyof PopupForm, val: unknown) => {
    setForms((p) => ({ ...p, [id]: { ...p[id], [field]: val } }));
  };

  const handleImageUpload = async (id: string, file: File) => {
    setCompressing((p) => ({ ...p, [id]: true }));
    try {
      const b64 = await compressToBase64(file, 400_000);
      setField(id, "imageBase64", b64);
      toast({ title: `Image compressed (${(b64.length / 1024).toFixed(0)} KB)` });
    } catch {
      toast({ title: "Compression failed", variant: "destructive" });
    } finally {
      setCompressing((p) => ({ ...p, [id]: false }));
    }
  };

  const save = async (id: string) => {
    const form = forms[id];
    if (!form) return;
    setSaving((p) => ({ ...p, [id]: true }));
    try {
      await setDoc(doc(db, "subjectPopups", id), { ...form, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Popup saved!" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 mb-1">
        <Sparkles size={16} className="text-primary" />
        <h2 className="font-bold text-foreground text-sm">Subject Popup Manager</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Show a teacher introduction popup when students open Science, Maths, or SST.
      </p>
      {POPUP_SUBJECTS.map(({ id, label, icon: Icon, color, bg }) => {
        const form = forms[id] ?? { enabled: false, mode: "once_session" as PopupMode, title: "", subtitle: "", imageBase64: "" };
        return (
          <div key={id} className="border border-border rounded-2xl overflow-hidden bg-card">
            {/* Header */}
            <div className={`flex items-center gap-3 px-4 py-3 ${bg} border-b border-border`}>
              <Icon size={16} className={color} />
              <h3 className="font-bold text-foreground text-sm flex-1">{label} Popup</h3>
              <button onClick={() => setField(id, "enabled", !form.enabled)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                  form.enabled
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "border-border text-muted-foreground"
                }`}>
                {form.enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                {form.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Image upload */}
              <div>
                <Label className="text-xs font-semibold text-foreground/80 mb-1.5 block">Teacher Image</Label>
                <div className="flex gap-2 items-start">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border cursor-pointer hover:bg-secondary transition-colors text-xs font-semibold flex-shrink-0">
                    {compressing[id] ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
                    {compressing[id] ? "Compressing…" : "Upload Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(id, f);
                      e.target.value = "";
                    }} />
                  </label>
                  {form.imageBase64 && (
                    <button onClick={() => setField(id, "imageBase64", "")}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/20">
                      <Trash2 size={11} /> Remove
                    </button>
                  )}
                </div>
                {form.imageBase64 && (
                  <img src={form.imageBase64} alt="preview"
                    className="mt-2 w-full max-h-36 object-cover rounded-xl border border-border" />
                )}
                {!form.imageBase64 && (
                  <p className="text-[11px] text-muted-foreground mt-1">No image. Auto-compresses to ≤ 400KB.</p>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Popup Title</Label>
                <Input value={form.title} onChange={(e) => setField(id, "title", e.target.value)}
                  placeholder="e.g. Meet Your Science Teacher" className="h-9 text-sm" />
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Subtitle / Description</Label>
                <Textarea value={form.subtitle} onChange={(e) => setField(id, "subtitle", e.target.value)}
                  placeholder="e.g. 10+ years of teaching experience in Physics, Chemistry & Biology"
                  className="text-sm resize-none" rows={2} />
              </div>

              {/* Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/80">Display Mode</Label>
                <Select value={form.mode} onValueChange={(v) => setField(id, "mode", v as PopupMode)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always show</SelectItem>
                    <SelectItem value="once_session">Once per session</SelectItem>
                    <SelectItem value="once_day">Once per day</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => save(id)} disabled={saving[id]} className="w-full gap-2">
                <CheckCircle size={14} /> {saving[id] ? "Saving…" : `Save ${label} Popup`}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BANNER MANAGER TAB  (Smart Banners + Legacy Popup)
─────────────────────────────────────────────────────────────── */
type BannerMode = "always" | "once_session" | "once_day" | "disabled";
type BannerType = "external" | "internal" | "youtube_video" | "youtube_live" | "announcement_popup";

interface BannerForm {
  enabled: boolean;
  mode: BannerMode;
  imageBase64: string;
  redirectUrl: string;
}

interface SmartBannerDoc {
  id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  bannerType: BannerType;
  link: string;
  imageUrl: string;
  priority: number;
  active: boolean;
  enabled: boolean;
  startDate: string;
  endDate: string;
  popupMessage: string;
  createdAt?: { seconds: number };
}

function extractYtId(url: string): string | null {
  if (!url) return null;
  const p = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const r of p) { const m = url.match(r); if (m) return m[1]; }
  return null;
}

function detectBannerType(url: string): BannerType {
  if (!url) return "external";
  if (url.includes("/live/") || url.includes("live=1")) return "youtube_live";
  if (extractYtId(url)) return "youtube_video";
  if (url.startsWith("/")) return "internal";
  return "external";
}

const BANNER_TYPE_LABELS: Record<BannerType, string> = {
  external: "External Link",
  internal: "Internal Page",
  youtube_video: "YouTube Video",
  youtube_live: "YouTube Live",
  announcement_popup: "Announcement Popup",
};

const EMPTY_SMART: Omit<SmartBannerDoc, "id"> = {
  title: "", subtitle: "", buttonText: "Watch Now", bannerType: "external",
  link: "", imageUrl: "", priority: 10, active: true, enabled: true,
  startDate: "", endDate: "", popupMessage: "",
};

/* ── Legacy popup banner ──────────────────────────────────── */
function LegacyPopupSection({ docId, label, desc }: { docId: string; label: string; desc: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState<BannerForm>({ enabled: false, mode: "once_session", imageBase64: "", redirectUrl: "" });
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteBanners", docId), (snap) => {
      if (snap.exists()) setForm(snap.data() as BannerForm);
    }, () => {});
    return unsub;
  }, [docId]);

  const updateField = <K extends keyof BannerForm>(k: K, v: BannerForm[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleImageUpload = async (file: File) => {
    setCompressing(true);
    try {
      const b64 = await compressToBase64(file, 400_000);
      updateField("imageBase64", b64);
      toast({ title: `Image compressed (${(b64.length / 1024).toFixed(0)} KB)` });
    } catch {
      toast({ title: "Compression failed", variant: "destructive" });
    } finally { setCompressing(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "siteBanners", docId), { ...form, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: `${label} saved!` });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card">
      <div className="flex items-center gap-3 px-4 py-3 bg-secondary/40 border-b border-border">
        <ImageIcon size={15} className="text-primary" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">{label}</h3>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
        <button onClick={() => updateField("enabled", !form.enabled)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
            form.enabled ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground"
          }`}>
          {form.enabled ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
          {form.enabled ? "Active" : "Off"}
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold text-foreground/80 mb-1.5 block">Banner Image</Label>
          <div className="flex gap-2 flex-wrap">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border cursor-pointer hover:bg-secondary text-xs font-semibold">
              {compressing ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
              {compressing ? "Compressing…" : "Upload Image"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = "";
              }} />
            </label>
            {form.imageBase64 && (
              <button onClick={() => updateField("imageBase64", "")}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-semibold">
                <Trash2 size={11} /> Remove
              </button>
            )}
          </div>
          {form.imageBase64
            ? <img src={form.imageBase64} alt="preview" className="mt-2 w-full max-h-40 object-contain rounded-xl border border-border bg-muted" />
            : <p className="text-[11px] text-muted-foreground mt-1">No image. Auto-compresses to ≤ 400KB.</p>
          }
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Redirect URL (optional)</Label>
          <Input value={form.redirectUrl} onChange={(e) => updateField("redirectUrl", e.target.value)}
            placeholder="https://… (leave empty for no link)" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground/80">Display Mode</Label>
          <Select value={form.mode} onValueChange={(v) => updateField("mode", v as BannerMode)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="always">Always show</SelectItem>
              <SelectItem value="once_session">Once per session</SelectItem>
              <SelectItem value="once_day">Once per day</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving} className="w-full gap-2">
          <CheckCircle size={14} /> {saving ? "Saving…" : `Save ${label}`}
        </Button>
      </div>
    </div>
  );
}

/* ── Smart Banner Editor ──────────────────────────────────── */
function SmartBannerEditor({
  initial, onSave, onCancel, saving,
}: {
  initial: Omit<SmartBannerDoc, "id">;
  onSave: (data: Omit<SmartBannerDoc, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Omit<SmartBannerDoc, "id">>(initial);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleLinkChange = (v: string) => {
    set("link", v);
    if (v.trim()) {
      const detected = detectBannerType(v.trim());
      set("bannerType", detected);
      const ytId = extractYtId(v);
      if (ytId && !form.imageUrl) {
        set("imageUrl", `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`);
      }
    }
  };

  const isYt = form.bannerType === "youtube_video" || form.bannerType === "youtube_live";

  return (
    <div className="border border-primary/30 rounded-2xl overflow-hidden bg-card/80"
      style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.15)" }}>
      <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center gap-2">
        <Sparkles size={14} className="text-primary" />
        <span className="font-bold text-sm text-foreground">
          {(initial as { id?: string }).id ? "Edit Banner" : "New Smart Banner"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Title & Subtitle */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Title</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Banner headline" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Button Text</Label>
            <Input value={form.buttonText} onChange={e => set("buttonText", e.target.value)}
              placeholder="Watch Now" className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Subtitle / Description</Label>
          <Input value={form.subtitle} onChange={e => set("subtitle", e.target.value)}
            placeholder="Short description shown under title" className="h-9 text-sm" />
        </div>

        {/* Link */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Link / URL</Label>
          <Input value={form.link} onChange={e => handleLinkChange(e.target.value)}
            placeholder="YouTube URL, https://… or /subjects/maths" className="h-9 text-sm font-mono" />
          <p className="text-[11px] text-muted-foreground">
            Auto-detects type: paste a YouTube link to fill image thumbnail automatically
          </p>
        </div>

        {/* Banner Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Banner Type</Label>
          <Select value={form.bannerType} onValueChange={v => set("bannerType", v as BannerType)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(BANNER_TYPE_LABELS) as [BannerType, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Popup message (only for announcement_popup) */}
        {form.bannerType === "announcement_popup" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Popup Message</Label>
            <Textarea value={form.popupMessage} onChange={e => set("popupMessage", e.target.value)}
              placeholder="Full announcement text shown in the popup…" className="text-sm resize-none" rows={3} />
          </div>
        )}

        {/* Image URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Banner Image URL</Label>
          <Input value={form.imageUrl} onChange={e => set("imageUrl", e.target.value)}
            placeholder="https://… (16:9 recommended, auto-filled for YouTube)" className="h-9 text-sm font-mono" />
          {isYt && !form.imageUrl && form.link && (
            <p className="text-[11px] text-amber-500">YouTube thumbnail will auto-fill when you save.</p>
          )}
          {form.imageUrl && (
            <img src={form.imageUrl} alt="preview"
              className="mt-1.5 rounded-xl max-h-28 object-contain border border-border bg-muted"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
        </div>

        {/* Priority & Dates */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Priority</Label>
            <Input type="number" value={form.priority} onChange={e => set("priority", Number(e.target.value))}
              className="h-9 text-sm" min={1} max={100} />
            <p className="text-[10px] text-muted-foreground">Lower = shown first</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Start Date</Label>
            <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
              className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">End Date</Label>
            <Input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)}
              className="h-9 text-sm" />
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button onClick={() => set("active", !form.active)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              form.active ? "bg-emerald-500 text-white border-emerald-500" : "border-border text-muted-foreground"
            }`}>
            {form.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
            {form.active ? "Active" : "Inactive"}
          </button>
          <p className="text-[11px] text-muted-foreground">Only active banners show on the homepage</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1 gap-1.5">
            <X size={13} /> Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(form)} disabled={saving} className="flex-1 gap-1.5">
            <CheckCircle size={13} /> {saving ? "Saving…" : "Save Banner"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Smart Banners list ───────────────────────────────────── */
function SmartBannersSection() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<SmartBannerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<SmartBannerDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "smartBanners"), orderBy("priority", "asc")),
      snap => {
        setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartBannerDoc)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const handleSave = async (data: Omit<SmartBannerDoc, "id">) => {
    if (!data.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await setDoc(doc(db, "smartBanners", editTarget.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        toast({ title: "Banner updated!" });
      } else {
        await addDoc(collection(db, "smartBanners"), { ...data, createdAt: serverTimestamp() });
        toast({ title: "Banner created!" });
      }
      setShowForm(false);
      setEditTarget(null);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "smartBanners", id));
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    } finally { setDeleting(null); }
  };

  const toggleActive = async (banner: SmartBannerDoc) => {
    await updateDoc(doc(db, "smartBanners", banner.id), { active: !banner.active }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground text-sm">Smart Banners</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Homepage banners with YouTube, external link, or announcement support. Ordered by priority.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setEditTarget(null); }} className="gap-1.5 shrink-0">
            <Plus size={13} /> New Banner
          </Button>
        )}
      </div>

      {(showForm && !editTarget) && (
        <SmartBannerEditor
          initial={{ ...EMPTY_SMART }}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-2xl bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : banners.length === 0 && !showForm ? (
        <div className="border border-dashed border-border rounded-2xl p-8 text-center">
          <ImageIcon size={24} className="text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No smart banners yet. Create one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map(banner => (
            <div key={banner.id}>
              {editTarget?.id === banner.id ? (
                <SmartBannerEditor
                  initial={{ ...banner }}
                  onSave={handleSave}
                  onCancel={() => setEditTarget(null)}
                  saving={saving}
                />
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card">
                  <div className="flex items-center gap-3 p-3">
                    {banner.imageUrl ? (
                      <img src={banner.imageUrl} alt={banner.title}
                        className="w-16 h-10 object-cover rounded-xl flex-shrink-0 bg-muted"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-16 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-secondary">
                        <ImageIcon size={16} className="text-muted-foreground/50" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground truncate">{banner.title}</p>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                          {BANNER_TYPE_LABELS[banner.bannerType]}
                        </span>
                      </div>
                      {banner.subtitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{banner.subtitle}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground/60">P:{banner.priority}</span>
                        {banner.startDate && <span className="text-[10px] text-muted-foreground/60">From {banner.startDate}</span>}
                        {banner.endDate && <span className="text-[10px] text-muted-foreground/60">To {banner.endDate}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => toggleActive(banner)}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                          banner.active ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" : "bg-secondary text-muted-foreground border-border"
                        }`}>
                        {banner.active ? "Active" : "Off"}
                      </button>
                      <button onClick={() => { setEditTarget(banner); setShowForm(false); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(banner.id)} disabled={deleting === banner.id}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        {deleting === banner.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BannerManagerTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2.5 mb-1">
        <ImageIcon size={16} className="text-primary" />
        <h2 className="font-bold text-foreground text-sm">Banner Manager</h2>
      </div>

      {/* Smart Banners (new system) */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card p-4">
        <SmartBannersSection />
      </div>

      {/* Legacy banners */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Legacy Banners</p>
        <LegacyPopupSection
          docId="popupBanner"
          label="Startup Popup Banner"
          desc="Shows when the website is first opened (base64 image)"
        />
        <LegacyPopupSection
          docId="topBanner"
          label="Homepage Top Banner (Fallback)"
          desc="Shown when no smart banner is active (base64 image)"
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TEST MANAGER TAB
─────────────────────────────────────────────────────────────── */
interface TestDoc {
  id: string;
  title: string;
  subject: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  active: boolean;
  isPremium: boolean;
  htmlSource: string;
  parsedQuestions: unknown[];
  instructions: string;
  createdAt?: { seconds: number };
}

interface TestForm {
  title: string;
  subject: string;
  duration: string;
  totalMarks: string;
  htmlSource: string;
  instructions: string;
  isPremium: boolean;
  active: boolean;
}

const EMPTY_TEST_FORM: TestForm = {
  title: "", subject: "science", duration: "30", totalMarks: "0",
  htmlSource: "", instructions: "", isPremium: false, active: true,
};

const HTML_TEMPLATE = `<quiz title="Test Name" subject="science" duration="30" marks="10">
  <question marks="1">
    <text>What is the formula of Ohm's Law?</text>
    <option>A. P = VI</option>
    <option correct>B. V = IR</option>
    <option>C. F = ma</option>
    <option>D. E = mc²</option>
    <explanation>Ohm's Law states V = IR, where V=voltage, I=current, R=resistance</explanation>
  </question>
  <question marks="1">
    <text>What is the SI unit of resistance?</text>
    <option correct>A. Ohm (Ω)</option>
    <option>B. Ampere</option>
    <option>C. Volt</option>
    <option>D. Watt</option>
  </question>
</quiz>`;

/* ─── Quiz Attempt Reset Panel ─────────────────────────────── */
function QuizResetPanel({ tests }: { tests: Array<{ id: string; title: string }> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState("all");
  const [targetUid, setTargetUid] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm(
      targetUid.trim()
        ? `Reset attempts for UID/email "${targetUid.trim()}"${selectedTest !== "all" ? " on this test" : " on ALL tests"}?`
        : `Reset ALL attempts${selectedTest !== "all" ? " for this test" : " (EVERY test, EVERY user)"}? This cannot be undone.`
    )) return;

    setResetting(true);
    try {
      let q;
      if (selectedTest !== "all" && targetUid.trim()) {
        q = query(collection(db, "testAttempts"), where("testId", "==", selectedTest), where("userId", "==", targetUid.trim()));
      } else if (selectedTest !== "all") {
        q = query(collection(db, "testAttempts"), where("testId", "==", selectedTest));
      } else if (targetUid.trim()) {
        q = query(collection(db, "testAttempts"), where("userId", "==", targetUid.trim()));
      } else {
        q = query(collection(db, "testAttempts"));
      }

      const snap = await getDocs(q);
      if (snap.empty) {
        toast({ title: "No matching attempts found", variant: "destructive" });
        return;
      }
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      toast({ title: `Reset ${snap.size} attempt${snap.size !== 1 ? "s" : ""} successfully` });
      setTargetUid("");
      setOpen(false);
    } catch {
      toast({ title: "Reset failed", variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <RefreshCw size={13} className="text-primary" />
          <span className="text-sm font-bold text-foreground">Reset Quiz Attempts</span>
          <Badge variant="secondary" className="text-[9px]">Admin Tool</Badge>
        </div>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-secondary/10">
          <p className="text-xs text-muted-foreground">
            Delete locked attempts to let students retake a test. Leave fields empty to reset all.
          </p>

          {/* Select test */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground/70">Test (optional)</Label>
            <Select value={selectedTest} onValueChange={setSelectedTest}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tests</SelectItem>
                {tests.map((t) => <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* UID or email */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground/70">Student UID or Email (optional)</Label>
            <Input
              value={targetUid}
              onChange={(e) => setTargetUid(e.target.value)}
              placeholder="Leave empty to reset all users"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleReset}
              disabled={resetting}
              variant="destructive"
              size="sm"
              className="gap-1.5 text-xs"
            >
              {resetting ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
              {resetting ? "Resetting…" : "Reset Attempts"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="text-xs">Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TestManagerTab() {
  const { toast } = useToast();
  const [tests, setTests] = useState<TestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [form, setForm] = useState<TestForm>(EMPTY_TEST_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedQuiz | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSubj, setFilterSubj] = useState("all");
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "tests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestDoc)));
      setLoading(false);
    }, () => {
      onSnapshot(collection(db, "tests"), (snap) => {
        setTests(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TestDoc)));
        setLoading(false);
      }, () => setLoading(false));
    });
    return unsub;
  }, []);

  const parseHtml = () => {
    if (!form.htmlSource.trim()) { toast({ title: "Paste your quiz HTML first", variant: "destructive" }); return; }
    const result = parseQuizHtml(form.htmlSource);
    setParsed(result);
    if (result.questions.length > 0) {
      setForm((p) => ({
        ...p,
        title: p.title || result.title,
        subject: result.subject || p.subject,
        duration: result.duration ? String(result.duration) : p.duration,
        totalMarks: result.totalMarks ? String(result.totalMarks) : p.totalMarks,
      }));
      toast({ title: `Parsed ${result.questions.length} questions` + (result.parseErrors.length ? ` (${result.parseErrors.length} warnings)` : "") });
    } else {
      toast({ title: "No questions found", description: result.parseErrors.join("; "), variant: "destructive" });
    }
  };

  const saveTest = async () => {
    if (!form.title.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    if (!parsed || parsed.questions.length === 0) { toast({ title: "Parse quiz HTML first", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        subject: form.subject,
        duration: parseInt(form.duration) || 30,
        totalMarks: parseInt(form.totalMarks) || parsed.totalMarks,
        totalQuestions: parsed.questions.length,
        isPremium: form.isPremium,
        active: form.active,
        htmlSource: form.htmlSource,
        parsedQuestions: parsed.questions,
        instructions: form.instructions.trim(),
        updatedAt: serverTimestamp(),
      };
      if (editId) {
        await updateDoc(doc(db, "tests", editId), data);
        toast({ title: "Test updated!" });
      } else {
        await addDoc(collection(db, "tests"), { ...data, createdAt: serverTimestamp() });
        toast({ title: "Test created!" });
      }
      setView("list"); setForm(EMPTY_TEST_FORM); setParsed(null); setEditId(null);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const startEdit = (t: TestDoc) => {
    setForm({
      title: t.title, subject: t.subject, duration: String(t.duration),
      totalMarks: String(t.totalMarks), htmlSource: t.htmlSource ?? "",
      instructions: t.instructions ?? "", isPremium: t.isPremium, active: t.active,
    });
    setEditId(t.id);
    if (t.htmlSource) setParsed(parseQuizHtml(t.htmlSource));
    setView("edit");
  };

  const deleteTest = async (id: string) => {
    if (!confirm("Delete this test? This cannot be undone.")) return;
    await deleteDoc(doc(db, "tests", id)).catch(() => {});
    toast({ title: "Deleted" });
  };

  const toggleActive = async (t: TestDoc) => {
    await updateDoc(doc(db, "tests", t.id), { active: !t.active }).catch(() => {});
  };

  const filtered = tests.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchSubj = filterSubj === "all" || t.subject === filterSubj;
    return matchSearch && matchSubj;
  });

  /* ── create/edit form ── */
  if (view === "create" || view === "edit") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { setView("list"); setForm(EMPTY_TEST_FORM); setParsed(null); setEditId(null); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown size={14} className="-rotate-90" /> Back
          </button>
          <h2 className="font-bold text-sm text-foreground ml-1">{view === "edit" ? "Edit Test" : "Create New Test"}</h2>
        </div>

        {/* HTML Paste area */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground/80">Quiz HTML</Label>
            <button onClick={() => setShowTemplate(!showTemplate)} className="text-[11px] text-primary font-semibold">
              {showTemplate ? "Hide" : "Show"} template
            </button>
          </div>
          {showTemplate && (
            <pre className="text-[10px] text-muted-foreground bg-secondary/60 p-3 rounded-xl overflow-x-auto leading-relaxed mb-2">
              {HTML_TEMPLATE}
            </pre>
          )}
          <Textarea
            value={form.htmlSource}
            onChange={(e) => { setForm((p) => ({ ...p, htmlSource: e.target.value })); setParsed(null); }}
            placeholder="Paste your quiz HTML here…"
            className="text-xs font-mono resize-none"
            rows={8}
          />
          <Button variant="outline" onClick={parseHtml} className="w-full gap-2 text-sm">
            <Eye size={13} /> Parse & Preview Quiz
          </Button>
        </div>

        {/* Parse result preview */}
        {parsed && (
          <div className={`rounded-xl p-3 text-xs border ${
            parsed.questions.length > 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
          }`}>
            {parsed.questions.length > 0
              ? <><strong>✓ {parsed.questions.length} questions</strong> parsed — {parsed.totalMarks} total marks — {parsed.duration} min</>
              : <><strong>✗ No questions found.</strong> Check your HTML format.</>
            }
            {parsed.parseErrors.length > 0 && (
              <ul className="mt-1 space-y-0.5 list-disc list-inside opacity-80">
                {parsed.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Test Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Science — Electricity Test" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Subject</Label>
            <Select value={form.subject} onValueChange={(v) => setForm((p) => ({ ...p, subject: v }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Duration (minutes)</Label>
            <Input type="number" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
              className="h-9 text-sm" min={1} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Total Marks</Label>
            <Input type="number" value={form.totalMarks} onChange={(e) => setForm((p) => ({ ...p, totalMarks: e.target.value }))}
              className="h-9 text-sm" min={0} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold text-foreground/80">Instructions (one per line, optional)</Label>
            <Textarea value={form.instructions} onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
              placeholder="Leave empty for default instructions" className="text-sm resize-none" rows={3} />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => setForm((p) => ({ ...p, isPremium: !p.isPremium }))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              form.isPremium ? "bg-amber-500/10 border-amber-500/30 text-amber-600" : "border-border text-muted-foreground"
            }`}>
            <Star size={11} fill={form.isPremium ? "currentColor" : "none"} />
            {form.isPremium ? "Premium" : "Free"}
          </button>
          <button onClick={() => setForm((p) => ({ ...p, active: !p.active }))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              form.active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "border-border text-muted-foreground"
            }`}>
            {form.active ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
            {form.active ? "Active" : "Inactive"}
          </button>
        </div>

        <Button onClick={saveTest} disabled={saving || !parsed || parsed.questions.length === 0} className="w-full gap-2">
          <CheckCircle size={14} /> {saving ? "Saving…" : view === "edit" ? "Update Test" : "Create Test"}
        </Button>
      </div>
    );
  }

  /* ── list view ── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileQuestion size={15} className="text-primary" />
          <h2 className="font-bold text-sm text-foreground">Test Manager</h2>
          <Badge variant="secondary" className="text-[10px]">{tests.length}</Badge>
        </div>
        <Button size="sm" onClick={() => { setForm(EMPTY_TEST_FORM); setParsed(null); setEditId(null); setView("create"); }} className="gap-1.5 text-xs">
          <Plus size={12} /> New Test
        </Button>
      </div>
      {/* Quiz attempt reset panel */}
      <QuizResetPanel tests={tests} />

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tests…" className="h-8 text-xs pl-8" />
        </div>
        <Select value={filterSubj} onValueChange={setFilterSubj}>
          <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="All subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {SUBJECTS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw size={18} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {tests.length === 0 ? "No tests yet. Create your first test." : "No tests match your search."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => (
            <div key={t.id} className="border border-border rounded-xl p-3 bg-card">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-[10px] font-bold capitalize text-muted-foreground">{t.subject}</span>
                    {t.isPremium && <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">PREMIUM</span>}
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${t.active ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" : "text-muted-foreground border-border"}`}>
                      {t.active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-foreground leading-snug">{t.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t.totalQuestions} questions · {t.duration} min · {t.totalMarks} marks
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleActive(t)}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                    title={t.active ? "Deactivate" : "Activate"}>
                    {t.active ? <ToggleRight size={13} className="text-emerald-500" /> : <ToggleLeft size={13} className="text-muted-foreground" />}
                  </button>
                  <button onClick={() => startEdit(t)}
                    className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => deleteTest(t.id)}
                    className="w-7 h-7 rounded-lg border border-red-200 dark:border-red-900 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── board exam countdown config tab ────────────────────── */
function BoardExamTab() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [examName, setExamName] = useState("CBSE Board Exam 2026");
  const [targetDate, setTargetDate] = useState("2026-03-15");
  const [message, setMessage] = useState("days left — you've got this!");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "boardExam"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setEnabled(d.enabled ?? false);
        setExamName(d.examName ?? "CBSE Board Exam 2026");
        setTargetDate(d.targetDate ?? "2026-03-15");
        setMessage(d.message ?? "days left — you've got this!");
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "siteSettings", "boardExam"), { enabled, examName, targetDate, message });
      toast({ title: "Board exam countdown saved!" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  /* Live preview */
  let daysLeft = 0;
  if (targetDate) {
    const examDate = new Date(targetDate + "T00:00:00");
    const today = new Date(); today.setHours(0,0,0,0);
    daysLeft = Math.ceil((examDate.getTime() - today.getTime()) / 86400000);
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-blue-500" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">Board Exam Countdown</h3>
          <p className="text-xs text-muted-foreground">Shown on the home page. Updates automatically every day.</p>
        </div>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div>
          <p className="text-sm font-bold text-foreground">Enable Countdown</p>
          <p className="text-xs text-muted-foreground">Show exam countdown on home page</p>
        </div>
        <button onClick={() => setEnabled(!enabled)}
          className={`w-12 h-6 rounded-full relative transition-colors ${enabled ? "bg-emerald-500" : "bg-muted"}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? "left-6" : "left-0.5"}`} />
        </button>
      </div>

      {/* Config fields */}
      <div className="rounded-2xl p-4 space-y-4" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Exam Name</Label>
          <Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="e.g. CBSE Board Exam 2026" className="h-9 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Target Date</Label>
          <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="h-9 text-sm" />
          <p className="text-[11px] text-muted-foreground">The app auto-calculates days remaining from today to this date.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Motivational Message</Label>
          <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. days left — you've got this!" className="h-9 text-sm" />
          <p className="text-[11px] text-muted-foreground">Shown below the day count. Leave blank to show "days left".</p>
        </div>
      </div>

      {/* Live preview */}
      {enabled && (
        <div className="rounded-2xl border overflow-hidden relative"
          style={{
            background: "linear-gradient(135deg, #0c1a4f 0%, #1e3a8a 50%, #0c1a4f 100%)",
            borderColor: "rgba(59,130,246,0.35)",
          }}>
          <div className="px-5 py-4">
            <p className="text-blue-400/70 text-[10px] font-black uppercase tracking-wider mb-1">Preview</p>
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={14} className="text-blue-400" />
              <span className="text-[11px] font-black tracking-widest text-blue-400/80 uppercase">{examName}</span>
            </div>
            <p className="text-4xl font-black text-white leading-none mb-1">
              {daysLeft < 0 ? "Done" : daysLeft}
            </p>
            <p className="text-[11px] text-blue-200/60 font-medium">
              {daysLeft === 0 ? "Boards Today!" : message || "days left"}
            </p>
          </div>
        </div>
      )}

      <Button onClick={save} disabled={saving} className="w-full gap-2">
        {saving ? <><div className="w-3 h-3 rounded-full border border-white/50 border-t-white animate-spin" />Saving…</> : <><Check size={14} />Save Countdown Settings</>}
      </Button>
    </div>
  );
}

/* ─── main admin page ─────────────────────────────────────── */
export default function Admin() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("dashboard");
  const bump = () => setRefreshKey((k) => k + 1);

  /* Tab quick-access groups for the compact nav */
  const NAV_TABS = [
    { value: "dashboard",        icon: Shield,        label: "Dashboard" },
    { value: "subjects",         icon: BookOpen,      label: "Subjects" },
    { value: "youtube",          icon: Youtube,       label: "YouTube" },
    { value: "announcements",    icon: Bell,          label: "Alerts" },
    { value: "members",          icon: User,          label: "More" },
  ];

  const ALL_TABS = [
    { value: "dashboard",         icon: Shield,        label: "Dashboard" },
    { value: "subjects",          icon: BookOpen,      label: "Subjects" },
    { value: "folders",           icon: FolderOpen,    label: "Folders" },
    { value: "resources",         icon: FileText,      label: "Resources" },
    { value: "premium-lectures",  icon: Crown,         label: "P. Lectures" },
    { value: "announcements",     icon: Bell,          label: "Alerts" },
    { value: "youtube",           icon: Youtube,       label: "YouTube" },
    { value: "chat",              icon: MessageSquare, label: "Chat" },
    { value: "contacts",          icon: Mail,          label: "Queries" },
    { value: "branding",          icon: Settings,      label: "Branding" },
    { value: "premium",           icon: Crown,         label: "Premium" },
    { value: "members",           icon: User,          label: "Members" },
    { value: "coupons",           icon: Tag,           label: "Coupons" },
    { value: "maintenance",       icon: Wrench,        label: "Maintenance" },
    { value: "popups",            icon: Sparkles,      label: "Popups" },
    { value: "banners",           icon: ImageIcon,     label: "Banners" },
    { value: "tests",             icon: FileQuestion,  label: "Tests" },
    { value: "surveys",           icon: ClipboardList, label: "Surveys" },
    { value: "coins",             icon: Coins,         label: "Coins" },
    { value: "boardExam",         icon: Clock,         label: "Countdown" },
    { value: "androidApp",        icon: Smartphone,    label: "Android App" },
  ];

  const activeTabMeta = ALL_TABS.find(t => t.value === activeTab);

  /* FAB quick-create options */
  const FAB_ACTIONS = [
    { label: "Add Resource",    icon: FileText,    tab: "resources",        color: "#10b981" },
    { label: "Add Lecture",     icon: Video,       tab: "premium-lectures", color: "#8b5cf6" },
    { label: "Send Alert",      icon: Bell,        tab: "announcements",    color: "#f59e0b" },
    { label: "Add Subject",     icon: BookOpen,    tab: "subjects",         color: "#3b82f6" },
  ];
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-32">

        {/* ── Premium header ── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))",
                border: "1.5px solid rgba(99,102,241,0.35)",
                boxShadow: "0 0 16px rgba(99,102,241,0.15)",
              }}
            >
              <Shield size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground leading-tight">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage all platform content, folders, and moderation</p>
            </div>
          </div>
          {/* Back to current section */}
          {activeTab !== "dashboard" && (
            <button
              onClick={() => setActiveTab("dashboard")}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80"
              style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
            >
              ← Dashboard
            </button>
          )}
        </div>

        {/* ── Current section breadcrumb (when not on dashboard) ── */}
        {activeTab !== "dashboard" && activeTabMeta && (
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
          >
            <activeTabMeta.icon size={14} className="text-primary flex-shrink-0" />
            <span className="text-sm font-bold text-foreground">{activeTabMeta.label}</span>
          </div>
        )}

        {/* ── All Tabs (hidden scroll pill bar) ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {activeTab !== "dashboard" && (
            <TabsList className="mb-5 flex flex-wrap h-auto gap-1 bg-secondary/60 p-1.5 rounded-xl">
              {ALL_TABS.map(({ value, icon: Icon, label }) => (
                <TabsTrigger key={value} value={value} className="gap-1.5 text-xs px-3 py-1.5 data-[state=active]:shadow-sm">
                  <Icon size={12} />{label}
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          <TabsContent value="dashboard"><DashboardTab onNavigate={setActiveTab} /></TabsContent>
          <TabsContent value="subjects"><SubjectsTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="folders"><FoldersTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="resources"><ResourcesTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="premium-lectures"><PremiumLecturesTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="announcements"><AnnouncementsTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="youtube"><YouTubeTab refresh={refreshKey} bump={bump} /></TabsContent>
          <TabsContent value="chat"><ChatModerationTab /></TabsContent>
          <TabsContent value="contacts"><ContactQueriesTab /></TabsContent>
          <TabsContent value="branding"><BrandingTab bump={bump} /></TabsContent>
          <TabsContent value="premium"><PremiumTab /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="coupons"><CouponTab /></TabsContent>
          <TabsContent value="maintenance"><MaintenanceTab /></TabsContent>
          <TabsContent value="popups"><PopupManagerTab /></TabsContent>
          <TabsContent value="banners"><BannerManagerTab /></TabsContent>
          <TabsContent value="tests"><TestManagerTab /></TabsContent>
          <TabsContent value="surveys"><SurveyManagerTab /></TabsContent>
          <TabsContent value="coins"><CoinManagerTab /></TabsContent>
          <TabsContent value="boardExam"><BoardExamTab /></TabsContent>
          <TabsContent value="androidApp"><AndroidAppSettingsTab /></TabsContent>
        </Tabs>
      </div>

      {/* ── Floating Action Button ── */}
      <div className="fixed bottom-24 right-5 z-50 flex flex-col items-end gap-2.5">
        {fabOpen && FAB_ACTIONS.map(({ label, icon: Icon, tab, color }) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setFabOpen(false); }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-lg font-bold text-xs text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: color,
              boxShadow: `0 4px 16px ${color}50`,
              animation: "fadeInUp 0.15s ease-out",
            }}
          >
            <Icon size={14} className="text-white" />
            {label}
          </button>
        ))}
        <button
          onClick={() => setFabOpen(v => !v)}
          className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            boxShadow: "0 8px 24px rgba(99,102,241,0.5)",
            transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <Plus size={26} className="text-white" />
        </button>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity:0; transform: translateY(8px); }
          to { opacity:1; transform: translateY(0); }
        }
      `}</style>
    </Layout>
  );
}
