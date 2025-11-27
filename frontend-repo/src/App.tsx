import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
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

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/" component={LoginPage} />
      <Route component={LoginPage} />
    </Switch>
  );
}

function ProtectedRouter() {
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

function AuthenticatedApp() {
  const { isAuthenticated, isLoading, user } = useAuth();
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

  // Show public routes if not authenticated
  if (!isAuthenticated) {
    return <PublicRouter />;
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
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Welcome, <span className="font-semibold">{user?.username}</span>
              </span>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 min-w-0 overflow-auto p-6 bg-background">
            <ProtectedRouter />
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
