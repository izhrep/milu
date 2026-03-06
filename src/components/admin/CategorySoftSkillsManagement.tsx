import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { useCategorySoftSkills, CategorySoftSkill } from '@/hooks/useCategorySoftSkills';
import { useQualities } from '@/hooks/useQualities';

export const CategorySoftSkillsManagement: React.FC = () => {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategorySoftSkills();
  const { qualities } = useQualities();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategorySoftSkill | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategorySoftSkill | null>(null);
  const [relatedSkills, setRelatedSkills] = useState<number>(0);

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });

  const handleCreateCategory = () => {
    createCategory({
      name: categoryForm.name,
      description: categoryForm.description || null,
    });
    setIsCreateDialogOpen(false);
    setCategoryForm({ name: '', description: '' });
  };

  const handleEditCategory = (category: CategorySoftSkill) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateCategory = () => {
    if (!selectedCategory) return;
    
    updateCategory({
      id: selectedCategory.id,
      name: categoryForm.name,
      description: categoryForm.description || null,
    });
    
    setIsEditDialogOpen(false);
    setSelectedCategory(null);
  };

  const handleDeleteClick = (category: CategorySoftSkill) => {
    const related = qualities?.filter(s => s.category_id === category.id).length || 0;
    setRelatedSkills(related);
    setCategoryToDelete(category);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (categoryToDelete && relatedSkills === 0) {
      deleteCategory(categoryToDelete.id);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  if (isLoading) return <div className="text-center py-8">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Категории Soft Skills</h2>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить категорию
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать категорию</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название *</Label>
                <Input
                  placeholder="Название категории"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Textarea
                  placeholder="Описание категории"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Отмена
                </Button>
                <Button onClick={handleCreateCategory} disabled={!categoryForm.name}>
                  Создать
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {category.description || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditCategory(category)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(category)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {categories?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Нет категорий
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изменить категорию</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название *</Label>
              <Input
                placeholder="Название категории"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Textarea
                placeholder="Описание категории"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleUpdateCategory} disabled={!categoryForm.name}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {relatedSkills > 0 ? 'Невозможно удалить категорию' : 'Подтверждение удаления'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {relatedSkills > 0 ? (
                <>
                  Невозможно удалить категорию, так как к ней привязано {relatedSkills} soft skills.
                  <br /><br />
                  Сначала удалите или переместите эти навыки.
                </>
              ) : (
                `Вы действительно хотите удалить категорию "${categoryToDelete?.name}"? Это действие нельзя отменить.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            {relatedSkills === 0 && (
              <AlertDialogAction onClick={handleConfirmDelete}>
                Удалить
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
