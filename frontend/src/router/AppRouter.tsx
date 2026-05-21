import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/AppLayout';
import { LoadingState } from '../components/LoadingState';
import { CheckInPage } from '../pages/CheckInPage';
import { DashboardPage } from '../pages/DashboardPage';
import { AdminPage } from '../pages/AdminPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LegalPage } from '../pages/LegalPage';
import { LearningPlanPage } from '../pages/LearningPlanPage';
import { LearningReportPage } from '../pages/LearningReportPage';
import { ListeningPage } from '../pages/ListeningPage';
import { LoginPage } from '../pages/LoginPage';
import { MembershipPage } from '../pages/MembershipPage';
import { MistakesPage } from '../pages/MistakesPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { ReviewPage } from '../pages/ReviewPage';
import { QuizPage } from '../pages/QuizPage';
import { ReadingPage } from '../pages/ReadingPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SpeakingPage } from '../pages/SpeakingPage';
import { StatsPage } from '../pages/StatsPage';
import { StudyPage } from '../pages/StudyPage';
import { SupportPage } from '../pages/SupportPage';
import { WordDetailPage } from '../pages/WordDetailPage';
import { WordBookDetailPage } from '../pages/WordBookDetailPage';
import { WordBooksPage } from '../pages/WordBooksPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
        <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
        <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/word-books" element={<WordBooksPage />} />
          <Route path="/word-books/:id" element={<WordBookDetailPage />} />
          <Route path="/words/:id" element={<WordDetailPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/mistakes" element={<MistakesPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/listening" element={<ListeningPage />} />
          <Route path="/speaking" element={<SpeakingPage />} />
          <Route path="/reading" element={<ReadingPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/learning-report" element={<LearningReportPage />} />
          <Route path="/learning-plan" element={<LearningPlanPage />} />
          <Route path="/check-in" element={<CheckInPage />} />
          <Route path="/learning-settings" element={<SettingsPage />} />
          <Route path="/membership" element={<MembershipPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/legal" element={<LegalPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <LoadingState text="正在检查登录状态..." />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <LoadingState text="正在检查登录状态..." />;
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
