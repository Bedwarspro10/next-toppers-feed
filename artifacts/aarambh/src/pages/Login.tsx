import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';

interface LoginProps {
  appName?: string;
  logoSrc?: string;
}

export default function Login({
  appName = 'NextToppers-Feed',
  logoSrc = 'https://nexttopper-feed.pages.dev/logo.png',
}: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // AuthContext/onAuthStateChanged is the source of truth.
  // Redirect only after Firebase auth + the existing AuthContext work is complete.
  useEffect(() => {
    if (!authLoading && user) {
      setLocation('/');
    }
  }, [authLoading, user, setLocation]);

  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // Do not navigate here. AuthContext will receive the Firebase user.
      // The effect above redirects after authLoading becomes false.
    } catch (err) {
      console.error('Google sign-in failed:', err);
      setError('Sign in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="hos-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;500;600&display=swap');
        .hos-root{position:relative;min-height:100vh;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 0%,#fbfbf9 0%,#f2f1ec 100%);font-family:'Inter',system-ui,sans-serif;padding:24px;box-sizing:border-box}
        .hos-orb{position:absolute;filter:blur(70px);opacity:.5;will-change:transform,border-radius}
        .hos-orb-a{width:46vw;height:46vw;max-width:420px;max-height:420px;top:-10%;left:-12%;background:linear-gradient(135deg,#ff8a65,#ff5f6d);animation:hosFloatA 16s ease-in-out infinite}
        .hos-orb-b{width:40vw;height:40vw;max-width:380px;max-height:380px;bottom:-14%;right:-10%;background:linear-gradient(135deg,#6c63ff,#4facfe);animation:hosFloatB 20s ease-in-out infinite}
        .hos-orb-c{width:26vw;height:26vw;max-width:260px;max-height:260px;bottom:6%;left:4%;background:linear-gradient(135deg,#ffd166,#ff8a65);opacity:.35;animation:hosFloatC 24s ease-in-out infinite}
        @keyframes hosFloatA{0%,100%{transform:translate(-8%,-6%) scale(1);border-radius:62% 38% 31% 69% / 58% 32% 68% 42%}50%{transform:translate(6%,8%) scale(1.15);border-radius:32% 68% 66% 34% / 48% 62% 38% 52%}}
        @keyframes hosFloatB{0%,100%{transform:translate(6%,6%) scale(1);border-radius:55% 45% 40% 60% / 50% 40% 60% 50%}50%{transform:translate(-8%,-10%) scale(1.2);border-radius:40% 60% 55% 45% / 60% 45% 55% 40%}}
        @keyframes hosFloatC{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10%,-12%) scale(1.25)}}
        .hos-card{position:relative;z-index:10;width:min(380px,100%);padding:44px 32px 32px;border-radius:32px;background:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.6);backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);box-shadow:0 20px 60px -20px rgba(20,20,30,.25),0 2px 8px rgba(20,20,30,.04);text-align:center;opacity:0;animation:hosCardIn .9s cubic-bezier(.34,1.56,.64,1) .05s forwards}
        @keyframes hosCardIn{0%{opacity:0;transform:translateY(28px) scale(.92)}100%{opacity:1;transform:translateY(0) scale(1)}}
        .hos-mark{width:64px;height:64px;margin:0 auto 22px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;box-shadow:0 10px 24px -10px rgba(108,99,255,.45),0 0 0 1px rgba(0,0,0,.04);animation:hosBreathe 4.5s ease-in-out infinite}
        .hos-mark-img{width:100%;height:100%;object-fit:contain;border-radius:8px}
        @keyframes hosBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        .hos-title,.hos-subtitle,.hos-btn,.hos-terms,.hos-error{opacity:0;animation:hosFadeUp .7s cubic-bezier(.22,1,.36,1) forwards}
        .hos-title{animation-delay:.22s}.hos-subtitle{animation-delay:.3s}.hos-btn{animation-delay:.4s}.hos-terms{animation-delay:.5s}.hos-error{animation-delay:0s}
        @keyframes hosFadeUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        .hos-title{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:800;font-size:24px;letter-spacing:-.02em;color:#17171b;margin:0 0 6px}
        .hos-subtitle{font-size:14px;color:#71717a;margin:0 0 28px;line-height:1.5}
        .hos-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:14px 20px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:#fff;box-shadow:0 1px 3px rgba(20,20,30,.06);font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:600;font-size:15px;color:#1c1c1e;cursor:pointer;transition:transform .35s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease,background .25s ease}
        .hos-btn:hover:not(:disabled){box-shadow:0 8px 20px -6px rgba(20,20,30,.15);transform:translateY(-1px)}
        .hos-btn:active:not(:disabled){transform:scale(.96)}
        .hos-btn:disabled{cursor:default;opacity:.85}
        .hos-btn:focus-visible{outline:2px solid #6c63ff;outline-offset:3px}
        .hos-btn-icon{display:flex;align-items:center;justify-content:center;width:20px;height:20px}
        .hos-spin{animation:hosSpin .8s linear infinite;color:#6c63ff}
        @keyframes hosSpin{to{transform:rotate(360deg)}}
        .hos-terms{font-size:12px;color:#a1a1aa;margin:20px 0 0;line-height:1.5}
        .hos-error{font-size:13px;color:#e0453f;margin:0 0 14px}
        @media(prefers-reduced-motion:reduce){.hos-orb,.hos-card,.hos-mark,.hos-title,.hos-subtitle,.hos-btn,.hos-terms,.hos-error,.hos-spin{animation:none!important;opacity:1!important;transform:none!important;transition:none!important}}
      `}</style>

      <div className="hos-orb hos-orb-a" />
      <div className="hos-orb hos-orb-b" />
      <div className="hos-orb hos-orb-c" />

      <div className="hos-card">
        <div className="hos-mark">
          <img src={logoSrc} alt={`${appName} logo`} className="hos-mark-img" />
        </div>

        <h1 className="hos-title">Welcome back</h1>
        <p className="hos-subtitle">Sign in to continue to {appName}</p>

        {error && <p className="hos-error">{error}</p>}

        <button
          type="button"
          className="hos-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
          aria-busy={loading}
        >
          <span className="hos-btn-icon">
            {loading ? <Loader2 className="hos-spin" size={20} /> : <GoogleGlyph />}
          </span>
          <span>{loading ? 'Signing in…' : 'Continue with Google'}</span>
        </button>

        <p className="hos-terms">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.5 35.1 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C39.8 37.4 44 31.4 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    </svg>
  );
}
