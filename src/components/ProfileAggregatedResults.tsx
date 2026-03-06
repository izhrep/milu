import React from 'react';
import { TrendingUp, Award, Target, BarChart3 } from 'lucide-react';
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Загрузка результатов оценок...</p>
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
    if (score >= 4) return 'text-green-600 bg-green-100';
    if (score >= 3) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
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
      <div className="bg-white rounded-2xl p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-6">Агрегированные результаты оценок</h4>
        
        {/* Общий средний балл */}
        {overallAverage > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                <h5 className="text-xl font-bold text-gray-900">Общий средний балл</h5>
              </div>
              <div className={`inline-flex items-center px-6 py-3 rounded-full text-2xl font-bold ${getScoreColor(overallAverage)}`}>
                {overallAverage.toFixed(2)} / 4.0
              </div>
              <p className="text-lg text-gray-700 mt-2 font-medium">{getScoreLabel(overallAverage)}</p>
              <div className="flex justify-center gap-6 mt-4 text-sm text-gray-600">
                <span>Всего оценок: {totalAssessments}</span>
                <span>Всего ответов: {totalResponses}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Средний балл по навыкам */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h5 className="font-semibold text-gray-900">Профессиональные навыки</h5>
                <p className="text-sm text-gray-600">Средний балл по всем навыкам</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold ${getScoreColor(avgSkillScore)}`}>
                {avgSkillScore.toFixed(2)} / 4.0
              </div>
              <p className="text-sm text-gray-600 mt-2">{getScoreLabel(avgSkillScore)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Основано на {skillResults.length} оценках навыков
              </p>
              {skillResults.length > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div 
                    className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(avgSkillScore / 4) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Средний балл по качествам */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h5 className="font-semibold text-gray-900">Soft Skills</h5>
                <p className="text-sm text-gray-600">Средний балл по всем Soft Skills</p>
              </div>
            </div>
            
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold ${getScoreColor(avgQualityScore)}`}>
                {avgQualityScore.toFixed(2)} / 4.0
              </div>
              <p className="text-sm text-gray-600 mt-2">{getScoreLabel(avgQualityScore)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Основано на {qualityResults.length} оценках Soft Skills
              </p>
              {qualityResults.length > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
                  <div 
                    className="h-2 rounded-full bg-purple-500 transition-all duration-300"
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
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Последние результаты по навыкам</h4>
          
          <div className="space-y-3">
            {latestSkillResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h6 className="font-medium text-gray-900">{result.skill_name}</h6>
                  <p className="text-sm text-gray-600">
                    Оценено: {new Date(result.assessment_date).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Период: {result.assessment_period || 'Не указан'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.skill_average || 0)}`}>
                    {(result.skill_average || 0).toFixed(1)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
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
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Последние результаты по качествам</h4>
          
          <div className="space-y-3">
            {latestQualityResults.map((result) => (
              <div key={result.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h6 className="font-medium text-gray-900">{result.quality_name}</h6>
                  <p className="text-sm text-gray-600">
                    Оценено: {new Date(result.assessment_date).toLocaleDateString('ru-RU')}
                  </p>
                  <p className="text-xs text-gray-500">
                    Период: {result.assessment_period || 'Не указан'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.quality_average || 0)}`}>
                    {(result.quality_average || 0).toFixed(1)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-yellow-600" />
            <h4 className="text-lg font-semibold text-yellow-900">Рекомендации по развитию</h4>
          </div>
          
          <div className="space-y-2 text-sm text-yellow-800">
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
        <div className="bg-white rounded-2xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">Нет результатов оценок</h4>
          <p className="text-gray-600 mb-4">
            Пройдите оценки навыков и качеств, чтобы увидеть ваши результаты и прогресс развития
          </p>
        </div>
      )}
    </div>
  );
};