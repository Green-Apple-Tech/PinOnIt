import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { AuthForm } from './components/Auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './components/AuthCallback';
import { ToastContainer } from './components/Toast';
import { Landing } from './pages/Landing';
import { NotFoundPage } from './pages/NotFound';
import { SessionManager } from './components/SessionManager';
import { captureCampaignParams } from './lib/campaignAttribution';
import { captureCreatorParam } from './lib/creatorAttribution';
import { captureTrialPromo } from './lib/trialPromo';
import { logMarketingVisit } from './lib/marketingVisits';
import { GuestNoIndex } from './components/GuestNoIndex';
import { INTENT_PATHS } from './lib/seoPaths';

function CampaignParamCapture() {
  const { search, pathname } = useLocation();
  useEffect(() => {
    captureCampaignParams(search, pathname);
    captureCreatorParam(search);
    captureTrialPromo(search);
    void logMarketingVisit(pathname);
  }, [search, pathname]);
  return null;
}

const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
);
const AppointmentsPage = lazy(() =>
  import('./pages/Appointments').then((m) => ({ default: m.AppointmentsPage })),
);
const RemindersPage = lazy(() =>
  import('./pages/Reminders').then((m) => ({ default: m.RemindersPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
const EmailSignaturePage = lazy(() =>
  import('./pages/EmailSignature').then((m) => ({ default: m.EmailSignaturePage })),
);
const MeetingPollsPage = lazy(() =>
  import('./pages/MeetingPolls').then((m) => ({ default: m.MeetingPollsPage })),
);
const QRCreatorPage = lazy(() =>
  import('./pages/QRCreator').then((m) => ({ default: m.QRCreatorPage })),
);
const QuoteViewPage = lazy(() =>
  import('./pages/QuoteView').then((m) => ({ default: m.QuoteViewPage })),
);
const BookingPage = lazy(() =>
  import('./pages/BookingPage').then((m) => ({ default: m.BookingPage })),
);
const PaidBookingPage = lazy(() =>
  import('./pages/PaidBooking').then((m) => ({ default: m.PaidBookingPage })),
);
const GroupSchedulingPage = lazy(() =>
  import('./pages/GroupScheduling').then((m) => ({ default: m.GroupSchedulingPage })),
);
const CoordinateMeetingsPage = lazy(() =>
  import('./pages/CoordinateMeetings').then((m) => ({ default: m.CoordinateMeetingsPage })),
);
const DocumentsPage = lazy(() =>
  import('./pages/Documents').then((m) => ({ default: m.DocumentsPage })),
);
const CreateDocumentPage = lazy(() =>
  import('./pages/CreateDocument').then((m) => ({ default: m.CreateDocumentPage })),
);
const SignNowSendPage = lazy(() =>
  import('./pages/SignNowSend').then((m) => ({ default: m.SignNowSendPage })),
);

function DocumentsNewRoute() {
  const [params] = useSearchParams();
  const page = params.get('signNow') === '1' ? <SignNowSendPage /> : <CreateDocumentPage />;
  return <Suspense fallback={<DashboardFallback />}>{page}</Suspense>;
}
const DocumentConfirmPage = lazy(() =>
  import('./pages/DocumentConfirm').then((m) => ({ default: m.DocumentConfirmPage })),
);
const BookPage = lazy(() =>
  import('./pages/Book').then((m) => ({ default: m.BookPage })),
);
const ReschedulePage = lazy(() =>
  import('./pages/Reschedule').then((m) => ({ default: m.ReschedulePage })),
);
const BookingActionPage = lazy(() =>
  import('./pages/BookingAction').then((m) => ({ default: m.BookingActionPage })),
);
const PollVotePage = lazy(() =>
  import('./pages/PollVote').then((m) => ({ default: m.PollVotePage })),
);
const CoordinationVotePage = lazy(() =>
  import('./pages/CoordinationVote').then((m) => ({ default: m.CoordinationVotePage })),
);
const MarketingTrafficPage = lazy(() =>
  import('./pages/MarketingTraffic').then((m) => ({ default: m.MarketingTrafficPage })),
);
const CreatorDashboardPage = lazy(() =>
  import('./pages/CreatorDashboard').then((m) => ({ default: m.CreatorDashboardPage })),
);
const CreatorAdminPage = lazy(() =>
  import('./pages/CreatorAdmin').then((m) => ({ default: m.CreatorAdminPage })),
);
const RedditOpportunitiesPage = lazy(() =>
  import('./pages/RedditOpportunities').then((m) => ({ default: m.RedditOpportunitiesPage })),
);
const StandingJobsPage = lazy(() =>
  import('./pages/StandingJobs').then((m) => ({ default: m.StandingJobsPage })),
);
const AIChat = lazy(() =>
  import('./components/AIChat').then((m) => ({ default: m.AIChat })),
);
const SeoIntentPage = lazy(() =>
  import('./pages/SeoIntentPage').then((m) => ({ default: m.SeoIntentPage })),
);
const SignNowPage = lazy(() =>
  import('./pages/SignNow').then((m) => ({ default: m.SignNowPage })),
);
const CampaignLandingPage = lazy(() =>
  import('./pages/CampaignLandingPage').then((m) => ({ default: m.CampaignLandingPage })),
);
const WhyPinOnItPage = lazy(() =>
  import('./pages/WhyPinOnIt').then((m) => ({ default: m.WhyPinOnItPage })),
);
const LegalTemplatesPage = lazy(() =>
  import('./pages/LegalTemplates').then((m) => ({ default: m.LegalTemplatesPage })),
);
const BlogIndexPage = lazy(() =>
  import('./pages/Blog').then((m) => ({ default: m.BlogIndexPage })),
);
const BlogPostPage = lazy(() =>
  import('./pages/Blog').then((m) => ({ default: m.BlogPostPage })),
);
const TermsPage = lazy(() =>
  import('./pages/Terms').then((m) => ({ default: m.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import('./pages/Privacy').then((m) => ({ default: m.PrivacyPage })),
);
const SmsConsentPage = lazy(() =>
  import('./pages/SmsConsent').then((m) => ({ default: m.SmsConsentPage })),
);
const AcceptableUsePage = lazy(() =>
  import('./pages/AcceptableUse').then((m) => ({ default: m.AcceptableUsePage })),
);
const LeaderboardPage = lazy(() =>
  import('./pages/Leaderboard').then((m) => ({ default: m.LeaderboardPage })),
);
const StatusPage = lazy(() =>
  import('./pages/Status').then((m) => ({ default: m.StatusPage })),
);
const PhoneShotsPage = lazy(() =>
  import('./pages/PhoneShots').then((m) => ({ default: m.PhoneShotsPage })),
);
const ReminderDonePage = lazy(() =>
  import('./pages/ReminderDone').then((m) => ({ default: m.ReminderDonePage })),
);
const CreatorsPage = lazy(() =>
  import('./pages/Creators').then((m) => ({ default: m.CreatorsPage })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DashboardFallback />}>{children}</Suspense>;
}

function DashboardFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
    </div>
  );
}

class QuietErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function SettingsTabRedirect({ tab }: { tab: string }) {
  const [params] = useSearchParams();
  const next = new URLSearchParams();
  for (const key of [
    'new',
    'edit',
    'code',
    'state',
    'calendar_error',
    'gmail_connected',
    'outlook_connected',
    'contacts_imported',
    'contacts_error',
  ]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  next.set('tab', tab);
  return <Navigate to={`/dashboard/settings?${next.toString()}`} replace />;
}

/** Keep ?type= and other query params when sending old public URLs into the dashboard. */
function PreserveSearchRedirect({ to }: { to: string }) {
  const [params] = useSearchParams();
  const qs = params.toString();
  return <Navigate to={qs ? `${to}?${qs}` : to} replace />;
}

function RefRedirect() {
  const { code } = useParams<{ code: string }>();
  return <Navigate to={`/signup?ref=${code}`} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <SessionManager />
          <CampaignParamCapture />
          <GuestNoIndex />
          <Routes>
            {/* Fixed paths must come before the /:slug wildcard */}
            <Route path="/" element={<Landing />} />
            {INTENT_PATHS.map((path) => (
              <Route key={path} path={path} element={<LazyPage><SeoIntentPage /></LazyPage>} />
            ))}
            <Route path="/calendly-alternative-for-small-business" element={<Navigate to="/calendly-alternative" replace />} />
            <Route path="/sign-now" element={<LazyPage><SignNowPage /></LazyPage>} />
            <Route path="/nda" element={<LazyPage><CampaignLandingPage slug="nda" /></LazyPage>} />
            <Route path="/reminders" element={<LazyPage><CampaignLandingPage slug="reminders" /></LazyPage>} />
            <Route path="/why-pinonit" element={<LazyPage><WhyPinOnItPage /></LazyPage>} />
            <Route path="/legal-templates" element={<LazyPage><LegalTemplatesPage /></LazyPage>} />
            <Route path="/blog" element={<LazyPage><BlogIndexPage /></LazyPage>} />
            <Route path="/blog/:slug" element={<LazyPage><BlogPostPage /></LazyPage>} />
            <Route path="/terms" element={<LazyPage><TermsPage /></LazyPage>} />
            <Route path="/privacy" element={<LazyPage><PrivacyPage /></LazyPage>} />
            <Route path="/sms-consent" element={<LazyPage><SmsConsentPage /></LazyPage>} />
            <Route path="/acceptable-use" element={<LazyPage><AcceptableUsePage /></LazyPage>} />
            <Route path="/leaderboard" element={<LazyPage><LeaderboardPage /></LazyPage>} />
            <Route path="/creators" element={<LazyPage><CreatorsPage /></LazyPage>} />
            <Route path="/status" element={<LazyPage><StatusPage /></LazyPage>} />
            <Route path="/shots/phone" element={<LazyPage><PhoneShotsPage /></LazyPage>} />
            <Route path="/reminder-done/:token" element={<LazyPage><ReminderDonePage /></LazyPage>} />
            <Route path="/login" element={<AuthForm />} />
            <Route path="/signup" element={<AuthForm />} />
            <Route path="/ref/:code" element={<RefRedirect />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<Navigate to="/dashboard?onboarding=1" replace />} />
            <Route
              path="/booking/:bookingId/:action/:actionToken"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <BookingActionPage />
                </Suspense>
              }
            />
            <Route
              path="/r/:token"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <ReschedulePage />
                </Suspense>
              }
            />
            <Route
              path="/d/:token"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <DocumentConfirmPage />
                </Suspense>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<DashboardFallback />}>
                    <Dashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            >
              <Route path="services" element={<SettingsTabRedirect tab="event-types" />} />
              <Route path="availability" element={<Navigate to="/dashboard/settings?tab=availability" replace />} />
              <Route path="reminders" element={<RemindersPage />} />
              <Route path="activity" element={<Navigate to="/dashboard/settings?tab=activity" replace />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="standing-jobs" element={<StandingJobsPage />} />
              <Route path="booking" element={<BookingPage />} />
              <Route path="contacts" element={<SettingsTabRedirect tab="contacts" />} />
              <Route path="messaging" element={<Navigate to="/dashboard/reminders" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="billing" element={<Navigate to="/dashboard/settings?tab=billing" replace />} />
              <Route path="analytics" element={<Navigate to="/dashboard/settings?tab=analytics" replace />} />
              <Route path="more-tools" element={<Navigate to="/dashboard" replace />} />
              <Route path="signature" element={<EmailSignaturePage />} />
              <Route path="paid-booking" element={<PaidBookingPage />} />
              <Route path="group-scheduling" element={<GroupSchedulingPage />} />
              <Route path="group-scheduling/polls" element={<MeetingPollsPage />} />
              <Route path="group-scheduling/coordinate" element={<CoordinateMeetingsPage />} />
              <Route path="polls" element={<Navigate to="/dashboard/group-scheduling" replace />} />
              <Route path="coordinate" element={<CoordinateMeetingsPage />} />
              <Route path="qr-code" element={<QRCreatorPage />} />
              <Route path="qr" element={<Navigate to="/dashboard/qr-code" replace />} />
              <Route path="quotes" element={<Navigate to="/dashboard/documents" replace />} />
              <Route path="quotes/new" element={<Navigate to="/dashboard/documents/new?type=quote" replace />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/new" element={<DocumentsNewRoute />} />
              <Route path="marketing-traffic" element={<MarketingTrafficPage />} />
              <Route path="reddit-opportunities" element={<RedditOpportunitiesPage />} />
              <Route path="creator" element={<CreatorDashboardPage />} />
              <Route path="creator-admin" element={<CreatorAdminPage />} />
            </Route>
            <Route path="/documents" element={<PreserveSearchRedirect to="/dashboard/documents" />} />
            <Route path="/documents/new" element={<PreserveSearchRedirect to="/dashboard/documents/new" />} />
            {/* Single-use booking links */}
            <Route
              path="/s/:token"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <BookPage />
                </Suspense>
              }
            />
            {/* Public quote / invoice / receipt */}
            <Route
              path="/q/:token"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <QuoteViewPage />
                </Suspense>
              }
            />
            {/* Poll voting */}
            <Route
              path="/poll/:pollId"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <PollVotePage />
                </Suspense>
              }
            />
            {/* Multi-party scheduling guest vote */}
            <Route
              path="/c/:token"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <CoordinationVotePage />
                </Suspense>
              }
            />
            {/* Public booking pages — must be after all fixed routes */}
            <Route
              path="/:slug/services"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <BookPage />
                </Suspense>
              }
            />
            <Route
              path="/:slug"
              element={
                <Suspense fallback={<DashboardFallback />}>
                  <BookPage />
                </Suspense>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <QuietErrorBoundary>
            <Suspense fallback={null}>
              <AIChat />
            </Suspense>
          </QuietErrorBoundary>
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
