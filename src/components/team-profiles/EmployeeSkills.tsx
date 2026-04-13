import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Calendar } from 'lucide-react';

interface MockSkill {
  name: string;
  category: string;
  level: number;
  maxLevel: number;
  lastAssessed: string;
}

const MOCK_SKILLS: MockSkill[] = [
  { name: 'SQL', category: 'Hard Skills', level: 4, maxLevel: 5, lastAssessed: '20.03.2026' },
  { name: 'Python', category: 'Hard Skills', level: 3, maxLevel: 5, lastAssessed: '20.03.2026' },
  { name: 'Аналитика данных', category: 'Hard Skills', level: 4, maxLevel: 5, lastAssessed: '20.03.2026' },
  { name: 'Excel / Google Sheets', category: 'Hard Skills', level: 5, maxLevel: 5, lastAssessed: '15.01.2026' },
  { name: 'Коммуникация', category: 'Soft Skills', level: 3, maxLevel: 5, lastAssessed: '20.03.2026' },
  { name: 'Работа в команде', category: 'Soft Skills', level: 4, maxLevel: 5, lastAssessed: '20.03.2026' },
  { name: 'Управление временем', category: 'Soft Skills', level: 3, maxLevel: 5, lastAssessed: '15.01.2026' },
  { name: 'Критическое мышление', category: 'Soft Skills', level: 2, maxLevel: 5, lastAssessed: '15.01.2026' },
];

const levelColor = (level: number, max: number) => {
  const pct = level / max;
  if (pct >= 0.8) return 'bg-primary';
  if (pct >= 0.6) return 'bg-primary/70';
  if (pct >= 0.4) return 'bg-primary/40';
  return 'bg-muted-foreground/30';
};

const SkillRow: React.FC<{ skill: MockSkill }> = ({ skill }) => (
  <div className="flex items-center gap-4 py-3 border-b border-border last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-foreground">{skill.name}</p>
      <div className="flex items-center gap-2 mt-1">
        <div className="flex gap-0.5">
          {Array.from({ length: skill.maxLevel }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-1.5 rounded-full ${i < skill.level ? levelColor(skill.level, skill.maxLevel) : 'bg-muted'}`}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">{skill.level}/{skill.maxLevel}</span>
      </div>
    </div>
    <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
      <Calendar className="w-3 h-3" />
      {skill.lastAssessed}
    </div>
  </div>
);

const EmployeeSkills: React.FC = () => {
  const categories = [...new Set(MOCK_SKILLS.map(s => s.category))];

  return (
    <div className="space-y-5 mt-4">
      <div className="bg-muted/30 border border-border rounded-lg px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Навыки сотрудника на основе результатов диагностик. Агрегация и детальный drill-down — в будущих итерациях.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {categories.map(cat => {
          const skills = MOCK_SKILLS.filter(s => s.category === cat);
          return (
            <div key={cat} className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                {cat}
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">{skills.length} навыков</p>
              {skills.map(s => (
                <SkillRow key={s.name} skill={s} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Empty state placeholder */}
      <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center">
        <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Дополнительные навыки будут добавлены после следующей диагностики</p>
        <Skeleton className="h-3 w-48 mx-auto mt-3 rounded-full" />
      </div>
    </div>
  );
};

export default EmployeeSkills;
