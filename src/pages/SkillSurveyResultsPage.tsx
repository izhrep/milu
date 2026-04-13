import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSkillSurveyResultsEnhanced } from '@/hooks/useSkillSurveyResultsEnhanced';
import { ExpandableSkillCard } from '@/components/ExpandableSkillCard';
import { Button } from '@/components/ui/button';
import Sidebar from '@/components/Sidebar';
import RightPanel from '@/components/RightPanel';
import { toast } from 'sonner';
// Helper to get user display name
const getUserDisplayName = (user: { last_name?: string; first_name?: string; middle_name?: string; email: string } | null): string => {
  if (!user) return 'ФИО не указано';
  const fullName = [user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'ФИО не указано';
};

const SkillSurveyResultsPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { skillResults, loading, error } = useSkillSurveyResultsEnhanced(currentUser?.id);
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

  const handleExportCSV = () => {
    if (!skillResults.length) return;
    
    const headers = ['Навык', 'Общая оценка', 'Самооценка', 'Оценка руководителя', 'Оценка коллег', 'Количество ответов'];
    const rows = skillResults.map(skill => [
      skill.skill_name,
      skill.average_score.toFixed(2),
      skill.self_score?.toFixed(2) || '-',
      skill.supervisor_score?.toFixed(2) || '-',
      skill.colleague_score?.toFixed(2) || '-',
      skill.response_count
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skill_survey_results_${new Date().toISOString().split('T')[0]}.csv`;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка результатов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/skill-survey')}
            className="text-purple-600 hover:text-purple-700"
          >
            Вернуться к оценке навыков
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="items-stretch border shadow-[2px_4px_16px_0_rgba(248,248,248,0.06)_inset,0_54px_32px_-16px_rgba(5,5,5,0.05),0_24px_24px_-16px_rgba(5,5,5,0.09),0_6px_12px_0_rgba(5,5,5,0.10),0_4px_4px_-4px_rgba(5,5,5,0.10),0_0.5px_1.5px_-4px_rgba(5,5,5,0.50)] flex overflow-hidden flex-wrap rounded-[32px] border-solid border-[rgba(255,255,255,0.40)]">
      <div className="print:hidden">
        <Sidebar />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto p-8">
        {/* Print-only header */}
        <div className="hidden print:block mb-6 pb-4 border-b">
          <h1 className="text-2xl font-bold">Отчёт: Результаты оценки профессиональных навыков</h1>
          <p className="text-sm text-muted-foreground">
            Сотрудник: {getUserDisplayName(currentUser)}
          </p>
          <p className="text-sm text-muted-foreground">
            Дата: {new Date().toLocaleDateString('ru-RU')}
          </p>
        </div>

        {/* Header */}
        <div className="flex items-center mb-8 print:hidden">
          <button 
            onClick={() => navigate('/skill-survey')}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <p className="text-sm text-gray-500">Обратно к разделу «Мое развитие»</p>
            <h1 className="text-2xl font-bold text-gray-900">Результаты оценки профессиональных навыков</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-8 mb-8 print:hidden">
          <button 
            onClick={() => navigate('/profile')}
            className="text-gray-400 font-medium hover:text-gray-900 transition-colors"
          >
            Профиль
          </button>
          <button 
            onClick={() => navigate('/development')}
            className="text-gray-900 font-medium border-b-2 border-purple-600 pb-2"
          >
            Мое развитие
          </button>
          <button className="text-gray-400 font-medium">Обучение</button>
        </div>

        {/* @legacy — scale description will be dynamic once stageConfig is wired */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          Ваши результаты оценки профессиональных навыков. Каждый навык оценивается по шкале, 
          где минимальное значение соответствует начинающему уровню, а максимальное — экспертному.
        </p>

        {/* Export Buttons */}
        {skillResults.length > 0 && (
          <div className="flex gap-2 mb-6 print:hidden">
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

        {/* Results Section */}
        {skillResults.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Нет результатов</h3>
            <p className="text-gray-600 mb-6">Вы еще не проходили оценку профессиональных навыков</p>
            <button
              onClick={() => navigate('/skill-survey')}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 transition-colors"
            >
              Пройти оценку
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ваши навыки</h2>
            
            {skillResults.map((skill) => (
              <ExpandableSkillCard
                key={skill.skill_id}
                skill_name={skill.skill_name}
                skill_sub_category={skill.subcategory || skill.category}
                skill_description={skill.skill_description}
                average_score={skill.average_score}
                self_score={skill.self_score}
                supervisor_score={skill.supervisor_score}
                colleague_score={skill.colleague_score}
                sub_skills={skill.sub_skills}
                comments={skill.comments}
              />
            ))}
            
            {/* Summary */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 border border-purple-200 mt-8">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Общая оценка</h3>
              <p className="text-purple-700">
                Средний балл по всем навыкам: {' '}
                <span className="font-bold">
                  {(skillResults.reduce((sum, skill) => sum + skill.average_score, 0) / skillResults.length).toFixed(1)}
                </span>{/* @legacy — maxScore will come from stageConfig */}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="print:hidden">
        <RightPanel />
      </div>
    </div>
  );
};

export default SkillSurveyResultsPage;