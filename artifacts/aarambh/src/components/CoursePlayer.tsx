import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface CoursePlayerProps {
  src: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

export function CoursePlayer({ src, title, open, onClose }: CoursePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "buffering" | "error">("loading");
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!open || !videoRef.current || !src) return;
    const video = videoRef.current;
    let hls: Hls | null = null;
    setStatus("loading");

    const onLoaded = () => setStatus("ready");
    const onWaiting = () => setStatus("buffering");
    const onPlaying = () => setStatus("ready");
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
    } else if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus("ready"));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setStatus("error");
      });
    } else {
      setStatus("error");
    }

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [open, src]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-0 sm:p-4">
      <div className="hyperos-backdrop open" onClick={onClose} />
      <div className="hyperos-panel open bg-black w-full h-full sm:h-auto sm:max-w-5xl sm:aspect-video sm:rounded-[28px] overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="min-w-0 flex items-center gap-2 pr-3">
            <p className="text-white text-sm font-semibold truncate">{title}</p>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="text-[11px] rounded-lg bg-black/50 border border-white/15 text-white px-2 py-1 outline-none">
              {[0.75,1,1.25,1.5,2].map((value) => <option key={value} value={value}>{value}x</option>)}
            </select>
          </div>
          <button onClick={onClose} className="shrink-0 w-9 h-9 rounded-full bg-white/10 border border-white/15 text-white flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video ref={videoRef} controls playsInline className="w-full h-full object-contain" />
          {status === "loading" && <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
          {status === "buffering" && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="w-7 h-7 text-white animate-spin" /></div>}
          {status === "error" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/80"><AlertTriangle className="w-8 h-8 text-red-400" /><p className="text-sm">This lecture is temporarily unavailable.</p></div>}
        </div>
      </div>
    </div>
  );
}
