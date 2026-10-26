import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { CreatorRoute } from './components/layout/CreatorRoute';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportItemPage } from './pages/ReportItemPage';
import { ProfilePage } from './pages/ProfilePage';
import { MatchesPage } from './pages/MatchesPage';
import { MapPage } from './pages/MapPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CampusVerificationPage } from './pages/CampusVerificationPage';
import { AuthSetupNoticePage } from './pages/AuthSetupNoticePage';
import { SupportReFoundPage } from './pages/SupportReFoundPage';
import { TermsPage } from './pages/TermsPage';
import { WalkthroughPage } from './pages/WalkthroughPage';
import { SafetyPrivacyPage } from './pages/SafetyPrivacyPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/support" element={<SupportReFoundPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/safety" element={<SafetyPrivacyPage />} />
          <Route path="/walkthrough" element={<WalkthroughPage />} />
          <Route path="/login" element={isSupabaseConfigured ? <LoginPage /> : <AuthSetupNoticePage />} />
          <Route path="/register" element={isSupabaseConfigured ? <RegisterPage /> : <AuthSetupNoticePage />} />
          <Route path="/verify-campus" element={<CampusVerificationPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/report" element={<ReportItemPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>
            <Route element={<CreatorRoute />}>
              <Route path="/creator" element={<CreatorDashboardPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
