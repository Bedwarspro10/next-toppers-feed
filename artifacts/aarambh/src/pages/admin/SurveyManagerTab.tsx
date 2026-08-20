import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, orderBy, query, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Pencil, CheckCircle, X, Eye, Clock,
  ToggleLeft, ToggleRight, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Survey {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnail: string;
  rewardCoins: number;
  active: boolean;
  estimatedTime: number;
  maxResponses: number;
  responseCount: number;
  htmlContent: string;
  createdAt: Timestamp | null;
}

const EMPTY: Omit<Survey, "id" | "createdAt" | "responseCount"> = {
  title: "", description: "", category: "", thumbnail: "",
  rewardCoins: 5, active: true, estimatedTime: 5,
  maxResponses: 0, htmlContent: "",
};

export function SurveyManagerTab() {
  const { toast } = useToast();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Survey | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [preview, setPreview] = useState<Survey | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "surveys"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSurveys(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Survey)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const openCreate = () => {
    setForm({ ...EMPTY });
    setCreating(true);
    setEditing(null);
  };

  const openEdit = (s: Survey) => {
    setForm({
      title: s.title, description: s.description, category: s.category,
      thumbnail: s.thumbnail, rewardCoins: s.rewardCoins, active: s.active,
      estimatedTime: s.estimatedTime, maxResponses: s.maxResponses, htmlContent: s.htmlContent,
    });
    setEditing(s);
    setCreating(false);
  };

  const closeForm = () => { setCreating(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "surveys", editing.id), { ...form, updatedAt: serverTimestamp() });
        toast({ title: "Survey updated ✓" });
      } else {
        await addDoc(collection(db, "surveys"), {
          ...form, responseCount: 0, createdAt: serverTimestamp(),
        });
        toast({ title: "Survey created ✓" });
      }
      closeForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this survey?")) return;
    try {
      await deleteDoc(doc(db, "surveys", id));
      toast({ title: "Survey deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (s: Survey) => {
    await updateDoc(doc(db, "surveys", s.id), { active: !s.active });
  };

  /* ── Form ─────────────────────────────────────────────── */
  if (creating || editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">{editing ? "Edit Survey" : "New Survey"}</h3>
          <Button variant="ghost" size="sm" onClick={closeForm}><X size={14} /></Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Survey title" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description shown on card" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Science, Feedback" />
          </div>
          <div className="space-y-2">
            <Label>Thumbnail URL</Label>
            <Input value={form.thumbnail} onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Reward Coins 🪙</Label>
            <Input type="number" min={1} max={100} value={form.rewardCoins} onChange={(e) => setForm((f) => ({ ...f, rewardCoins: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Est. Time (minutes)</Label>
            <Input type="number" min={1} value={form.estimatedTime} onChange={(e) => setForm((f) => ({ ...f, estimatedTime: Number(e.target.value) }))} />
          </div>
          <div className="space-y-2">
            <Label>Max Responses (0 = unlimited)</Label>
            <Input type="number" min={0} value={form.maxResponses} onChange={(e) => setForm((f) => ({ ...f, maxResponses: Number(e.target.value) }))} />
          </div>
          <div className="flex items-center gap-3">
            <Label>Active</Label>
            <button onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className={`text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${form.active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "bg-muted text-muted-foreground border-border"}`}>
              {form.active ? <><ToggleRight size={14} /> Active</> : <><ToggleLeft size={14} /> Inactive</>}
            </button>
          </div>
        </div>

        {/* HTML Content */}
        <div className="space-y-2">
          <Label>Survey HTML Content *</Label>
          <p className="text-xs text-muted-foreground">
            Paste your survey HTML here. You can use standard form inputs, radio buttons, checkboxes, and textareas.
            The content renders inside a sandboxed iframe with safe styles applied.
          </p>
          <Textarea
            value={form.htmlContent}
            onChange={(e) => setForm((f) => ({ ...f, htmlContent: e.target.value }))}
            placeholder={`<div class="section">
  <p class="section-title">About You</p>
  <div class="question">
    <label class="required">How do you rate this course?</label>
    <div class="rating">
      <input type="radio" name="q1" id="q1a" value="1"><label for="q1a">1</label>
      <input type="radio" name="q1" id="q1b" value="2"><label for="q1b">2</label>
      <input type="radio" name="q1" id="q1c" value="3"><label for="q1c">3</label>
      <input type="radio" name="q1" id="q1d" value="4"><label for="q1d">4</label>
      <input type="radio" name="q1" id="q1e" value="5"><label for="q1e">5</label>
    </div>
  </div>
</div>`}
            rows={12}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "Saving..." : editing ? "Update Survey" : "Create Survey"}
          </Button>
          <Button variant="outline" onClick={closeForm}>Cancel</Button>
        </div>
      </div>
    );
  }

  /* ── Preview modal ── */
  if (preview) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:system-ui,sans-serif;font-size:14px;color:#1f2937;padding:16px;background:#fff;line-height:1.6}
      h1,h2,h3{font-weight:700;margin-bottom:12px}p{margin-bottom:10px}
      label{display:block;font-weight:600;margin-bottom:6px}
      input[type=text],textarea,select{width:100%;padding:10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:14px;margin-bottom:12px}
      input[type=radio],input[type=checkbox]{margin-right:8px;accent-color:#f59e0b}
      .question{margin-bottom:20px;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb}
      .section-title{font-size:16px;font-weight:700;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #f59e0b}
      .rating{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
      .rating label{cursor:pointer;padding:8px 14px;border:1.5px solid #d1d5db;border-radius:8px;font-weight:600}
      .required::after{content:" *";color:#ef4444}
    </style></head><body>${preview.htmlContent}</body></html>`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-lg">Preview: {preview.title}</h3>
          <Button variant="ghost" size="sm" onClick={() => setPreview(null)}><X size={14} /></Button>
        </div>
        <iframe srcDoc={fullHtml} sandbox="allow-forms allow-scripts" className="w-full rounded-2xl border" style={{ height: "60vh" }} />
      </div>
    );
  }

  /* ── List ─────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-lg flex items-center gap-2">📝 Surveys</h3>
        <Button size="sm" onClick={openCreate} className="gap-1.5"><Plus size={13} /> New Survey</Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Create HTML surveys that students complete in exchange for Gold Coins.
        Each student can only complete a survey once.
      </p>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full w-6 h-6 border-2 border-primary border-t-transparent" /></div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No surveys yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card">
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock size={9} /> {s.estimatedTime}m</span>
                  <span className="text-[11px] font-bold text-amber-500">🪙 {s.rewardCoins}</span>
                  {s.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{s.category}</span>}
                  <span className="text-[10px] text-muted-foreground">{s.responseCount ?? 0} responses</span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setPreview(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Preview">
                  <Eye size={13} className="text-muted-foreground" />
                </button>
                <button onClick={() => handleToggle(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={s.active ? "Deactivate" : "Activate"}>
                  {s.active ? <ToggleRight size={13} className="text-emerald-500" /> : <ToggleLeft size={13} className="text-muted-foreground" />}
                </button>
                <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <Pencil size={13} className="text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                  <Trash2 size={13} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
