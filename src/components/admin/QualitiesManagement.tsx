import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQualities, Quality } from '@/hooks/useQualities';
import { useCategorySoftSkills } from '@/hooks/useCategorySoftSkills';
import { useSubCategorySoftSkills } from '@/hooks/useSubCategorySoftSkills';

export const QualitiesManagement = () => {
  const { qualities, isLoading, createQuality, updateQuality, deleteQuality } = useQualities();
  const { categories, isLoading: categoriesLoading } = useCategorySoftSkills();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<Quality | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  
  const [qualityForm, setQualityForm] = useState({
    name: '',
    description: '',
    category_id: null as string | null,
    sub_category_id: '' as string,
  });

  const { subCategories } = useSubCategorySoftSkills(qualityForm.category_id || undefined);

  useEffect(() => {
    setQualityForm(prev => ({ ...prev, sub_category_id: '' }));
  }, [qualityForm.category_id]);

  const handleCreate = () => {
    const dataToSend = { ...qualityForm, sub_category_id: qualityForm.sub_category_id || null };
    createQuality(dataToSend);
    setIsCreateOpen(false);
    setQualityForm({ name: '', description: '', category_id: null, sub_category_id: '' });
  };

  const handleEdit = (quality: Quality) => {
    setSelectedQuality(quality);
    setQualityForm({
      name: quality.name,
      description: quality.description || '',
      category_id: quality.category_id,
      sub_category_id: quality.sub_category_id || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (selectedQuality) {
      const dataToSend = { id: selectedQuality.id, ...qualityForm, sub_category_id: qualityForm.sub_category_id || null };
      updateQuality(dataToSend);
      setIsEditOpen(false);
      setSelectedQuality(null);
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

  const filteredQualities = React.useMemo(() => {
    if (!categoryFilter) return qualities;
    return qualities?.filter(q => q.category_id === categoryFilter);
  }, [qualities, categoryFilter]);

  if (isLoading) {
    return <div className="text-center p-4">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Soft Skills</h2>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить качество
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать качество</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название *</Label>
                <Input
                  value={qualityForm.name}
                  onChange={(e) => setQualityForm({ ...qualityForm, name: e.target.value })}
                  placeholder="Например: Коммуникабельность"
                  required
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  value={qualityForm.description}
                  onChange={(e) => setQualityForm({ ...qualityForm, description: e.target.value })}
                  placeholder="Краткое описание качества"
                  rows={3}
                />
              </div>
              <div>
                <Label>Категория</Label>
                <Select
                  value={qualityForm.category_id || "none"}
                  onValueChange={(value) => setQualityForm({ ...qualityForm, category_id: value === "none" ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию (опционально)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без категории</SelectItem>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Подкатегория</Label>
                <Select
                  value={qualityForm.sub_category_id || "none"}
                  onValueChange={(value) => setQualityForm({ ...qualityForm, sub_category_id: value === "none" ? '' : value })}
                  disabled={!qualityForm.category_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={qualityForm.category_id ? "Без подкатегории" : "Сначала выберите категорию"} />
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
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleCreate} disabled={!qualityForm.name}>
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
            {filteredQualities?.map((quality) => {
              const subCategoryName = getSubCategoryName(quality.sub_category_id || null);
              return (
                <TableRow key={quality.id}>
                  <TableCell className="font-medium">{quality.name}</TableCell>
                  <TableCell>
                    {getCategoryName(quality.category_id)}
                    {subCategoryName && (
                      <span className="text-muted-foreground"> → {subCategoryName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {quality.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(quality)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteQuality(quality.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredQualities?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Нет качеств
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать качество</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название *</Label>
              <Input
                value={qualityForm.name}
                onChange={(e) => setQualityForm({ ...qualityForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Textarea
                value={qualityForm.description}
                onChange={(e) => setQualityForm({ ...qualityForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Категория</Label>
              <Select
                value={qualityForm.category_id || "none"}
                onValueChange={(value) => setQualityForm({ ...qualityForm, category_id: value === "none" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите категорию (опционально)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без категории</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Подкатегория</Label>
              <Select
                value={qualityForm.sub_category_id || "none"}
                onValueChange={(value) => setQualityForm({ ...qualityForm, sub_category_id: value === "none" ? '' : value })}
                disabled={!qualityForm.category_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={qualityForm.category_id ? "Без подкатегории" : "Сначала выберите категорию"} />
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
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleUpdate} disabled={!qualityForm.name}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
