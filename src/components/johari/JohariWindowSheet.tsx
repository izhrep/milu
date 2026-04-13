import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  AlertTriangle, 
  Loader2, 
  Brain, 
  AlertCircle,
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronDown,
  Info
} from 'lucide-react';
import { JohariQuadrants } from './JohariQuadrants';
import { JohariCompetencyView } from './JohariCompetencyView';
import { JohariCommentsClassification } from './JohariCommentsClassification';
import { useJohariReport, type RespondentScope } from '@/hooks/useJohariReport';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface JohariWindowSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId: string | null;
  evaluatedUserId: string | null;
  evaluatedUserName?: string;
  /** Может ли текущий пользователь утверждать AI-отчёты (HR/Admin) */
  canReview?: boolean;
}

export const JohariWindowSheet: React.FC<JohariWindowSheetProps> = ({
  open,
  onOpenChange,
  stageId,
  evaluatedUserId,
  evaluatedUserName,
  canReview = false
}) => {
  const {
    snapshot,
    loading,
    error,
    dataChanged,
    insufficientData,
    insufficientDataMessage,
    excludedSkills,
    currentScope,
    fetchReport,
    regenerateReport,
    reviewSnapshot,
    isReviewing
  } = useJohariReport();

  const [scopeToggle, setScopeToggle] = useState(false);
  const isExternalOnly = currentScope === 'external_only';

  useEffect(() => {
    if (open && stageId && evaluatedUserId) {
      setScopeToggle(false);
      fetchReport(stageId, evaluatedUserId, 'all');
    }
  }, [open, stageId, evaluatedUserId, fetchReport]);

  const handleScopeToggle = (checked: boolean) => {
    setScopeToggle(checked);
    if (stageId && evaluatedUserId) {
      const newScope: RespondentScope = checked ? 'external_only' : 'all';
      fetchReport(stageId, evaluatedUserId, newScope);
    }
  };

  const handleRegenerate = () => {
    if (stageId && evaluatedUserId) {
      regenerateReport(stageId, evaluatedUserId, currentScope);
    }
  };

  const handleReview = () => {
    if (snapshot) {
      reviewSnapshot(snapshot.id);
    }
  };

  // Comments review is shown only if: report is reviewed OR user can review
  const showCommentsReview = snapshot && (snapshot.is_reviewed || canReview);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'd MMMM yyyy, HH:mm', { locale: ru });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] xl:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Окно Джохари (AI)
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {evaluatedUserName && (
                <span>Анализ soft skills для: <strong>{evaluatedUserName}</strong></span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={loading}
                className="shrink-0"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Обновить отчёт
              </Button>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Генерация отчёта...</p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              Это может занять несколько секунд
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Ошибка</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Insufficient data state */}
        {insufficientData && !loading && (
          <div className="py-6 space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Недостаточно данных</AlertTitle>
              <AlertDescription>
                {insufficientDataMessage || 'Недостаточно данных для построения отчёта Окна Джохари.'}
              </AlertDescription>
            </Alert>

            {excludedSkills.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Навыки, исключённые из расчёта</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {excludedSkills.map((skill) => (
                      <div 
                        key={skill.skill_id} 
                        className="flex items-center justify-between p-2 rounded bg-muted/50"
                      >
                        <span className="font-medium text-sm">{skill.skill_name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {skill.reason}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Success state with snapshot */}
        {snapshot && !loading && !insufficientData && (
          <div className="space-y-6">
            {/* Data changed banner */}
            {dataChanged && (
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">
                  Данные изменились
                </AlertTitle>
                <AlertDescription className="flex items-center justify-between">
                  <span className="text-amber-700 dark:text-amber-300">
                    С момента генерации отчёта данные были обновлены. Вы можете перегенерировать отчёт.
                  </span>
                  <Button 
                    size="sm" 
                    onClick={handleRegenerate}
                    className="ml-4"
                    disabled={loading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Перегенерировать
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Snapshot metadata + scope switch */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Создан: {formatDate(snapshot.created_at)}</span>
              </div>
              <Badge variant="outline">Версия {snapshot.version}</Badge>
              <div className="flex items-center gap-2">
                <Switch
                  id="scope-toggle"
                  checked={scopeToggle}
                  onCheckedChange={handleScopeToggle}
                  disabled={loading}
                />
                <Label htmlFor="scope-toggle" className="text-sm cursor-pointer flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Только внешние
                </Label>
              </div>
              {snapshot.metrics_json.total_others_raters_cnt != null && (
                <Badge variant="secondary">
                  👥 {isExternalOnly ? 'Внешних' : 'Респондентов'}: {snapshot.metrics_json.total_others_raters_cnt}
                </Badge>
              )}
            </div>

            {/* Collapsible help — visible to HR/Lead */}
            {canReview && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
                    <Info className="w-4 h-4" />
                    Справка по работе с Окном Джохари
                    <ChevronDown className="w-3.5 h-3.5 ml-auto transition-transform [[data-state=open]>&]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="text-xs text-muted-foreground border rounded-md px-4 py-3 bg-muted/30 space-y-2 mt-1">
                    <p className="font-medium text-foreground">Как читать Окно Джохари</p>
                    <div className="space-y-1">
                      <p>🟢 <strong>Открытая зона</strong> — самооценка и внешняя оценка близки. Зона взаимопонимания.</p>
                      <p>🟠 <strong>Слепая зона</strong> — сотрудник оценивает себя выше, чем окружающие. Возможная переоценка.</p>
                      <p>🔵 <strong>Скрытая зона</strong> — окружающие оценивают выше, чем сам сотрудник. Возможная недооценка.</p>
                      <p>⚪ <strong>Чёрный ящик</strong> — недостаточно данных для классификации.</p>
                    </div>
                    <div className="border-t border-border/30 pt-2 space-y-1">
                      <p><strong>Δ (Дельта)</strong> — разница между «Я» и «{isExternalOnly ? 'Внешние' : 'Все кроме меня'}» в баллах. Знак показывает направление.</p>
                      <p><strong>⚡ Противоречивые оценки</strong> — высокий разброс оценок внутри группы респондентов.</p>
                      <p><strong>Условные обозначения:</strong> 💪 большинство оценок 1 · 👌 большинство 2 · 🔧 большинство 3 · ❔ мало данных · В↑В↓ внешние vs команда · Л↑Л↓ лид vs коллеги</p>
                    </div>
                    <p className="italic text-muted-foreground/80">Большая Δ не всегда означает противоречивые оценки. Это разные явления.</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Tabs: Компетенции / Навыки */}
            <Tabs defaultValue="competencies">
              <TabsList className="grid w-full grid-cols-2 max-w-xs">
                <TabsTrigger value="competencies">Компетенции</TabsTrigger>
                <TabsTrigger value="skills">Навыки</TabsTrigger>
              </TabsList>
              <TabsContent value="competencies" className="mt-3">
                <JohariCompetencyView skills={snapshot.metrics_json.skills} />
              </TabsContent>
              <TabsContent value="skills" className="mt-3">
                <JohariQuadrants 
                  skills={snapshot.metrics_json.skills} 
                  scaleMax={snapshot.metrics_json.scale_max}
                  scaleMin={snapshot.metrics_json.scale_min}
                  externalOnly={isExternalOnly}
                />
              </TabsContent>
            </Tabs>

            {/* Moderation status banner */}
            {!snapshot.is_reviewed && canReview && (
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 dark:text-amber-200">
                  Ожидает проверки
                </AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-4">
                  <span className="text-amber-700 dark:text-amber-300 text-sm">
                    AI-отчёт будет скрыт от сотрудника до утверждения HR/Admin.
                  </span>
                  <Button 
                    size="sm" 
                    onClick={handleReview}
                    disabled={isReviewing}
                    className="shrink-0"
                  >
                    {isReviewing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2" />
                    )}
                    Утвердить отчёт
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Reviewed status */}
            {snapshot.is_reviewed && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span>Отчёт утверждён</span>
                {snapshot.reviewed_at && (
                  <span className="text-xs">
                    ({formatDate(snapshot.reviewed_at)})
                  </span>
                )}
              </div>
            )}

            {/* Comments Classification — for both scopes */}
            {showCommentsReview && (
              <>
                <Separator />
                {snapshot.comments_classification ? (
                  <JohariCommentsClassification
                    data={snapshot.comments_classification}
                    canReview={canReview}
                    isExternalOnly={isExternalOnly}
                  />
                ) : (
                  <Alert className="bg-muted/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Нет данных для AI-классификации комментариев</AlertTitle>
                    <AlertDescription>
                      {isExternalOnly
                        ? 'Нет комментариев внешних респондентов для классификации.'
                        : 'Нет комментариев респондентов для классификации.'}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {/* Hidden AI report notice for non-reviewers */}
            {!snapshot.is_reviewed && !canReview && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>AI-анализ ожидает проверки</AlertTitle>
                <AlertDescription>
                  AI-сгенерированный отчёт будет доступен после проверки HR/Admin.
                </AlertDescription>
              </Alert>
            )}

            {/* Excluded skills */}
            {excludedSkills.length > 0 && (
              <>
                <Separator />
                <Card className="border-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      Исключено из расчёта
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {excludedSkills.map((skill) => (
                        <div 
                          key={skill.skill_id} 
                          className="flex items-center justify-between text-sm py-1"
                        >
                          <span className="text-muted-foreground">{skill.skill_name}</span>
                          <span className="text-xs text-muted-foreground/70">{skill.reason}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
