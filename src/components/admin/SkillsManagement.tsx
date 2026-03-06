import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSkills } from '@/hooks/useSkills';
import { useCategorySkills } from '@/hooks/useCategorySkills';
import { useSubCategoryHardSkills } from '@/hooks/useSubCategoryHardSkills';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  sub_category_id?: string | null;
}

export const SkillsManagement = () => {
  const { skills, isLoading, createSkill, updateSkill, deleteSkill } = useSkills();
  const { categories, isLoading: categoriesLoading } = useCategorySkills();
  
  const [isCreateSkillOpen, setIsCreateSkillOpen] = useState(false);
  const [isEditSkillOpen, setIsEditSkillOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  const [skillForm, setSkillForm] = useState({
    name: '',
    description: '',
    category_id: '',
    sub_category_id: '',
  });

  const { subCategories } = useSubCategoryHardSkills(skillForm.category_id || undefined);

  useEffect(() => {
    setSkillForm(prev => ({ ...prev, sub_category_id: '' }));
  }, [skillForm.category_id]);

  const handleCreateSkill = () => {
    const dataToSend = {
      ...skillForm,
      sub_category_id: skillForm.sub_category_id || null
    };
    createSkill(dataToSend);
    setIsCreateSkillOpen(false);
    setSkillForm({ name: '', description: '', category_id: '', sub_category_id: '' });
  };

  const handleEditSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setSkillForm({
      name: skill.name,
      description: skill.description || '',
      category_id: skill.category_id || '',
      sub_category_id: skill.sub_category_id || '',
    });
    setIsEditSkillOpen(true);
  };

  const handleUpdateSkill = () => {
    if (selectedSkill) {
      const dataToSend = {
        id: selectedSkill.id,
        ...skillForm,
        sub_category_id: skillForm.sub_category_id || null
      };
      updateSkill(dataToSend);
      setIsEditSkillOpen(false);
      setSelectedSkill(null);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return '—';
    return categories?.find(c => c.id === categoryId)?.name || '—';
  };

  const getSubCategoryName = (subCategoryId: string | null) => {
    if (!subCategoryId) return '';
    return subCategories?.find(sc => sc.id === subCategoryId)?.name || '';
  };

  const filteredSkills = React.useMemo(() => {
    if (!categoryFilter) return skills;
    return skills?.filter(s => s.category_id === categoryFilter);
  }, [skills, categoryFilter]);

  if (isLoading || categoriesLoading) {
    return <div className="text-center p-4">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Hard Skills</h2>
        
        <Dialog open={isCreateSkillOpen} onOpenChange={setIsCreateSkillOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить навык
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать навык</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название *</Label>
                <Input
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  placeholder="Например: Управление проектами"
                  required
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  value={skillForm.description}
                  onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                  placeholder="Краткое описание навыка"
                  rows={3}
                />
              </div>
              <div>
                <Label>Категория *</Label>
                <Select
                  value={skillForm.category_id}
                  onValueChange={(value) => setSkillForm({ ...skillForm, category_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Подкатегория</Label>
                <Select
                  value={skillForm.sub_category_id || "none"}
                  onValueChange={(value) => setSkillForm({ ...skillForm, sub_category_id: value === "none" ? '' : value })}
                  disabled={!skillForm.category_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={skillForm.category_id ? "Без подкатегории" : "Сначала выберите категорию"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без подкатегории</SelectItem>
                    {subCategories?.map((subCategory) => (
                      <SelectItem key={subCategory.id} value={subCategory.id}>
                        {subCategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateSkillOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleCreateSkill} disabled={!skillForm.name || !skillForm.category_id}>
                  Создать
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-64">
        <Label>Фильтр по категории</Label>
        <Select value={categoryFilter || "all"} onValueChange={(value) => setCategoryFilter(value === "all" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Все категории" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSkills?.map((skill) => {
              const subCategoryName = getSubCategoryName(skill.sub_category_id || null);
              return (
                <TableRow key={skill.id}>
                  <TableCell className="font-medium">{skill.name}</TableCell>
                  <TableCell>
                    {getCategoryName(skill.category_id)}
                    {subCategoryName && (
                      <span className="text-muted-foreground"> → {subCategoryName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {skill.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditSkill(skill)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteSkill(skill.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredSkills?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Нет навыков
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditSkillOpen} onOpenChange={setIsEditSkillOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать навык</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название *</Label>
              <Input
                value={skillForm.name}
                onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Textarea
                value={skillForm.description}
                onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Категория *</Label>
              <Select
                value={skillForm.category_id}
                onValueChange={(value) => setSkillForm({ ...skillForm, category_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Подкатегория</Label>
              <Select
                value={skillForm.sub_category_id || "none"}
                onValueChange={(value) => setSkillForm({ ...skillForm, sub_category_id: value === "none" ? '' : value })}
                disabled={!skillForm.category_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={skillForm.category_id ? "Без подкатегории" : "Сначала выберите категорию"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без подкатегории</SelectItem>
                  {subCategories?.map((subCategory) => (
                    <SelectItem key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditSkillOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleUpdateSkill} disabled={!skillForm.name || !skillForm.category_id}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
