import React from 'react';
import { TrendingUp, Award, Target, BarChart3 } from "@/components/icons";
import { useUserAssessmentResults } from '@/hooks/useUserAssessmentResults';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';

export const ProfileAggregatedResults: React.FC = () => {
  const { user: authUser } = useAuth();
  const { getCurrentUser } = useUsers();
  const currentUser = getCurrentUser();
  const targetUserId = authUser?.id || currentUser?.id || '';
  const { qualityResults, skillResults, loading } = useUserAssessmentResults(targetUserId);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-chart-3 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка результатов оценок...</p>
        </div>
      </div>
    );
  }

  // Вычисляем общие средние показатели по всем результатам сотрудника
  const avgSkillScore = skillResults.length > 0 
    ? skillResults.reduce((sum, result) => sum + (result.skill_average || 0), 0) / skillResults.length 
    : 0;
    
  const avgQualityScore = qualityResults.length > 0 
    ? qualityResults.reduce((sum, result) => sum + (result.quality_average || 0), 0) / qualityResults.length 
    : 0;

  // Общий средний балл по всем оценкам
  const overallAverage = skillResults.length > 0 || qualityResults.length > 0
    ? ((avgSkillScore * skillResults.length) + (avgQualityScore * qualityResults.length)) / (skillResults.length + qualityResults.length)
    : 0;

  // Всего проведено оценок
  const totalAssessments = skillResults.length + qualityResults.length;
  const totalResponses = skillResults.reduce((sum, r) => sum + r.total_responses, 0) + 
                        qualityResults.reduce((sum, r) => sum + r.total_responses, 0);

  // Последние результаты оценок
  const latestSkillResults = skillResults.slice(0, 5);
  const latestQualityResults = qualityResults.slice(0, 5);

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-success bg-success/20';
    if (score >= 3) return 'text-warning bg-warning/20';
    return 'text-destructive bg-destructive/20';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 4) return 'Отлично';
    if (score >= 3) return 'Хорошо';
    if (score >= 2) return 'Удовлетворительно';
    return 'Требует развития';
  };

  return (
    <div className="space-y-6">
      {/* Общие показатели */}
      <div className="bg-white rounded-2xl p-6 border border-border">
        <h4 className="text-body-lg font-semibold text-foreground mb-6">Агрегированные результаты оценок</h4>
        
        {/* Общий средний балл */}
        {overallAverage > 0 && (
          <div className="bg-gradient-to-r from-primary to-chart-3 rounded-xl p-6 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h5 className="text-heading-4 font-bold text-foreground">Общий средний балл</h5>
              </div>
              <div className={`inline-flex items-center px-6 py-3 rounded-full text-heading-3 font-bold ${getScoreColor(overallAverage)}`}>
                {overallAverage.toFixed(2)} / 4.0
              </div>
              <p className="text-body-lg text-foreground mt-2 font-medium">{getScoreLabel(overallAverage)}</p>
              <div className="flex justify-center gap-6 mt-4 text-body-md text-muted-foreground">
                <span>Всего оценок: {totalAssessments}</span>
                <span>Всего ответов: {totalResponses}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Средний балл по навыкам */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h5 className="font-semibold text-foreground">Профессиональные навыки</h5>
                <p className="text-body-md text-muted-foreground">Средний балл по всем навыкам</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-body-lg font-bold ${getScoreColor(avgSkillScore)}`}>
                {avgSkillScore.toFixed(2)} / 4.0
              </div>
              <p className="text-body-md text-muted-foreground mt-2">{getScoreLabel(avgSkillScore)}</p>
              <p className="text-caption-sm text-muted-foreground mt-1">
                Основано на {skillResults.length} оценках навыков
              </p>
              {skillResults.length > 0 && (
                <div className="w-full bg-border rounded-full h-2 mt-3">
                  <div 
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${(avgSkillScore / 4) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Средний балл по качествам */}
          <div className="border border-border rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-chart-3/20 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-chart-3" />
              </div>
              <div>
                <h5 className="font-semibold text-foreground">Soft Skills</h5>
                <p className="text-body-md text-muted-foreground">Средний балл по всем Soft Skills</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-body-lg font-bold ${getScoreColor(avgQualityScore)}`}>
                {avgQualityScore.toFixed(2)} / 4.0
              </div>
              <p className="text-body-md text-muted-foreground mt-2">{getScoreLabel(avgQualityScore)}</p>
              <p className="text-caption-sm text-muted-foreground mt-1">
                Основано на {qualityResults.length} оценках Soft Skills
              </p>
              {qualityResults.length > 0 && (
                <div className="w-full bg-border rounded-full h-2 mt-3">
                  <div 
                    className="h-2 rounded-full bg-chart-3 transition-all duration-300"
                    style={{ width: `${(avgQualityScore / 4) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Последние результаты по навыкам */}
      {latestSkillResults.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-border">
          <h4 className="text-body-lg font-semibold text-foreground mb-4">Последние результаты по навыкам</h4>
          
          <div className="space-y-3">
            {latestSkillResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <h6 className="font-medium text-foreground">{result.skill_name}</h6>
                  <p className="text-body-md text-muted-foreground">
                    Оценено: {new Date(result.assessment_date).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-caption-sm text-muted-foreground">
                    Период: {result.assessment_period || 'Не указан'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-body-md font-medium ${getScoreColor(result.skill_average || 0)}`}>
                    {(result.skill_average || 0).toFixed(1)}
                  </div>
                  <p className="text-caption-sm text-muted-foreground mt-1">
                    {result.total_responses} оценок
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Последние результаты по качествам */}
      {latestQualityResults.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-border">
          <h4 className="text-body-lg font-semibold text-foreground mb-4">Последние результаты по качествам</h4>
          
          <div className="space-y-3">
            {latestQualityResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <h6 className="font-medium text-foreground">{result.quality_name}</h6>
                  <p className="text-body-md text-muted-foreground">
                    Оценено: {new Date(result.assessment_date).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-caption-sm text-muted-foreground">
                    Период: {result.assessment_period || 'Не указан'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-body-md font-medium ${getScoreColor(result.quality_average || 0)}`}>
                    {(result.quality_average || 0).toFixed(1)}
                  </div>
                  <p className="text-caption-sm text-muted-foreground mt-1">
                    {result.total_responses} оценок
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Рекомендации */}
      {(avgSkillScore < 4 || avgQualityScore < 4) && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-warning" />
            <h4 className="text-body-lg font-semibold text-warning">Рекомендации по развитию</h4>
          </div>
          
          <div className="space-y-2 text-body-md text-warning">
            {avgSkillScore < 4 && (
              <p>• Рекомендуется сосредоточиться на развитии профессиональных навыков</p>
            )}
            {avgQualityScore < 4 && (
              <p>• Стоит обратить внимание на развитие личностных качеств</p>
            )}
            <p>• Регулярно проходите оценки для отслеживания прогресса</p>
            <p>• Создайте индивидуальный план развития на основе полученных результатов</p>
          </div>
        </div>
      )}

      {/* Если нет данных */}
      {skillResults.length === 0 && qualityResults.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-border">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-muted-foreground/70" />
          </div>
          <h4 className="text-body-lg font-semibold text-foreground mb-2">Нет результатов оценок</h4>
          <p className="text-muted-foreground mb-4">
            Пройдите оценки навыков и качеств, чтобы увидеть ваши результаты и прогресс развития
          </p>
        </div>
      )}
    </div>
  );
};