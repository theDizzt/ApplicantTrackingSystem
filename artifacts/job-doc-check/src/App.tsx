import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import LandingPage from '@/pages/landing';
import LoginPage from '@/pages/login';
import RegisterPage from '@/pages/register';
import AdminLoginPage from '@/pages/admin/login';
import AdminPage from '@/pages/admin/index';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGuard } from '@/components/auth-guard';

import Dashboard from '@/pages/dashboard';
import CompaniesPage from '@/pages/companies';
import CompanyDetail from '@/pages/company-detail';
import ResumesPage from '@/pages/resumes';
import ResumeDetail from '@/pages/resume-detail';
import AnalysesPage from '@/pages/analyses';
import NewAnalysisPage from '@/pages/analysis-new';
import AnalysisDetail from '@/pages/analysis-detail';
import InterviewsPage from '@/pages/interviews';
import NewInterviewPage from '@/pages/interview-new';
import InterviewDetail from '@/pages/interview-detail';
import CoverLetterPage from '@/pages/cover-letter';
import SubscriptionPage from '@/pages/subscription';

const queryClient = new QueryClient();

function ProtectedRoute(props: { path: string; component: React.ComponentType<any> }) {
  return (
    <Route path={props.path}>
      {params => (
        <AuthGuard>
          <AppShell>
            <props.component {...params} />
          </AppShell>
        </AuthGuard>
      )}
    </Route>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminPage} />

      {/* Protected Routes */}
      <ProtectedRoute path="/dashboard" component={Dashboard} />

      <ProtectedRoute path="/companies" component={CompaniesPage} />
      <ProtectedRoute path="/companies/:id" component={CompanyDetail} />

      <ProtectedRoute path="/resumes" component={ResumesPage} />
      <ProtectedRoute path="/resumes/:id" component={ResumeDetail} />

      <ProtectedRoute path="/analyses" component={AnalysesPage} />
      <ProtectedRoute path="/analyses/new" component={NewAnalysisPage} />
      <ProtectedRoute path="/analyses/:id" component={AnalysisDetail} />

      <ProtectedRoute path="/interviews" component={InterviewsPage} />
      <ProtectedRoute path="/interviews/new" component={NewInterviewPage} />
      <ProtectedRoute path="/interviews/:id" component={InterviewDetail} />

      <ProtectedRoute path="/cover-letter" component={CoverLetterPage} />

      <ProtectedRoute path="/subscription" component={SubscriptionPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
