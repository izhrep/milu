import { useState, useEffect } from 'react';
import { CompetencyProfile, CompetencyResult } from './useCompetencyProfile';
import { supabase } from '@/integrations/supabase/client';
import { useUserCareerProgress } from './useUserCareerProgress';

interface DevelopmentTask {
  id: string;
  task_name: string;
  task_goal: string;
  how_to: string;
  measurable_result: string;
  task_order: number;
  skill_id?: string;
  quality_id?: string;
  competency_level_id: string;
}

interface CompetencyWithTasks extends CompetencyResult {
  tasks: DevelopmentTask[];
}

interface DevelopmentTasksData {
  skills: CompetencyWithTasks[];
  qualities: CompetencyWithTasks[];
}

// Fetch tasks from database based on career track requirements
const fetchTasksForRequirements = async (requirements: Array<{id: string, type: 'skill' | 'quality', current_level: number, target_level: number}>) => {
  const tasks: DevelopmentTask[] = [];
  
  for (const req of requirements) {
    // Get competency levels between current and target
    const { data: competencyLevels } = await supabase
      .from('competency_levels')
      .select('*')
      .gte('level', Math.floor(req.current_level) + 1)
      .lte('level', Math.ceil(req.target_level))
      .order('level');
    
    if (competencyLevels) {
      for (const level of competencyLevels) {
        // Get tasks for this competency at this level using raw query
        const { data: developmentTasks, error } = await supabase
          .from('development_tasks' as any)
          .select('*')
          .eq('competency_level_id', level.id)
          .eq(req.type === 'skill' ? 'skill_id' : 'quality_id', req.id)
          .order('task_order');
        
        if (error) {
          console.error('Error fetching development tasks:', error);
          continue;
        }
        
        if (developmentTasks) {
          // Type assertion for the data
          const typedTasks = developmentTasks.map((task: any) => ({
            id: task.id,
            task_name: task.task_name,
            task_goal: task.task_goal,
            how_to: task.how_to,
            measurable_result: task.measurable_result,
            task_order: task.task_order,
            skill_id: task.skill_id,
            quality_id: task.quality_id,
            competency_level_id: task.competency_level_id
          } as DevelopmentTask));
          
          tasks.push(...typedTasks);
        }
      }
    }
  }
  
  return tasks;
};

export const useDevelopmentTasks = (profile: CompetencyProfile | null) => {
  const [tasks, setTasks] = useState<DevelopmentTasksData>({ skills: [], qualities: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { progress } = useUserCareerProgress();

  useEffect(() => {
    if (!profile || !progress) return;
    
    fetchDevelopmentTasks();
  }, [profile, progress]);

  const fetchDevelopmentTasks = async () => {
    if (!profile || !progress) return;
    
    setLoading(true);
    setError(null);

    try {
      // Get current and next step requirements from career track
      const { data: currentStep } = await supabase
        .from('career_track_steps')
        .select(`
          *,
          grades (
            id,
            name,
            level
          )
        `)
        .eq('id', progress.current_step_id)
        .single();

      let nextStep = null;
      if (currentStep) {
        const { data: nextStepData } = await supabase
          .from('career_track_steps')
          .select(`
            *,
            grades (
              id,
              name,
              level
            )
          `)
          .eq('career_track_id', progress.career_track_id)
          .eq('step_order', currentStep.step_order + 1)
          .single();
        
        nextStep = nextStepData;
      }

      // Get requirements for current and next steps
      const stepToAnalyze = nextStep || currentStep;
      if (!stepToAnalyze) {
        setTasks({ skills: [], qualities: [] });
        return;
      }

      // Get skill requirements for the target step
      const { data: gradeSkills } = await supabase
        .from('grade_skills')
        .select(`
          skill_id,
          target_level,
          skills (
            name,
            category
          )
        `)
        .eq('grade_id', stepToAnalyze.grades.id);

      // Get quality requirements for the target step
      const { data: gradeQualities } = await supabase
        .from('grade_qualities')
        .select(`
          quality_id,
          target_level,
          qualities (
            name
          )
        `)
        .eq('grade_id', stepToAnalyze.grades.id);

      // Build requirements array for fetching tasks
      const skillRequirements = (gradeSkills || []).map(gs => ({
        id: gs.skill_id,
        type: 'skill' as const,
        current_level: profile.skills.find(s => s.id === gs.skill_id)?.current_level || 0,
        target_level: gs.target_level
      })).filter(req => req.current_level < req.target_level);

      const qualityRequirements = (gradeQualities || []).map(gq => ({
        id: gq.quality_id,
        type: 'quality' as const,
        current_level: profile.qualities.find(q => q.id === gq.quality_id)?.current_level || 0,
        target_level: gq.target_level
      })).filter(req => req.current_level < req.target_level);

      // Fetch development tasks for these requirements
      const skillTasks = await fetchTasksForRequirements(skillRequirements);
      const qualityTasks = await fetchTasksForRequirements(qualityRequirements);

      // Group tasks by competency
      const skillsWithTasks: CompetencyWithTasks[] = skillRequirements.map(req => {
        const skill = profile.skills.find(s => s.id === req.id);
        const tasks = skillTasks.filter(task => task.skill_id === req.id);
        
        return {
          ...skill!,
          target_level: req.target_level,
          gap: req.target_level - req.current_level,
          tasks
        };
      });

      const qualitiesWithTasks: CompetencyWithTasks[] = qualityRequirements.map(req => {
        const quality = profile.qualities.find(q => q.id === req.id);
        const tasks = qualityTasks.filter(task => task.quality_id === req.id);
        
        return {
          ...quality!,
          target_level: req.target_level,
          gap: req.target_level - req.current_level,
          tasks
        };
      });

      setTasks({
        skills: skillsWithTasks,
        qualities: qualitiesWithTasks
      });

    } catch (err) {
      console.error('Error fetching development tasks:', err);
      setError('Ошибка при загрузке задач развития');
    } finally {
      setLoading(false);
    }
  };

  return { tasks, loading, error, refetch: fetchDevelopmentTasks };
};