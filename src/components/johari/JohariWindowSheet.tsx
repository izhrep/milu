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
import { 
  RefreshCw, 
  AlertTriangle, 
  Loader2, 
  Brain, 
  Lightbulb, 
  MessageSquare,
  MessageSquareText,
  AlertCircle,
  Calendar,
  ShieldCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { JohariQuadrants } from './JohariQuadrants';
import { useJohariReport, type SkillMetrics, type StructuredQuestion, type RespondentScope, type ExternalCommentsReview, type SummaryCase, type OneToOneQuestion } from '@/hooks/useJohariReport';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Заменяет англоязычные / устаревшие названия зон на русские бизнес-названия */
const replaceZoneTerms = (text: string): string => {
  return text
    .replace(/\bhidden_strength\b/gi, 'Скрытая зона')
    .replace(/\bblind_spot\b/gi, 'Слепая зона')
    .replace(/\bgrey_zone\b/gi, 'Серая зона')
    .replace(/\bgrey\s+zone\b/gi, 'Серая зона')
    .replace(/\barena\b/gi, 'Открытая зона')
    .replace(/\bunknown\b/gi, 'Чёрный ящик')
    .replace(/Арена/g, 'Открытая зона')
    .replace(/Скрытая сила/g, 'Скрытая зона')
    .replace(/Неизвестное/g, 'Чёрный ящик')
    .replace(/серая зона/gi, 'Серая зона');
};

// --- Validation + fallback for discussion questions ---

const BLIND_TEMPLATES = [
  'Как сотрудник оценивает свой текущий уровень в навыке «{skill}»? Что именно даёт ему уверенность в этой оценке?',
  'Какие конкретные ситуации за последний период могли бы проиллюстрировать применение навыка «{skill}»?',
];
const HIDDEN_TEMPLATES = [
  'Что мешает сотруднику чувствовать себя уверенно в навыке «{skill}», несмотря на высокую оценку окружающих?',
  'Есть ли у сотрудника опыт успешного применения навыка «{skill}», который он мог не замечать?',
];
const POLARIZED_TEMPLATE = 'Оценки по навыку «{skill}» заметно расходятся между респондентами. Как сотрудник думает, в каких ситуациях этот навык проявляется по-разному?';

interface ValidatedQuestion {
  zone: string;
  skill_name: string;
  question: string;
}

function validateAndBuildQuestions(
  aiQuestions: (StructuredQuestion | string)[] | undefined,
  skills: SkillMetrics[]
): ValidatedQuestion[] {
  const skillNames = new Set(skills.map(s => s.skill_name.toLowerCase()));
  const validZones = new Set(['blind_spot', 'hidden_strength', 'arena', 'polarized']);

  // Try to validate AI questions
  if (aiQuestions && aiQuestions.length > 0) {
    const validated: ValidatedQuestion[] = [];
    const usedSkills = new Set<string>();

    for (const q of aiQuestions) {
      if (typeof q === 'string') continue;
      if (!q.zone || !q.skill_name || !q.question) continue;
      if (!validZones.has(q.zone)) continue;
      if (!skillNames.has(q.skill_name.toLowerCase())) continue;
      const key = q.skill_name.toLowerCase();
      if (usedSkills.has(key) && skills.length > 3) continue;
      usedSkills.add(key);
      validated.push({ zone: q.zone, skill_name: q.skill_name, question: q.question });
    }

    if (validated.length >= 3) return validated;
  }

  return generateFallbackQuestions(skills);
}

function generateFallbackQuestions(skills: SkillMetrics[]): ValidatedQuestion[] {
  const blind = skills.filter(s => s.zone === 'blind_spot').sort((a, b) => b.delta - a.delta);
  const hidden = skills.filter(s => s.zone === 'hidden_strength').sort((a, b) => b.delta - a.delta);
  const arena = skills.filter(s => s.zone === 'arena').sort((a, b) => b.delta - a.delta);
  const polarized = skills.filter(s => s.is_polarized).sort((a, b) => b.delta - a.delta);

  const result: ValidatedQuestion[] = [];
  const used = new Set<string>();

  const pick = (pool: SkillMetrics[], zone: string, templates: string[], count: number) => {
    let added = 0;
    for (const s of pool) {
      if (added >= count) break;
      if (used.has(s.skill_id)) continue;
      used.add(s.skill_id);
      result.push({
        zone,
        skill_name: s.skill_name,
        question: templates[added % templates.length].replace('{skill}', s.skill_name),
      });
      added++;
    }
    return added;
  };

  let blindPicked = pick(blind, 'blind_spot', BLIND_TEMPLATES, 2);
  if (blindPicked < 2) pick(hidden, 'blind_spot', BLIND_TEMPLATES, 2 - blindPicked);

  let hiddenPicked = pick(hidden, 'hidden_strength', HIDDEN_TEMPLATES, 2);
  if (hiddenPicked < 2) pick(arena, 'hidden_strength', HIDDEN_TEMPLATES, 2 - hiddenPicked);

  if (polarized.length > 0) {
    const s = polarized.find(p => !used.has(p.skill_id)) || polarized[0];
    result.push({
      zone: 'polarized',
      skill_name: s.skill_name,
      question: POLARIZED_TEMPLATE.replace('{skill}', s.skill_name),
    });
  }

  return result;
}

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
    aiReport,
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

  // AI-текст показывается только если: отчёт утверждён ИЛИ пользователь может утверждать
  const showAiReport = aiReport && (snapshot?.is_reviewed || canReview);

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

            {/* Legend */}
            <div className="inline-flex flex-col gap-0.5 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30 max-w-md">
              <span className="font-medium text-foreground text-[11px] mb-0.5">FAQ</span>
              <span><strong className="font-semibold text-foreground">Δ (Дельта)</strong> — разница между «Я» и «{isExternalOnly ? 'Внешние' : 'Все кроме меня'}»</span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-orange-600 inline shrink-0" />
                <span><strong className="font-semibold text-foreground">Поляризация</strong> — высокий разброс оценок внутри группы «{isExternalOnly ? 'Внешние' : 'Все кроме меня'}»</span>
              </span>
              <span className="text-muted-foreground/80 italic text-[11px] mt-0.5">Большая Δ не всегда означает поляризацию</span>
            </div>

            {/* Quadrants */}
            <JohariQuadrants 
              skills={snapshot.metrics_json.skills} 
              scaleMax={snapshot.metrics_json.scale_max}
              externalOnly={isExternalOnly}
            />

            {/* Moderation status banner */}
            {!snapshot.is_reviewed && canReview && aiReport && (
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

            {/* AI Report */}
            {showAiReport && (
              <>
                <Separator />
                
                {/* Summary as bullet list */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Brain className="w-4 h-4 text-primary" />
                      Резюме AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {(() => {
                        const raw = replaceZoneTerms(aiReport.summary);

                        // Count skills per zone from snapshot for dynamic headers
                        const zoneCounts: Record<string, number> = {};
                        if (snapshot?.metrics_json?.skills) {
                          for (const s of snapshot.metrics_json.skills) {
                            zoneCounts[s.zone] = (zoneCounts[s.zone] || 0) + 1;
                          }
                        }
                        const blindCount = zoneCounts['blind_spot'] || 0;
                        const hiddenCount = zoneCounts['hidden_strength'] || 0;

                        /** Build dynamic section header based on actual zone count */
                        const buildZoneHeader = (zone: 'blind' | 'hidden', count: number): string | null => {
                          if (count === 0) return null;
                          const zoneName = zone === 'blind' ? 'Слепая зона' : 'Скрытая зона';
                          const zoneNamePlural = zone === 'blind' ? 'слепых зон' : 'скрытых зон';
                          if (count >= 3) return `Топ-3 ${zoneNamePlural}`;
                          const suffix = count === 1 ? 'навык' : 'навыка';
                          return `${zoneName} (${count} ${suffix})`;
                        };

                        // Normalize: strip double markers, stray bullets, formatting artifacts
                        const normalized = raw
                          .replace(/^[•–—\-]\s*[•–—\-]\s*/gm, '')
                          .replace(/^[•–—\-]\s*/gm, '')
                          .replace(/\*\*/g, '');

                        // Split into lines
                        let lines = normalized.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        // Fallback: if single long paragraph, split by sentences
                        if (lines.length <= 1 && raw.length > 120) {
                          lines = normalized
                            .split(/(?<=[.!?])\s+/)
                            .map(s => s.trim())
                            .filter(s => s.length > 0);
                        }

                        // Protect against header+item glued on one line
                        const expanded: string[] = [];
                        for (const line of lines) {
                          const glueMatch = line.match(/^((?:ТОП-\d+|Топ-\d+)[^:]*:)\s*(1[.)].*)$/i);
                          if (glueMatch) {
                            expanded.push(glueMatch[1]);
                            glueMatch[2].split(/(?=\d+[.)]\s)/).forEach(s => expanded.push(s.trim()));
                          } else {
                            expanded.push(line);
                          }
                        }

                        // Detect section headers
                        const isSectionHeader = (l: string) =>
                          /^(КЛЮЧЕВЫЕ\s+ВЫВОДЫ|ТОП-\d+|Ключевые\s+выводы|Топ-\d+)/i.test(l) ||
                          (/:\s*$/.test(l) && !(/^\d+[.)]/.test(l)));

                        /** Determine if a header is a blind/hidden zone section */
                        const getZoneType = (header: string): 'blind' | 'hidden' | null => {
                          if (/слеп/i.test(header)) return 'blind';
                          if (/скрыт/i.test(header)) return 'hidden';
                          return null;
                        };

                        const elements: React.ReactNode[] = [];
                        let idx = 0;
                        while (idx < expanded.length) {
                          const line = expanded[idx];

                          if (isSectionHeader(line)) {
                            // Determine zone type for dynamic header replacement
                            const zoneType = getZoneType(line);
                            let displayHeader: string | null;

                            if (zoneType === 'blind') {
                              displayHeader = buildZoneHeader('blind', blindCount);
                            } else if (zoneType === 'hidden') {
                              displayHeader = buildZoneHeader('hidden', hiddenCount);
                            } else if (/КЛЮЧЕВЫЕ\s+ВЫВОДЫ/i.test(line)) {
                              displayHeader = 'Ключевые выводы';
                            } else {
                              displayHeader = line.replace(/:$/, '');
                            }

                            idx++;

                            // Collect items for this section
                            const isNumbered = idx < expanded.length && /^\d+[.)]/.test(expanded[idx]);
                            const items: string[] = [];

                            if (isNumbered) {
                              while (idx < expanded.length && /^\d+[.)]/.test(expanded[idx])) {
                                items.push(expanded[idx].replace(/^\d+[.)]\s*/, ''));
                                idx++;
                              }
                            } else {
                              while (idx < expanded.length && !isSectionHeader(expanded[idx])) {
                                items.push(expanded[idx]);
                                idx++;
                              }
                            }

                            // Skip entire section if header is null (count=0) or no items
                            if (!displayHeader || items.length === 0) continue;

                            // For zone sections, limit items to count (max 3)
                            const maxItems = zoneType
                              ? Math.min(items.length, zoneType === 'blind' ? Math.min(blindCount, 3) : Math.min(hiddenCount, 3))
                              : items.length;
                            const visibleItems = items.slice(0, maxItems);

                            elements.push(
                              <p key={`h-${idx}`} className="font-semibold text-sm mt-3 first:mt-0">
                                {displayHeader}
                              </p>
                            );

                            if (isNumbered) {
                              elements.push(
                                <ol key={`ol-${idx}`} className="list-decimal list-inside space-y-0.5 ml-1">
                                  {visibleItems.map((item, i) => (
                                    <li key={i} className="text-sm">{item}</li>
                                  ))}
                                </ol>
                              );
                            } else {
                              elements.push(
                                <ul key={`ul-${idx}`} className="space-y-1 ml-1">
                                  {visibleItems.map((item, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                      <span className="text-primary mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            }
                          } else {
                            elements.push(
                              <div key={`f-${idx}`} className="flex items-start gap-2 text-sm">
                                <span className="text-primary mt-0.5">•</span>
                                <span>{line}</span>
                              </div>
                            );
                            idx++;
                          }
                        }
                        return elements;
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations as bullets */}
                {aiReport.recommendations && aiReport.recommendations.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        Рекомендации для Unit-lead
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {aiReport.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-primary font-medium">•</span>
                            <span>{replaceZoneTerms(rec)}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Discussion questions — data-driven with validation + fallback */}
                {(() => {
                  const skills = snapshot.metrics_json.skills;
                  const validatedQuestions = validateAndBuildQuestions(
                    aiReport.discussion_questions,
                    skills
                  );

                  if (validatedQuestions.length === 0) return null;

                  const zoneLabelMap: Record<string, string> = {
                    blind_spot: 'Слепая зона',
                    hidden_strength: 'Скрытая зона',
                    arena: 'Открытая зона',
                    polarized: 'Поляризация',
                  };
                   const zoneColorMap: Record<string, string> = {
                    blind_spot: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                    hidden_strength: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    arena: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    polarized: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                  };

                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          Вопросы для обсуждения на 1:1 (для Unit-lead)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {validatedQuestions.map((q, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 mt-0.5 ${zoneColorMap[q.zone] || ''}`}>
                                {zoneLabelMap[q.zone] || q.zone}
                              </Badge>
                              <span>{replaceZoneTerms(q.question)}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* External Comments Case-Based Review — only for external_only scope */}
                {isExternalOnly && (
                  (() => {
                    const review = snapshot.external_comments_review as ExternalCommentsReview | null | undefined;
                    
                    if (!review) {
                      return (
                        <Alert className="bg-muted/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Нет данных для AI-обзора комментариев</AlertTitle>
                          <AlertDescription>
                            Нет комментариев внешних респондентов для ревью.
                          </AlertDescription>
                        </Alert>
                      );
                    }

                    const strengthCases = review.summary_cases?.filter(c => c.type === 'strength') || [];
                    const attentionCases = review.summary_cases?.filter(c => c.type === 'attention') || [];
                    const questions = review.one_to_one_questions || [];

                    const zoneLabelMap: Record<string, string> = {
                      open: 'Открытая зона',
                      blind: 'Слепая зона',
                      hidden: 'Скрытая зона',
                      unknown: 'Чёрный ящик',
                    };
                    const zoneColorMap: Record<string, string> = {
                      open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      blind: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                      hidden: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      unknown: 'bg-muted text-muted-foreground',
                    };

                    const renderCase = (c: SummaryCase) => (
                      <div key={c.id} className="space-y-1.5 p-3 rounded-lg bg-muted/30 border">
                        <p className="font-semibold text-sm">{c.title}</p>
                        <p className="text-sm text-muted-foreground">{c.insight}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Подтверждено комментариями: {c.evidence_count}</span>
                        </div>
                        {c.example_signals && c.example_signals.length > 0 && (
                          <ul className="space-y-0.5 ml-1">
                            {c.example_signals.map((sig, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <span className="mt-0.5">→</span>
                                <span>{sig}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {c.related_skills && c.related_skills.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-xs text-muted-foreground/70">Связанные навыки (гипотеза):</span>
                            {c.related_skills.map((rs, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                                {rs.skill_name}{rs.relation === 'secondary' ? ' (↓)' : ''}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );

                    return (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <MessageSquareText className="w-4 h-4 text-primary" />
                            Краткое ревью комментариев внешних
                          </CardTitle>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Только внешние респонденты</span>
                            {review.notes?.comments_used > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                💬 {review.notes.comments_used} комментариев
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Strength cases */}
                          {strengthCases.length > 0 && (
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Сильные кейсы по комментариям внешних</p>
                              {strengthCases.map(renderCase)}
                            </div>
                          )}

                          {/* Attention cases */}
                          {attentionCases.length > 0 && (
                            <div className="space-y-2">
                              <p className="font-semibold text-sm">Кейсы внимания</p>
                              {attentionCases.map(renderCase)}
                            </div>
                          )}

                          {/* 1:1 Questions */}
                          {questions.length > 0 && (
                            <div>
                              <p className="font-semibold text-sm mb-1.5">Что обсудить на 1:1 (для Unit-lead)</p>
                              <ol className="space-y-2">
                                {questions.map((q, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-sm">
                                    <span className="text-muted-foreground font-medium shrink-0">{idx + 1}.</span>
                                    <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 py-0 mt-0.5 ${zoneColorMap[q.zone] || ''}`}>
                                      {zoneLabelMap[q.zone] || q.zone}
                                    </Badge>
                                    <span>{q.question}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })()
                )}
              </>
            )}

            {/* Hidden AI report notice for non-reviewers */}
            {aiReport && !snapshot.is_reviewed && !canReview && (
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
