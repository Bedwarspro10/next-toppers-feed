import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BotProvider } from "@/contexts/BotContext";
import { UnreadProvider } from "@/contexts/UnreadContext";
import { PremiumProvider } from "@/contexts/PremiumContext";
import { PremiumModalProvider } from "@/contexts/PremiumModalContext";
import { SubjectPopupProvider } from "@/contexts/SubjectPopupContext";
import { XPProvider } from "@/contexts/XPContext";
import { CoinProvider, useCoin } from "@/contexts/CoinContext";
import { StartupBanner } from "@/components/BannerSystem";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import PremiumModal from "@/components/PremiumModal";
import { useAnnouncementNotifications } from "@/hooks/useNotifications";
import React, { Suspense, useEffect } from "react";
import { NextToppersLoader } from "@/components/NextToppersLoader";

const Home          = React.lazy(() => import("@/pages/Home"));
const Subjects      = React.lazy(() => import("@/pages/Subjects"));
const SubjectDetail = React.lazy(() => import("@/pages/SubjectDetail"));
const YouTubePage   = React.lazy(() => import("@/pages/YouTube"));
const Announcements = React.lazy(() => import("@/pages/Announcements"));
const Login         = React.lazy(() => import("@/pages/Login"));
const Dashboard     = React.lazy(() => import("@/pages/Dashboard"));
const Profile       = React.lazy(() => import("@/pages/Profile"));
const Admin         = React.lazy(() => import("@/pages/Admin"));
const Chat          = React.lazy(() => import("@/pages/Chat"));
const Contact       = React.lazy(() => import("@/pages/Contact"));
const Terms         = React.lazy(() => import("@/pages/Terms"));
const Privacy       = React.lazy(() => import("@/pages/Privacy"));
const SearchPage    = React.lazy(() => import("@/pages/Search"));
const BookmarksPage    = React.lazy(() => import("@/pages/Bookmarks"));
const PaymentHistory   = React.lazy(() => import("@/pages/PaymentHistory"));
const Tests            = React.lazy(() => import("@/pages/Tests"));
const TestEngine       = React.lazy(() => import("@/pages/TestEngine"));
const TestHistory      = React.lazy(() => import("@/pages/TestHistory"));
const Leaderboard      = React.lazy(() => import("@/pages/Leaderboard"));
const VideoPlayer      = React.lazy(() => import("@/pages/VideoPlayer"));
const WalletPage       = React.lazy(() => import("@/pages/Wallet"));
const SurveysPage      = React.lazy(() => import("@/pages/Surveys"));
const NotFound         = React.lazy(() => import("@/pages/not-found"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <NextToppersLoader size={56} />
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full bg-card border border-destructive/30 rounded-2xl p-8 shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <span className="text-destructive text-2xl">⚠</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* HyperOS-style fluid spring transition between pages */
function PageTransition({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.99 }}
        transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.9 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PageTransition>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/subjects" component={Subjects} />
        <Route path="/subjects/:subject" component={SubjectDetail} />
        <Route path="/youtube" component={YouTubePage} />
        <Route path="/announcements" component={Announcements} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/login" component={Login} />
        <Route path="/search" component={SearchPage} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/watch" component={VideoPlayer} />

        <Route path="/bookmarks">
          {() => (
            <ProtectedRoute>
              <BookmarksPage />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/chat">
          {() => (
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/profile">
          {() => (
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/dashboard">
          {() => (
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin">
          {() => (
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/payments">
          {() => (
            <ProtectedRoute>
              <PaymentHistory />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/tests" component={Tests} />
        <Route path="/tests/:testId" component={TestEngine} />
        <Route path="/test-history">
          {() => (
            <ProtectedRoute>
              <TestHistory />
            </ProtectedRoute>
          )}
        </Route>

        <Route path="/surveys" component={SurveysPage} />
        <Route path="/wallet">
          {() => (
            <ProtectedRoute>
              <WalletPage />
            </ProtectedRoute>
          )}
        </Route>

        <Route component={NotFound} />
      </Switch>
      </PageTransition>
    </Suspense>
  );
}

function NotificationManager() {
  const { user } = useAuth();
  useAnnouncementNotifications(!!user);
  return null;
}

function DailyLoginManager() {
  const { user } = useAuth();
  const { awardDailyLogin } = useCoin();
  useEffect(() => {
    if (user) {
      // Fire-and-forget — coin context handles duplicate prevention
      awardDailyLogin().catch(() => {});
    }
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .catch(() => {});
    });
  }
}

export default function App() {
  useEffect(() => { registerSW(); }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PremiumProvider>
            <XPProvider>
              <CoinProvider>
                <PremiumModalProvider>
                  <UnreadProvider>
                    <BotProvider>
                      <SubjectPopupProvider>
                        <TooltipProvider>
                          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                            <Router />
                          </WouterRouter>
                          <NotificationManager />
                          <DailyLoginManager />
                          <PremiumModal />
                          <StartupBanner />
                          <Toaster />
                        </TooltipProvider>
                      </SubjectPopupProvider>
                    </BotProvider>
                  </UnreadProvider>
                </PremiumModalProvider>
              </CoinProvider>
            </XPProvider>
          </PremiumProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
