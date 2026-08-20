import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useLocation } from "wouter";
import { X, ChevronRight, Loader2 } from "lucide-react";

/* ─── types ─────────────────────────────────────────────── */
export type PopupMode = "always" | "once_session" | "once_day" | "disabled";

export interface SubjectPopupConfig {
  enabled: boolean;
  mode: PopupMode;
  title: string;
  subtitle: string;
  imageBase64: string;
  updatedAt?: { seconds: number };
}

interface PopupState {
  subjectId: string;
  config: SubjectPopupConfig;
  targetHref: string;
}

interface SubjectPopupContextValue {
  requestNavigation: (subjectId: string, href: string) => void;
  configs: Record<string, SubjectPopupConfig | null>;
}

const SubjectPopupContext = createContext<SubjectPopupContextValue>({
  requestNavigation: () => {},
  configs: {},
});

export function useSubjectPopup() { return useContext(SubjectPopupContext); }

/* ─── mode check helpers ─────────────────────────────────── */
const POPUP_SUBJECTS = ["maths", "science", "sst"];

function sessionKey(id: string) { return `nt_popup_session_${id}`; }
function dayKey(id: string) { return `nt_popup_day_${id}`; }

function shouldShow(subjectId: string, mode: PopupMode): boolean {
  if (mode === "disabled") return false;
  if (mode === "always") return true;
  if (mode === "once_session") {
    return !sessionStorage.getItem(sessionKey(subjectId));
  }
  if (mode === "once_day") {
    const stored = localStorage.getItem(dayKey(subjectId));
    if (!stored) return true;
    const today = new Date().toDateString();
    return stored !== today;
  }
  return false;
}

function markShown(subjectId: string, mode: PopupMode) {
  if (mode === "once_session") {
    sessionStorage.setItem(sessionKey(subjectId), "1");
  } else if (mode === "once_day") {
    localStorage.setItem(dayKey(subjectId), new Date().toDateString());
  }
}

/* ─── popup modal UI ─────────────────────────────────────── */
function SubjectPopupModal({
  popup, onClose, onContinue,
}: {
  popup: PopupState;
  onClose: () => void;
  onContinue: () => void;
}) {
  const { config } = popup;
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        style={{
          background: "linear-gradient(160deg,#0d1224 0%,#0a0d1a 60%,#0f0820 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        }}>
        {/* Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle,rgba(99,102,241,0.5),transparent 70%)", transform: "translate(30%,-30%)" }} />

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <X size={14} className="text-white/70" />
        </button>

        {/* Teacher image */}
        {config.imageBase64 && (
          <div className="relative w-full aspect-[4/3] overflow-hidden bg-black/30">
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={24} className="text-white/30 animate-spin" />
              </div>
            )}
            <img
              src={config.imageBase64}
              alt={config.title}
              className="w-full h-full object-cover transition-opacity duration-300"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              onLoad={() => setImgLoaded(true)}
            />
            <div className="absolute inset-0"
              style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(13,18,36,0.95) 100%)" }} />
          </div>
        )}

        {/* Content */}
        <div className="px-5 pb-5" style={{ paddingTop: config.imageBase64 ? "12px" : "52px" }}>
          {config.title && (
            <h2 className="text-white font-black text-xl leading-tight mb-1">{config.title}</h2>
          )}
          {config.subtitle && (
            <p className="text-white/55 text-sm leading-relaxed mb-5">{config.subtitle}</p>
          )}
          <button
            onClick={onContinue}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm text-white"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
            Continue <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── provider ───────────────────────────────────────────── */
export function SubjectPopupProvider({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [configs, setConfigs] = useState<Record<string, SubjectPopupConfig | null>>({});
  const [activePopup, setActivePopup] = useState<PopupState | null>(null);
  const configsRef = useRef(configs);
  configsRef.current = configs;

  /* Subscribe to each subject's popup config */
  useEffect(() => {
    const unsubs = POPUP_SUBJECTS.map((id) =>
      onSnapshot(
        doc(db, "subjectPopups", id),
        (snap) => {
          setConfigs((prev) => ({
            ...prev,
            [id]: snap.exists() ? (snap.data() as SubjectPopupConfig) : null,
          }));
        },
        () => setConfigs((prev) => ({ ...prev, [id]: null })),
      )
    );
    return () => unsubs.forEach((u) => u());
  }, []);

  const requestNavigation = useCallback((subjectId: string, href: string) => {
    const cfg = configsRef.current[subjectId];
    if (!cfg || !cfg.enabled || !shouldShow(subjectId, cfg.mode)) {
      navigate(href);
      return;
    }
    setActivePopup({ subjectId, config: cfg, targetHref: href });
  }, [navigate]);

  const handleClose = () => setActivePopup(null);
  const handleContinue = () => {
    if (activePopup) {
      markShown(activePopup.subjectId, activePopup.config.mode);
      navigate(activePopup.targetHref);
      setActivePopup(null);
    }
  };

  return (
    <SubjectPopupContext.Provider value={{ requestNavigation, configs }}>
      {children}
      {activePopup && (
        <SubjectPopupModal popup={activePopup} onClose={handleClose} onContinue={handleContinue} />
      )}
    </SubjectPopupContext.Provider>
  );
}
