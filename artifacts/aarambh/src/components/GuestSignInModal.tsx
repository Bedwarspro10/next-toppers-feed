import { Link } from "wouter";
import { LogIn, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export default function GuestSignInModal({ open, onClose, action = "access this content" }: Props) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/50 "
        onClick={onClose}
      />
      <div className="fixed inset-x-4 bottom-24 z-[71] max-w-sm mx-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-80">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 animate-fade-in-up">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen size={18} className="text-primary" />
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={13} />
            </button>
          </div>
          <h3 className="font-display font-bold text-base text-foreground mb-1">
            Sign in to continue
          </h3>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Please sign in to {action}. It's free and takes just a second!
          </p>
          <Link href="/login" onClick={onClose}>
            <Button className="w-full gap-2 h-10">
              <LogIn size={15} /> Sign in with Google
            </Button>
          </Link>
          <button
            onClick={onClose}
            className="w-full mt-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Not now
          </button>
        </div>
      </div>
    </>
  );
}
