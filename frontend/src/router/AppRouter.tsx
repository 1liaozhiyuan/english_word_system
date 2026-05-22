import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppLayout } from '../components/AppLayout';
import { LoadingState } from '../components/LoadingState';

const AdminPage = React.lazy(() => import('../pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const CheckInPage = React.lazy(() => import('../pages/CheckInPage').then((module) => ({ default: module.CheckInPage })));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const FavoritesPage = React.lazy(() => import('../pages/FavoritesPage').then((module) => ({ default: module.FavoritesPage })));
const FeatureHubPage = React.lazy(() => import('../pages/FeatureHubPage').then((module) => ({ default: module.FeatureHubPage })));
const ForgotPasswordPage = React.lazy(() => import('../pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const GrammarPage = React.lazy(() => import('../pages/GrammarPage').then((module) => ({ default: module.GrammarPage })));
const LegalPage = React.lazy(() => import('../pages/LegalPage').then((module) => ({ default: module.LegalPage })));
const LearningPlanPage = React.lazy(() => import('../pages/LearningPlanPage').then((module) => ({ default: module.LearningPlanPage })));
const LearningReportPage = React.lazy(() => import('../pages/LearningReportPage').then((module) => ({ default: module.LearningReportPage })));
const ListeningPage = React.lazy(() => import('../pages/ListeningPage').then((module) => ({ default: module.ListeningPage })));
const LoginPage = React.lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const MembershipPage = React.lazy(() => import('../pages/MembershipPage').then((module) => ({ default: module.MembershipPage })));
const MistakesPage = React.lazy(() => import('../pages/MistakesPage').then((module) => ({ default: module.MistakesPage })));
const NotificationsPage = React.lazy(() => import('../pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const OnboardingPage = React.lazy(() => import('../pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const QuizPage = React.lazy(() => import('../pages/QuizPage').then((module) => ({ default: module.QuizPage })));
const ReadingPage = React.lazy(() => import('../pages/ReadingPage').then((module) => ({ default: module.ReadingPage })));
const RegisterPage = React.lazy(() => import('../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const ResetPasswordPage = React.lazy(() => import('../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ReviewPage = React.lazy(() => import('../pages/ReviewPage').then((module) => ({ default: module.ReviewPage })));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const SpeakingPage = React.lazy(() => import('../pages/SpeakingPage').then((module) => ({ default: module.SpeakingPage })));
const StatsPage = React.lazy(() => import('../pages/StatsPage').then((module) => ({ default: module.StatsPage })));
const StudyPage = React.lazy(() => import('../pages/StudyPage').then((module) => ({ default: module.StudyPage })));
const SupportPage = React.lazy(() => import('../pages/SupportPage').then((module) => ({ default: module.SupportPage })));
const WordBookDetailPage = React.lazy(() => import('../pages/WordBookDetailPage').then((module) => ({ default: module.WordBookDetailPage })));
const WordBooksPage = React.lazy(() => import('../pages/WordBooksPage').then((module) => ({ default: module.WordBooksPage })));
const WordDetailPage = React.lazy(() => import('../pages/WordDetailPage').then((module) => ({ default: module.WordDetailPage })));
const WritingPage = React.lazy(() => import('../pages/WritingPage').then((module) => ({ default: module.WritingPage })));

export function AppRouter() {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<LoadingState text="正在加载页面..." />}>
        <Routes>
          <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
          <Route path="/reset-password" element={<GuestOnly><ResetPasswordPage /></GuestOnly>} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/today" element={<FeatureHubPage kind="today" />} />
            <Route path="/ability" element={<FeatureHubPage kind="ability" />} />
            <Route path="/review-data" element={<FeatureHubPage kind="data" />} />
            <Route path="/services" element={<FeatureHubPage kind="service" />} />
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
            <Route path="/writing" element={<WritingPage />} />
            <Route path="/grammar" element={<GrammarPage />} />
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
      </React.Suspense>
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
