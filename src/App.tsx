import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { AuthForm } from './components/Auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './components/AuthCallback';
import { AIChat } from './components/AIChat';
import { ToastContainer } from './components/Toast';
import { Landing } from './pages/Landing';
import { CalendlyAlternative } from './pages/CalendlyAlternative';
import { WhyPinOnItPage } from './pages/WhyPinOnIt';
import { BookPage } from './pages/Book';
import { ReschedulePage } from './pages/Reschedule';
import { BookingActionPage } from './pages/BookingAction';
import { TermsPage } from './pages/Terms';
import { PrivacyPage } from './pages/Privacy';
import { SmsConsentPage } from './pages/SmsConsent';
import { AcceptableUsePage } from './pages/AcceptableUse';
import { LeaderboardPage } from './pages/Leaderboard';
import { PollVotePage } from './pages/PollVote';
import { StatusPage } from './pages/Status';
import { NotFoundPage } from './pages/NotFound';
import { SessionManager } from './components/SessionManager';
import { CampaignLandingPage } from './pages/CampaignLandingPage';
import { captureCampaignParams } from './lib/campaignAttribution';

function CampaignParamCapture() {
  const { search, pathname } = useLocation();
  useEffect(() => {
    captureCampaignParams(search, pathname);
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
const MoreToolsPage = lazy(() =>
  import('./pages/MoreTools').then((m) => ({ default: m.MoreToolsPage })),
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
const DocumentConfirmPage = lazy(() =>
  import('./pages/DocumentConfirm').then((m) => ({ default: m.DocumentConfirmPage })),
);

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
          <Routes>
            {/* Fixed paths must come before the /:slug wildcard */}
            <Route path="/" element={<Landing />} />
            <Route path="/calendly-alternative" element={<CalendlyAlternative />} />
            <Route path="/nda" element={<CampaignLandingPage slug="nda" />} />
            <Route path="/reminders" element={<CampaignLandingPage slug="reminders" />} />
            <Route path="/why-pinonit" element={<WhyPinOnItPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/sms-consent" element={<SmsConsentPage />} />
            <Route path="/acceptable-use" element={<AcceptableUsePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/login" element={<AuthForm />} />
            <Route path="/signup" element={<AuthForm />} />
            <Route path="/ref/:code" element={<RefRedirect />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<Navigate to="/dashboard?onboarding=1" replace />} />
            <Route path="/booking/:bookingId/:action/:actionToken" element={<BookingActionPage />} />
            <Route path="/r/:token" element={<ReschedulePage />} />
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
              <Route path="booking" element={<BookingPage />} />
              <Route path="contacts" element={<SettingsTabRedirect tab="contacts" />} />
              <Route path="messaging" element={<Navigate to="/dashboard/reminders" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="billing" element={<Navigate to="/dashboard/settings?tab=billing" replace />} />
              <Route path="analytics" element={<Navigate to="/dashboard/settings?tab=analytics" replace />} />
              <Route path="more-tools" element={<MoreToolsPage />} />
              <Route path="signature" element={<EmailSignaturePage />} />
              <Route path="paid-booking" element={<PaidBookingPage />} />
              <Route path="group-scheduling" element={<GroupSchedulingPage />} />
              <Route path="group-scheduling/polls" element={<MeetingPollsPage />} />
              <Route path="group-scheduling/coordinate" element={<CoordinateMeetingsPage />} />
              <Route path="polls" element={<Navigate to="/dashboard/group-scheduling" replace />} />
              <Route path="coordinate" element={<CoordinateMeetingsPage />} />
              <Route path="qr-code" element={<QRCreatorPage />} />
              <Route path="qr" element={<Navigate to="/dashboard/qr-code" replace />} />
              <Route path="quotes" element={<Navigate to="/dashboard/documents/new?type=quote" replace />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="documents/new" element={<CreateDocumentPage />} />
            </Route>
            <Route path="/documents" element={<PreserveSearchRedirect to="/dashboard/documents" />} />
            <Route path="/documents/new" element={<PreserveSearchRedirect to="/dashboard/documents/new" />} />
            {/* Single-use booking links */}
            <Route path="/s/:token" element={<BookPage />} />
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
            <Route path="/poll/:pollId" element={<PollVotePage />} />
            {/* Public booking pages — must be after all fixed routes */}
            <Route path="/:slug/services" element={<BookPage />} />
            <Route path="/:slug" element={<BookPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <QuietErrorBoundary>
            <AIChat />
          </QuietErrorBoundary>
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
