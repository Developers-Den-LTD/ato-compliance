import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth, RequireAuth } from "@/contexts/AuthContext";
import { LoginForm, MFAForm } from "@/components/auth/LoginForm";
import { AutoLogin } from "@/components/auth/AutoLogin";
import Dashboard from "@/pages/dashboard";
import Systems from "@/pages/systems";
import SystemDetail from "@/pages/system-detail";
import Controls from "@/pages/controls";
import DocumentGeneration from "@/pages/document-generation";
import Assessment from "@/pages/assessment";
import AssessmentManagement from "@/pages/assessment-management";
import Analytics from "@/pages/analytics";
import DataIngestion from "@/pages/data-ingestion";
import Settings from "@/pages/settings";
import LLMSettings from "@/pages/llm-settings";
import TestAssessment from "@/pages/test-assessment";
import TemplateManagement from "@/pages/template-management";
import ChatPage from "@/pages/chat";
import NotFound from "@/pages/not-found";
import { useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/systems" component={Systems} />
      <Route path="/systems/:id" component={SystemDetail} />
      <Route path="/assessment-management/:id" component={AssessmentManagement} />
      <Route path="/controls" component={Controls} />
      <Route path="/documents" component={DocumentGeneration} />
      <Route path="/document-generation" component={DocumentGeneration} />
      <Route path="/templates" component={TemplateManagement} />
      <Route path="/template-management" component={TemplateManagement} />
      <Route path="/assessment" component={Assessment} />
      <Route path="/ingestion" component={DataIngestion} />
      <Route path="/data-ingestion" component={DataIngestion} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/llm-settings" component={LLMSettings} />
      <Route path="/test-assessment" component={TestAssessment} />
      <Route path="/test-assessment/:id" component={TestAssessment} />
      <Route path="/chat" component={ChatPage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function LoginPage() {
  const [showMFA, setShowMFA] = useState(false);
  const [mfaData, setMfaData] = useState<{ userId: string; challenge: string }>({ userId: '', challenge: '' });
  const [, setLocation] = useLocation();

  const handleLoginSuccess = () => {
    setLocation('/');
  };

  const handleMFARequired = (userId: string, challenge: string) => {
    setMfaData({ userId, challenge });
    setShowMFA(true);
  };

  if (showMFA) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <MFAForm
          userId={mfaData.userId}
          challenge={mfaData.challenge}
          onSuccess={handleLoginSuccess}
          onBack={() => setShowMFA(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoginForm
        onSuccess={handleLoginSuccess}
        onMFARequired={handleMFARequired}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Auto-login in development
  if (process.env.NODE_ENV === 'development') {
    return (
      <>
        <AutoLogin />
        <InnerApp />
      </>
    );
  }

  return <InnerApp />;
}

function InnerApp() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold">Loading...</div>
          <div className="text-sm text-muted-foreground mt-2">Authenticating</div>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated && location !== '/login') {
    return <LoginPage />;
  }

  // Show authenticated app
  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider defaultTheme="light" storageKey="ato-agent-theme">
          <AuthProvider>
            <AuthenticatedApp />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
