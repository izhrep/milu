import React from 'react';
import { CompetencyProfile } from '@/hooks/useCompetencyProfile';

interface CompetencyProfileWidgetProps {
  profile: CompetencyProfile;
  loading: boolean;
}

export const CompetencyProfileWidget: React.FC<CompetencyProfileWidgetProps> = ({ profile, loading }) => {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Профиль компетенций</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-caption-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-card">
        <h4 className="text-foreground text-body-base font-semibold mb-4">Профиль компетенций</h4>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-caption-sm">Нет данных о компетенциях</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-success bg-success/10';
    if (score >= 3) return 'text-warning bg-warning/10';
    return 'text-destructive bg-destructive/10';
  };

  const getGapColor = (gap: number) => {
    if (gap <= 1) return 'text-success';
    if (gap <= 2) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-card">
      <h4 className="text-foreground text-body-base font-semibold mb-4">Профиль компетенций</h4>
      
      {/* Общие показатели */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-primary/10 rounded-lg text-center">
          <div className="text-primary text-heading-3 font-bold">{profile.overall_score}</div>
          <div className="text-muted-foreground text-caption-sm">Средний балл</div>
        </div>
        <div className="p-4 bg-warning/10 rounded-lg text-center">
          <div className="text-warning text-heading-3 font-bold">{profile.total_gap}</div>
          <div className="text-muted-foreground text-caption-sm">Общий GAP</div>
        </div>
      </div>

      {/* Топ навыков с наибольшим gap */}
      <div className="mb-4">
        <h5 className="text-foreground text-body-md font-medium mb-3">Приоритетные для развития Hard Skills</h5>
        <div className="space-y-2">
          {profile.skills.slice(0, 3).map((skill) => (
            <div key={skill.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <span className="text-foreground text-body-md font-medium">{skill.name}</span>
                <div className="text-muted-foreground text-caption-sm mt-1">{skill.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-caption-sm font-medium ${getScoreColor(skill.current_level)}`}>
                  {skill.current_level}/4
                </div>
                <div className={`text-body-md font-bold ${getGapColor(skill.gap)}`}>
                  -{skill.gap}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ качеств с наибольшим gap */}
      <div>
        <h5 className="text-foreground text-body-md font-medium mb-3">Приоритетные для развития Soft Skills</h5>
        <div className="space-y-2">
          {profile.qualities.slice(0, 3).map((quality) => (
            <div key={quality.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <span className="text-foreground text-body-md font-medium">{quality.name}</span>
                <div className="text-muted-foreground text-caption-sm mt-1">{quality.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-caption-sm font-medium ${getScoreColor(quality.current_level)}`}>
                  {quality.current_level}/4
                </div>
                <div className={`text-body-md font-bold ${getGapColor(quality.gap)}`}>
                  -{quality.gap}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};