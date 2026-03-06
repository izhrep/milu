import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RadarChartResults } from './RadarChartResults';
import { AssessmentDetailsReport } from './AssessmentDetailsReport';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AssessmentData {
  name: string;
  category?: string;
  self_assessment: number;
  peers_average: number;
  manager_assessment: number;
}

interface AssessmentResultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export const AssessmentResultsDialog: React.FC<AssessmentResultsDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
}) => {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<AssessmentData[]>([]);
  const [categoryAverages, setCategoryAverages] = useState<{ category: string; average: number }[]>([]);

  useEffect(() => {
    if (open && userId) {
      fetchResults();
    }
  }, [open, userId]);

  const fetchResults = async () => {
    try {
      setLoading(true);

      // 1. Получаем grade_id пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('grade_id')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (!userData?.grade_id) {
        toast.error('У сотрудника не назначен грейд');
        setLoading(false);
        return;
      }

      // 2. Получаем навыки и качества грейда
      const [gradeSkillsResponse, gradeQualitiesResponse] = await Promise.all([
        supabase
          .from('grade_skills')
          .select(`
            skill_id,
            target_level,
            hard_skills (
              id, 
              name,
              category_hard_skills (name)
            )
          `)
          .eq('grade_id', userData.grade_id),
        supabase
          .from('grade_qualities')
          .select(`
            quality_id,
            target_level,
            soft_skills (id, name)
          `)
          .eq('grade_id', userData.grade_id)
      ]);

      if (gradeSkillsResponse.error) throw gradeSkillsResponse.error;
      if (gradeQualitiesResponse.error) throw gradeQualitiesResponse.error;

      const gradeSkills = gradeSkillsResponse.data || [];
      const gradeQualities = gradeQualitiesResponse.data || [];

      // 3. Получаем assignments для определения типа оценщика
      const { data: assignments, error: assignmentsError } = await supabase
        .from('survey_360_assignments')
        .select('evaluating_user_id, assignment_type, is_manager_participant')
        .eq('evaluated_user_id', userId);

      if (assignmentsError) throw assignmentsError;

      // Создаем map для быстрого определения типа оценщика
      const evaluatorTypeMap = new Map<string, 'self' | 'manager' | 'peer'>();
      (assignments || []).forEach(a => {
        if (a.assignment_type === 'self') {
          evaluatorTypeMap.set(a.evaluating_user_id, 'self');
        } else if (a.assignment_type === 'manager' || a.is_manager_participant) {
          evaluatorTypeMap.set(a.evaluating_user_id, 'manager');
        } else {
          evaluatorTypeMap.set(a.evaluating_user_id, 'peer');
        }
      });

      // 4. Получаем результаты из hard_skill_results
      const { data: skillResults, error: skillError } = await supabase
        .from('hard_skill_results')
        .select(`
          question_id,
          evaluating_user_id,
          evaluated_user_id,
          answer_option_id,
          hard_skill_questions (skill_id),
          hard_skill_answer_options (numeric_value)
        `)
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false);

      if (skillError) throw skillError;

      // 5. Получаем результаты из soft_skill_results
      const { data: qualityResults, error: qualityError } = await supabase
        .from('soft_skill_results')
        .select(`
          question_id,
          evaluating_user_id,
          evaluated_user_id,
          answer_option_id,
          soft_skill_questions (quality_id),
          soft_skill_answer_options (numeric_value)
        `)
        .eq('evaluated_user_id', userId)
        .eq('is_draft', false);

      if (qualityError) throw qualityError;

      // 6. Группируем результаты по навыкам
      const skillsMap = new Map<string, { self: number[], peers: number[], manager: number[] }>();
      
      (skillResults || []).forEach(result => {
        const skillId = result.hard_skill_questions?.skill_id;
        const value = result.hard_skill_answer_options?.numeric_value;
        
        if (!skillId || value === null || value === undefined) return;
        
        if (!skillsMap.has(skillId)) {
          skillsMap.set(skillId, { self: [], peers: [], manager: [] });
        }
        
        const data = skillsMap.get(skillId)!;
        const evaluatorType = evaluatorTypeMap.get(result.evaluating_user_id) || 'peer';
        
        if (evaluatorType === 'self') {
          data.self.push(value);
        } else if (evaluatorType === 'manager') {
          data.manager.push(value);
        } else {
          data.peers.push(value);
        }
      });

      // 7. Группируем результаты по качествам
      const qualitiesMap = new Map<string, { self: number[], peers: number[], manager: number[] }>();
      
      (qualityResults || []).forEach(result => {
        const qualityId = result.soft_skill_questions?.quality_id;
        const value = result.soft_skill_answer_options?.numeric_value;
        
        if (!qualityId || value === null || value === undefined) return;
        
        if (!qualitiesMap.has(qualityId)) {
          qualitiesMap.set(qualityId, { self: [], peers: [], manager: [] });
        }
        
        const data = qualitiesMap.get(qualityId)!;
        const evaluatorType = evaluatorTypeMap.get(result.evaluating_user_id) || 'peer';
        
        if (evaluatorType === 'self') {
          data.self.push(value);
        } else if (evaluatorType === 'manager') {
          data.manager.push(value);
        } else {
          data.peers.push(value);
        }
      });

      // 8. Формируем данные для диаграммы
      const combinedData: AssessmentData[] = [];

      // Добавляем навыки
      gradeSkills.forEach(gs => {
        if (!gs.hard_skills) return;
        
        const results = skillsMap.get(gs.skill_id);
        const selfAvg = results?.self.length ? results.self.reduce((a, b) => a + b, 0) / results.self.length : 0;
        const peersAvg = results?.peers.length ? results.peers.reduce((a, b) => a + b, 0) / results.peers.length : 0;
        const managerAvg = results?.manager.length ? results.manager.reduce((a, b) => a + b, 0) / results.manager.length : 0;
        
        const categoryName = gs.hard_skills.category_hard_skills?.name;
        
        combinedData.push({
          name: gs.hard_skills.name,
          category: categoryName,
          self_assessment: Math.round(selfAvg * 10) / 10,
          peers_average: Math.round(peersAvg * 10) / 10,
          manager_assessment: Math.round(managerAvg * 10) / 10,
        });
      });

      // Добавляем качества
      gradeQualities.forEach(gq => {
        if (!gq.soft_skills) return;
        
        const results = qualitiesMap.get(gq.quality_id);
        const selfAvg = results?.self.length ? results.self.reduce((a, b) => a + b, 0) / results.self.length : 0;
        const peersAvg = results?.peers.length ? results.peers.reduce((a, b) => a + b, 0) / results.peers.length : 0;
        const managerAvg = results?.manager.length ? results.manager.reduce((a, b) => a + b, 0) / results.manager.length : 0;
        
        combinedData.push({
          name: gq.soft_skills.name,
          self_assessment: Math.round(selfAvg * 10) / 10,
          peers_average: Math.round(peersAvg * 10) / 10,
          manager_assessment: Math.round(managerAvg * 10) / 10,
        });
      });

      setChartData(combinedData);

      // 9. Вычисляем средние значения по категориям навыков
      const categoryMap = new Map<string, { self: number[], peers: number[], manager: number[] }>();
      
      gradeSkills.forEach(gs => {
        if (!gs.hard_skills || !gs.hard_skills.category_hard_skills?.name) return;
        
        const categoryName = gs.hard_skills.category_hard_skills.name;
        const results = skillsMap.get(gs.skill_id);
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, { self: [], peers: [], manager: [] });
        }
        
        const categoryData = categoryMap.get(categoryName)!;
        
        const selfAvg = results?.self.length ? results.self.reduce((a, b) => a + b, 0) / results.self.length : 0;
        const peersAvg = results?.peers.length ? results.peers.reduce((a, b) => a + b, 0) / results.peers.length : 0;
        const managerAvg = results?.manager.length ? results.manager.reduce((a, b) => a + b, 0) / results.manager.length : 0;
        
        if (selfAvg > 0) categoryData.self.push(selfAvg);
        if (peersAvg > 0) categoryData.peers.push(peersAvg);
        if (managerAvg > 0) categoryData.manager.push(managerAvg);
      });

      const categoryAveragesData = Array.from(categoryMap.entries()).map(([category, data]) => {
        const allScores = [...data.self, ...data.peers, ...data.manager];
        const average = allScores.length > 0 
          ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
          : 0;
        return {
          category,
          average: Math.round(average * 10) / 10
        };
      });

      setCategoryAverages(categoryAveragesData);
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.error('Ошибка при загрузке результатов');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Результаты оценки 360° Hard Skills и Soft Skills - {userName}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Радарная диаграмма</TabsTrigger>
            <TabsTrigger value="details">Детализация результатов</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="space-y-6">
            <RadarChartResults 
              data={chartData} 
              assessmentType="survey_360"
              loading={loading}
            />
            
            {categoryAverages.length > 0 && (
              <div className="bg-surface rounded-lg border border-border p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Сводная результатов по категориям Hard Skills</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryAverages.map((item) => (
                    <div key={item.category} className="p-4 bg-surface-secondary rounded-lg border border-border">
                      <div className="text-sm text-text-secondary mb-1">{item.category}</div>
                      <div className="text-2xl font-bold text-primary">{item.average.toFixed(1)}</div>
                      <div className="text-xs text-text-tertiary mt-1">Среднее значение</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="details">
            <AssessmentDetailsReport userId={userId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
