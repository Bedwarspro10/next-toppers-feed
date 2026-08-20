import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { SiGoogle } from "react-icons/si";
import { Shield, Zap, Star, BookOpen, Lock } from "lucide-react";

export default function Login() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");
  const [featureIdx, setFeatureIdx] = useState(0);

  useEffect(() => {
    if (!loading && user) setLocation("/");
  }, [user, loading, setLocation]);

  useEffect(() => {
    const id = setInterval(() => setFeatureIdx((i) => (i + 1) % 3), 3000);
    return () => clearInterval(id);
  }, []);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch {
      setError("Sign in failed. Please try again.");
      setSigningIn(false);
    }
  };

  const features = [
    { icon: BookOpen, title: "Premium Study Material", desc: "NCERT notes, DPPs, and expert lectures" },
    { icon: Zap,      title: "Smart Practice Tests",   desc: "Topic-wise quizzes with instant results" },
    { icon: Star,     title: "Community & Mentors",    desc: "Connect, ask doubts, and grow together" },
  ];

  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #050d1a 0%, #061220 40%, #050d1a 100%)" }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(0,255,136,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(0,255,136,0.08) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at bottom left, rgba(0,200,255,0.06) 0%, transparent 70%)" }} />
      <div className="absolute top-1/3 right-0 w-[300px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at right, rgba(99,102,241,0.06) 0%, transparent 70%)" }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm mx-auto px-5 py-10 flex flex-col gap-6">

        {/* Logo + Brand */}
        <div className="flex flex-col items-center gap-4">
          {/* Logo with neon ring */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, #00ff88, #00d4ff, #6366f1, #00ff88)",
                padding: "2px",
                borderRadius: "9999px",
                filter: "blur(0px)",
                boxShadow: "0 0 24px rgba(0,255,136,0.35), 0 0 48px rgba(0,255,136,0.12)",
              }} />
            <div className="relative w-20 h-20 rounded-full p-[2.5px]"
              style={{ background: "conic-gradient(from 0deg, #00ff88, #00d4ff, #6366f1, #00ff88)" }}>
              <div className="w-full h-full rounded-full overflow-hidden bg-[#050d1a] flex items-center justify-center">
                <img src="/logo.png" alt="Next Toppers" className="w-14 h-14 object-cover rounded-full" />
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: "var(--font-display, sans-serif)" }}>
              <span className="text-white">Next Toppers</span>{" "}
              <span style={{
                background: "linear-gradient(135deg, #00ff88, #00d4ff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>Feed</span>
            </h1>
            <p className="text-white/50 text-sm mt-1.5 font-medium">
              Your complete study ecosystem for{" "}
              <span style={{ color: "#00ff88" }}>Class 10th</span>
            </p>
          </div>
        </div>

        {/* Login card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div className="px-6 pt-6 pb-5">
            <h2 className="text-xl font-black text-white mb-1">Sign in to continue</h2>
            <p className="text-white/45 text-sm mb-5">
              Access all your study resources for{" "}
              <span className="text-white/75 font-semibold">Aarambh Batch.</span>
            </p>

            {/* Google button */}
            <button
              onClick={handleGoogleLogin}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] relative overflow-hidden"
              style={{
                background: signingIn
                  ? "rgba(0,255,136,0.08)"
                  : "linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,212,255,0.1))",
                border: "1.5px solid rgba(0,255,136,0.4)",
                color: "#00ff88",
                boxShadow: signingIn ? "none" : "0 0 20px rgba(0,255,136,0.15)",
              }}
            >
              {signingIn ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-[#00ff88]/40 border-t-[#00ff88] animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <SiGoogle className="w-4 h-4 flex-shrink-0" style={{ color: "#00ff88" }} />
                  <span>Continue with Google</span>
                </>
              )}
              {/* Shimmer */}
              {!signingIn && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(0,255,136,0.06) 50%, transparent 100%)",
                  }} />
              )}
            </button>

            {error && (
              <p className="text-red-400 text-xs text-center mt-3 font-semibold">{error}</p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.08)" }} />
              <span className="text-white/25 text-xs font-medium">OR</span>
              <div className="flex-1 h-[1px]" style={{ background: "rgba(255,255,255,0.08)" }} />
            </div>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                { icon: Shield, label: "Secure & Safe",         sub: "Your data is 100% protected",          color: "#00ff88" },
                { icon: Zap,    label: "Quick Access",          sub: "One tap sign in, instant access",      color: "#00d4ff" },
                { icon: Star,   label: "Verified Students Only", sub: "Exclusive access for enrolled students", color: "#f59e0b" },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/85 text-sm font-semibold leading-none mb-0.5">{label}</p>
                    <p className="text-white/35 text-xs">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Terms footer */}
          <div className="px-6 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <p className="text-white/30 text-xs text-center leading-relaxed">
              By continuing, you agree to our{" "}
              <a href="/terms"
                className="font-semibold transition-colors hover:underline"
                style={{ color: "#00ff88" }}>
                Terms
              </a>
              {" "}&amp;{" "}
              <a href="/privacy"
                className="font-semibold transition-colors hover:underline"
                style={{ color: "#00ff88" }}>
                Privacy Policy
              </a>.
            </p>
          </div>
        </div>

        {/* Trust badge */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.2)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="9" cy="7" r="4" stroke="#00ff88" strokeWidth="1.5"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/80 text-sm font-bold leading-none mb-0.5">Trusted by 10,000+ students</p>
            <p className="text-white/35 text-xs">Learning smarter every day</p>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((s) => <Star key={s} size={10} fill="#f59e0b" className="text-amber-500" />)}
            </div>
            <p className="text-white/45 text-[10px] font-bold mt-0.5">4.8/5</p>
          </div>
        </div>

        {/* Bottom note */}
        <div className="flex items-center justify-center gap-2">
          <Lock size={11} style={{ color: "rgba(255,255,255,0.2)" }} />
          <p className="text-white/25 text-xs text-center">Only enrolled students can access course content.</p>
        </div>
      </div>
    </div>
  );
}
