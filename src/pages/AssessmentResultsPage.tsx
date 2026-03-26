import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, Download, Calendar, Brain, FileSpreadsheet, History } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadarChartResults } from '@/components/RadarChartResults';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HorizontalBarChart, BarChartDataItem } from '@/components/HorizontalBarChart';
import { CollapsibleHorizontalBarChart } from '@/components/CollapsibleHorizontalBarChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetencyComments } from '@/components/CompetencyComments';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { 
  CompetencyFilter,
  CompetencyFilterType, 
  RadarRoleType, 
  RespondentGroupType, 
  SkillSetFilterType,
  allRadarRoles,
  allRespondentGroups,
  respondentGroupLabels
} from '@/components/CompetencyFilter';
import { RespondentGroupFilter } from '@/components/RespondentGroupFilter';
import { useCorrectAssessmentResults } from '@/hooks/useCorrectAssessmentResults';
import { useSkillSurveyResultsEnhanced } from '@/hooks/useSkillSurveyResultsEnhanced';
import { useSurvey360ResultsEnhanced } from '@/hooks/useSurvey360ResultsEnhanced';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useSnapshotContext } from '@/hooks/useSnapshotContext';
import { JohariWindowSheet } from '@/components/johari/JohariWindowSheet';
import { supabase } from '@/integrations/supabase/client';
import { exportAssessmentExcel } from '@/utils/exportAssessmentExcel';
import { toast } from 'sonner';
import { GapsAnalysisBlock } from '@/components/GapsAnalysisBlock';
import { useStageTemplateConfig } from '@/hooks/useStageTemplateConfig';
const AssessmentResultsPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [evaluatedUserName, setEvaluatedUserName] = useState<string>('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessCheckComplete, setAccessCheckComplete] = useState(false);
  
  // Получаем stageId из state (от TeamPage) или fallback на активный этап
  const stageIdFromState = location.state?.stageId as string | undefined;
  
  // Получаем диагностические этапы
  const { stages: diagnosticStages, activeStage } = useDiagnosticStages();
  
  // Explicit stage selector state
  const [manualStageId, setManualStageId] = useState<string | undefined>(undefined);
  
  // Fallback: if no active stage, use the first available stage
  const firstStageId = diagnosticStages && diagnosticStages.length > 0 ? diagnosticStages[0].id : null;
  
  // Определяем ID этапа: manual > state > активный > первый доступный
  const selectedStageId = manualStageId || stageIdFromState || activeStage?.id || firstStageId || null;
  
  // Snapshot context for historical data
  const { snapshotContext, isHistorical, loading: snapshotLoading, snapshotResolved } = useSnapshotContext(selectedStageId, userId);
  
  // Stage template config (hard_skills_enabled toggle, scales, etc.)
  const { config: stageConfig, loading: stageConfigLoading } = useStageTemplateConfig(selectedStageId || undefined);
  const hardSkillsEnabled = stageConfig.hardSkillsEnabled;
  
  // Available competency filters based on stage config
  const availableCompetencyFilters = useMemo<CompetencyFilterType[]>(() => {
    if (hardSkillsEnabled) {
      return ['hard_skills', 'soft_skills', 'hard_categories', 'soft_categories', 'hard_subcategories', 'soft_subcategories'];
    }
    return ['soft_skills', 'soft_categories', 'soft_subcategories'];
  }, [hardSkillsEnabled]);

  // Информация о выбранном этапе для отображения
  const selectedStageInfo = useMemo(() => {
    if (!selectedStageId || !diagnosticStages) return null;
    const stage = diagnosticStages.find(s => s.id === selectedStageId);
    if (!stage) return null;
    return {
      period: stage.period || stage.evaluation_period || 'Без названия',
      is_active: stage.is_active
    };
  }, [selectedStageId, diagnosticStages]);
  
  // Фильтр компетенций - по умолчанию soft_skills если hard отключены
  const [globalFilter, setGlobalFilter] = useState<CompetencyFilterType>('hard_skills');
  
  // Auto-switch to soft_skills when hard skills are disabled
  useEffect(() => {
    if (stageConfigLoading) return;
    if (!hardSkillsEnabled && globalFilter.includes('hard')) {
      setGlobalFilter('soft_skills');
    }
  }, [hardSkillsEnabled, stageConfigLoading]);
  
  // Фильтр ролей для RadarChart (multi-select)
  const [radarRoles, setRadarRoles] = useState<RadarRoleType[]>(allRadarRoles);
  
  // Фильтр групп респондентов для горизонтальных диаграмм (multi-select)
  const [respondentGroups, setRespondentGroups] = useState<RespondentGroupType[]>(allRespondentGroups);
  
  // Фильтр набора навыков
  const [skillSetFilter, setSkillSetFilter] = useState<SkillSetFilterType>('assigned_to_all');
  
  // Переключатель отображения комментариев
  const [showComments, setShowComments] = useState(true);
  const [commentsKey, setCommentsKey] = useState(0);

  // Callback для скрытия комментариев при нажатии "Скрыть" на любом комментарии
  const handleHideComment = () => {
    setShowComments(false);
  };

  // При повторном включении комментариев — сбрасываем локальное скрытие через ключ
  const handleShowCommentsChange = (value: boolean) => {
    setShowComments(value);
    if (value) {
      setCommentsKey(prev => prev + 1);
    }
  };
  
  // Показать авторов комментариев (только для HR/manager/admin)
  const [showAuthors, setShowAuthors] = useState(false);
  
  // Johari Window Sheet state
  const [johariSheetOpen, setJohariSheetOpen] = useState(false);
  
  // Print mode state for Recharts rendering
  const [isPrinting, setIsPrinting] = useState(false);
  const { user: currentUser } = useAuth();
  
  // Permission-based check for Johari Window
  const { hasPermission: canViewJohariAll, isLoading: loadingViewAll } = usePermission('assessment_results.view_all');
  const { hasPermission: canViewJohariTeam, isLoading: loadingViewTeam } = usePermission('assessment_results.view_team');
  
  const permissionsLoading = loadingViewAll || loadingViewTeam;
  const canViewJohari = !permissionsLoading && (canViewJohariAll || canViewJohariTeam);
  
  // Access control check: user can only view their own results or subordinates' results
  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUser || !userId) {
        setAccessCheckComplete(true);
        return;
      }
      
      // User viewing their own results - always allowed
      if (currentUser.id === userId) {
        setAccessDenied(false);
        setAccessCheckComplete(true);
        return;
      }
      
      // Check permission to view all results (admin, hr_bp)
      if (canViewJohariAll && !loadingViewAll) {
        setAccessDenied(false);
        setAccessCheckComplete(true);
        return;
      }
      
      // Check if viewing team member (manager with team.view permission) — subtree check
      if (canViewJohariTeam && !loadingViewTeam) {
        const { data: isInSubtree, error } = await supabase
          .rpc('is_in_management_subtree', { 
            _manager_id: currentUser.id, 
            _target_id: userId 
          });
        
        if (isInSubtree && !error) {
          setAccessDenied(false);
          setAccessCheckComplete(true);
          return;
        }
      }
      
      // Wait for permissions to load before denying access
      if (permissionsLoading) {
        return;
      }
      
      // No access - redirect to own results
      console.warn('[AccessControl] User tried to access unauthorized results, redirecting');
      setAccessDenied(true);
      setAccessCheckComplete(true);
      toast.error('Доступ запрещён. Вы можете просматривать только свои результаты.');
      navigate(`/assessment/results/${currentUser.id}`, { replace: true });
    };
    
    checkAccess();
  }, [currentUser, userId, navigate, canViewJohariAll, canViewJohariTeam, loadingViewAll, loadingViewTeam, permissionsLoading]);

  // Helper to get user display name
  const getUserDisplayName = () => {
    if (!currentUser) return 'ФИО не указано';
    const fullName = [currentUser.last_name, currentUser.first_name, currentUser.middle_name].filter(Boolean).join(' ').trim();
    return fullName || currentUser.email || 'ФИО не указано';
  };

  // Handle print events for Recharts
  useEffect(() => {
    const handleBeforePrint = () => {
      setIsPrinting(true);
    };
    
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // PDF export handler with proper timing
  const handleExportPDF = () => {
    setIsPrinting(true);
    // Wait for React to render with isPrinting=true, then trigger resize and print
    requestAnimationFrame(() => {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        setTimeout(() => {
          window.print();
        }, 50);
      }, 50);
    });
  };

  // Получаем имя оцениваемого пользователя
  useEffect(() => {
    const fetchUserName = async () => {
      if (!userId) return;
      
      const { data } = await supabase
        .from('users')
        .select('last_name, first_name')
        .eq('id', userId)
        .single();
      
      if (data) {
        setEvaluatedUserName(`${data.last_name || ''} ${data.first_name || ''}`.trim());
      }
    };
    
    fetchUserName();
  }, [userId]);

  // Получаем правильно рассчитанные результаты с фильтром по этапу
  const {
    radarData,
    overallResults,
    skillResults,
    qualityResults,
    loading,
    maxValue,
    managerPositionCategory
  } = useCorrectAssessmentResults(userId, globalFilter, 'all', skillSetFilter, selectedStageId, snapshotContext, snapshotResolved);

  // Получаем комментарии
  const {
    skillResults: enhancedSkillResults,
    loading: enhancedSkillLoading,
  } = useSkillSurveyResultsEnhanced(userId, selectedStageId, snapshotContext, snapshotResolved);
  const {
    qualityResults: enhancedQualityResults,
    loading: enhancedQualityLoading,
  } = useSurvey360ResultsEnhanced(userId, selectedStageId, snapshotContext, snapshotResolved);


  // Функции для получения заголовков в зависимости от фильтра
  const getOverallTitle = () => {
    if (globalFilter === 'hard_skills') {
      return 'Средний балл по всем hard-навыкам';
    } else if (globalFilter === 'soft_skills') {
      return 'Средний балл по всем soft-навыкам';
    }
    return 'Общая оценка по компетенциям';
  };

  const getDetailedTitle = () => {
    if (globalFilter === 'hard_skills') {
      return 'Детализация по hard-навыкам';
    } else if (globalFilter === 'soft_skills') {
      return 'Детализация по soft-навыкам';
    } else if (globalFilter === 'hard_categories') {
      return 'Детализация по hard-навыкам данной компетенции';
    } else if (globalFilter === 'soft_categories') {
      return 'Детализация по soft-навыкам данной компетенции';
    } else if (globalFilter === 'hard_subcategories') {
      return 'Детализация по hard-навыкам данной подкомпетенции';
    } else if (globalFilter === 'soft_subcategories') {
      return 'Детализация по soft-навыкам данной подкомпетенции';
    }
    return 'Детализация результатов';
  };

  useEffect(() => {
    if (location.state?.showCompletionMessage) {
      setShowCompletionMessage(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Show loading state while checking access or loading data
  if (!accessCheckComplete || accessDenied || loading || snapshotLoading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {accessDenied ? 'Перенаправление...' : 'Загрузка результатов...'}
          </p>
        </div>
      </div>
    );
  }

  // Проверяем, есть ли данные для текущего фильтра
  const hasDataForCurrentFilter = radarData && radarData.length > 0;

  // Маппинг групп респондентов на данные из overallResults
  const groupColors: Record<RespondentGroupType, string> = {
    self: '#3A3FBC',           // Синий - Личный фидбек
    manager_internal: '#F28C28', // Оранжевый - Лид (внутренний)
    manager_external: '#9B59B6', // Фиолетовый - Лид (внешний)
    peer_internal: '#2EAE80',    // Зелёный - Коллега (внутренний)
    peer_external: '#E74C3C',    // Красный - Коллега (внешний)
    customer_external: '#F1C40F', // Жёлтый - Заказчик (внешний)
    all_except_self: '#8B5CF6'   // Фиолетовый - Все кроме фидбека сотрудника
  };

  // Возвращает элемент с value: null при отсутствии данных (для фиксированных позиций строк)
  const mapRespondentGroupToData = (group: RespondentGroupType, results: any): BarChartDataItem => {
    const emptyItem: BarChartDataItem = {
      label: respondentGroupLabels[group],
      value: null,
      color: groupColors[group],
      count: 0
    };

    if (!results) return emptyItem;

    switch (group) {
      case 'self':
        if (results.self_assessment != null) {
          return {
            label: respondentGroupLabels.self,
            value: results.self_assessment,
            color: groupColors.self,
            count: results.self_count || 0
          };
        }
        return emptyItem;
      case 'manager_internal':
        if (results.manager_assessment != null) {
          return {
            label: respondentGroupLabels.manager_internal,
            value: results.manager_assessment,
            color: groupColors.manager_internal,
            count: results.manager_count || 0
          };
        }
        return emptyItem;
      case 'peer_internal':
      case 'peer_external':
      case 'customer_external':
        // Маппим на категории должностей из peers_by_position_category
        if (results.peers_by_position_category) {
          for (const [categoryId, catData] of Object.entries(results.peers_by_position_category)) {
            const data = catData as { average: number; count: number; name: string };
            const categoryName = data.name?.toLowerCase() || '';
            
            let matchedGroup: RespondentGroupType | null = null;
            
            if (categoryName.includes('заказчик')) {
              matchedGroup = 'customer_external';
            } else if (categoryName.includes('коллега') && categoryName.includes('внешний')) {
              matchedGroup = 'peer_external';
            } else if (categoryName.includes('коллега') && categoryName.includes('внутренний')) {
              matchedGroup = 'peer_internal';
            } else if (categoryName.includes('лид') && categoryName.includes('внешний')) {
              matchedGroup = 'manager_external';
            }
            
            if (matchedGroup === group && data.average != null) {
              return {
                label: respondentGroupLabels[group],
                value: data.average,
                color: groupColors[group],
                count: data.count || 0
              };
            }
          }
        }
        return emptyItem;
      case 'manager_external':
        // Ищем в peers_by_position_category
        if (results.peers_by_position_category) {
          for (const [categoryId, catData] of Object.entries(results.peers_by_position_category)) {
            const data = catData as { average: number; count: number; name: string };
            const categoryName = data.name?.toLowerCase() || '';
            
            if (categoryName.includes('лид') && categoryName.includes('внешний') && data.average != null) {
              return {
                label: respondentGroupLabels.manager_external,
                value: data.average,
                color: groupColors.manager_external,
                count: data.count || 0
              };
            }
          }
        }
        return emptyItem;
      case 'all_except_self':
        if (results.all_except_self != null) {
          return {
            label: respondentGroupLabels.all_except_self,
            value: results.all_except_self,
            color: groupColors.all_except_self,
            count: results.all_except_self_count || 0
          };
        }
        return emptyItem;
      default:
        return emptyItem;
    }
  };

  // Генерация данных для общей диаграммы (фильтруем по выбранным группам респондентов)
  // Всегда добавляем все выбранные группы для фиксированных позиций
  const generateOverallChartData = (): BarChartDataItem[] => {
    if (!overallResults) return [];

    const chartItems: BarChartDataItem[] = [];

    // Проходим по выбранным группам респондентов - всегда добавляем (для фиксированных позиций)
    for (const group of respondentGroups) {
      const item = mapRespondentGroupToData(group, overallResults);
      chartItems.push(item);
    }

    // Добавляем "Все" если выбраны все группы
    if (respondentGroups.length === allRespondentGroups.length) {
      chartItems.push({
        label: 'Все',
        value: overallResults.all_average ?? null,
        color: 'hsl(var(--primary))',
        count: overallResults.all_count || 0
      });
    }

    return chartItems;
  };

  // Генерация данных для диаграммы отдельной компетенции
  // Всегда добавляем все выбранные группы для фиксированных позиций
  const generateCompetencyChartData = (competency: any): BarChartDataItem[] => {
    const data = competency?.data;
    if (!data) return [];

    const chartItems: BarChartDataItem[] = [];

    // Проходим по выбранным группам респондентов - всегда добавляем (для фиксированных позиций)
    for (const group of respondentGroups) {
      const item = mapRespondentGroupToData(group, data);
      chartItems.push(item);
    }

    // Добавляем "Все" если выбраны все группы
    if (respondentGroups.length === allRespondentGroups.length) {
      chartItems.push({
        label: 'Все',
        value: data.all_average ?? null,
        color: 'hsl(var(--primary))',
        count: data.all_count || 0
      });
    }

    return chartItems;
  };

  // Формируем заголовок с именем
  const pageTitle = evaluatedUserName 
    ? `Обратная связь 360 - ${evaluatedUserName}` 
    : 'Обратная связь 360';

  return (
    <div className="min-h-full print:p-0">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-surface-secondary pt-2 pb-4 px-6 border-b border-border/50 shadow-sm print:static print:border-0 print:shadow-none">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumbs + Stage info */}
          <div className="print:hidden mb-3 flex items-center justify-between">
            <Breadcrumbs />
            <div className="flex items-center gap-2">
              {isHistorical && (
                <Badge variant="warning" className="flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Исторические данные
                </Badge>
              )}
              {diagnosticStages && diagnosticStages.length > 0 && (
                <Select
                  value={selectedStageId || undefined}
                  onValueChange={(val) => setManualStageId(val)}
                >
                  <SelectTrigger className="w-[220px] h-8 text-sm">
                    <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Выберите этап" />
                  </SelectTrigger>
                  <SelectContent>
                    {diagnosticStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.period || stage.evaluation_period || 'Без названия'}
                        {stage.is_active ? ' (активный)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {showCompletionMessage && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 print:hidden mb-4">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200 font-medium ml-2">
                Оценка завершена. Результаты сохранены.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between print:hidden">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">{pageTitle}</h1>
            </div>
            <div className="flex gap-2">
              {canViewJohari && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-block">
                        <Button 
                          variant="outline" 
                          disabled
                          className="print:hidden bg-gradient-to-r from-purple-500/50 to-violet-600/50 text-white border-0 cursor-not-allowed"
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Окно Джохари (AI)
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Временно недоступно</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {canViewJohari && (
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    if (!userId) return;
                    toast.info('Формируется Excel-файл...');
                    try {
                      await exportAssessmentExcel(
                        userId,
                        selectedStageId,
                        evaluatedUserName,
                        selectedStageInfo?.period,
                        snapshotContext
                      );
                      toast.success('Excel-файл успешно сформирован');
                    } catch (error) {
                      console.error('Excel export error:', error);
                      toast.error('Ошибка при формировании Excel-файла');
                    }
                  }}
                  className="print:hidden"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Экспорт Excel
                </Button>
              )}
              <Button variant="outline" onClick={handleExportPDF} className="print:hidden">
                <Download className="w-4 h-4 mr-2" />
                Экспорт PDF
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад
              </Button>
            </div>
          </div>
          
          {/* Заголовок для печати */}
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">Сотрудник: {evaluatedUserName || getUserDisplayName()}</p>
            <p className="text-sm text-muted-foreground">Дата: {new Date().toLocaleDateString('ru-RU')}</p>
            {selectedStageInfo && (
              <p className="text-sm text-muted-foreground">Этап: {selectedStageInfo.period}</p>
            )}
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Фильтры над Розой навыков */}
        <div className="print:hidden">
        <CompetencyFilter
          value={globalFilter}
          onChange={setGlobalFilter}
          radarRoles={radarRoles}
          onRadarRolesChange={setRadarRoles}
          availableFilters={availableCompetencyFilters}
          skillSetValue={skillSetFilter}
          onSkillSetChange={setSkillSetFilter}
          showComments={showComments}
          onShowCommentsChange={handleShowCommentsChange}
          showAuthors={showAuthors}
          onShowAuthorsChange={canViewJohari ? setShowAuthors : undefined}
        />
        </div>

        {/* Роза компетенций */}
        {hasDataForCurrentFilter ? (
        <RadarChartResults 
          data={radarData} 
          assessmentType="survey_360"
          loading={loading}
          maxValue={maxValue}
          filterType={globalFilter}
          selectedRoles={radarRoles}
          isPrinting={isPrinting}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {globalFilter.includes('hard') ? 'Роза навыков' : 'Роза качеств'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground text-lg">Нет данных для отображения</p>
            <p className="text-sm text-muted-foreground/70 text-center max-w-md">
              Данные появятся после того, как респонденты завершат оценку (нажмут «Завершить оценку»). 
              Пока оценка находится в процессе — результаты недоступны.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Блок «Разрывы» — анализ внешних оценок */}
      {hasDataForCurrentFilter && (
        <GapsAnalysisBlock
          skillResults={skillResults}
          qualityResults={qualityResults}
        />
      )}

      {/* Локальный фильтр группы респондентов для горизонтальных диаграмм */}
      {hasDataForCurrentFilter && (overallResults || skillResults.length > 0 || qualityResults.length > 0) && (
        <Card className="p-4 print:hidden">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Группа респондентов
            </label>
            <RespondentGroupFilter
              selectedGroups={respondentGroups}
              onChange={setRespondentGroups}
            />
          </div>
        </Card>
      )}

      {/* Общая оценка - показываем только для hard_skills и soft_skills (сворачиваемый) */}
      {overallResults && (globalFilter === 'hard_skills' || globalFilter === 'soft_skills') && hasDataForCurrentFilter && (
        <CollapsibleHorizontalBarChart 
          data={generateOverallChartData()} 
          title={getOverallTitle()}
          maxValue={maxValue}
          defaultOpen={true}
        />
      )}

      {/* Детализация результатов */}
      {hasDataForCurrentFilter && skillResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{getDetailedTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Для категорий/подкатегорий группируем по category_name */}
            {(globalFilter === 'hard_categories' || globalFilter === 'hard_subcategories') ? (
              (() => {
                // Группируем навыки по категориям
                const groupedSkills = skillResults.reduce((acc, skill) => {
                  const categoryName = skill.category_name || 'Без категории';
                  if (!acc[categoryName]) {
                    acc[categoryName] = [];
                  }
                  acc[categoryName].push(skill);
                  return acc;
                }, {} as Record<string, typeof skillResults>);

                return Object.entries(groupedSkills).map(([categoryName, skills]) => (
                  <div key={categoryName} className="space-y-4 border-l-4 border-primary/20 pl-4">
                    <h3 className="text-lg font-semibold text-foreground">{categoryName}</h3>
                    {skills.map(skill => {
                      const skillComments = enhancedSkillResults.find(
                        s => s.skill_id === skill.competency_id
                      )?.comments || [];
                      
                      return (
                        <div key={skill.competency_id} className="space-y-2">
                          <HorizontalBarChart
                            data={generateCompetencyChartData(skill)}
                            title={skill.competency_name}
                            subtitle={[skill.category_name, skill.subcategory_name].filter(Boolean).join(' → ')}
                            maxValue={maxValue}
                          />
                          {showComments && (
                            <CompetencyComments 
                              key={commentsKey}
                              comments={skillComments} 
                              competencyName={skill.competency_name}
                              onHideComment={handleHideComment}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()
            ) : (
              // Для обычных навыков - сортируем по категории, затем по названию
              [...skillResults]
                .sort((a, b) => {
                  const catA = (a.category_name || 'Яяя').toLowerCase();
                  const catB = (b.category_name || 'Яяя').toLowerCase();
                  if (catA !== catB) return catA.localeCompare(catB, 'ru');
                  return a.competency_name.toLowerCase().localeCompare(b.competency_name.toLowerCase(), 'ru');
                })
                .map(skill => {
                  const skillComments = enhancedSkillResults.find(
                    s => s.skill_id === skill.competency_id
                  )?.comments || [];
                  
                  return (
                    <div key={skill.competency_id} className="space-y-2">
                      <HorizontalBarChart
                        data={generateCompetencyChartData(skill)}
                        title={skill.competency_name}
                        subtitle={[skill.category_name, skill.subcategory_name].filter(Boolean).join(' → ')}
                        maxValue={maxValue}
                      />
                      {showComments && (
                        <CompetencyComments 
                          key={commentsKey}
                          comments={skillComments} 
                          competencyName={skill.competency_name}
                          showAuthors={showAuthors}
                          onHideComment={handleHideComment}
                        />
                      )}
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      )}

      {hasDataForCurrentFilter && qualityResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{getDetailedTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Для категорий/подкатегорий группируем по category_name */}
            {(globalFilter === 'soft_categories' || globalFilter === 'soft_subcategories') ? (
              (() => {
                // Группируем качества по категориям
                const groupedQualities = qualityResults.reduce((acc, quality) => {
                  const categoryName = quality.category_name || 'Без категории';
                  if (!acc[categoryName]) {
                    acc[categoryName] = [];
                  }
                  acc[categoryName].push(quality);
                  return acc;
                }, {} as Record<string, typeof qualityResults>);

                return Object.entries(groupedQualities).map(([categoryName, qualities]) => (
                  <div key={categoryName} className="space-y-4 border-l-4 border-primary/20 pl-4">
                    <h3 className="text-lg font-semibold text-foreground">{categoryName}</h3>
                    {qualities.map(quality => {
                      const qualityComments = enhancedQualityResults.find(
                        q => q.quality_id === quality.competency_id
                      )?.comments || [];
                      
                      return (
                        <div key={quality.competency_id} className="space-y-2">
                          <HorizontalBarChart
                            data={generateCompetencyChartData(quality)}
                            title={quality.competency_name}
                            subtitle={[quality.category_name, quality.subcategory_name].filter(Boolean).join(' → ')}
                            maxValue={maxValue}
                          />
                          {showComments && (
                            <CompetencyComments 
                              key={commentsKey}
                              comments={qualityComments} 
                              competencyName={quality.competency_name}
                              showAuthors={showAuthors}
                              onHideComment={handleHideComment}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()
            ) : (
              // Для обычных качеств - сортируем по категории, затем по названию
              [...qualityResults]
                .sort((a, b) => {
                  const catA = (a.category_name || 'Яяя').toLowerCase();
                  const catB = (b.category_name || 'Яяя').toLowerCase();
                  if (catA !== catB) return catA.localeCompare(catB, 'ru');
                  return a.competency_name.toLowerCase().localeCompare(b.competency_name.toLowerCase(), 'ru');
                })
                .map(quality => {
                  const qualityComments = enhancedQualityResults.find(
                    q => q.quality_id === quality.competency_id
                  )?.comments || [];
                  
                  return (
                    <div key={quality.competency_id} className="space-y-2">
                      <HorizontalBarChart
                        data={generateCompetencyChartData(quality)}
                        title={quality.competency_name}
                        subtitle={[quality.category_name, quality.subcategory_name].filter(Boolean).join(' → ')}
                        maxValue={maxValue}
                      />
                      {showComments && (
                        <CompetencyComments 
                          key={commentsKey}
                          comments={qualityComments} 
                          competencyName={quality.competency_name}
                          showAuthors={showAuthors}
                          onHideComment={handleHideComment}
                        />
                      )}
                    </div>
                  );
                })
            )}
          </CardContent>
        </Card>
      )}

      {/* Показываем "Нет данных" в детализации если данных нет */}
      {!hasDataForCurrentFilter && (
        <Card>
          <CardHeader>
            <CardTitle>{getDetailedTitle()}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground text-lg">Нет данных для отображения</p>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Johari Window Sheet */}
      <JohariWindowSheet
        open={johariSheetOpen}
        onOpenChange={setJohariSheetOpen}
        stageId={selectedStageId}
        evaluatedUserId={userId || null}
        evaluatedUserName={evaluatedUserName}
        canReview={canViewJohari}
      />
    </div>
  );
};

export default AssessmentResultsPage;
