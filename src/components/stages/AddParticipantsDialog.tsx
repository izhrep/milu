import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';
import { useMeetingStages } from '@/hooks/useMeetingStages';
import { useUsers } from '@/hooks/useUsers';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AddParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentStageId: string;
  diagnosticStageId?: string;
  meetingStageId?: string;
}

export const AddParticipantsDialog = ({ 
  open, 
  onOpenChange, 
  parentStageId,
  diagnosticStageId,
  meetingStageId 
}: AddParticipantsDialogProps) => {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingParticipants, setExistingParticipants] = useState<string[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');

  const { users } = useUsers();
  const { addParticipants: addDiagnosticParticipants, getParticipants: getDiagnosticParticipants } = useDiagnosticStages();
  const { addParticipants: addMeetingParticipants, getParticipants: getMeetingParticipants } = useMeetingStages();

  useEffect(() => {
    if (!open) {
      setSelectedUsers([]);
      setExistingParticipants([]);
      setSearchName('');
      setSearchEmail('');
      return;
    }

    const loadExistingParticipants = async () => {
      setIsLoadingParticipants(true);
      try {
        const participants: string[] = [];
        
        if (diagnosticStageId) {
          const diagnosticParticipants = await getDiagnosticParticipants(diagnosticStageId);
          participants.push(...diagnosticParticipants);
        }
        
        if (meetingStageId) {
          const meetingParticipants = await getMeetingParticipants(meetingStageId);
          participants.push(...meetingParticipants);
        }

        setExistingParticipants([...new Set(participants)]);
      } catch (error) {
        console.error('Error loading participants:', error);
      } finally {
        setIsLoadingParticipants(false);
      }
    };

    loadExistingParticipants();
  }, [open, diagnosticStageId, meetingStageId]);

  const handleToggleUser = (userId: string) => {
    if (existingParticipants.includes(userId)) return;
    
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedUsers.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Выберите хотя бы одного участника',
        variant: 'destructive',
      });
      return;
    }

    if (!diagnosticStageId && !meetingStageId) {
      toast({
        title: 'Ошибка',
        description: 'Нет доступных подэтапов для добавления участников',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const promises = [];
      
      if (diagnosticStageId) {
        promises.push(addDiagnosticParticipants({ stageId: diagnosticStageId, userIds: selectedUsers }));
      }

      if (meetingStageId) {
        promises.push(addMeetingParticipants({ stageId: meetingStageId, userIds: selectedUsers }));
      }

      await Promise.all(promises);

      toast({
        title: 'Успех',
        description: `Добавлено участников: ${selectedUsers.length}`,
      });

      onOpenChange(false);
      setSelectedUsers([]);
    } catch (error) {
      console.error('Error adding participants:', error);
      toast({
        title: 'Ошибка',
        description: 'Ошибка при добавлении участников',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeUsers = users?.filter(u => u.status) || [];

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    return activeUsers.filter(user => {
      const fullName = `${user.last_name || ''} ${user.first_name || ''} ${user.middle_name || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      
      const matchesName = !searchName || fullName.includes(searchName.toLowerCase());
      const matchesEmail = !searchEmail || email.includes(searchEmail.toLowerCase());
      
      return matchesName && matchesEmail;
    });
  }, [activeUsers, searchName, searchEmail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Добавить участников в этап</DialogTitle>
          <DialogDescription>
            Выберите сотрудников для добавления в этап
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Поиск по ФИО</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input
                  id="search-name"
                  placeholder="Введите фамилию, имя или отчество..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-email">Поиск по Email</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input
                  id="search-email"
                  placeholder="Введите email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Table with users */}
          <ScrollArea className="h-[450px] rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Должность</TableHead>
                  <TableHead>Категория должностей</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {searchName || searchEmail ? 'Пользователи не найдены' : 'Нет активных пользователей'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isExisting = existingParticipants.includes(user.id);
                    const isChecked = selectedUsers.includes(user.id) || isExisting;
                    return (
                      <TableRow 
                        key={user.id} 
                        className={isExisting ? 'opacity-60' : 'hover:bg-muted/50'}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => !isExisting && handleToggleUser(user.id)}
                            disabled={isExisting}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {user.last_name} {user.first_name} {user.middle_name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {user.email || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.positions?.name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {user.positions?.position_categories?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {isExisting ? (
                            <Badge variant="secondary">Уже добавлен</Badge>
                          ) : (
                            <Badge variant="outline">Активен</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>

          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Выбрано: {selectedUsers.length} из {filteredUsers.length}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isSubmitting || selectedUsers.length === 0}>
                {isSubmitting ? 'Добавление...' : 'Добавить'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
