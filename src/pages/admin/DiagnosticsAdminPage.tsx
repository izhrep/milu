import React from 'react';
import { Navigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Star, HelpCircle, Layers, FolderTree, Folder, Upload, Settings2 } from 'lucide-react';
import { SkillsManagement } from '@/components/admin/SkillsManagement';
import { QualitiesManagement } from '@/components/admin/QualitiesManagement';
import { SurveyQuestionsManagement } from '@/components/admin/SurveyQuestionsManagement';
import { CategorySkillsManagement } from '@/components/admin/CategorySkillsManagement';
import { CategorySoftSkillsManagement } from '@/components/admin/CategorySoftSkillsManagement';
import { SubCategoryHardSkillsManagement } from '@/components/admin/SubCategoryHardSkillsManagement';
import { SubCategorySoftSkillsManagement } from '@/components/admin/SubCategorySoftSkillsManagement';
import { ImportDiagnosticsData } from '@/components/admin/ImportDiagnosticsData';
import { ImportGradesData } from '@/components/admin/ImportGradesData';
import { CleanupDiagnosticsData } from '@/components/admin/CleanupDiagnosticsData';
import { DiagnosticConfigTemplatesManager } from '@/components/admin/DiagnosticConfigTemplatesManager';
import { usePermission } from '@/hooks/usePermission';

export default function DiagnosticsAdminPage() {
  const { hasPermission: canViewAdminPanel, isLoading: adminLoading } = usePermission('security.view_admin_panel');
  const { hasPermission: canManageParticipants, isLoading: participantsLoading } = usePermission('diagnostics.manage_participants');

  // Проверка доступа
  if (adminLoading || participantsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Доступ только для admin и hr_bp
  if (!canViewAdminPanel && !canManageParticipants) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Справочники диагностики</h1>
        <p className="text-text-secondary mt-2">
          Управление навыками, качествами и вопросами для оценки сотрудников
        </p>
      </div>

      <Tabs defaultValue="hard-skills" className="space-y-6">
        <TabsList className="grid w-full max-w-5xl grid-cols-5">
          <TabsTrigger value="hard-skills" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Hard Skills
          </TabsTrigger>
          <TabsTrigger value="soft-skills" className="gap-2">
            <Star className="h-4 w-4" />
            Soft Skills
          </TabsTrigger>
          <TabsTrigger value="questions" data-value="questions" className="gap-2">
            <HelpCircle className="h-4 w-4" />
            Вопросы и ответы
          </TabsTrigger>
          <TabsTrigger value="config-templates" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Шкалы и правила
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Импорт
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config-templates" className="space-y-4">
          <DiagnosticConfigTemplatesManager />
        </TabsContent>

        <TabsContent value="hard-skills" className="space-y-4">
          <Tabs defaultValue="categories" className="space-y-4">
            <TabsList>
              <TabsTrigger value="categories" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Категории Hard Skills
              </TabsTrigger>
              <TabsTrigger value="subcategories" className="gap-2">
                <Folder className="h-4 w-4" />
                Подкатегории Hard навыков
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2">
                <Layers className="h-4 w-4" />
                Hard Skills
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories">
              <CategorySkillsManagement />
            </TabsContent>

            <TabsContent value="subcategories">
              <SubCategoryHardSkillsManagement />
            </TabsContent>

            <TabsContent value="skills">
              <SkillsManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="soft-skills" className="space-y-4">
          <Tabs defaultValue="categories" className="space-y-4">
            <TabsList>
              <TabsTrigger value="categories" className="gap-2">
                <FolderTree className="h-4 w-4" />
                Категории Soft Skills
              </TabsTrigger>
              <TabsTrigger value="subcategories" className="gap-2">
                <Folder className="h-4 w-4" />
                Подкатегории Soft навыков
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2">
                <Layers className="h-4 w-4" />
                Soft Skills
              </TabsTrigger>
            </TabsList>

            <TabsContent value="categories">
              <CategorySoftSkillsManagement />
            </TabsContent>

            <TabsContent value="subcategories">
              <SubCategorySoftSkillsManagement />
            </TabsContent>

            <TabsContent value="skills">
              <QualitiesManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <SurveyQuestionsManagement />
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <ImportDiagnosticsData />
          <ImportGradesData />
          <CleanupDiagnosticsData />
        </TabsContent>
      </Tabs>
    </div>
  );
}