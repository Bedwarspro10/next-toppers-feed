import { Layout } from "@/components/layout/Layout";
import { Shield } from "lucide-react";

const SECTIONS = [
  { title: "1. Acceptance of Terms", body: "By accessing and using the Next Toppers Feed platform, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use this platform." },
  { title: "2. Use of the Platform", body: "This platform is intended for enrolled students of the Aarambh batch. You agree to use the platform only for lawful purposes and in a way that does not infringe the rights of others." },
  { title: "3. Account Responsibility", body: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use." },
  { title: "4. Intellectual Property", body: "All content on this platform — including lectures, notes, PDFs, and other materials — is the intellectual property of NextToppers or its content providers. Unauthorized reproduction is strictly prohibited." },
  { title: "5. Content Availability", body: "We reserve the right to modify, suspend, or discontinue any part of the platform at any time without notice. We are not liable for any interruption in service." },
  { title: "6. Limitation of Liability", body: "NextToppers shall not be liable for any indirect, incidental, or consequential damages arising from your use of or inability to use the platform." },
  { title: "7. Changes to Terms", body: "We may revise these terms at any time. Continued use of the platform after changes constitutes acceptance of the revised terms." },
  { title: "8. Contact", body: "For questions about these Terms, contact us at nexttoppersfeed@gmail.com ." },
];

export default function Terms() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Terms & Conditions</h1>
            <p className="text-sm text-muted-foreground mt-1">Last updated: January 2026</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-7">
          {SECTIONS.map(({ title, body }) => (
            <div key={title} className="pb-7 border-b border-border last:border-0 last:pb-0">
              <h2 className="text-base font-display font-semibold text-foreground mb-2">{title}</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
