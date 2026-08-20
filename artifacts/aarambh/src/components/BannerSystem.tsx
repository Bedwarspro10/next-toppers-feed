import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { X, ExternalLink, Loader2, Play, Radio, Megaphone } from "lucide-react";
import { useLocation } from "wouter";

/* ─── types ─────────────────────────────────────────────── */
type BannerMode = "always" | "once_session" | "once_day" | "disabled";
type BannerType = "external" | "internal" | "youtube_video" | "youtube_live" | "announcement_popup";

interface BannerDoc {
  enabled: boolean;
  mode: BannerMode;
  imageBase64: string;
  redirectUrl: string;
  updatedAt?: { seconds: number };
}

/* ─── New Smart Banner ─────────────────────────────────── */
export interface SmartBanner {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  bannerType: BannerType;
  link: string;
  priority: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  popupMessage?: string;
  enabled: boolean;
  createdAt?: { seconds: number };
}

/* ─── YouTube helpers ─────────────────────────────────── */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function isYouTubeLiveUrl(url: string): boolean {
  return url.includes("/live/") || url.includes("live=1") || url.includes("&live");
}

export function inferBannerType(url: string): BannerType {
  if (!url) return "external";
  if (isYouTubeLiveUrl(url)) return "youtube_live";
  if (extractYouTubeId(url)) return "youtube_video";
  if (url.startsWith("/") || url.startsWith(window.location.origin)) return "internal";
  return "external";
}

/* ─── helpers ────────────────────────────────────────────── */
const SESSION_KEY = "nt_startup_banner_seen";
const DAY_KEY = "nt_startup_banner_day";

function shouldShowBanner(mode: BannerMode, sessionKey: string, dayKey: string): boolean {
  if (mode === "disabled") return false;
  if (mode === "always") return true;
  if (mode === "once_session") return !sessionStorage.getItem(sessionKey);
  if (mode === "once_day") {
    const stored = localStorage.getItem(dayKey);
    return stored !== new Date().toDateString();
  }
  return false;
}

function markBannerSeen(mode: BannerMode, sessionKey: string, dayKey: string) {
  if (mode === "once_session") sessionStorage.setItem(sessionKey, "1");
  if (mode === "once_day") localStorage.setItem(dayKey, new Date().toDateString());
}

function isSmartBannerActive(banner: SmartBanner): boolean {
  if (!banner.active || !banner.enabled) return false;
  const now = new Date();
  if (banner.startDate) {
    const start = new Date(banner.startDate);
    if (now < start) return false;
  }
  if (banner.endDate) {
    const end = new Date(banner.endDate);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  return true;
}

/* ─── Announcement Popup ─────────────────────────────── */
function AnnouncementPopupModal({ message, title, onClose }: {
  message: string; title?: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
      <div className="relative w-full max-w-sm animate-in zoom-in-95 fade-in duration-200">
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 40px 100px rgba(0,0,0,0.5)",
          }}>
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <Megaphone size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Announcement</p>
                <h3 className="font-bold text-foreground text-base leading-tight">{title ?? "Important Notice"}</h3>
              </div>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed mb-5">{message}</p>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.4)" }}>
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Smart Top Banner ───────────────────────────────── */
export function SmartTopBanner() {
  const [banners, setBanners] = useState<SmartBanner[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "smartBanners"), orderBy("priority", "asc")),
      (snap) => {
        setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmartBanner)));
      },
      () => {}
    );
    return unsub;
  }, []);

  const banner = banners.find(b => isSmartBannerActive(b));
  const dismissed2 = sessionStorage.getItem("nt_smart_top_dismissed");

  if (!banner || dismissed || dismissed2) return <LegacyTopBanner />;

  const handleDismiss = () => {
    sessionStorage.setItem("nt_smart_top_dismissed", "1");
    setDismissed(true);
  };

  const handleClick = () => {
    const { bannerType, link, popupMessage, title } = banner;
    if (bannerType === "announcement_popup") {
      setShowPopup(true);
      return;
    }
    if (bannerType === "youtube_video" || bannerType === "youtube_live") {
      const ytId = extractYouTubeId(link);
      if (ytId) {
        const isLive = bannerType === "youtube_live";
        navigate(`/watch?v=${ytId}&title=${encodeURIComponent(title ?? "Video")}&live=${isLive ? "1" : "0"}`);
        return;
      }
    }
    if (bannerType === "internal") {
      const path = link.startsWith(window.location.origin)
        ? link.replace(window.location.origin, "")
        : link;
      navigate(path);
      return;
    }
    if (link) window.open(link, "_blank", "noopener");
  };

  const bannerTypeIcon = () => {
    if (banner.bannerType === "youtube_video") return <Play size={11} fill="currentColor" />;
    if (banner.bannerType === "youtube_live") return <Radio size={11} />;
    if (banner.bannerType === "external") return <ExternalLink size={11} />;
    if (banner.bannerType === "announcement_popup") return <Megaphone size={11} />;
    return null;
  };

  return (
    <>
      <section className="w-full mb-4 animate-fade-in-up">
        <div className="relative w-full overflow-hidden rounded-2xl group cursor-pointer"
          style={{
            aspectRatio: banner.imageUrl ? "16/9" : undefined,
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
          }}
          onClick={handleClick}>

          {banner.imageUrl ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-secondary/50">
                  <div className="w-full h-full animate-pulse bg-secondary" />
                </div>
              )}
              <img
                src={banner.imageUrl}
                alt={banner.title ?? "Banner"}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
                onLoad={() => setImgLoaded(true)}
              />
              {/* Overlay for text */}
              {(banner.title || banner.subtitle || banner.buttonText) && (
                <div className="absolute inset-0 flex flex-col justify-end p-4"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }}>
                  {banner.title && (
                    <h3 className="text-white font-black text-base leading-tight">{banner.title}</h3>
                  )}
                  {banner.subtitle && (
                    <p className="text-white/70 text-xs mt-1">{banner.subtitle}</p>
                  )}
                  {banner.buttonText && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: "rgba(99,102,241,0.85)", backdropFilter: "blur(4px)" }}>
                        {bannerTypeIcon()}
                        {banner.buttonText}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Type badge */}
              {(banner.bannerType === "youtube_live") && (
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white"
                  style={{ background: "rgba(239,68,68,0.9)", backdropFilter: "blur(4px)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
              )}
              {banner.bannerType === "youtube_video" && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                    <Play size={22} className="text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Text-only banner */
            <div className="w-full px-5 py-6 flex items-center gap-4"
              style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}>
              {bannerTypeIcon() && (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <span className="text-indigo-400 scale-125">{bannerTypeIcon()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {banner.title && <h3 className="font-bold text-foreground text-sm">{banner.title}</h3>}
                {banner.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{banner.subtitle}</p>}
              </div>
              {banner.buttonText && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  {banner.buttonText}
                </span>
              )}
            </div>
          )}

          {/* Dismiss */}
          <button onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
            <X size={12} className="text-white" />
          </button>
        </div>
      </section>

      {showPopup && (
        <AnnouncementPopupModal
          message={banner.popupMessage ?? banner.subtitle ?? ""}
          title={banner.title}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
}

/* ─── TopBanner (legacy fallback) ───────────────────────── */
function LegacyTopBanner() {
  const [config, setConfig] = useState<BannerDoc | null>(null);
  const [show, setShow] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteBanners", "topBanner"), (snap) => {
      if (!snap.exists()) { setConfig(null); setShow(false); return; }
      const data = snap.data() as BannerDoc;
      setConfig(data);
      if (data.enabled && data.imageBase64) {
        const hidden = sessionStorage.getItem("nt_top_banner_dismissed");
        if (!hidden) setShow(true);
      } else {
        setShow(false);
      }
    }, () => {});
    return unsub;
  }, []);

  if (!show || !config?.imageBase64 || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem("nt_top_banner_dismissed", "1");
    setDismissed(true);
  };

  const handleClick = () => {
    const url = config?.redirectUrl?.trim();
    if (!url) return;
    const ytId = extractYouTubeId(url);
    if (ytId) {
      const isLive = url.includes("/live/") || url.includes("live=1");
      navigate(`/watch?v=${ytId}&title=${encodeURIComponent("Video")}&live=${isLive ? "1" : "0"}`);
      return;
    }
    if (url.startsWith("/")) { navigate(url); return; }
    window.open(url, "_blank", "noopener");
  };

  return (
    <section className="w-full mb-4">
      <div className="relative w-full overflow-hidden rounded-2xl group"
        style={{ aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)" }}>
        {!imgLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 animate-pulse" />
        )}
        <img
          src={config.imageBase64}
          alt="Promotional Banner"
          className="w-full h-full object-cover cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
          style={{ opacity: imgLoaded ? 1 : 0, transition: "opacity 0.3s" }}
          onLoad={() => setImgLoaded(true)}
          onClick={handleClick}
        />
        <button onClick={handleDismiss}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <X size={12} className="text-white" />
        </button>
      </div>
    </section>
  );
}

