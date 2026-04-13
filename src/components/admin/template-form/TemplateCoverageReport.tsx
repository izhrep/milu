import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useDiagnosticConfigTemplates } from '@/hooks/useDiagnosticConfigTemplates';
import { useTemplateSelection } from '@/contexts/TemplateSelectionContext';

interface CategoryCoverage {
  categoryId: string;
  categoryName: string;
  skillType: 'hard' | 'soft';
  requiredLevels: number[];
  existingLevels: number[];
  missingLevels: number[];
  extraLevels: number[];
  isComplete: boolean;
}

interface CoverageResult {
  categories: CategoryCoverage[];
  allComplete: boolean;
  hasWarnings: boolean;
  hasErrors: boolean;
}

interface TemplateCoverageReportProps {
  templateId: string;
}

export const TemplateCoverageReport: React.FC<TemplateCoverageReportProps> = ({ templateId }) => {
  const { fetchTemplateCoverage } = useDiagnosticConfigTemplates();
  const { selectTemplate, setFocusedAnswerCategoryId } = useTemplateSelection();

  const [coverage, setCoverage] = useState<CoverageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchTemplateCoverage(templateId);
      setCoverage(result ?? null);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [templateId, fetchTemplateCoverage]);

  const navigateToCategory = (categoryId: string) => {
    selectTemplate(templateId);
    setFocusedAnswerCategoryId(categoryId);
    const questionsTab = document.querySelector('[data-value="questions"]') as HTMLElement;
    if (questionsTab) questionsTab.click();
  };

  if (!loaded) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Покрытие шкалы вариантами ответов
          </h4>
          <Button variant="outline" size="sm" onClick={handleLoad} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Проверка...' : 'Проверить покрытие'}
          </Button>
        </div>
      </div>
    );
  }

  if (!coverage) {
    return (
      <div className="border border-border rounded-lg p-3 bg-card">
        <p className="text-sm text-muted-foreground">Не удалось загрузить данные покрытия.</p>
      </div>
    );
  }

  const statusIcon = coverage.allComplete
    ? <CheckCircle2 className="h-4 w-4 text-green-600" />
    : coverage.hasErrors
      ? <XCircle className="h-4 w-4 text-destructive" />
      : <AlertTriangle className="h-4 w-4 text-amber-500" />;

  const statusText = coverage.allComplete
    ? 'Все группы ответов полностью покрывают шкалу'
    : coverage.hasErrors
      ? 'Есть группы с недостающими уровнями'
      : 'Есть группы с уровнями вне диапазона';

  // Group by skill type
  const hardCategories = coverage.categories.filter(c => c.skillType === 'hard');
  const softCategories = coverage.categories.filter(c => c.skillType === 'soft');

  const renderCategoryRow = (cat: CategoryCoverage) => {
    const icon = cat.isComplete
      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
      : cat.missingLevels.length > 0
        ? <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;

    return (
      <div key={cat.categoryId} className="flex items-start gap-2 py-1.5">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{cat.categoryName}</span>
            {cat.isComplete && (
              <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
                ✅ Полное покрытие
              </Badge>
            )}
            {cat.missingLevels.length > 0 && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/5">
                ❌ Нет уровней: {cat.missingLevels.join(', ')}
              </Badge>
            )}
            {cat.extraLevels.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                ⚠️ Вне диапазона: {cat.extraLevels.join(', ')}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Диапазон шаблона: [{cat.requiredLevels[0]}..{cat.requiredLevels[cat.requiredLevels.length - 1]}], 
            существующие: [{cat.existingLevels.join(', ') || '—'}]
          </p>
        </div>
        {!cat.isComplete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs flex-shrink-0"
            onClick={() => navigateToCategory(cat.categoryId)}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Перейти
          </Button>
        )}
      </div>
    );
  };

  const renderSection = (title: string, categories: CategoryCoverage[]) => {
    if (categories.length === 0) return null;
    const complete = categories.filter(c => c.isComplete).length;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h5>
          <span className="text-xs text-muted-foreground">
            ({complete}/{categories.length} групп покрыто)
          </span>
        </div>
        <div className="divide-y divide-border">
          {categories.map(renderCategoryRow)}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border rounded-lg p-3 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Покрытие шкалы
          </h4>
          {statusIcon}
          <span className="text-xs text-muted-foreground">{statusText}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLoad} disabled={loading} className="h-7">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {renderSection('Hard Skills', hardCategories)}
      {renderSection('Soft Skills', softCategories)}
    </div>
  );
};
