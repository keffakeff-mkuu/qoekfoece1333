import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import {
  ForgotPasswordPage,
  LoginPage,
  OnboardingPage,
  RegisterPage,
  ResetPasswordPage,
} from './pages/AuthPages';
import {
  AIAssistantPage,
  BillingPage,
  DiscoverPage,
  HomePage,
  MyAppsPage,
  NotificationsPage,
  ProfilePage,
  ReportsPage,
  SettingsPage,
  UpcomingModulePage,
} from './pages/PlatformPages';
import {
  FFAttendancePage,
  FFClientsPage,
  FFDashboardPage,
  FFEmployeesPage,
  FFIncidentsPage,
  FFSchedulePage,
  FFSitesPage,
} from './pages/FieldForcePages';
import {
  FFClientPortalPage,
  FFFinancePage,
  FFIntelligencePage,
  FFPatrolsPage,
  FFPayrollPage,
} from './pages/FieldForceModulesPages';

const ProtectedShell: React.FC = () => {
  const { user, organization } = useApp();
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!organization) return <Navigate to="/onboarding" replace />;
  return <AppLayout />;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          <Route path="/app" element={<ProtectedShell />}>
            <Route index element={<Navigate to="/app/home" replace />} />
            <Route path="home" element={<HomePage />} />
            <Route path="my-apps" element={<MyAppsPage />} />
            <Route path="discover" element={<DiscoverPage />} />

            <Route path="fieldforce/dashboard" element={<FFDashboardPage />} />
            <Route path="fieldforce/employees" element={<FFEmployeesPage />} />
            <Route path="fieldforce/clients" element={<FFClientsPage />} />
            <Route path="fieldforce/sites" element={<FFSitesPage />} />
            <Route path="fieldforce/schedule" element={<FFSchedulePage />} />
            <Route path="fieldforce/attendance" element={<FFAttendancePage />} />
            <Route path="fieldforce/patrols" element={<FFPatrolsPage />} />
            <Route path="fieldforce/incidents" element={<FFIncidentsPage />} />
            <Route path="fieldforce/payroll" element={<FFPayrollPage />} />
            <Route path="fieldforce/finance" element={<FFFinancePage />} />
            <Route path="fieldforce/client-portal" element={<FFClientPortalPage />} />
            <Route path="fieldforce/intelligence" element={<FFIntelligencePage />} />

            <Route path="ai-assistant" element={<AIAssistantPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="settings/organisation" element={<SettingsPage tab="organisation" />} />
            <Route path="settings/members" element={<SettingsPage tab="members" />} />
            <Route path="settings/audit-log" element={<SettingsPage tab="audit" />} />
            <Route path="settings/diagnostics" element={<SettingsPage tab="diagnostics" />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="upcoming/:slug" element={<UpcomingModulePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
