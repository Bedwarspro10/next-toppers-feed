import { Layout } from "@/components/layout/Layout";
import { Lock } from "lucide-react";

const SECTIONS = [
  { title: "1. Information We Collect", body: "We collect information you provide when signing in (name, email, profile picture via Google OAuth), as well as usage data such as pages visited and content accessed." },
  { title: "2. How We Use Your Information", body: "Your information is used to provide access to course materials, personalize your experience, send important announcements, and maintain the security of your account." },
  { title: "3. Data Storage", body: "Your data is stored securely using Google Firebase. We do not sell or share your personal data with third parties except as required by law." },
  { title: "4. Google Sign-In", body: "We use Google OAuth for authentication. By signing in with Google, you agree to Google's Privacy Policy in addition to ours. We only access your basic profile information." },
  { title: "5. Cookies", body: "We use session cookies to keep you logged in. We do not use tracking or advertising cookies." },
  { title: "6. Your Rights", body: "You have the right to access, correct, or delete your personal data. Contact us at nexttoppersfeed@gmail.com to make such a request." },
  { title: "7. Children's Privacy", body: "Our platform is designed for students. We take special care to protect the privacy of minors and do not knowingly collect unnecessary personal information from students under 18." },
  { title: "8. Changes to This Policy", body: "We may update this Privacy Policy from time to time. We will notify users of significant changes via announcements on the platform." },
];

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Privacy Policy</h1>
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
