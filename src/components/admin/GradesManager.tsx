import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash, Eye, X, Copy } from 'lucide-react';
import { GradeDetailsDialog } from '@/components/GradeDetailsDialog';
import { GradeSkillsQualitiesView } from '@/components/admin/GradeSkillsQualitiesView';

interface SkillWithLevel {
  skill_id: string;
  target_level: number;
}

interface QualityWithLevel {
  quality_id: string;
  target_level: number;
}

export const GradesManager = () => {
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; gradeId?: string }>({ open: false });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: grades, isLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grades')
        .select('*, positions(name), position_categories(name), certifications(name)')
        .order('level', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: positionCategories } = useQuery({
    queryKey: ['position_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('position_categories').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: certifications } = useQuery({
    queryKey: ['certifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certifications').select('*');
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete related skills and qualities first
      await supabase.from('grade_skills').delete().eq('grade_id', id);
      await supabase.from('grade_qualities').delete().eq('grade_id', id);
      
      // Then delete the grade
      const { error } = await supabase.from('grades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({ title: 'Грейд удален' });
      setDeleteDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ gradeData, skills, qualities }: { gradeData: any; skills: SkillWithLevel[]; qualities: QualityWithLevel[] }) => {
      // Validate skills and qualities have IDs
      const validSkills = skills.filter(s => s.skill_id && s.skill_id.trim() !== '');
      const validQualities = qualities.filter(q => q.quality_id && q.quality_id.trim() !== '');

      if (editDialog.data?.id) {
        // Update grade
        const { error: gradeError } = await supabase
          .from('grades')
          .update(gradeData)
          .eq('id', editDialog.data.id);
        if (gradeError) throw gradeError;

        // Delete existing skills and qualities
        await supabase.from('grade_skills').delete().eq('grade_id', editDialog.data.id);
        await supabase.from('grade_qualities').delete().eq('grade_id', editDialog.data.id);

        // Insert new skills
        if (validSkills.length > 0) {
          const { error: skillsError } = await supabase
            .from('grade_skills')
            .insert(validSkills.map(s => ({ grade_id: editDialog.data.id, skill_id: s.skill_id, target_level: s.target_level })));
          if (skillsError) throw skillsError;
        }

        // Insert new qualities
        if (validQualities.length > 0) {
          const { error: qualitiesError } = await supabase
            .from('grade_qualities')
            .insert(validQualities.map(q => ({ grade_id: editDialog.data.id, quality_id: q.quality_id, target_level: q.target_level })));
          if (qualitiesError) throw qualitiesError;
        }
      } else {
        // Create grade
        const { data: newGrade, error: gradeError } = await supabase
          .from('grades')
          .insert(gradeData)
          .select()
          .single();
        if (gradeError) throw gradeError;

        // Insert skills
        if (validSkills.length > 0) {
          const { error: skillsError } = await supabase
            .from('grade_skills')
            .insert(validSkills.map(s => ({ grade_id: newGrade.id, skill_id: s.skill_id, target_level: s.target_level })));
          if (skillsError) throw skillsError;
        }

        // Insert qualities
        if (validQualities.length > 0) {
          const { error: qualitiesError } = await supabase
            .from('grade_qualities')
            .insert(validQualities.map(q => ({ grade_id: newGrade.id, quality_id: q.quality_id, target_level: q.target_level })));
          if (qualitiesError) throw qualitiesError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast({ title: editDialog.data?.id ? 'Грейд обновлен' : 'Грейд создан' });
      setEditDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Всего грейдов: {grades?.length || 0}</h3>
            <Button onClick={() => setEditDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить грейд
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Уровень</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Зарплата</TableHead>
                <TableHead>Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades?.map((grade: any) => (
                <TableRow key={grade.id}>
                  <TableCell className="font-medium">{grade.name}</TableCell>
                  <TableCell>{grade.level}</TableCell>
                  <TableCell>{grade.positions?.name || '-'}</TableCell>
                  <TableCell>{grade.position_categories?.name || '-'}</TableCell>
                  <TableCell>
                    {grade.min_salary && grade.max_salary
                      ? `${grade.min_salary} - ${grade.max_salary}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDetailsDialog({ open: true, gradeId: grade.id })}
                        title="Просмотр навыков и качеств"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const copiedData = { ...grade };
                          const originalId = copiedData.id;
                          delete copiedData.id;
                          delete copiedData.created_at;
                          delete copiedData.updated_at;
                          copiedData.name = `${copiedData.name} (копия)`;
                          copiedData.copySourceId = originalId;
                          setEditDialog({ open: true, data: copiedData });
                        }}
                        title="Копировать грейд"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditDialog({ open: true, data: grade })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteDialog({ open: true, id: grade.id })}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <GradeEditDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false })}
        data={editDialog.data}
        positions={positions}
        positionCategories={positionCategories}
        certifications={certifications}
        onSave={(gradeData, skills, qualities) => saveMutation.mutate({ gradeData, skills, qualities })}
      />

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
          </DialogHeader>
          <p>Вы уверены, что хотите удалить этот грейд?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false })}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteDialog.id!)}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailsDialog.gradeId && (
        <GradeDetailsDialog
          open={detailsDialog.open}
          onOpenChange={(open) => setDetailsDialog({ open })}
          gradeId={detailsDialog.gradeId}
          gradeName={grades?.find(g => g.id === detailsDialog.gradeId)?.name || ''}
        />
      )}
    </>
  );
};

const GradeEditDialog = ({ open, onClose, data, positions, positionCategories, certifications, onSave }: any) => {
  const [formData, setFormData] = useState<any>({});
  const [skills, setSkills] = useState<SkillWithLevel[]>([]);
  const [qualities, setQualities] = useState<QualityWithLevel[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [availableQualities, setAvailableQualities] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch skills
    const fetchSkills = async () => {
      const { data: skillsData } = await supabase
        .from('hard_skills')
        .select('id, name')
        .order('name');
      setAvailableSkills(skillsData || []);
    };

    // Fetch qualities
    const fetchQualities = async () => {
      const { data: qualitiesData } = await supabase
        .from('soft_skills')
        .select('id, name')
        .order('name');
      setAvailableQualities(qualitiesData || []);
    };

    fetchSkills();
    fetchQualities();
  }, []);

  useEffect(() => {
    if (data?.id || data?.copySourceId) {
      setFormData(data);
      
      // Fetch existing skills and qualities for this grade (or copy source)
      const fetchGradeRequirements = async () => {
        const sourceId = data.copySourceId || data.id;
        const { data: gradeSkills } = await supabase
          .from('grade_skills')
          .select('skill_id, target_level')
          .eq('grade_id', sourceId);
        
        const { data: gradeQualities } = await supabase
          .from('grade_qualities')
          .select('quality_id, target_level')
          .eq('grade_id', sourceId);

        setSkills(gradeSkills || []);
        setQualities(gradeQualities || []);
      };

      fetchGradeRequirements();
    } else {
      setFormData({});
      setSkills([]);
      setQualities([]);
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanData = { ...formData };
    delete cleanData.id;
    delete cleanData.created_at;
    delete cleanData.updated_at;
    delete cleanData.positions;
    delete cleanData.position_categories;
    delete cleanData.certifications;
    delete cleanData.copySourceId;
    
    onSave(cleanData, skills, qualities);
  };

  const addSkill = () => {
    setSkills([...skills, { skill_id: '', target_level: 1 }]);
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const updateSkill = (index: number, field: 'skill_id' | 'target_level', value: any) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    setSkills(updated);
  };

  const addQuality = () => {
    setQualities([...qualities, { quality_id: '', target_level: 1 }]);
  };

  const removeQuality = (index: number) => {
    setQualities(qualities.filter((_, i) => i !== index));
  };

  const updateQuality = (index: number, field: 'quality_id' | 'target_level', value: any) => {
    const updated = [...qualities];
    updated[index] = { ...updated[index], [field]: value };
    setQualities(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {data?.id ? 'Редактировать грейд' : 'Создать грейд'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Название <span className="text-destructive">*</span></Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Уровень <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                value={formData.level !== undefined && formData.level !== null ? formData.level : ''}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Должность</Label>
            <Select
              value={formData.position_id || ''}
              onValueChange={(value) => setFormData({ ...formData, position_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                {positions?.map((pos: any) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Минимальная зарплата</Label>
              <Input
                type="number"
                value={formData.min_salary || ''}
                onChange={(e) => setFormData({ ...formData, min_salary: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>Максимальная зарплата</Label>
              <Input
                type="number"
                value={formData.max_salary || ''}
                onChange={(e) => setFormData({ ...formData, max_salary: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Сертификация</Label>
            <Select
              value={formData.certification_id || ''}
              onValueChange={(value) => setFormData({ ...formData, certification_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите сертификацию" />
              </SelectTrigger>
              <SelectContent>
                {certifications?.map((cert: any) => (
                  <SelectItem key={cert.id} value={cert.id}>
                    {cert.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Ключевые задачи</Label>
            <Textarea
              value={formData.key_tasks || ''}
              onChange={(e) => setFormData({ ...formData, key_tasks: e.target.value })}
              rows={3}
            />
          </div>

          {/* Skills Section */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">
                Hard Skills
              </Label>
              <Button type="button" size="sm" onClick={addSkill}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить Hard Skill
              </Button>
            </div>
            
            {skills.length === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                Hard Skills не добавлены.
              </div>
            )}
            
            {skills.map((skill, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select
                    value={skill.skill_id}
                    onValueChange={(value) => updateSkill(index, 'skill_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите Hard Skill" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSkills.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="Уровень"
                    value={skill.target_level}
                    onChange={(e) => updateSkill(index, 'target_level', parseFloat(e.target.value))}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSkill(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Qualities Section */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">
                Soft Skills
              </Label>
              <Button type="button" size="sm" onClick={addQuality}>
                <Plus className="h-4 w-4 mr-1" />
                Добавить Soft Skill
              </Button>
            </div>
            
            {qualities.length === 0 && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                Soft Skills не добавлены.
              </div>
            )}
            
            {qualities.map((quality, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select
                    value={quality.quality_id}
                    onValueChange={(value) => updateQuality(index, 'quality_id', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите Soft Skill" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableQualities.map((q) => (
                        <SelectItem key={q.id} value={q.id}>
                          {q.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    placeholder="Уровень"
                    value={quality.target_level}
                    onChange={(e) => updateQuality(index, 'target_level', parseFloat(e.target.value))}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuality(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit">
              {data?.id ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
