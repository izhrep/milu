import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HorizontalBarChart, BarChartDataItem } from './HorizontalBarChart';
import { useDetailedAssessmentResults, CompetencyDetailedResult } from '@/hooks/useDetailedAssessmentResults';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DetailedResult {
  name: string;
  category?: string;
  type: 'skill' | 'quality';
  self_assessment: number;
  peers_average: number;
  manager_assessment: number;
  peers_count: number;
}

interface AssessmentDetailsReportProps {
  userId: string;
}

export const AssessmentDetailsReport: React.FC<AssessmentDetailsReportProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<DetailedResult[]>([]);
  
  // Фильтры для детализированных результатов
  const [dataTypeFilter, setDataTypeFilter] = useState<'all' | 'skills' | 'qualities'>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [competencyFilter, setCompetencyFilter] = useState<string>('all');

  // Получаем детализированные результаты с помощью нового хука
  const { 
    overallResults, 
    skillResults, 
    qualityResults,
    loading: detailedLoading 
  } = useDetailedAssessmentResults(userId);

  useEffect(() => {
    fetchDetails();
  }, [userId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);

      // 1. Получаем grade_id пользователя
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('grade_id, manager_id')
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
        const value = (result as any).raw_numeric_value ?? result.hard_skill_answer_options?.numeric_value;
        
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
        const value = (result as any).raw_numeric_value ?? result.soft_skill_answer_options?.numeric_value;
        
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

      // 8. Формируем детализированные данные
      const detailedData: DetailedResult[] = [];

      // Добавляем навыки
      gradeSkills.forEach(gs => {
        if (!gs.hard_skills) return;
        
        const results = skillsMap.get(gs.skill_id);
        const selfAvg = results?.self.length ? results.self.reduce((a, b) => a + b, 0) / results.self.length : 0;
        const peersAvg = results?.peers.length ? results.peers.reduce((a, b) => a + b, 0) / results.peers.length : 0;
        const managerAvg = results?.manager.length ? results.manager.reduce((a, b) => a + b, 0) / results.manager.length : 0;
        
        const categoryName = gs.hard_skills.category_hard_skills?.name;
        
        detailedData.push({
          name: gs.hard_skills.name,
          category: categoryName,
          type: 'skill',
          self_assessment: Math.round(selfAvg * 10) / 10,
          peers_average: Math.round(peersAvg * 10) / 10,
          manager_assessment: Math.round(managerAvg * 10) / 10,
          peers_count: results?.peers.length || 0,
        });
      });

      // Добавляем качества
      gradeQualities.forEach(gq => {
        if (!gq.soft_skills) return;
        
        const results = qualitiesMap.get(gq.quality_id);
        const selfAvg = results?.self.length ? results.self.reduce((a, b) => a + b, 0) / results.self.length : 0;
        const peersAvg = results?.peers.length ? results.peers.reduce((a, b) => a + b, 0) / results.peers.length : 0;
        const managerAvg = results?.manager.length ? results.manager.reduce((a, b) => a + b, 0) / results.manager.length : 0;
        
        detailedData.push({
          name: gq.soft_skills.name,
          type: 'quality',
          self_assessment: Math.round(selfAvg * 10) / 10,
          peers_average: Math.round(peersAvg * 10) / 10,
          manager_assessment: Math.round(managerAvg * 10) / 10,
          peers_count: results?.peers.length || 0,
        });
      });

      setDetails(detailedData);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Ошибка при загрузке детальных результатов');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (details.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Нет данных для отображения</p>
        </CardContent>
      </Card>
    );
  }

  // Функция для генерации данных диаграммы
  const generateChartData = (): BarChartDataItem[] => {
    if (!overallResults) return [];

    const roleColors: Record<string, string> = {
      self: 'hsl(259 100% 52%)', // Фиолетовый
      manager: 'hsl(217 100% 50%)', // Синий
      peers: 'hsl(20 100% 60%)', // Оранжевый
      all_except_self: 'hsl(var(--destructive))',
      all: 'hsl(var(--primary))',
    };

    const roleLabels: Record<string, string> = {
      self: 'Самооценка',
      manager: 'Руководитель',
      peers: 'Коллеги',
      all_except_self: 'Все кроме фидбека сотрудника',
      all: 'Все',
    };

    const data = overallResults.data;
    const chartItems: BarChartDataItem[] = [];

    if (roleFilter === 'all' || roleFilter === 'self') {
      if (data.self_assessment !== null) {
        chartItems.push({
          label: roleLabels.self,
          value: data.self_assessment,
          color: roleColors.self,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'manager') {
      if (data.manager_assessment !== null) {
        chartItems.push({
          label: roleLabels.manager,
          value: data.manager_assessment,
          color: roleColors.manager,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'peers') {
      if (data.peers_average !== null) {
        chartItems.push({
          label: roleLabels.peers,
          value: data.peers_average,
          color: roleColors.peers,
        });
      }
    }



    if (roleFilter === 'all' || roleFilter === 'all_except_self') {
      if (data.all_except_self !== null) {
        chartItems.push({
          label: roleLabels.all_except_self,
          value: data.all_except_self,
          color: roleColors.all_except_self,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'all_average') {
      if (data.all_average !== null) {
        chartItems.push({
          label: roleLabels.all,
          value: data.all_average,
          color: roleColors.all,
        });
      }
    }

    return chartItems;
  };

  // Функция для генерации данных диаграммы по конкретной компетенции
  const generateCompetencyChartData = (competency: CompetencyDetailedResult): BarChartDataItem[] => {
    const roleColors: Record<string, string> = {
      self: 'hsl(259 100% 52%)', // Фиолетовый
      manager: 'hsl(217 100% 50%)', // Синий
      peers: 'hsl(20 100% 60%)', // Оранжевый
      all_except_self: 'hsl(var(--destructive))',
      all: 'hsl(var(--primary))',
    };

    const roleLabels: Record<string, string> = {
      self: 'Самооценка',
      manager: 'Руководитель',
      peers: 'Коллеги',
      all_except_self: 'Все кроме фидбека сотрудника',
      all: 'Все',
    };

    const data = competency.data;
    const chartItems: BarChartDataItem[] = [];

    if (roleFilter === 'all' || roleFilter === 'self') {
      if (data.self_assessment !== null) {
        chartItems.push({
          label: roleLabels.self,
          value: data.self_assessment,
          color: roleColors.self,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'manager') {
      if (data.manager_assessment !== null) {
        chartItems.push({
          label: roleLabels.manager,
          value: data.manager_assessment,
          color: roleColors.manager,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'peers') {
      if (data.peers_average !== null) {
        chartItems.push({
          label: roleLabels.peers,
          value: data.peers_average,
          color: roleColors.peers,
        });
      }
    }



    if (roleFilter === 'all' || roleFilter === 'all_except_self') {
      if (data.all_except_self !== null) {
        chartItems.push({
          label: roleLabels.all_except_self,
          value: data.all_except_self,
          color: roleColors.all_except_self,
        });
      }
    }

    if (roleFilter === 'all' || roleFilter === 'all_average') {
      if (data.all_average !== null) {
        chartItems.push({
          label: roleLabels.all,
          value: data.all_average,
          color: roleColors.all,
        });
      }
    }

    return chartItems;
  };

  // Получение списка компетенций для фильтра
  const getCompetencyOptions = () => {
    const options: { value: string; label: string }[] = [{ value: 'all', label: 'Все' }];
    
    if (dataTypeFilter === 'all' || dataTypeFilter === 'skills') {
      skillResults.forEach(skill => {
        options.push({
          value: `skill_${skill.competency_id}`,
          label: skill.competency_name,
        });
      });
    }

    if (dataTypeFilter === 'all' || dataTypeFilter === 'qualities') {
      qualityResults.forEach(quality => {
        options.push({
          value: `quality_${quality.competency_id}`,
          label: quality.competency_name,
        });
      });
    }

    return options;
  };

  // Фильтрация компетенций
  const filteredSkillResults = competencyFilter === 'all' 
    ? skillResults 
    : skillResults.filter(s => `skill_${s.competency_id}` === competencyFilter);

  const filteredQualityResults = competencyFilter === 'all' 
    ? qualityResults 
    : qualityResults.filter(q => `quality_${q.competency_id}` === competencyFilter);

  const skills = details.filter(d => d.type === 'skill');
  const qualities = details.filter(d => d.type === 'quality');

  return (
    <div className="space-y-6">
      {/* Горизонтальные диаграммы с фильтрами */}
      <Card>
        <CardHeader>
          <CardTitle>Визуализация результатов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Фильтры */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Тип данных</label>
              <Select value={dataTypeFilter} onValueChange={(value: any) => {
                setDataTypeFilter(value);
                setCompetencyFilter('all');
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="skills">Hard Skills (навыки)</SelectItem>
                  <SelectItem value="qualities">Soft Skills (качества)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Роль</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="self">Самооценка</SelectItem>
                  <SelectItem value="manager">Руководитель</SelectItem>
                  <SelectItem value="peers">Коллеги</SelectItem>
                  <SelectItem value="all_except_self">Все кроме фидбека сотрудника</SelectItem>
                  <SelectItem value="all_average">Все (средняя)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Компетенция</label>
              <Select value={competencyFilter} onValueChange={setCompetencyFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getCompetencyOptions().map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Общая оценка */}
          {competencyFilter === 'all' && overallResults && (
            <HorizontalBarChart 
              data={generateChartData()} 
              title="Общая оценка по всем компетенциям"
              maxValue={5}
            />
          )}

          {/* Hard Skills */}
          {(dataTypeFilter === 'all' || dataTypeFilter === 'skills') && filteredSkillResults.length > 0 && (
            <div className="space-y-4">
              {competencyFilter === 'all' && <h3 className="text-lg font-semibold">Hard Skills</h3>}
              {filteredSkillResults.map(skill => (
                <HorizontalBarChart
                  key={skill.competency_id}
                  data={generateCompetencyChartData(skill)}
                  title={skill.competency_name}
                  maxValue={4}
                />
              ))}
            </div>
          )}

          {/* Soft Skills */}
          {(dataTypeFilter === 'all' || dataTypeFilter === 'qualities') && filteredQualityResults.length > 0 && (
            <div className="space-y-4">
              {competencyFilter === 'all' && <h3 className="text-lg font-semibold">Soft Skills</h3>}
              {filteredQualityResults.map(quality => (
                <HorizontalBarChart
                  key={quality.competency_id}
                  data={generateCompetencyChartData(quality)}
                  title={quality.competency_name}
                  maxValue={5}
                />
              ))}
            </div>
          )}

          {/* Нет данных */}
          {!detailedLoading && !overallResults && filteredSkillResults.length === 0 && filteredQualityResults.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Нет данных для отображения</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Таблицы с подробными данными */}
      {skills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hard Skills (детальная таблица)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hard Skill</TableHead>
                  <TableHead className="text-center">Самооценка</TableHead>
                  <TableHead className="text-center">Коллеги ({skills[0]?.peers_count || 0})</TableHead>
                  <TableHead className="text-center">Руководитель</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skills.map((skill) => (
                  <TableRow key={skill.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{skill.name}</span>
                        {skill.category && <Badge variant="secondary" className="text-xs">{skill.category}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {skill.self_assessment || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {skill.peers_average || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {skill.manager_assessment || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {qualities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Soft Skills (детальная таблица)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Soft Skill</TableHead>
                  <TableHead className="text-center">Самооценка</TableHead>
                  <TableHead className="text-center">Коллеги ({qualities[0]?.peers_count || 0})</TableHead>
                  <TableHead className="text-center">Руководитель</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualities.map((quality) => (
                  <TableRow key={quality.name}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{quality.name}</span>
                        {quality.category && <Badge variant="secondary" className="text-xs">{quality.category}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {quality.self_assessment || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {quality.peers_average || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {quality.manager_assessment || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};