import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import ProfilePage from "./pages/ProfilePage";
import DevelopmentCareerTrackPage from "./pages/DevelopmentCareerTrackPage";
import DevelopmentQuestionnairesPage from "./pages/DevelopmentQuestionnairesPage";
import TasksPage from "./pages/TasksPage";
import AdminDashboard from "./pages/admin/DashboardPage";
import StagesPage from "./pages/admin/StagesPage";
import ReferenceTablePage from "./pages/admin/ReferenceTablePage";
import UsersAdminPage from "./pages/admin/UsersAdminPage";
import FeedPage from "./pages/FeedPage";
import MeetingsPage from "./pages/MeetingsPage";
import TeamPage from "./pages/TeamPage";
import SkillSurveyQuestionsPage from "./pages/SkillSurveyQuestionsPage";
import SkillSurveyResultsPage from "./pages/SkillSurveyResultsPage";
import Survey360QuestionsPage from "./pages/Survey360QuestionsPage";
import Survey360ResultsPage from "./pages/Survey360ResultsPage";
import AssessmentResultsPage from "./pages/AssessmentResultsPage";
import AssessmentCompletedPage from "./pages/AssessmentCompletedPage";
import UnifiedAssessmentPage from "./pages/UnifiedAssessmentPage";
import UsersListPage from "./pages/UsersListPage";
import CreateUserPage from "./pages/CreateUserPage";
import UsersMigrationPage from "./pages/UsersMigrationPage";
import SecurityManagementPage from "./pages/SecurityManagementPage";
import DiagnosticsAdminPage from "./pages/admin/DiagnosticsAdminPage";
import ImportSoftSkillAnswersPage from "./pages/admin/ImportSoftSkillAnswersPage";
import ImportSoftSkillQuestionsPage from "./pages/admin/ImportSoftSkillQuestionsPage";
import MyAssignmentsPage from "./pages/MyAssignmentsPage";
import ManagerReportsPage from "./pages/ManagerReportsPage";
import ManagerComparisonPage from "./pages/ManagerComparisonPage";
import HRAnalyticsPage from "./pages/HRAnalyticsPage";
import { DiagnosticMonitoringPage } from "./pages/DiagnosticMonitoringPage";
import ReportsPage from "./pages/ReportsPage";
import MeetingsMonitoringPage from "./pages/MeetingsMonitoringPage";
import AuthPage from "./pages/AuthPage";
import NotFound from "./pages/NotFound";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const queryClient = new QueryClient();

// Header component that shows toggle when sidebar is collapsed
const AppHeader = () => {
  const { state, toggleSidebar } = useSidebar();
  
  if (state !== 'collapsed') return null;
  
  return (
    <header className="h-12 flex items-center border-b border-border bg-surface px-4 sticky top-0 z-20">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-8 w-8"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    </header>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <SidebarProvider>
                    <div className="flex h-svh w-full">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col min-h-0">
                        <AppHeader />
                        <main className="flex-1 min-h-0 overflow-auto bg-surface-secondary">
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/profile" element={<ProfilePage />} />
                            <Route path="/development/career-track" element={<DevelopmentCareerTrackPage />} />
                            <Route path="/questionnaires" element={<DevelopmentQuestionnairesPage />} />
                            <Route path="/tasks" element={<TasksPage />} />
                            <Route path="/meetings" element={<MeetingsPage />} />
                            <Route path="/meetings-monitoring" element={<MeetingsMonitoringPage />} />
                            <Route path="/team" element={<TeamPage />} />
                            <Route path="/feed" element={<FeedPage />} />
                            <Route path="/skill-survey/questions/:assignmentId" element={<SkillSurveyQuestionsPage />} />
                            <Route path="/skill-survey/results" element={<SkillSurveyResultsPage />} />
                            <Route path="/survey-360/questions/:assignmentId" element={<Survey360QuestionsPage />} />
                            <Route path="/survey-360-results" element={<Survey360ResultsPage />} />
                            <Route path="/assessment/results/:userId" element={<AssessmentResultsPage />} />
                            <Route path="/assessment/:assignmentId" element={<UnifiedAssessmentPage />} />
                            <Route path="/unified-assessment/:assignmentId" element={<UnifiedAssessmentPage />} />
                            <Route path="/assessment/completed" element={<AssessmentCompletedPage />} />
                            <Route path="/users" element={<UsersListPage />} />
                            <Route path="/users/create" element={<CreateUserPage />} />
                            <Route path="/users/migration" element={<UsersMigrationPage />} />
                            <Route path="/admin" element={<AdminDashboard />} />
                            <Route path="/admin/users" element={<UsersAdminPage />} />
                            <Route path="/admin/stages" element={<StagesPage />} />
                            <Route path="/admin/:tableId" element={<ReferenceTablePage />} />
                            <Route path="/admin/diagnostics" element={<DiagnosticsAdminPage />} />
                            <Route path="/admin/import-soft-skill-answers" element={<ImportSoftSkillAnswersPage />} />
                            <Route path="/admin/import-soft-skill-questions" element={<ImportSoftSkillQuestionsPage />} />
                            <Route path="/admin/reports" element={<ReportsPage />} />
                            <Route path="/my-assignments" element={<MyAssignmentsPage />} />
                            <Route path="/manager-reports" element={<ManagerReportsPage />} />
                            <Route path="/manager/comparison" element={<ManagerComparisonPage />} />
                            <Route path="/hr-analytics" element={<HRAnalyticsPage />} />
                            <Route path="/diagnostic-monitoring" element={<DiagnosticMonitoringPage />} />
                            <Route path="/security" element={<SecurityManagementPage />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </AuthGuard>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
