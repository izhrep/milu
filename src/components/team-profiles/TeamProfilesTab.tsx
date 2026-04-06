import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Users, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import {
  computeProfileStatus,
  profileStatusLabels,
  profileStatusColors,
  actionLabel,
  ProfileStatus,
} from './profileTypes';
import ProfileEmployeeList from './ProfileEmployeeList';
import ProfileCard from './ProfileCard';

interface Props {
  selectedUserId: string | null;
  onSelectUser: (id: string | null) => void;
}

const TeamProfilesTab = ({ selectedUserId, onSelectUser }: Props) => {
  const { user } = useAuth();
  const { users, loading } = useUsers();
  const { profiles, getProfile, saveProfile } = useTeamProfiles(user?.id);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [managerFilter, setManagerFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // All employees (for admin/hr_bp we show everyone)
  const employees = useMemo(() => users || [], [users]);

  // Unique filter values
  const managers = useMemo(() => {
    const set = new Map<string, string>();
    employees.forEach(e => {
      if (e.manager_id) {
        const mgr = employees.find(u => u.id === e.manager_id);
        if (mgr) set.set(mgr.id, `${mgr.last_name || ''} ${mgr.first_name || ''}`.trim());
      }
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const positions = useMemo(() => {
    const s = new Set<string>();
    employees.forEach(e => { if (e.positions?.name) s.add(e.positions.name); });
    return Array.from(s).sort();
  }, [employees]);

  // Enriched with status
  const enriched = useMemo(() => {
    return employees.map(e => ({
      ...e,
      profileStatus: computeProfileStatus(getProfile(e.id)),
    }));
  }, [employees, profiles]);

  // Apply filters
  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (searchQuery) {
        const name = `${e.last_name || ''} ${e.first_name || ''} ${e.middle_name || ''}`.toLowerCase();
        if (!name.includes(searchQuery.toLowerCase())) return false;
      }
      if (managerFilter !== 'all' && e.manager_id !== managerFilter) return false;
      if (positionFilter !== 'all' && e.positions?.name !== positionFilter) return false;
      if (statusFilter !== 'all' && e.profileStatus !== statusFilter) return false;
      return true;
    });
  }, [enriched, searchQuery, managerFilter, positionFilter, statusFilter]);

  // Summary counters
  const counts = useMemo(() => {
    const c = { total: enriched.length, not_filled: 0, partially_filled: 0, filled: 0 };
    enriched.forEach(e => { c[e.profileStatus]++; });
    return c;
  }, [enriched]);

  // Selected employee
  const selectedEmployee = useMemo(() => {
    if (!selectedUserId) return null;
    return employees.find(e => e.id === selectedUserId) || null;
  }, [selectedUserId, employees]);

  // Find manager name
  const getManagerName = (managerId: string | null) => {
    if (!managerId) return '—';
    const mgr = employees.find(u => u.id === managerId);
    return mgr ? `${mgr.last_name || ''} ${mgr.first_name || ''}`.trim() : '—';
  };

  // Navigate to next unfilled
  const goToNextUnfilled = () => {
    const next = enriched.find(e => e.id !== selectedUserId && e.profileStatus === 'not_filled')
      || enriched.find(e => e.id !== selectedUserId && e.profileStatus === 'partially_filled');
    if (next) onSelectUser(next.id);
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-surface-secondary rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-surface-secondary rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Профили команды</h2>
        <p className="text-text-secondary mt-1">Заполнение и актуализация управленческих профилей сотрудников</p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-text-secondary">Всего сотрудников</p>
            <p className="text-2xl font-bold text-text-primary mt-1">{counts.total}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-text-secondary">Не заполнены</p>
            <p className="text-2xl font-bold text-destructive mt-1">{counts.not_filled}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-text-secondary">Частично заполнены</p>
            <p className="text-2xl font-bold text-accent-foreground mt-1">{counts.partially_filled}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-card">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-text-secondary">Заполнены</p>
            <p className="text-2xl font-bold text-primary mt-1">{counts.filled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Compact filters toolbar */}
      <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs text-text-secondary">Поиск по ФИО</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
              <Input
                placeholder="Введите имя..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-text-secondary">Руководитель</Label>
            <Select value={managerFilter} onValueChange={setManagerFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Все" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-text-secondary">Должность</Label>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Все" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все должности</SelectItem>
                {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-text-secondary">Статус профиля</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Все" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="not_filled">Не заполнен</SelectItem>
                <SelectItem value="partially_filled">Частично заполнен</SelectItem>
                <SelectItem value="filled">Заполнен</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Employee list — full width */}
      <ProfileEmployeeList
        employees={filtered}
        selectedId={selectedUserId}
        onSelect={onSelectUser}
        getManagerName={getManagerName}
      />

      {/* Side sheet for profile card */}
      <Sheet
        open={!!selectedEmployee}
        onOpenChange={(open) => { if (!open) onSelectUser(null); }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto p-6">
          <SheetHeader className="mb-4">
            <SheetTitle>
              {selectedEmployee
                ? `${selectedEmployee.last_name || ''} ${selectedEmployee.first_name || ''}`.trim()
                : 'Профиль'}
            </SheetTitle>
          </SheetHeader>
          {selectedEmployee && (
            <ProfileCard
              employee={selectedEmployee}
              profile={getProfile(selectedEmployee.id)}
              onSave={(data) => saveProfile(selectedEmployee.id, data)}
              onSaveAndNext={(data) => {
                saveProfile(selectedEmployee.id, data);
                goToNextUnfilled();
              }}
              getManagerName={getManagerName}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TeamProfilesTab;
