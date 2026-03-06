import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash, ChevronDown, ChevronUp } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CareerTrackStep {
  id?: string;
  grade_id: string;
  step_order: number;
  duration_months?: number;
  description?: string;
}

export const CareerTracksManager = () => {
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tracks, isLoading } = useQuery({
    queryKey: ['career_tracks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_tracks')
        .select('*, track_types(name), positions(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: trackSteps } = useQuery({
    queryKey: ['career_track_steps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('career_track_steps')
        .select('*, grades(name)')
        .order('step_order', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grades').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: trackTypes } = useQuery({
    queryKey: ['track_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('track_types').select('*');
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

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const trackData = {
        name: formData.name,
        description: formData.description,
        track_type_id: formData.track_type_id || null,
        target_position_id: formData.target_position_id || null,
        duration_months: formData.duration_months ? parseInt(formData.duration_months) : null,
      };

      let trackId = formData.id;

      if (formData.id) {
        const { error } = await supabase
          .from('career_tracks')
          .update(trackData)
          .eq('id', formData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('career_tracks')
          .insert(trackData)
          .select()
          .single();
        if (error) throw error;
        trackId = data.id;
      }

      // Handle steps
      if (formData.steps && formData.steps.length > 0) {
        // Delete existing steps for this track
        await supabase.from('career_track_steps').delete().eq('career_track_id', trackId);

        // Insert new steps
        const stepsToInsert = formData.steps.map((step: CareerTrackStep, index: number) => ({
          career_track_id: trackId,
          grade_id: step.grade_id,
          step_order: index + 1,
          duration_months: step.duration_months ? parseInt(String(step.duration_months)) : null,
          description: step.description || null,
        }));

        const { error: stepsError } = await supabase
          .from('career_track_steps')
          .insert(stepsToInsert);
        if (stepsError) throw stepsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['career_tracks'] });
      queryClient.invalidateQueries({ queryKey: ['career_track_steps'] });
      toast({ title: 'Успешно сохранено' });
      setEditDialog({ open: false });
    },
    onError: (error) => {
      toast({ title: 'Ошибка', description: String(error), variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('career_track_steps').delete().eq('career_track_id', id);
      const { error } = await supabase.from('career_tracks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['career_tracks'] });
      queryClient.invalidateQueries({ queryKey: ['career_track_steps'] });
      toast({ title: 'Успешно удалено' });
    },
    onError: (error) => {
      toast({ title: 'Ошибка', description: String(error), variant: 'destructive' });
    },
  });

  const getStepsForTrack = (trackId: string) => {
    return trackSteps?.filter(step => step.career_track_id === trackId) || [];
  };

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Карьерные треки</CardTitle>
          <Button onClick={() => setEditDialog({ open: true })}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tracks?.map(track => {
            const steps = getStepsForTrack(track.id);
            const isExpanded = expandedTrack === track.id;
            
            return (
              <Collapsible key={track.id} open={isExpanded} onOpenChange={(open) => setExpandedTrack(open ? track.id : null)}>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </CollapsibleTrigger>
                          <div>
                            <h3 className="font-semibold">{track.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {steps.length} {steps.length === 1 ? 'грейд' : steps.length < 5 ? 'грейда' : 'грейдов'}
                              {track.track_types && ` • ${track.track_types.name}`}
                              {track.positions && ` • ${track.positions.name}`}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditDialog({ open: true, data: { ...track, steps } })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate(track.id)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      {track.description && (
                        <p className="text-sm text-muted-foreground mb-4">{track.description}</p>
                      )}
                      {steps.length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Шаг</TableHead>
                              <TableHead>Грейд</TableHead>
                              <TableHead>Длительность (мес.)</TableHead>
                              <TableHead>Описание</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {steps.map(step => (
                              <TableRow key={step.id}>
                                <TableCell>{step.step_order}</TableCell>
                                <TableCell>{step.grades?.name}</TableCell>
                                <TableCell>{step.duration_months || '-'}</TableCell>
                                <TableCell>{step.description || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        <EditDialog
          open={editDialog.open}
          onClose={() => setEditDialog({ open: false })}
          data={editDialog.data}
          onSave={(data) => saveMutation.mutate(data)}
          grades={grades || []}
          trackTypes={trackTypes || []}
          positions={positions || []}
        />
      </CardContent>
    </Card>
  );
};

const EditDialog = ({ open, onClose, data, onSave, grades, trackTypes, positions }: any) => {
  const [formData, setFormData] = useState(data || { steps: [] });
  const [steps, setSteps] = useState<CareerTrackStep[]>(data?.steps || []);

  React.useEffect(() => {
    setFormData(data || { steps: [] });
    setSteps(data?.steps || []);
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, steps });
  };

  const addStep = () => {
    setSteps([...steps, { grade_id: '', step_order: steps.length + 1 }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.id ? 'Редактировать' : 'Создать'} карьерный трек</DialogTitle>
          <DialogDescription>Заполните информацию о карьерном треке и его грейдах</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label>Название *</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Описание</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Тип трека</Label>
                <Select
                  value={formData.track_type_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, track_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите тип" />
                  </SelectTrigger>
                  <SelectContent>
                    {trackTypes.map((type: any) => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Целевая должность</Label>
                <Select
                  value={formData.target_position_id || ''}
                  onValueChange={(value) => setFormData({ ...formData, target_position_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите должность" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.map((pos: any) => (
                      <SelectItem key={pos.id} value={pos.id}>{pos.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Общая длительность (месяцы)</Label>
              <Input
                type="number"
                value={formData.duration_months || ''}
                onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Грейды карьерного трека</h3>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить грейд
                </Button>
              </div>

              <div className="space-y-4">
                {steps.map((step, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4">
                      <div className="flex gap-4 items-start">
                        <div className="flex-1 grid grid-cols-3 gap-4">
                          <div>
                            <Label>Грейд *</Label>
                            <Select
                              value={step.grade_id}
                              onValueChange={(value) => updateStep(index, 'grade_id', value)}
                              required
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Выберите грейд" />
                              </SelectTrigger>
                              <SelectContent>
                                {grades.map((grade: any) => (
                                  <SelectItem key={grade.id} value={grade.id}>{grade.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Длительность (мес.)</Label>
                            <Input
                              type="number"
                              value={step.duration_months || ''}
                              onChange={(e) => updateStep(index, 'duration_months', e.target.value)}
                            />
                          </div>

                          <div>
                            <Label>Описание</Label>
                            <Input
                              value={step.description || ''}
                              onChange={(e) => updateStep(index, 'description', e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(index)}
                          className="mt-6"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit">Сохранить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
