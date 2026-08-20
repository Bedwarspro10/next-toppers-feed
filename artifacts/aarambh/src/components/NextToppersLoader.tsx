interface NextToppersLoaderProps {
  size?: number;
  className?: string;
}

export function NextToppersLoader({ size = 52, className = "" }: NextToppersLoaderProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`flex-shrink-0 relative ${className}`}
      aria-label="Loading"
    >
      {/* Glow ring */}
      <div
        className="absolute inset-0 rounded-full animate-ping opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,0.6) 0%, transparent 70%)",
          animationDuration: "2s",
        }}
      />
      <svg
        viewBox="0 0 64 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", filter: "drop-shadow(0 0 6px rgba(59,130,246,0.5))" }}
      >
        <defs>
          <linearGradient id="ntGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="ntGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="ntGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        {/* Segment 1: Large top-right arrow */}
        <polygon
          points="20,3 44,3 58,25 34,25"
          fill="url(#ntGrad1)"
          style={{
            animation: "nt-seg1 2s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "39px 14px",
          }}
        />
        {/* Segment 2: Large bottom-right arrow */}
        <polygon
          points="34,31 58,31 44,53 20,53"
          fill="url(#ntGrad2)"
          style={{
            animation: "nt-seg2 2s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "39px 42px",
          }}
        />
        {/* Segment 3a: Small left top */}
        <polygon
          points="2,12 18,12 27,23 11,23"
          fill="url(#ntGrad3)"
          style={{
            animation: "nt-seg3 2s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "14px 17px",
          }}
        />
        {/* Segment 3b: Small left bottom */}
        <polygon
          points="11,33 27,33 18,44 2,44"
          fill="url(#ntGrad3)"
          style={{
            animation: "nt-seg3 2s cubic-bezier(0.4,0,0.2,1) infinite",
            transformOrigin: "14px 38px",
          }}
        />
      </svg>
    </div>
  );
}

export function NextToppersLoaderFull({
  label = "Loading…",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-8">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full opacity-30 animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.8) 0%, rgba(139,92,246,0.4) 50%, transparent 70%)",
            transform: "scale(1.8)",
          }}
        />
        <NextToppersLoader size={60} />
      </div>
      {label && (
        <p className="text-sm text-muted-foreground font-medium tracking-wide">{label}</p>
      )}
    </div>
  );
}

export function NextToppersPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-full opacity-25 animate-pulse"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,1) 0%, rgba(139,92,246,0.6) 50%, transparent 70%)",
            transform: "scale(2.5)",
          }}
        />
        <NextToppersLoader size={72} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-lg font-display text-foreground tracking-tight">Next Toppers</span>
        <span className="font-bold text-lg text-blue-500">Feed</span>
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">Loading your experience…</p>
    </div>
  );
}
