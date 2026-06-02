import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { AuthForm } from './components/Auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthCallback } from './components/AuthCallback';
import { AIChat } from './components/AIChat';
import { ToastContainer } from './components/Toast';
import { Landing } from './pages/Landing';
import { BookPage } from './pages/Book';
import { BookingActionPage } from './pages/BookingAction';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { ServicesPage } from './pages/Services';
import { AppointmentsPage } from './pages/Appointments';
import { SettingsPage } from './pages/Settings';
import { EmailSignaturePage } from './pages/EmailSignature';
import { TermsPage } from './pages/Terms';
import { PrivacyPage } from './pages/Privacy';
import { AcceptableUsePage } from './pages/AcceptableUse';
import { LeaderboardPage } from './pages/Leaderboard';
import { ContactsPage } from './pages/Contacts';
import { MeetingPollsPage } from './pages/MeetingPolls';
import { PollVotePage } from './pages/PollVote';
import { QRCreatorPage } from './pages/QRCreator';
import { PaidBookingPage } from './pages/PaidBooking';
import { StatusPage } from './pages/Status';
import { NotFoundPage } from './pages/NotFound';
import { SessionManager } from './components/SessionManager';

const GroupSchedulingPage = lazy(() =>
  import('./pages/GroupScheduling').then(m => ({ default: m.GroupSchedulingPage })),
);
const CoordinateMeetingsPage = lazy(() =>
  import('./pages/CoordinateMeetings').then(m => ({ default: m.CoordinateMeetingsPage })),
);

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Loading" />
    </div>
  );
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
          <Routes>
            {/* Fixed paths must come before the /:slug wildcard */}
            <Route path="/" element={<Landing />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/acceptable-use" element={<AcceptableUsePage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="/login" element={<AuthForm />} />
            <Route path="/signup" element={<AuthForm />} />
            <Route path="/ref/:code" element={<RefRedirect />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/booking/:bookingId/:action/:actionToken" element={<BookingActionPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            >
              <Route path="services" element={<ServicesPage />} />
              <Route path="availability" element={<Navigate to="/dashboard/settings?tab=availability" replace />} />
              <Route path="reminders" element={<Navigate to="/dashboard/settings?tab=reminders" replace />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="messaging" element={<Navigate to="/dashboard/settings?tab=reminders" replace />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="billing" element={<Navigate to="/dashboard/settings?tab=billing" replace />} />
              <Route path="analytics" element={<Navigate to="/dashboard/settings?tab=analytics" replace />} />
              <Route path="signature" element={<EmailSignaturePage />} />
              <Route path="paid-booking" element={<PaidBookingPage />} />
              <Route path="group-scheduling" element={<Suspense fallback={<RouteFallback />}><GroupSchedulingPage /></Suspense>} />
              <Route path="group-scheduling/polls" element={<MeetingPollsPage />} />
              <Route path="group-scheduling/coordinate" element={<Suspense fallback={<RouteFallback />}><CoordinateMeetingsPage /></Suspense>} />
              <Route path="polls" element={<Navigate to="/dashboard/group-scheduling" replace />} />
              <Route path="coordinate" element={<Suspense fallback={<RouteFallback />}><CoordinateMeetingsPage /></Suspense>} />
              <Route path="qr" element={<QRCreatorPage />} />
            </Route>
            {/* Single-use booking links */}
            <Route path="/s/:token" element={<BookPage />} />
            {/* Poll voting */}
            <Route path="/poll/:pollId" element={<PollVotePage />} />
            {/* Public booking pages — must be after all fixed routes */}
            <Route path="/:slug" element={<BookPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <AIChat />
          <ToastContainer />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
