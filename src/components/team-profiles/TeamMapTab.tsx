import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, Briefcase, AlertCircle, TrendingUp, Heart, ExternalLink } from 'lucide-react';
import {
  ManagementProfile,
  computeProfileStatus,
  profileStatusLabels,
  profileStatusColors,
  changeTypeLabels,
  type ChangeType,
} from './profileTypes';
import { useTeamProfiles } from '@/hooks/useTeamProfiles';
import { useAuth } from '@/contexts/AuthContext';

interface TreeNode {
  id: string;
  name: string;
  position: string;
  children?: TreeNode[];
}

export const MOCK_TREE: TreeNode = {
  id: 'root-1',
  name: 'Зази Азамат',
  position: 'Директор по развитию',
  children: [
    {
      id: 'child-1',
      name: 'Иванова Мария',
      position: 'Руководитель проектов',
      children: [
        { id: 'gc-1', name: 'Петров Алексей', position: 'Старший аналитик' },
        { id: 'gc-2', name: 'Сидорова Елена', position: 'Аналитик' },
        { id: 'gc-3', name: 'Козлов Дмитрий', position: 'Разработчик' },
      ],
    },
    {
      id: 'child-2',
      name: 'Кузнецов Артём',
      position: 'Тимлид разработки',
      children: [
        { id: 'gc-4', name: 'Новикова Анна', position: 'Фронтенд-разработчик' },
        { id: 'gc-5', name: 'Морозов Игорь', position: 'Бэкенд-разработчик' },
      ],
    },
    {
      id: 'child-3',
      name: 'Волкова Ольга',
      position: 'HR-менеджер',
    },
    {
      id: 'child-4',
      name: 'Лебедев Сергей',
      position: 'Продуктовый дизайнер',
    },
  ],
};

/** Find a node by id in the tree */
export function findNode(node: TreeNode, id: string): TreeNode | null {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// ─── Compact Node Card ───

const NodeCard: React.FC<{
  node: TreeNode;
  profile: ManagementProfile | null;
  onSelect?: (node: TreeNode) => void;
}> = ({ node, profile, onSelect }) => {
  const status = computeProfileStatus(profile);
  const statusLabel = profileStatusLabels[status];
  const statusColor = profileStatusColors[status];

  const project = profile?.currentProject?.trim() || null;
  const role = profile?.currentRole?.trim() || null;

  return (
    <div
      onClick={() => onSelect?.(node)}
      className="bg-card border border-border rounded-lg px-3 py-2 w-48 shadow-sm text-center cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
    >
      <div className="flex justify-center mb-1.5">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <p className="text-xs font-semibold text-foreground truncate leading-tight">{node.name}</p>
      <p className="text-[10px] text-muted-foreground truncate mb-1.5">{node.position}</p>
      <Badge className={`${statusColor} text-[9px] px-1.5 py-0 mb-1.5`}>{statusLabel}</Badge>
      <div className="space-y-0.5 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-center gap-1">
          <Briefcase className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{project || 'Не указано'}</span>
        </div>
      </div>
      <div className="mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="inline-flex items-center gap-1 text-[9px] text-primary font-medium">
          <ExternalLink className="w-2.5 h-2.5" />
          Открыть карточку
        </span>
      </div>
    </div>
  );
};

// ─── Main Component ───

interface TeamMapTabProps {
  onSelectEmployee?: (employee: { id: string; name: string; position: string }) => void;
}

const TeamMapTab: React.FC<TeamMapTabProps> = ({ onSelectEmployee }) => {
  const { user } = useAuth();
  const { getProfile } = useTeamProfiles(user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const canvasRef = useRef<HTMLDivElement>(null);
  const root = MOCK_TREE;
  const children = root.children || [];

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollLeft = Math.max(0, scrollLeft);
  }, []);

  const handleSelect = (node: TreeNode) => {
    onSelectEmployee?.({ id: node.id, name: node.name, position: node.position });
  };

  return (
    <div className="space-y-4 mt-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Карта команды</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Нажмите на сотрудника, чтобы открыть его карточку
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-2.5 bg-muted/30 rounded-lg border border-border text-sm">
        <div className="relative w-48">
          <Search className="absolute left-2 top-2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="Статус профиля" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="not_filled">Не заполнен</SelectItem>
            <SelectItem value="partially_filled">Частично заполнен</SelectItem>
            <SelectItem value="filled">Заполнен</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Org chart */}
      <div
        ref={canvasRef}
        className="relative border border-border rounded-lg bg-muted/10 overflow-auto"
        style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}
      >
        <div className="inline-flex flex-col items-center py-8 px-12" style={{ minWidth: 'max-content' }}>
          <NodeCard node={root} profile={getProfile(root.id)} onSelect={handleSelect} />

          {children.length > 0 && (
            <>
              <div className="w-px h-6 bg-border" />
              {children.length > 1 && (
                <div className="relative" style={{ width: `${children.length * (192 + 24) - 24}px` }}>
                  <div className="absolute top-0 h-px bg-border" style={{ left: `${192 / 2}px`, right: `${192 / 2}px` }} />
                </div>
              )}
              <div className="flex justify-center gap-6">
                {children.map(child => (
                  <div key={child.id} className="flex flex-col items-center">
                    <div className="w-px h-5 bg-border" />
                    <NodeCard node={child} profile={getProfile(child.id)} onSelect={handleSelect} />
                    {child.children && child.children.length > 0 && (
                      <>
                        <div className="w-px h-5 bg-border" />
                        {child.children.length > 1 && (
                          <div className="relative" style={{ width: `${child.children.length * (192 + 24) - 24}px` }}>
                            <div className="absolute top-0 h-px bg-border" style={{ left: `${192 / 2}px`, right: `${192 / 2}px` }} />
                          </div>
                        )}
                        <div className="flex justify-center gap-6">
                          {child.children.map(gc => (
                            <div key={gc.id} className="flex flex-col items-center">
                              <div className="w-px h-5 bg-border" />
                              <NodeCard node={gc} profile={getProfile(gc.id)} onSelect={handleSelect} />
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center italic">
        Skeleton · данные дерева моковые
      </p>
    </div>
  );
};

export default TeamMapTab;
