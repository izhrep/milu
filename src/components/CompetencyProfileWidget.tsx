import React from 'react';
import { CompetencyProfile } from '@/hooks/useCompetencyProfile';

interface CompetencyProfileWidgetProps {
  profile: CompetencyProfile;
  loading: boolean;
}

export const CompetencyProfileWidget: React.FC<CompetencyProfileWidgetProps> = ({ profile, loading }) => {
  if (loading) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
        <h4 className="text-[#202020] text-base font-semibold mb-4">Профиль компетенций</h4>
        <div className="flex items-center justify-center py-8">
          <p className="text-[#718096] text-xs">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
        <h4 className="text-[#202020] text-base font-semibold mb-4">Профиль компетенций</h4>
        <div className="text-center py-8">
          <p className="text-[#718096] text-xs">Нет данных о компетенциях</p>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600 bg-green-50';
    if (score >= 3) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getGapColor = (gap: number) => {
    if (gap <= 1) return 'text-green-600';
    if (gap <= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white p-6 rounded-[20px] shadow-[0_3.5px_25.5px_0_rgba(0,0,0,0.10)]">
      <h4 className="text-[#202020] text-base font-semibold mb-4">Профиль компетенций</h4>
      
      {/* Общие показатели */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <div className="text-blue-600 text-2xl font-bold">{profile.overall_score}</div>
          <div className="text-[#718096] text-xs">Средний балл</div>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg text-center">
          <div className="text-[#FF8934] text-2xl font-bold">{profile.total_gap}</div>
          <div className="text-[#718096] text-xs">Общий GAP</div>
        </div>
      </div>

      {/* Топ навыков с наибольшим gap */}
      <div className="mb-4">
        <h5 className="text-[#202020] text-sm font-medium mb-3">Приоритетные для развития Hard Skills</h5>
        <div className="space-y-2">
          {profile.skills.slice(0, 3).map((skill) => (
            <div key={skill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <span className="text-[#202020] text-sm font-medium">{skill.name}</span>
                <div className="text-[#718096] text-xs mt-1">{skill.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(skill.current_level)}`}>
                  {skill.current_level}/4
                </div>
                <div className={`text-sm font-bold ${getGapColor(skill.gap)}`}>
                  -{skill.gap}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ качеств с наибольшим gap */}
      <div>
        <h5 className="text-[#202020] text-sm font-medium mb-3">Приоритетные для развития Soft Skills</h5>
        <div className="space-y-2">
          {profile.qualities.slice(0, 3).map((quality) => (
            <div key={quality.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <span className="text-[#202020] text-sm font-medium">{quality.name}</span>
                <div className="text-[#718096] text-xs mt-1">{quality.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-2 py-1 rounded text-xs font-medium ${getScoreColor(quality.current_level)}`}>
                  {quality.current_level}/4
                </div>
                <div className={`text-sm font-bold ${getGapColor(quality.gap)}`}>
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