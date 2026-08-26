import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Home, BookOpen, Youtube, Bell, User as UserIcon,
  LogIn, Menu, Shield, X, ChevronRight, LogOut,
  Sun, Moon, Contact, MessageSquare, Sparkles, Crown,
  Search, Bookmark, Wrench, Receipt, FileQuestion, ArrowLeft,
  Maximize, Minimize, Trophy, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePremium } from "@/contexts/PremiumContext";
import { usePremiumModal } from "@/contexts/PremiumModalContext";
import { useUnread } from "@/contexts/UnreadContext";
import { useBot } from "@/contexts/BotContext";
import { CoinChipMobile, CoinChipDesktop } from "@/components/CoinChip";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { onSnapshot, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import NextCutieFeedBot from "@/components/NextCutieFeedBot";

/* ── Keyboard-open detector (Android fix) ── */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      setOpen(window.innerHeight - vv.height > 150);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);
  return open;
}

function useDarkMode() {
  const [dark, setDark] = React.useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };
  return { dark, toggle };
}

function PremiumChip() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500 text-[9px] font-bold tracking-wide uppercase border border-amber-500/25 select-none">
      <Crown size={8} />PREMIUM
    </span>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAdmin } = useAuth();
  const { isPremium } = usePremium();
  const { setOpen: openPremium } = usePremiumModal();
  const { communityUnread, totalPrivateUnread } = useUnread();
  const { toggleOpen: toggleBot } = useBot();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const keyboardOpen = useKeyboardOpen();
  const isOnChat = location.startsWith("/chat");

  /* Fullscreen API */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "maintenance"), (snap) => {
      if (snap.exists()) setMaintenance(snap.data() as { enabled: boolean; message: string });
      else setMaintenance(null);
    }, () => setMaintenance(null));
    return unsub;
  }, []);

  const drawerItems = [
    { href: "/",              label: "Home",            sub: "Go to homepage",           icon: Home },
    { href: "/subjects",      label: "Subjects",        sub: "Explore all subjects",     icon: BookOpen },
    { href: "/youtube",       label: "YouTube",         sub: "Watch educational videos",  icon: Youtube },
    { href: "/announcements", label: "Announcements",   sub: "Latest updates & news",    icon: Bell },
    { href: "/search",        label: "Search",          sub: "Find lectures & files",    icon: Search },
    { href: "/tests",         label: "Practice Tests",  sub: "Quizzes & mock tests",     icon: FileQuestion },
    { href: "/surveys",       label: "Surveys",         sub: "Earn coins by completing surveys", icon: ClipboardList },
    { href: "/wallet",        label: "Gold Wallet",     sub: "Coins, rewards & premium", icon: Trophy },
    { href: "/bookmarks",     label: "Bookmarks",       sub: "Your saved items",         icon: Bookmark },
    { href: "/contact",       label: "Contact",         sub: "Get in touch with us",     icon: Contact },
    { href: "/chat",          label: "Chat",            sub: "Start a conversation",     icon: MessageSquare },
    { href: "/profile",       label: "Profile",         sub: "View your profile",        icon: UserIcon },
  ];
  if (user) drawerItems.push({ href: "/payments", label: "Payment History", sub: "Your payment records", icon: Receipt });
  if (isAdmin) drawerItems.push({ href: "/admin", label: "Admin", sub: "Admin panel", icon: Shield });

  const sidebarItems = [
    { href: "/",              label: "Home",          icon: Home },
    { href: "/subjects",      label: "Subjects",      icon: BookOpen },
    { href: "/youtube",       label: "YouTube",       icon: Youtube },
    { href: "/announcements", label: "Announcements", icon: Bell },
    { href: "/search",        label: "Search",        icon: Search },
    { href: "/tests",         label: "Tests",         icon: FileQuestion },
    { href: "/surveys",       label: "Surveys",       icon: ClipboardList },
    { href: "/leaderboard",   label: "Leaderboard",   icon: Trophy },
  ];
  if (user) {
    sidebarItems.push({ href: "/bookmarks", label: "Bookmarks",       icon: Bookmark });
    sidebarItems.push({ href: "/chat",      label: "Chat",            icon: MessageSquare });
    sidebarItems.push({ href: "/payments",  label: "Payments",        icon: Receipt });
    sidebarItems.push({ href: "/profile",   label: "Profile",         icon: UserIcon });
  } else {
    sidebarItems.push({ href: "/login", label: "Sign In", icon: LogIn });
  }
  if (isAdmin) sidebarItems.push({ href: "/admin", label: "Admin", icon: Shield });

  const handleSignOut = () => signOut(auth);
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  const Logo = () => (
    <Link href="/">
      <div className="flex items-center gap-2.5 cursor-pointer group">
        <img src="/logo.png" alt="Next Toppers" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
        <div className="leading-none">
          <span className="block text-sm font-bold text-sidebar-foreground font-display tracking-tight group-hover:text-white transition-colors">
            Next Toppers
          </span>
          <span className="block text-[10px] font-semibold text-sidebar-foreground/50 tracking-widest uppercase">
            Feed
          </span>
        </div>
      </div>
    </Link>
  );

  const NavItem = ({ item, onClick }: { item: typeof sidebarItems[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    const isChat = item.href === "/chat";
    const totalChatUnread = communityUnread + totalPrivateUnread;
    const unread = isChat && totalChatUnread > 0 && !active ? totalChatUnread : 0;
    return (
      <Link href={item.href} onClick={onClick}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer press-spring relative overflow-hidden ${
          active
            ? "text-sidebar-primary font-semibold"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium"
        }`}>
          {active && (
            <motion.div
              layoutId="hyper-sidebar-pill"
              className="absolute inset-0 bg-sidebar-primary/20 rounded-xl"
              transition={{ type: "spring", stiffness: 500, damping: 34, mass: 0.9 }}
            />
          )}
          {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-full z-10" />}
          <div className={`relative z-10 flex-shrink-0 ${active ? "animate-tab-bounce" : ""}`}>
            <Icon size={17} />
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <span className="relative z-10 text-sm">{item.label}</span>
        </div>
      </Link>
    );
  };

  if (maintenance?.enabled && !isAdmin) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
          <Wrench size={28} className="text-amber-500" />
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Under Maintenance</h1>
        <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
          {maintenance.message || "We're making improvements. Please check back shortly."}
        </p>
        <div className="mt-6 px-4 py-2 rounded-xl bg-muted text-xs text-muted-foreground">
          Next Toppers – Aarambh
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border fixed top-0 left-0 h-full z-30">
        <div className="px-4 py-4 border-b border-sidebar-border/60">
          <Logo />
          {isPremium && (
            <div className="mt-2.5">
              <PremiumChip />
            </div>
          )}
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {sidebarItems.map((item) => <NavItem key={item.href} item={item} />)}
        </nav>
        <div className="px-2.5 py-3 border-t border-sidebar-border/60 space-y-1.5">
          {/* Coin Chip — desktop sidebar */}
          {user && <CoinChipDesktop />}
          {user && !isAdmin && (
            isPremium ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Crown size={13} className="text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">Premium Active</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => openPremium(true)}
                className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl text-sm font-semibold transition-all group"
                style={{
                  background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(249,115,22,0.08) 100%)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "rgb(217,119,6)",
                }}
              >
                <Crown size={14} className="group-hover:scale-110 transition-transform flex-shrink-0" />
                <span>Upgrade to Premium</span>
              </button>
            )
          )}
          <button
            onClick={toggleBot}
            className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl text-sm font-semibold transition-all group"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(236,72,153,0.08) 100%)",
              border: "1px solid rgba(139,92,246,0.2)",
              color: "rgb(139,92,246)",
            }}
          >
            <Sparkles size={14} className="group-hover:scale-110 transition-transform flex-shrink-0" />
            <span>Ask AI</span>
          </button>
          <button
            onClick={toggleDark}
            className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-xl text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all text-sm font-medium"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
          {!user ? (
            <Link href="/login">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer bg-sidebar-primary/20 text-sidebar-primary hover:bg-sidebar-primary/30 transition-all font-semibold text-sm">
                <LogIn size={14} /> Sign in
              </div>
            </Link>
          ) : (
            <div className="px-3 py-2.5 rounded-xl bg-sidebar-accent">
              <div className="flex items-center gap-2 mb-1.5">
                {user.photoURL
                  ? <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-7 h-7 rounded-full bg-sidebar-primary/30 flex items-center justify-center text-sidebar-primary text-xs font-bold flex-shrink-0">{user.displayName?.charAt(0) ?? "U"}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-semibold text-sidebar-foreground truncate">{user.displayName}</p>
                    {isPremium && <PremiumChip />}
                  </div>
                  <p className="text-[10px] text-sidebar-foreground/45 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={handleSignOut} className="flex items-center gap-1.5 text-[11px] text-sidebar-foreground/45 hover:text-sidebar-foreground transition-colors">
                <LogOut size={11} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 md:ml-56 flex flex-col min-h-screen">
        {/* ── Mobile Topbar ── */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card sticky top-0 z-20 shadow-sm">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer active:opacity-70 transition-opacity">
              <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-border/50">
                <img src="/logo.png" alt="" className="w-full h-full object-cover" />
              </div>
              <span className="font-black text-sm font-display text-foreground tracking-tight">
                Next Toppers <span className="text-blue-500">Feed</span>
              </span>
            </div>
          </Link>

          {/* Coin Chip — mobile topbar */}
          {user && <CoinChipMobile />}

          <div className="flex items-center gap-1">
            {/* Premium / Upgrade button */}
            {user && isPremium && !isAdmin && (
              <button
                onClick={() => openPremium(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                style={{
                  background: "rgba(251,191,36,0.08)",
                  border: "1.5px solid rgba(251,191,36,0.4)",
                  color: "rgb(180,83,9)",
                }}
              >
                <Crown size={11} className="text-amber-500" />
                <span>Premium</span>
              </button>
            )}
            {user && !isPremium && !isAdmin && (
              <button
                onClick={() => openPremium(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                style={{
                  background: "rgba(251,191,36,0.06)",
                  border: "1.5px solid rgba(251,191,36,0.35)",
                  color: "rgb(217,119,6)",
                }}
              >
                <Crown size={11} className="text-amber-500" />
                <span>Upgrade</span>
              </button>
            )}
            {/* Fullscreen toggle */}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90 border border-border/50"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen mode"}
            >
              {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            </button>
            {/* AI Bot */}
            <button
              onClick={toggleBot}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90"
              style={{ color: "rgb(139,92,246)" }}
              aria-label="Ask AI"
            >
              <Sparkles size={17} />
            </button>
            <button
              onClick={toggleDark}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground transition-all active:scale-90"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {/* Polished hamburger menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-foreground bg-secondary border border-border transition-all active:scale-90 hover:bg-secondary/80"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X size={18} strokeWidth={2.5} />
              ) : (
                <div className="flex flex-col gap-[5px] items-center justify-center w-5">
                  <span className="block w-5 h-[2px] bg-foreground rounded-full transition-all" />
                  <span className="block w-3.5 h-[2px] bg-foreground/60 rounded-full transition-all" />
                  <span className="block w-5 h-[2px] bg-foreground rounded-full transition-all" />
                </div>
              )}
            </button>
          </div>
        </header>

        {/* ── Mobile Drawer (dark slide-in from right) ── */}
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <div
              className="md:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
              onClick={() => setMobileOpen(false)}
            />
            {/* Panel */}
            <div
              className="md:hidden fixed top-0 right-0 bottom-0 z-50 w-[76%] max-w-[320px] flex flex-col overflow-hidden"
              style={{
                background: "#0d1117",
                borderLeft: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "-8px 0 32px rgba(0,0,0,0.6)",
                animation: "slideInRight 0.22s ease",
              }}
            >
              {/* Top: Back to Home */}
              <div className="px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 font-bold text-sm"
                  style={{ color: "#60a5fa" }}
                >
                  <ArrowLeft size={16} />
                  Back to Home
                </button>
              </div>

              {/* Nav items */}
              <div className="flex-1 overflow-y-auto py-2">
                {/* Group 1: Core nav */}
                {[
                  { href: "/subjects",      label: "Subjects",       icon: BookOpen,      color: "#3b82f6", bg: "rgba(59,130,246,0.18)" },
                  { href: "/youtube",       label: "YouTube",        icon: Youtube,       color: "#ef4444", bg: "rgba(239,68,68,0.18)" },
                  { href: "/announcements", label: "Announcements",  icon: Bell,          color: "#10b981", bg: "rgba(16,185,129,0.18)" },
                ].map(({ href, label, icon: Icon, color, bg }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors"
                        style={{ background: active ? "rgba(255,255,255,0.05)" : undefined }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: bg }}>
                          <Icon size={17} style={{ color }} />
                        </div>
                        <span className="font-semibold text-sm" style={{ color: active ? "#fff" : "rgba(255,255,255,0.85)" }}>
                          {label}
                        </span>
                      </div>
                    </Link>
                  );
                })}

                <div className="mx-5 my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

                {/* Group 2: Tools */}
                {[
                  { href: "/search",       label: "Search",         icon: Search,        color: "#8b5cf6", bg: "rgba(139,92,246,0.18)" },
                  { href: "/tests",        label: "Practice Tests", icon: FileQuestion,  color: "#f97316", bg: "rgba(249,115,22,0.18)" },
                  { href: "/leaderboard",  label: "Leaderboard",   icon: Trophy,        color: "#f59e0b", bg: "rgba(245,158,11,0.18)" },
                  { href: "/bookmarks",    label: "Bookmarks",      icon: Bookmark,      color: "#f43f5e", bg: "rgba(244,63,94,0.18)" },
                  { href: "/contact",      label: "Contact Us",     icon: Contact,       color: "#10b981", bg: "rgba(16,185,129,0.18)" },
                ].map(({ href, label, icon: Icon, color, bg }) => {
                  const active = isActive(href);
                  return (
                    <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors"
                        style={{ background: active ? "rgba(255,255,255,0.05)" : undefined }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: bg }}>
                          <Icon size={17} style={{ color }} />
                        </div>
                        <span className="font-semibold text-sm" style={{ color: active ? "#fff" : "rgba(255,255,255,0.85)" }}>
                          {label}
                        </span>
                      </div>
                    </Link>
                  );
                })}

                <div className="mx-5 my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }} />

                {/* Group 3: User */}
                {[
                  { href: "/chat",     label: "Chat",           icon: MessageSquare, color: "#3b82f6", bg: "rgba(59,130,246,0.18)" },
                  { href: "/profile",  label: "Profile",        icon: UserIcon,      color: "#8b5cf6", bg: "rgba(139,92,246,0.18)" },
                  ...(user ? [{ href: "/payments", label: "Payment History", icon: Receipt, color: "#f59e0b", bg: "rgba(245,158,11,0.18)" }] : []),
                  ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield, color: "#10b981", bg: "rgba(16,185,129,0.18)" }] : []),
                ].map(({ href, label, icon: Icon, color, bg }) => {
                  const active = isActive(href);
                  const isChat = href === "/chat";
                  const unread = isChat && (communityUnread + totalPrivateUnread) > 0 && !active
                    ? communityUnread + totalPrivateUnread : 0;
                  return (
                    <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                      <div className="flex items-center gap-3.5 px-5 py-3.5 cursor-pointer transition-colors"
                        style={{ background: active ? "rgba(255,255,255,0.05)" : undefined }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                          style={{ background: bg }}>
                          <Icon size={17} style={{ color }} />
                          {unread > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                              {unread > 9 ? "9+" : unread}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-sm" style={{ color: active ? "#fff" : "rgba(255,255,255,0.85)" }}>
                          {label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Bottom: User profile card */}
              <div className="flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                {!user ? (
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <LogIn size={16} className="text-white/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white/80">Sign In</p>
                        <p className="text-[11px] text-white/35">Login to your account</p>
                      </div>
                      <ChevronRight size={15} className="text-white/25 flex-shrink-0" />
                    </div>
                  </Link>
                ) : (
                  <Link href="/profile" onClick={() => setMobileOpen(false)}>
                    <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/5 transition-colors">
                      {user.photoURL
                        ? <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.15)" }} />
                        : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", color: "white" }}>
                            {(user.displayName ?? "U").charAt(0).toUpperCase()}
                          </div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white truncate max-w-[120px]">{user.displayName ?? "Student"}</p>
                          {isPremium && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0"
                              style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }}>
                              PREMIUM
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{user.email}</p>
                      </div>
                      <ChevronRight size={15} className="flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
                    </div>
                  </Link>
                )}
              </div>
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
        <NextCutieFeedBot />

        {/* Footer */}
        <footer className="hidden md:block border-t border-border bg-card/60 px-6 py-5 text-xs text-muted-foreground">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-4 h-4 rounded object-cover opacity-60" />
              <span className="font-semibold text-foreground/60">Next Toppers – Feed</span>
              <span className="text-muted-foreground/50">© {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-5">
              {["/contact", "/terms", "/privacy"].map((href) => (
                <Link key={href} href={href}>
                  <span className="hover:text-foreground transition-colors cursor-pointer capitalize">{href.slice(1)}</span>
                </Link>
              ))}
            </div>
          </div>
        </footer>

        {/* Mobile Bottom Nav — hidden when keyboard is open on chat (Android fix) */}
        <nav className={`md:hidden fixed bottom-0 w-full border-t border-border bg-card flex items-center justify-around px-1 py-1.5 z-20 shadow-lg transition-transform duration-150 ${keyboardOpen && isOnChat ? "translate-y-full pointer-events-none" : "translate-y-0"}`}>
          {[
            { href: "/",              icon: Home,          label: "Home" },
            { href: "/subjects",      icon: BookOpen,      label: "Subjects" },
            { href: "/youtube",       icon: Youtube,       label: "YouTube" },
            { href: "/announcements", icon: Bell,          label: "Alerts" },
            ...(user
              ? [{ href: "/chat", icon: MessageSquare, label: "Chat" }]
              : [{ href: "/login", icon: LogIn, label: "Sign In" }]
            ),
          ].map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            const isChat = href === "/chat";
            const unread = isChat && (communityUnread + totalPrivateUnread) > 0 && !active
              ? communityUnread + totalPrivateUnread
              : 0;
            return (
              <Link key={href} href={href}>
                <div className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl cursor-pointer press-spring">
                  {active && (
                    <motion.div
                      layoutId="hyper-bottom-nav-pill"
                      className="absolute inset-0 rounded-xl bg-blue-500/10"
                      transition={{ type: "spring", stiffness: 500, damping: 32, mass: 0.9 }}
                    />
                  )}
                  <div className={`relative z-10 ${active ? "text-blue-500 animate-tab-bounce" : "text-muted-foreground"}`}>
                    <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
                    {unread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </div>
                  <span className={`relative z-10 text-[9px] font-semibold tracking-wide transition-colors ${active ? "text-blue-500" : "text-muted-foreground/65"}`}>{label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
