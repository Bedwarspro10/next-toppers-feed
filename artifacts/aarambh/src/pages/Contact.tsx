import { useState } from "react";
import { useLocation } from "wouter";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, MapPin, MessageSquare, Send, CheckCircle, ChevronLeft } from "lucide-react";

const CONTACT_DETAILS = [
  { icon: Mail,         label: "Email",         value: "nexttoppersfeed@gmail.com", href: "mailto:nexttoppersfeed@gmail.com" },
  { icon: Phone,        label: "WhatsApp",       value: "Not available",            href: null },
  { icon: MapPin,       label: "Location",       value: "India",                    href: null },
  { icon: MessageSquare,label: "Response time",  value: "Within 24 hours",          href: null },
];

export default function Contact() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim() || null,
        message: form.message.trim(),
      };

      // Dual-write: Firestore (primary) + API server (backup)
      const firestorePromise = addDoc(collection(db, "contactMessages"), {
        ...payload,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const apiPromise = fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => null);

      await Promise.all([firestorePromise, apiPromise]);

      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 group transition-colors"
          >
            <ChevronLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Home
          </button>
          <h1 className="text-3xl font-display font-bold text-foreground">Contact Us</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">We're here to help. Reach out anytime.</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Form */}
          <div className="md:col-span-3 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="font-display font-semibold text-foreground mb-5">Send a message</h2>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <p className="font-semibold text-foreground mb-1">Message received!</p>
                <p className="text-sm text-muted-foreground mb-5">We'll get back to you within 24 hours.</p>
                <Button variant="outline" size="sm" onClick={() => setSent(false)}>Send another</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold text-foreground/80">Your Name</Label>
                    <Input id="name" placeholder="e.g. Arjun Sharma" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required className="h-10 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-foreground/80">Email Address</Label>
                    <Input id="email" type="email" placeholder="you@gmail.com" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required className="h-10 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs font-semibold text-foreground/80">Subject</Label>
                  <Input id="subject" placeholder="What is this about?" value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-xs font-semibold text-foreground/80">Message</Label>
                  <Textarea id="message" placeholder="Describe your question or feedback..." rows={5} value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    required className="text-sm resize-none" />
                </div>
                <Button type="submit" className="w-full gap-2 h-10" disabled={loading}>
                  {loading ? "Sending…" : <><Send size={15} /> Send Message</>}
                </Button>
              </form>
            )}
          </div>

          {/* Contact details */}
          <div className="md:col-span-2 space-y-3">
            {CONTACT_DETAILS.map(({ icon: Icon, label, value, href }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline">{value}</a>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
