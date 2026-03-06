import React, { useState } from 'react';
import { CareerTrack, CareerTrackStep } from '@/hooks/useCareerTracks';
import { ChevronDown, Check, X, Target, Star } from 'lucide-react';
import { useUserCareerProgress } from '@/hooks/useUserCareerProgress';
import { useToast } from '@/hooks/use-toast';

interface CareerTracksWidgetProps {
  tracks: CareerTrack[];
  loading: boolean;
  onSelectTrack: (trackId: string, stepId?: string) => void;
}

export const CareerTracksWidget: React.FC<CareerTracksWidgetProps> = ({ 
  tracks, 
  loading, 
  onSelectTrack 
}) => {
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const { progress, selectTrack, selectStep } = useUserCareerProgress();
  const { toast } = useToast();

  const handleSelectTrack = async (trackId: string, recommendedStepId?: string) => {
    try {
      await selectTrack(trackId, recommendedStepId);
      toast({
        title: "Карьерный трек выбран",
        description: "Ваш прогресс был сохранен. Теперь вы можете следить за своим развитием.",
      });
      onSelectTrack?.(trackId);
    } catch (error) {
      toast({
        title: "Ошибка", 
        description: "Не удалось выбрать карьерный трек. Попробуйте еще раз.",
        variant: "destructive",
      });
    }
  };
  
  // Фильтруем уже выбранный трек из рекомендаций
  const filteredTracks = progress?.career_track_id 
    ? tracks.filter(track => track.id !== progress.career_track_id)
    : tracks;

  const handleSelectStep = async (stepId: string, stepName: string) => {
    try {
      await selectStep(stepId);
      toast({
        title: "Шаг развития выбран",
        description: `Выбран шаг: ${stepName}. Ваш прогресс обновлен.`,
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось выбрать шаг развития. Попробуйте еще раз.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
        <h4 className="text-[#202020] text-base font-semibold mb-4">Рекомендуемые карьерные треки</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-[#718096] text-xs">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!filteredTracks || filteredTracks.length === 0) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
        <h4 className="text-[#202020] text-base font-semibold mb-4">Рекомендуемые карьерные треки</h4>
        <div className="text-center py-8">
          <p className="text-[#718096] text-xs">
            {progress?.career_track_id ? 'Вы уже выбрали карьерный трек' : 'Нет доступных карьерных треков'}
          </p>
        </div>
      </div>
    );
  }

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getCompatibilityText = (score: number) => {
    if (score >= 80) return 'Отличное соответствие';
    if (score >= 60) return 'Хорошее соответствие';
    if (score >= 40) return 'Частичное соответствие';
    return 'Требует развития';
  };

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 80) return 'text-green-600 bg-green-50';
    if (readiness >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const renderTrackStep = (step: CareerTrackStep, isRecommended: boolean) => {
    const allRequirements = [...step.required_skills, ...step.required_qualities];
    const readyCount = allRequirements.filter(req => req.is_ready).length;
    const isSelected = progress?.current_step_id === step.id;
    
    return (
      <div key={step.id} className={`border rounded-lg p-4 ${
        isSelected ? 'border-[#FF8934] bg-[#FF8934]/10' :
        isRecommended ? 'border-[#FF8934] bg-orange-50' : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h6 className="text-[#202020] text-sm font-medium">
                Шаг {step.step_order}: {step.grade.name} (Уровень {step.grade.level || 'N/A'})
              </h6>
              {isSelected && (
                <span className="px-2 py-1 bg-[#FF8934] text-white text-xs font-medium rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Текущий
                </span>
              )}
              {isRecommended && !isSelected && (
                <span className="px-2 py-1 bg-[#FF8934] text-white text-xs font-medium rounded-full">
                  Рекомендуемый
                </span>
              )}
            </div>
            <p className="text-[#718096] text-xs mt-1">
              {step.description || 'Описание не указано'}
            </p>
          </div>
          <div className="text-right">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getReadinessColor(step.overall_readiness)}`}>
              {step.compatibility_score.toFixed(0)}% соответствие
            </div>
            <div className="text-[#718096] text-xs mt-1">
              {readyCount}/{allRequirements.length} требований
            </div>
          </div>
        </div>

        {/* Прогресс-бар совместимости */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Совместимость с шагом</span>
            <span>{step.compatibility_score.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                step.compatibility_score >= 80 ? 'bg-green-500' : 
                step.compatibility_score >= 60 ? 'bg-yellow-500' : 
                step.compatibility_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${step.compatibility_score}%` }}
            />
          </div>
        </div>

        {/* Требования */}
        <div className="space-y-2">
          {step.required_skills.slice(0, 3).map((skill) => (
            <div key={skill.skill_id} className="flex items-center justify-between text-xs">
              <span className="text-[#202020]">{skill.skill_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[#718096]">{skill.user_level}/{skill.target_level}</span>
                {skill.is_ready ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <X className="w-3 h-3 text-red-600" />
                )}
              </div>
            </div>
          ))}
          
          {step.required_qualities.slice(0, 2).map((quality) => (
            <div key={quality.quality_id} className="flex items-center justify-between text-xs">
              <span className="text-[#202020]">{quality.quality_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[#718096]">{quality.user_level}/{quality.target_level}</span>
                {quality.is_ready ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <X className="w-3 h-3 text-red-600" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Кнопка выбора шага */}
        <button
          onClick={() => handleSelectStep(step.id, `Шаг ${step.step_order}: ${step.grade.name} (Уровень ${step.grade.level || 'N/A'})`)}
          disabled={isSelected}
          className={`w-full mt-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
            isSelected 
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : isRecommended 
                ? 'bg-[#FF8934] text-white hover:bg-[#e67a2b]'
                : 'bg-gray-100 text-[#202020] hover:bg-gray-200'
          }`}
        >
          {isSelected ? 'Выбран' : 'Выбрать этот шаг'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {filteredTracks.slice(0, 3).map((track) => {
        const isExpanded = expandedTrack === track.id;
        
        return (
          <div key={track.id} className="bg-white rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)] overflow-hidden">
            <div className="p-6">
              {/* Заголовок трека */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h5 className="text-[#202020] text-lg font-semibold mb-2">{track.name}</h5>
                  <p className="text-[#718096] text-sm mb-2">
                    {track.description || 'Описание не указано'}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-[#718096]">
                    <span>Цель: {track.target_position.name}</span>
                    <span>Длительность: {track.duration_months} мес.</span>
                    <span>Шагов: {track.steps.length}</span>
                  </div>
                </div>
                
                <div className="text-right ml-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className={`w-3 h-3 rounded-full ${getCompatibilityColor(track.compatibility_score)}`}
                    />
                    <span className="text-[#202020] text-lg font-bold">
                      {track.compatibility_score.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[#718096] text-xs">
                    {getCompatibilityText(track.compatibility_score)}
                  </p>
                </div>
              </div>

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-blue-600 text-lg font-bold">{track.compatibility_score.toFixed(0)}%</div>
                  <div className="text-[#718096] text-xs">Совместимость</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg text-center">
                  <div className="text-[#FF8934] text-lg font-bold">{track.total_gap}</div>
                  <div className="text-[#718096] text-xs">Общий GAP</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-green-600 text-lg font-bold">{track.steps.length}</div>
                  <div className="text-[#718096] text-xs">Шагов</div>
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    const recommendedStep = track.steps.find(step => 
                      step.compatibility_score === Math.max(...track.steps.map(s => s.compatibility_score))
                    );
                    handleSelectTrack(track.id, recommendedStep?.id);
                  }}
                  disabled={progress?.career_track_id === track.id}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    progress?.career_track_id === track.id
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-[#FF8934] text-white hover:bg-[#e67a2b]'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  {progress?.career_track_id === track.id ? 'Выбран' : 'Выбрать трек'}
                </button>
                
                <button
                  onClick={() => setExpandedTrack(isExpanded ? null : track.id)}
                  className="px-4 py-2 border border-gray-300 text-[#202020] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  Детали
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Детализация шагов */}
            {isExpanded && (
              <div className="border-t border-gray-200 p-6">
                <h6 className="text-[#202020] text-base font-semibold mb-4">Шаги карьерного трека</h6>
                <div className="space-y-4">
                  {track.steps.map((step, index) => {
                    // Находим шаг с наибольшей совместимостью
                    const bestStep = track.steps.reduce((best, current) => 
                      current.compatibility_score > best.compatibility_score ? current : best
                    );
                    const isRecommended = step.id === bestStep.id;
                    return renderTrackStep(step, isRecommended);
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};