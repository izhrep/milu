import React, { useState } from 'react';
import { CareerTrack, CareerTrackStep } from '@/hooks/useCareerTracks';
import { ChevronDown, Check, X, Target, Star } from "@/components/icons";
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
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Рекомендуемые карьерные треки</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-caption-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!filteredTracks || filteredTracks.length === 0) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Рекомендуемые карьерные треки</h4>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-caption-sm">
            {progress?.career_track_id ? 'Вы уже выбрали карьерный трек' : 'Нет доступных карьерных треков'}
          </p>
        </div>
      </div>
    );
  }

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-warning';
    if (score >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const getCompatibilityText = (score: number) => {
    if (score >= 80) return 'Отличное соответствие';
    if (score >= 60) return 'Хорошее соответствие';
    if (score >= 40) return 'Частичное соответствие';
    return 'Требует развития';
  };

  const getReadinessColor = (readiness: number) => {
    if (readiness >= 80) return 'text-success bg-success/10';
    if (readiness >= 60) return 'text-warning bg-warning/10';
    return 'text-destructive bg-destructive/10';
  };

  const renderTrackStep = (step: CareerTrackStep, isRecommended: boolean) => {
    const allRequirements = [...step.required_skills, ...step.required_qualities];
    const readyCount = allRequirements.filter(req => req.is_ready).length;
    const isSelected = progress?.current_step_id === step.id;
    
    return (
      <div key={step.id} className={`border rounded-lg p-4 ${
        isSelected ? 'border-warning bg-warning/10' :
        isRecommended ? 'border-warning bg-warning/10' : 'border-border'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h6 className="text-foreground text-body-md font-medium">
                Шаг {step.step_order}: {step.grade.name} (Уровень {step.grade.level || 'N/A'})
              </h6>
              {isSelected && (
                <span className="px-2 py-1 bg-warning text-white text-caption-sm font-medium rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Текущий
                </span>
              )}
              {isRecommended && !isSelected && (
                <span className="px-2 py-1 bg-warning text-white text-caption-sm font-medium rounded-full">
                  Рекомендуемый
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-caption-sm mt-1">
              {step.description || 'Описание не указано'}
            </p>
          </div>
          <div className="text-right">
            <div className={`px-3 py-1 rounded-full text-caption-sm font-medium ${getReadinessColor(step.overall_readiness)}`}>
              {step.compatibility_score.toFixed(0)}% соответствие
            </div>
            <div className="text-muted-foreground text-caption-sm mt-1">
              {readyCount}/{allRequirements.length} требований
            </div>
          </div>
        </div>

        {/* Прогресс-бар совместимости */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-caption-sm text-muted-foreground mb-1">
            <span>Совместимость с шагом</span>
            <span>{step.compatibility_score.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                step.compatibility_score >= 80 ? 'bg-success' : 
                step.compatibility_score >= 60 ? 'bg-warning' : 
                step.compatibility_score >= 40 ? 'bg-warning' : 'bg-destructive'
              }`}
              style={{ width: `${step.compatibility_score}%` }}
            />
          </div>
        </div>

        {/* Требования */}
        <div className="space-y-2">
          {step.required_skills.slice(0, 3).map((skill) => (
            <div key={skill.skill_id} className="flex items-center justify-between text-caption-sm">
              <span className="text-foreground">{skill.skill_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{skill.user_level}/{skill.target_level}</span>
                {skill.is_ready ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <X className="w-3 h-3 text-destructive" />
                )}
              </div>
            </div>
          ))}
          
          {step.required_qualities.slice(0, 2).map((quality) => (
            <div key={quality.quality_id} className="flex items-center justify-between text-caption-sm">
              <span className="text-foreground">{quality.quality_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{quality.user_level}/{quality.target_level}</span>
                {quality.is_ready ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <X className="w-3 h-3 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Кнопка выбора шага */}
        <button
          onClick={() => handleSelectStep(step.id, `Шаг ${step.step_order}: ${step.grade.name} (Уровень ${step.grade.level || 'N/A'})`)}
          disabled={isSelected}
          className={`w-full mt-3 px-3 py-2 text-caption-sm font-medium rounded-lg transition-colors ${
            isSelected 
              ? 'bg-border text-muted-foreground cursor-not-allowed'
              : isRecommended 
                ? 'bg-warning text-white hover:bg-warning/90'
                : 'bg-muted text-foreground hover:bg-border'
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
          <div key={track.id} className="bg-white rounded-[20px] shadow-card overflow-hidden">
            <div className="p-6">
              {/* Заголовок трека */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h5 className="text-foreground text-body-lg font-semibold mb-2">{track.name}</h5>
                  <p className="text-muted-foreground text-body-md mb-2">
                    {track.description || 'Описание не указано'}
                  </p>
                  <div className="flex items-center gap-4 text-caption-sm text-muted-foreground">
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
                    <span className="text-foreground text-body-lg font-bold">
                      {track.compatibility_score.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-muted-foreground text-caption-sm">
                    {getCompatibilityText(track.compatibility_score)}
                  </p>
                </div>
              </div>

              {/* Статистика */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <div className="text-primary text-body-lg font-bold">{track.compatibility_score.toFixed(0)}%</div>
                  <div className="text-muted-foreground text-caption-sm">Совместимость</div>
                </div>
                <div className="p-3 bg-warning/10 rounded-lg text-center">
                  <div className="text-warning text-body-lg font-bold">{track.total_gap}</div>
                  <div className="text-muted-foreground text-caption-sm">Общий GAP</div>
                </div>
                <div className="p-3 bg-success/10 rounded-lg text-center">
                  <div className="text-success text-body-lg font-bold">{track.steps.length}</div>
                  <div className="text-muted-foreground text-caption-sm">Шагов</div>
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
                  className={`flex-1 px-4 py-2 text-body-md font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                    progress?.career_track_id === track.id
                      ? 'bg-border text-muted-foreground cursor-not-allowed'
                      : 'bg-warning text-white hover:bg-warning/90'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  {progress?.career_track_id === track.id ? 'Выбран' : 'Выбрать трек'}
                </button>
                
                <button
                  onClick={() => setExpandedTrack(isExpanded ? null : track.id)}
                  className="px-4 py-2 border border-border text-foreground text-body-md font-medium rounded-lg hover:bg-muted transition-colors flex items-center gap-2"
                >
                  Детали
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* Детализация шагов */}
            {isExpanded && (
              <div className="border-t border-border p-6">
                <h6 className="text-foreground text-body-base font-semibold mb-4">Шаги карьерного трека</h6>
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