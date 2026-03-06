import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import { decryptUserData } from '@/lib/userDataDecryption';
import { usePeerSelectionUsers, PeerSelectionUser } from '@/hooks/usePeerSelectionUsers';
// Use PeerSelectionUser from hook instead of local User interface
type User = PeerSelectionUser;

interface Assignment {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  status: string;
  is_manager_participant?: boolean;
  assignment_type?: string;
}

interface ColleagueSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (selectedColleagues: string[]) => Promise<void>;
  currentUserId: string;
  managerId?: string;
  diagnosticStageId?: string;
}

export const ColleagueSelectionDialog = ({ 
  open, 
  onOpenChange, 
  onConfirm,
  currentUserId,
  managerId,
  diagnosticStageId
}: ColleagueSelectionDialogProps) => {
  const [colleagues, setColleagues] = useState<User[]>([]);
  const [selectedColleagues, setSelectedColleagues] = useState<string[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [positionCategoryFilter, setPositionCategoryFilter] = useState<string>('all');
  
  // Use secure hook for fetching peer selection users
  const { fetchUsers: fetchPeerUsers } = usePeerSelectionUsers();

  useEffect(() => {
    if (open) {
      fetchExistingAssignments();
      fetchColleagues();
    }
  }, [open]);

  const fetchExistingAssignments = async () => {
    try {
      // Фильтруем только по текущему активному этапу диагностики
      let query = supabase
        .from('survey_360_assignments')
        .select('id, evaluated_user_id, evaluating_user_id, status, is_manager_participant, assignment_type')
        .eq('evaluated_user_id', currentUserId)
        .eq('assignment_type', 'peer');

      // Важно: фильтруем только респондентов текущего активного этапа
      if (diagnosticStageId) {
        query = query.eq('diagnostic_stage_id', diagnosticStageId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setExistingAssignments(data || []);

      // Предвыбираем коллег со статусом pending или approved для текущего этапа
      const preselected = (data || [])
        .filter(a => 
          a.evaluating_user_id !== currentUserId && 
          a.evaluating_user_id !== managerId &&
          (a.status === 'pending' || a.status === 'approved')
        )
        .map(a => a.evaluating_user_id);

      setSelectedColleagues(preselected);
    } catch (error) {
      console.error('Error fetching existing assignments:', error);
    }
  };

  const fetchColleagues = async () => {
    try {
      setLoading(true);
      console.log('Fetching colleagues for user (secure):', currentUserId);
      
      // Use SECURITY DEFINER function to get only minimal user data
      const users = await fetchPeerUsers(currentUserId);
      
      // Filter out manager if specified
      const filteredUsers = managerId 
        ? users.filter(u => u.id !== managerId)
        : users;

      console.log('Processed users (secure):', filteredUsers);
      setColleagues(filteredUsers);
    } catch (error) {
      console.error('Error fetching colleagues:', error);
      toast.error('Ошибка загрузки списка коллег');
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentInfo = (userId: string) => {
    const assignment = existingAssignments.find(a => a.evaluating_user_id === userId);
    return assignment;
  };

  const isManagerAssignment = (userId: string) => {
    const assignment = getAssignmentInfo(userId);
    return assignment?.is_manager_participant === true;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Ожидает утверждения',
      'approved': 'Согласовано',
      'completed': 'Выполнено',
      'draft': 'Черновик'
    };
    return statusMap[status] || status;
  };

  const isApprovedAssignment = (userId: string) => {
    const assignment = getAssignmentInfo(userId);
    return assignment?.status === 'approved' || assignment?.status === 'completed';
  };

  const handleToggleColleague = (userId: string) => {
    // Не позволяем изменять выбор руководителя
    if (isManagerAssignment(userId)) {
      return;
    }

    // Не позволяем снимать галочку с согласованных респондентов
    const assignment = getAssignmentInfo(userId);
    if (assignment && (assignment.status === 'approved' || assignment.status === 'completed')) {
      // Можно только добавить в список, но не убрать
      if (!selectedColleagues.includes(userId)) {
        setSelectedColleagues(prev => [...prev, userId]);
      }
      return;
    }

    setSelectedColleagues(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleConfirm = async () => {
    if (selectedColleagues.length === 0) {
      toast.error('Выберите хотя бы одного коллегу');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Находим коллег, которых убрали из выбора
      const deselectedColleagues = existingAssignments
        .filter(a => 
          !selectedColleagues.includes(a.evaluating_user_id) &&
          !isManagerAssignment(a.evaluating_user_id) &&
          a.assignment_type === 'peer'
        );

      // 2. Удаляем только pending записи для убранных коллег
      const pendingToDelete = deselectedColleagues
        .filter(a => a.status === 'pending')
        .map(a => a.id);

      if (pendingToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('survey_360_assignments')
          .delete()
          .in('id', pendingToDelete);

        if (deleteError) {
          console.error('Error deleting pending assignments:', deleteError);
          toast.error('Ошибка при удалении назначений');
          return;
        }

        // Удаляем связанные задачи
        const { error: deleteTasksError } = await supabase
          .from('tasks')
          .delete()
          .in('assignment_id', pendingToDelete);

        if (deleteTasksError) {
          console.error('Error deleting tasks:', deleteTasksError);
        }
      }

      // 3. Для выбранных коллег: создаём новые или обновляем rejected -> pending
      for (const colleagueId of selectedColleagues) {
        const existingAssignment = existingAssignments.find(
          a => a.evaluating_user_id === colleagueId && a.assignment_type === 'peer'
        );

        if (!existingAssignment) {
          // Создаём новую запись со статусом pending и added_by_manager=false
          const { error: insertError } = await supabase
            .from('survey_360_assignments')
            .insert({
              evaluated_user_id: currentUserId,
              evaluating_user_id: colleagueId,
              diagnostic_stage_id: diagnosticStageId,
              assignment_type: 'peer',
              status: 'pending',
              added_by_manager: false
            });

          if (insertError) {
            console.error('Error inserting assignment:', insertError);
            toast.error('Ошибка при создании назначения');
            return;
          }
        } else if (existingAssignment.status === 'rejected') {
          // Обновляем rejected -> pending
          const { error: updateError } = await supabase
            .from('survey_360_assignments')
            .update({ status: 'pending' })
            .eq('id', existingAssignment.id);

          if (updateError) {
            console.error('Error updating assignment:', updateError);
            toast.error('Ошибка при обновлении назначения');
            return;
          }
        }
        // Если статус approved - ничего не делаем
      }

      // Завершаем задачу peer_selection
      const { data: peerSelectionTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('user_id', currentUserId)
        .eq('diagnostic_stage_id', diagnosticStageId)
        .eq('task_type', 'peer_selection')
        .eq('status', 'pending')
        .maybeSingle();

      if (peerSelectionTask) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .eq('id', peerSelectionTask.id);
      }

      // Создаем задачу peer_approval для руководителя
      if (managerId) {
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', currentUserId)
          .single();

        let evaluatedUserName = 'Сотрудник';
        if (userData) {
          try {
            const decrypted = await decryptUserData({
              first_name: userData.first_name,
              last_name: userData.last_name,
              middle_name: null,
              email: userData.email
            });
            evaluatedUserName = `${decrypted.last_name} ${decrypted.first_name}`;
          } catch {
            evaluatedUserName = 'Сотрудник';
          }
        }

        await supabase.functions.invoke('create-peer-approval-task', {
          body: {
            managerId,
            evaluatedUserId: currentUserId,
            evaluatedUserName,
            diagnosticStageId
          }
        });
      }

      toast.success('Список отправлен на утверждение руководителю');
      setSelectedColleagues([]);
      onOpenChange(false);
      await onConfirm(selectedColleagues);
    } catch (error) {
      console.error('Error confirming selection:', error);
      toast.error('Ошибка при отправке списка');
    } finally {
      setSubmitting(false);
    }
  };

  // Получаем уникальные должности и категории для фильтров
  const uniquePositions = [...new Set(colleagues.map(c => c.position_name).filter(Boolean))].sort();
  const uniquePositionCategories = [...new Set(colleagues.map(c => c.position_category).filter(Boolean))].sort();

  // Фильтрация коллег по поисковому запросу и фильтрам
  const filteredColleagues = colleagues.filter(colleague => {
    // Фильтр по поиску (по ФИО и email)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const fullName = `${colleague.last_name} ${colleague.first_name} ${colleague.middle_name || ''}`.toLowerCase();
      const email = (colleague.email || '').toLowerCase();
      if (!fullName.includes(query) && !email.includes(query)) return false;
    }
    
    // Фильтр по должности
    if (positionFilter !== 'all' && colleague.position_name !== positionFilter) return false;
    
    // Фильтр по категории должности
    if (positionCategoryFilter !== 'all' && colleague.position_category !== positionCategoryFilter) return false;
    
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Выберите респондентов для прохождения формы "Обратная связь 360"</DialogTitle>
        </DialogHeader>

        {/* Фильтры */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ФИО или email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Select value={positionCategoryFilter} onValueChange={setPositionCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Категория должности" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {uniquePositionCategories.map(category => (
                    <SelectItem key={category} value={category!}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={positionFilter} onValueChange={setPositionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Должность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все должности</SelectItem>
                  {uniquePositions.map(position => (
                    <SelectItem key={position} value={position!}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Existing assignments section */}
              {existingAssignments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">Выбранные коллеги</h4>
                  <div className="space-y-2">
                    {existingAssignments
                      .filter(a => a.evaluating_user_id !== currentUserId)
                      .map(assignment => {
                        const colleague = colleagues.find(c => c.id === assignment.evaluating_user_id);
                        if (!colleague) return null;
                        
                        const isManager = assignment.is_manager_participant;
                        const isApproved = assignment.status === 'approved' || assignment.status === 'completed';
                        
                        return (
                          <div
                            key={assignment.id}
                            className={`flex items-start space-x-3 p-3 rounded-lg border ${
                              isManager || isApproved ? 'bg-muted/50' : 'hover:bg-accent/50'
                            } transition-colors`}
                          >
                            <Checkbox
                              id={assignment.id}
                              checked={selectedColleagues.includes(colleague.id)}
                              onCheckedChange={() => handleToggleColleague(colleague.id)}
                              disabled={isManager || isApproved}
                            />
                             <Label
                              htmlFor={assignment.id}
                              className={`flex-1 ${isManager || isApproved ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="font-medium">
                                {colleague.last_name} {colleague.first_name} {colleague.middle_name}
                                {isManager && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (Руководитель - нельзя удалить)
                                  </span>
                                )}
                                {!isManager && isApproved && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    (Согласовано - нельзя удалить)
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 mt-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {colleague.position_category && (
                                    <span className="text-sm text-muted-foreground">
                                      {colleague.position_category}
                                    </span>
                                  )}
                                  {colleague.position_name && (
                                    <span className="text-sm text-muted-foreground">
                                      • {colleague.position_name}
                                    </span>
                                  )}
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {getStatusLabel(assignment.status)}
                                  </span>
                                </div>
                              </div>
                            </Label>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Available colleagues section */}
              {filteredColleagues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'Ничего не найдено' : 'Нет доступных коллег для выбора'}
                </div>
              ) : (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    Доступные коллеги {searchQuery && `(найдено: ${filteredColleagues.filter(c => !existingAssignments.some(a => a.evaluating_user_id === c.id)).length})`}
                  </h4>
                  <div className="space-y-2">
                    {filteredColleagues
                      .filter(c => !existingAssignments.some(a => a.evaluating_user_id === c.id))
                      .map(colleague => (
                        <div
                          key={colleague.id}
                          className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <Checkbox
                            id={colleague.id}
                            checked={selectedColleagues.includes(colleague.id)}
                            onCheckedChange={() => handleToggleColleague(colleague.id)}
                          />
                          <Label
                            htmlFor={colleague.id}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium">
                              {colleague.last_name} {colleague.first_name} {colleague.middle_name}
                            </div>
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                {colleague.position_category && (
                                  <span>{colleague.position_category}</span>
                                )}
                                {colleague.position_name && (
                                  <span>• {colleague.position_name}</span>
                                )}
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={
              submitting || 
              selectedColleagues.length === 0 ||
              // Все выбранные коллеги уже согласованы
              selectedColleagues.every(id => {
                const assignment = getAssignmentInfo(id);
                return assignment?.status === 'approved' || assignment?.status === 'completed';
              })
            }
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Отправка...
              </>
            ) : (
              `Отправить на утверждение (${selectedColleagues.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
