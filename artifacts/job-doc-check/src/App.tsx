import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGuard } from '@/components/auth-guard';
import { Skeleton } from '@/components/ui/skeleton';

const LandingPage = lazy(() => import('@/pages/landing'));
const LoginPage = lazy(() => import('@/pages/login'));
const RegisterPage = lazy(() => import('@/pages/register'));
const AdminLoginPage = lazy(() => import('@/pages/admin/login'));
const AdminPage = lazy(() => import('@/pages/admin/index'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
const CompaniesPage = lazy(() => import('@/pages/companies'));
const CompanyDetail = lazy(() => import('@/pages/company-detail'));
const ResumesPage = lazy(() => import('@/pages/resumes'));
const ResumeDetail = lazy(() => import('@/pages/resume-detail'));
const AnalysesPage = lazy(() => import('@/pages/analyses'));
const NewAnalysisPage = lazy(() => import('@/pages/analysis-new'));
const AnalysisDetail = lazy(() => import('@/pages/analysis-detail'));
const InterviewsPage = lazy(() => import('@/pages/interviews'));
const NewInterviewPage = lazy(() => import('@/pages/interview-new'));
const InterviewDetail = lazy(() => import('@/pages/interview-detail'));
const CoverLetterPage = lazy(() => import('@/pages/cover-letter'));
const SchedulePage = lazy(() => import('@/pages/schedule'));
const ProfileItemsPage = lazy(() => import('@/pages/profile-items'));
const SubscriptionPage = lazy(() => import('@/pages/subscription'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 p-6" role="status" aria-label="화면 불러오는 중">
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}

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
      <ProtectedRoute path="/profile" component={ProfileItemsPage} />
      <ProtectedRoute path="/schedule" component={SchedulePage} />
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
          <Suspense fallback={<RouteFallback />}>
            <Router />
          </Suspense>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