/* ─── TopBanner export (tries smart first) ─────────────── */
export function TopBanner() {
  return <SmartTopBanner />;
}

/* ─────────────────────────────────────────────────────────────
   STARTUP POPUP BANNER
─────────────────────────────────────────────────────────────── */
export function StartupBanner() {
  const [config, setConfig] = useState<BannerDoc | null>(null);
  const [visible, setVisible] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteBanners", "popupBanner"), (snap) => {
      if (!snap.exists()) { setConfig(null); setVisible(false); return; }
      const data = snap.data() as BannerDoc;
      setConfig(data);
      if (data.enabled && data.imageBase64 && shouldShowBanner(data.mode, SESSION_KEY, DAY_KEY)) {
        setVisible(true);
      }
    }, () => {});
    return unsub;
  }, []);

  if (!visible || !config?.imageBase64) return null;

  const handleClose = () => {
    markBannerSeen(config.mode, SESSION_KEY, DAY_KEY);
    setVisible(false);
  };

  const handleClick = () => {
    const url = config.redirectUrl?.trim();
    if (url) {
      const ytId = extractYouTubeId(url);
      if (ytId) {
        const isLive = url.includes("/live/") || url.includes("live=1");
        handleClose();
        navigate(`/watch?v=${ytId}&title=${encodeURIComponent("Video")}&live=${isLive ? "1" : "0"}`);
        return;
      }
      if (url.startsWith("/")) { handleClose(); navigate(url); return; }
      window.open(url, "_blank", "noopener");
    }
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)" }}>
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in duration-200">
        <button onClick={handleClose}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
          <X size={15} className="text-white" />
        </button>
        <div
          className="rounded-2xl overflow-hidden cursor-pointer"
          style={{ border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 40px 100px rgba(0,0,0,0.5)" }}
          onClick={handleClick}>
          {!imgLoaded && (
            <div className="flex items-center justify-center w-full h-48 bg-black/40">
              <Loader2 size={24} className="text-white/30 animate-spin" />
            </div>
          )}
          <img
            src={config.imageBase64}
            alt="Announcement"
            className="w-full object-contain"
            style={{ display: imgLoaded ? "block" : "none", maxHeight: "70vh" }}
            onLoad={() => setImgLoaded(true)}
          />
          {config.redirectUrl?.trim() && imgLoaded && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white/80"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
              <ExternalLink size={10} /> Open link
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
