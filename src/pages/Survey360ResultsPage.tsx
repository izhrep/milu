import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { useSurvey360ResultsEnhanced } from '@/hooks/useSurvey360ResultsEnhanced';
import { useAuth } from '@/contexts/AuthContext';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { StageFilter, useStageFilter } from '@/components/StageFilter';
import { ExpandableQualityCard } from '@/components/ExpandableQualityCard';
import { toast } from 'sonner';

// Helper to get user display name
const getUserDisplayName = (user: { last_name?: string; first_name?: string; middle_name?: string; email: string } | null): string => {
  if (!user) return 'ФИО не указано';
  const fullName = [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'ФИО не указано';
};

const Survey360ResultsPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { stages: diagnosticStages } = useDiagnosticStages();
  const [isPrinting, setIsPrinting] = useState(false);
  
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
  
  // Convert DiagnosticStage[] to StageOption[] format
  const stages = diagnosticStages?.map(s => ({
    id: s.id,
    period: s.period || s.evaluation_period || 'Без названия',
    start_date: s.start_date,
    end_date: s.end_date,
    is_active: s.is_active
  })) || [];
  
  const { selectedStageId, setSelectedStageId } = useStageFilter(stages);
  const { qualityResults, summary, loading } = useSurvey360ResultsEnhanced(currentUser?.id, selectedStageId);

  const radarData = qualityResults.map(result => ({
    quality: result.category ? `${result.quality_name} (${result.category})` : result.quality_name,
    value: result.average_score,
    fullMark: 4
  }));

  const handleExportCSV = () => {
    if (!qualityResults.length) return;
    
    const headers = ['Качество', 'Категория', 'Общая оценка', 'Самооценка', 'Оценка руководителя', 'Оценка коллег', 'Количество ответов'];
    const rows = qualityResults.map(quality => [
      quality.quality_name,
      quality.category || '-',
      quality.average_score.toFixed(2),
      quality.self_score?.toFixed(2) || '-',
      quality.supervisor_score?.toFixed(2) || '-',
      quality.colleague_score?.toFixed(2) || '-',
      quality.response_count
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `360_survey_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Отчёт экспортирован');
  };

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

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка результатов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Print-only header */}
      <div className="hidden print:block mb-6 pb-4 border-b">
        <h1 className="text-2xl font-bold">Отчёт: Результаты оценки 360°</h1>
        <p className="text-sm text-muted-foreground">
          Сотрудник: {getUserDisplayName(currentUser)}
        </p>
        <p className="text-sm text-muted-foreground">
          Этап: {stages.find(s => s.id === selectedStageId)?.period || 'Все этапы'} | Дата: {new Date().toLocaleDateString('ru-RU')}
        </p>
      </div>

      <div className="print:hidden">
        <Breadcrumbs />
      </div>
      
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Результаты оценки 360°</h1>
        <p className="text-text-secondary mt-2">Ваши результаты всесторонней оценки личностных качеств</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button onClick={() => navigate('/survey-360')} variant="outline">
          Оценка 360°
        </Button>
        <Button onClick={() => navigate('/skill-survey')} variant="outline">
          Самооценка навыков
        </Button>
        <Button variant="default">Результаты</Button>
        
        <div className="ml-auto">
          <StageFilter
            stages={stages}
            selectedStageId={selectedStageId}
            onStageChange={setSelectedStageId}
            showAllOption={false}
          />
        </div>
      </div>

      {qualityResults.length > 0 && (
        <div className="flex gap-2 print:hidden">
          <Button onClick={handleExportCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт CSV
          </Button>
          <Button onClick={handleExportPDF} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Экспорт PDF
          </Button>
        </div>
      )}

      <div className="bg-gradient-to-r from-brand-purple to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold mb-2">
              {summary ? summary.overall_average.toFixed(1) : '—'}
            </h2>
            <p className="text-purple-100">Общий балл личностных качеств</p>
            <p className="text-sm text-purple-200 mt-2">Оценка основана на 360-градусной обратной связи</p>
          </div>
          <div className="text-right">
            <div className="text-6xl opacity-20 font-bold">360°</div>
          </div>
        </div>
      </div>

      {qualityResults.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Визуализация результатов оценки по навыкам и качествам</h3>
          <div className="h-96">
            {isPrinting ? (
              <RadarChart width={500} height={380} data={radarData}>
                <PolarGrid gridType="polygon" stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="quality" 
                  tick={{ fontSize: 12, fill: '#374151' }}
                  className="text-xs"
                />
                <PolarRadiusAxis 
                  domain={[0, 4]} 
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  angle={90}
                />
                <Radar
                  name="Результат оценки"
                  dataKey="value"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#a855f7' }}
                />
              </RadarChart>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid gridType="polygon" stroke="#e5e7eb" />
                <PolarAngleAxis 
                  dataKey="quality" 
                  tick={{ fontSize: 12, fill: '#374151' }}
                  className="text-xs"
                />
                <PolarRadiusAxis 
                  domain={[0, 4]} 
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  angle={90}
                />
                <Radar
                  name="Результат оценки"
                  dataKey="value"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#a855f7' }}
                />
              </RadarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {qualityResults.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-text-primary">Детальная оценка навыков и качеств</h3>
          {qualityResults.map((quality) => (
            <ExpandableQualityCard
              key={quality.quality_id}
              quality_name={quality.quality_name}
              quality_description={quality.quality_description}
              behavioral_indicators={quality.behavioral_indicators}
              category={quality.category}
              sub_category={quality.subcategory}
              average_score={quality.average_score}
              self_score={quality.self_score}
              supervisor_score={quality.supervisor_score}
              colleague_score={quality.colleague_score}
              comments={quality.comments}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <p className="text-lg text-text-secondary">Нет данных для отображения</p>
          <p className="text-sm text-text-tertiary mt-2">Пройдите оценку 360°, чтобы увидеть результаты</p>
        </div>
      )}

      <div className="flex gap-4 justify-center print:hidden">
        <Button onClick={() => navigate('/survey-360')} variant="default" size="lg">
          Пройти оценку еще раз
        </Button>
        <Button onClick={() => navigate('/')} variant="outline" size="lg">
          Вернуться на главную
        </Button>
      </div>
    </div>
  );
};

export default Survey360ResultsPage;
