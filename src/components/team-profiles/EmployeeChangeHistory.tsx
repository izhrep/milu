import React, { useState } from 'react';
import { Calendar, DollarSign, Briefcase, User, Plus, Pencil, Trash2, TrendingUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EmployeeHistoryEventDialog, { type HistoryEvent, type EventType } from './EmployeeHistoryEventDialog';

/* ── Mock data ─────────────────────────────────────────── */
const INIT_SALARY: HistoryEvent[] = [
  { id: 's1', type: 'salary', date: '2026-03-01', title: 'Повышение', amountFrom: 160000, amount: 180000, comment: 'По результатам ревью Q1' },
  { id: 's2', type: 'salary', date: '2025-09-01', title: 'Повышение', amountFrom: 140000, amount: 160000, comment: 'Плановая индексация' },
  { id: 's3', type: 'salary', date: '2024-03-15', title: 'Стартовая', amount: 140000 },
];

const INIT_PROJECTS: HistoryEvent[] = [
  { id: 'p1', type: 'project', date: '2026-03-20', title: 'Останкино казна', to: 'Останкино казна', from: 'Останкино', comment: 'Перевод по бизнес-запросу' },
  { id: 'p2', type: 'project', date: '2025-06-01', endDate: '2026-03-19', title: 'X5 Опт', to: 'X5 Опт', from: 'X5 Group' },
  { id: 'p3', type: 'project', date: '2024-03-15', endDate: '2025-05-31', title: 'Ригла', to: 'Ригла', from: 'Ригла' },
];

const INIT_ROLES: HistoryEvent[] = [
  { id: 'r1', type: 'role', date: '2026-01-01', title: 'Старший аналитик', to: 'Старший аналитик', from: 'Аналитик', comment: 'Повышение по итогам диагностики' },
  { id: 'r2', type: 'role', date: '2024-03-15', endDate: '2025-12-31', title: 'Аналитик', to: 'Аналитик' },
];

/* ── Helpers ────────────────────────────────────────────── */
const fmt = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtShort = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
};
const fmtMoney = (n: number) => n.toLocaleString('ru-RU') + ' ₽';

/* ── Section component ─────────────────────────────────── */
const SECTION_META: Record<EventType, { label: string; icon: React.ReactNode }> = {
  salary: { label: 'История зарплаты', icon: <DollarSign className="w-4 h-4 text-primary" /> },
  project: { label: 'История проектов', icon: <Briefcase className="w-4 h-4 text-primary" /> },
  role: { label: 'История должности / роли', icon: <User className="w-4 h-4 text-primary" /> },
};

interface SectionProps {
  type: EventType;
  events: HistoryEvent[];
  onAdd: () => void;
  onEdit: (e: HistoryEvent) => void;
  onDelete: (id: string) => void;
}

const HistorySection: React.FC<SectionProps> = ({ type, events, onAdd, onEdit, onDelete }) => {
  const meta = SECTION_META[type];

  const renderDetail = (e: HistoryEvent) => {
    if (type === 'salary') {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{e.amount ? fmtMoney(e.amount) : '—'}</span>
        </div>
      );
    }
    if (type === 'project') {
      return (
        <div>
          <p className="text-sm font-medium text-foreground">{e.to}</p>
          {e.from && <p className="text-[11px] text-muted-foreground">Клиент: {e.from}</p>}
          <p className="text-[11px] text-muted-foreground">
            {fmt(e.date)}{e.endDate ? ` — ${fmt(e.endDate)}` : ' — настоящее время'}
          </p>
        </div>
      );
    }
    return (
      <div>
        <p className="text-sm font-medium text-foreground">{e.to}</p>
        {e.from && <p className="text-[11px] text-muted-foreground">Ранее: {e.from}</p>}
        <p className="text-[11px] text-muted-foreground">
          с {fmt(e.date)}{e.endDate ? ` по ${fmt(e.endDate)}` : ''}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          {meta.icon}
          {meta.label}
          <Badge variant="outline" className="text-[10px] ml-1">{events.length}</Badge>
        </h3>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={onAdd}>
          <Plus className="w-3 h-3" />
          Добавить
        </Button>
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Нет записей</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Нажмите «Добавить», чтобы внести первое изменение</p>
        </div>
      ) : (
        <div className="relative px-5 py-4">
          <div className="absolute left-[30px] top-4 bottom-4 w-px bg-border" />
          <div className="space-y-5">
            {events.map((e, i) => (
              <div key={e.id} className="relative pl-7 group">
                {/* Dot */}
                <div className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${i === 0 ? 'border-primary bg-primary/20' : 'border-muted-foreground/40 bg-background'}`} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={i === 0 ? 'default' : 'outline'} className="text-[10px] gap-1 flex-shrink-0">
                        <Calendar className="w-2.5 h-2.5" />
                        {fmt(e.date)}
                      </Badge>
                    </div>
                    {renderDetail(e)}
                    {e.comment && (
                      <p className="text-[11px] text-muted-foreground/70 mt-1 italic">«{e.comment}»</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(e)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Редактировать</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(e.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">Удалить</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Dynamics visualization (redesigned) ───────────────── */
const DynamicsBlock: React.FC<{
  salary: HistoryEvent[];
  projects: HistoryEvent[];
  roles: HistoryEvent[];
}> = ({ salary, projects, roles }) => {
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

  // Collect all dates
  const allDates = [
    ...salary.map(e => e.date),
    ...projects.flatMap(e => [e.date, e.endDate].filter(Boolean) as string[]),
    ...roles.flatMap(e => [e.date, e.endDate].filter(Boolean) as string[]),
  ];
  if (allDates.length === 0) return null;

  const sorted = [...allDates].sort();
  const minDate = new Date(sorted[0] + 'T00:00:00');
  const now = new Date();
  const maxDate = new Date(Math.max(now.getTime(), new Date(sorted[sorted.length - 1] + 'T00:00:00').getTime()));

  // Add padding: 1 month before and after
  const padMs = 30 * 24 * 60 * 60 * 1000;
  const tMin = minDate.getTime() - padMs;
  const tMax = maxDate.getTime() + padMs;
  const totalMs = tMax - tMin;

  const pct = (iso: string) => {
    const t = new Date(iso + 'T00:00:00').getTime();
    return ((t - tMin) / totalMs) * 100;
  };
  const pctTs = (ts: number) => ((ts - tMin) / totalMs) * 100;

  // Quarter grid lines
  const gridLines: { label: string; pct: number }[] = [];
  const cursor = new Date(minDate);
  cursor.setDate(1);
  cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
  while (cursor.getTime() <= tMax) {
    const p = pctTs(cursor.getTime());
    if (p >= 0 && p <= 100) {
      const q = Math.floor(cursor.getMonth() / 3) + 1;
      gridLines.push({ label: `Q${q} ${cursor.getFullYear()}`, pct: p });
    }
    cursor.setMonth(cursor.getMonth() + 3);
  }

  // Milestone events (transition points)
  const milestones: { id: string; date: string; pct: number; type: EventType; label: string }[] = [];
  salary.forEach(s => milestones.push({ id: s.id, date: s.date, pct: pct(s.date), type: 'salary', label: s.title || 'Зарплата' }));
  projects.forEach(p => milestones.push({ id: p.id, date: p.date, pct: pct(p.date), type: 'project', label: p.to || p.title }));
  roles.forEach(r => milestones.push({ id: r.id, date: r.date, pct: pct(r.date), type: 'role', label: r.to || r.title }));

  // Salary step-line
  const sortedSalary = [...salary].sort((a, b) => a.date.localeCompare(b.date));
  const salaryVals = sortedSalary.map(s => s.amount || 0);
  const sMax = Math.max(...salaryVals, 1);
  const sMin = Math.min(...salaryVals, 0);
  const sRange = sMax - sMin || 1;

  // Build SVG step path
  const TRACK_H = 110;
  const PAD_Y = 30;
  const usable = TRACK_H - PAD_Y * 2;

  const salaryY = (val: number) => PAD_Y + usable - ((val - sMin) / sRange) * usable;

  let stepPath = '';
  const salaryPoints: { x: number; y: number; val: number; id: string; date: string }[] = [];

  sortedSalary.forEach((s, i) => {
    const x = pct(s.date);
    const y = salaryY(s.amount || 0);
    if (i === 0) {
      stepPath += `M ${x} ${y}`;
    } else {
      // horizontal to this x at previous y, then vertical to new y
      const prevY = salaryY(sortedSalary[i - 1].amount || 0);
      stepPath += ` L ${x} ${prevY} L ${x} ${y}`;
    }
    salaryPoints.push({ x, y, val: s.amount || 0, id: s.id, date: s.date });
  });
  // Extend to "now"
  if (sortedSalary.length > 0) {
    const lastY = salaryY(sortedSalary[sortedSalary.length - 1].amount || 0);
    const nowPct = pctTs(now.getTime());
    stepPath += ` L ${nowPct} ${lastY}`;
  }

  // Fill path (area under step)
  let fillPath = stepPath;
  if (sortedSalary.length > 0) {
    const nowPct = pctTs(now.getTime());
    const firstX = pct(sortedSalary[0].date);
    fillPath += ` L ${nowPct} ${TRACK_H} L ${firstX} ${TRACK_H} Z`;
  }

  // Sorted projects/roles by date
  const sortedProjects = [...projects].sort((a, b) => a.date.localeCompare(b.date));
  const sortedRoles = [...roles].sort((a, b) => a.date.localeCompare(b.date));

  const SEG_H = 36;

  const isHighlighted = (id: string) => hoveredMilestone === id;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Динамика сотрудника
        </h3>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[280px]">
              Единый timeline: зарплата как ступенчатая числовая динамика, проекты и роли как интервальные периоды. Наведите на маркер перехода, чтобы увидеть событие.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Timeline container with shared grid — horizontal scroll */}
      <div className="overflow-x-auto pb-2 -mx-5 px-5">
        <div className="relative" style={{ minWidth: 700 }}>
        {/* Vertical grid lines — span all tracks */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          {gridLines.map((g, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-border/40"
              style={{ left: `${g.pct}%` }}
            />
          ))}
        </div>

        {/* Milestone vertical markers */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {milestones.map(m => (
            <div
              key={`ml-${m.id}`}
              className="absolute top-0 bottom-0"
              style={{
                left: `${m.pct}%`,
                borderLeft: '1px dashed',
                borderColor: hoveredMilestone === m.id
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--primary) / 0.15)',
                opacity: hoveredMilestone === m.id ? 1 : 0.6,
              }}
            />
          ))}
        </div>

        {/* Track labels column + tracks */}
        <div className="space-y-1 relative" style={{ zIndex: 1 }}>

          {/* ─── Track 1: Salary ─── */}
          <div className="flex items-stretch">
            <div className="w-[72px] flex-shrink-0 flex items-center">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Зарплата
              </span>
            </div>
            <div className="flex-1 relative bg-muted/20 rounded border border-border/60" style={{ height: TRACK_H }}>
              {/* Fill area */}
              <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 100 ${TRACK_H}`} preserveAspectRatio="none">
                <path d={fillPath} fill="hsl(var(--primary) / 0.06)" />
                <path d={stepPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>

              {/* Value labels + dots */}
              {salaryPoints.map((pt, i) => (
                <React.Fragment key={pt.id}>
                  {/* Dot */}
                  <div
                    className={`absolute w-2.5 h-2.5 rounded-full border-2 border-primary -translate-x-1/2 -translate-y-1/2 cursor-pointer ${
                      isHighlighted(pt.id) ? 'bg-primary scale-150' : 'bg-background'
                    }`}
                    style={{ left: `${pt.x}%`, top: `${(pt.y / TRACK_H) * 100}%` }}
                    onMouseEnter={() => setHoveredMilestone(pt.id)}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  />
                  {/* Value label — positioned above dot */}
                  <div
                    className="absolute -translate-x-1/2 pointer-events-none"
                    style={{
                      left: `${pt.x}%`,
                      top: `${Math.max((pt.y / TRACK_H) * 100 - 22, 0)}%`,
                    }}
                  >
                    <span className={`text-[11px] font-bold whitespace-nowrap ${isHighlighted(pt.id) ? 'text-primary' : 'text-foreground/80'}`}>
                      {fmtMoney(pt.val)}
                    </span>
                  </div>
                  {/* Horizontal plateau indicator */}
                  {i < salaryPoints.length - 1 && (
                    <div
                      className="absolute h-px bg-primary/20 pointer-events-none"
                      style={{
                        left: `${pt.x}%`,
                        width: `${salaryPoints[i + 1].x - pt.x}%`,
                        top: `${(pt.y / TRACK_H) * 100}%`,
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ─── Track 2: Projects ─── */}
          <div className="flex items-stretch">
            <div className="w-[72px] flex-shrink-0 flex items-center">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <Briefcase className="w-3 h-3" /> Проекты
              </span>
            </div>
            <div className="flex-1 relative bg-muted/20 rounded border border-border/60" style={{ height: SEG_H }}>
              {sortedProjects.map((p, i) => {
                const left = pct(p.date);
                const right = p.endDate ? pct(p.endDate) : pctTs(now.getTime());
                const width = Math.max(right - left, 0.5);
                const highlighted = isHighlighted(p.id);
                // Alternate muted accent colors
                const bgClass = i % 2 === 0
                  ? 'bg-primary/15 border-primary/30'
                  : 'bg-accent/40 border-accent/60';
                return (
                  <div
                    key={p.id}
                    className={`absolute top-1 bottom-1 rounded flex items-center border cursor-pointer ${bgClass} ${
                      highlighted ? 'ring-2 ring-primary/50 shadow-sm' : ''
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onMouseEnter={() => setHoveredMilestone(p.id)}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  >
                    <span className={`text-[10px] font-medium truncate px-2 ${highlighted ? 'text-primary' : 'text-foreground/80'}`}>
                      {p.to}
                    </span>
                  </div>
                );
              })}
              {/* Transition markers between projects */}
              {sortedProjects.slice(1).map(p => (
                <div
                  key={`pt-${p.id}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/40"
                  style={{ left: `${pct(p.date)}%` }}
                />
              ))}
            </div>
          </div>

          {/* ─── Track 3: Roles ─── */}
          <div className="flex items-stretch">
            <div className="w-[72px] flex-shrink-0 flex items-center">
              <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Роль
              </span>
            </div>
            <div className="flex-1 relative bg-muted/20 rounded border border-border/60" style={{ height: SEG_H }}>
              {sortedRoles.map((r, i) => {
                const left = pct(r.date);
                const right = r.endDate ? pct(r.endDate) : pctTs(now.getTime());
                const width = Math.max(right - left, 0.5);
                const highlighted = isHighlighted(r.id);
                const intensity = 0.12 + (i / Math.max(sortedRoles.length - 1, 1)) * 0.25;
                return (
                  <div
                    key={r.id}
                    className={`absolute top-1 bottom-1 rounded flex items-center border border-secondary/50 cursor-pointer ${
                      highlighted ? 'ring-2 ring-primary/50 shadow-sm' : ''
                    }`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: `hsl(var(--primary) / ${intensity})`,
                    }}
                    onMouseEnter={() => setHoveredMilestone(r.id)}
                    onMouseLeave={() => setHoveredMilestone(null)}
                  >
                    <span className={`text-[10px] font-medium truncate px-2 ${highlighted ? 'text-primary' : 'text-foreground/80'}`}>
                      {r.to}
                    </span>
                  </div>
                );
              })}
              {/* Transition markers */}
              {sortedRoles.slice(1).map(r => (
                <div
                  key={`rt-${r.id}`}
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/40"
                  style={{ left: `${pct(r.date)}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Time axis ─── */}
        <div className="flex items-stretch mt-1">
          <div className="w-[72px] flex-shrink-0" />
          <div className="flex-1 relative h-5 border-t border-border/60">
            {gridLines.map((g, i) => (
              <div key={i} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${g.pct}%`, top: 0 }}>
                <div className="w-px h-1.5 bg-border" />
                <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
        </div>{/* close relative / min-width */}
      </div>{/* close overflow-x-auto */}

      {/* Hover tooltip */}
      {hoveredMilestone && (() => {
        const m = milestones.find(x => x.id === hoveredMilestone);
        if (!m) return null;
        const typeLabel = m.type === 'salary' ? 'Зарплата' : m.type === 'project' ? 'Проект' : 'Роль';
        return (
          <div
            className="mt-3 px-3 py-2 bg-muted/50 border border-primary/20 rounded-md flex items-center gap-3 text-xs transition-all"
          >
            <Badge variant="outline" className="text-[10px] gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {fmt(m.date)}
            </Badge>
            <span className="text-muted-foreground">{typeLabel}:</span>
            <span className="font-medium text-foreground">{m.label}</span>
            {m.type === 'salary' && (() => {
              const ev = salary.find(s => s.id === m.id);
              return ev?.amount ? <span className="text-primary font-semibold">{fmtMoney(ev.amount)}</span> : null;
            })()}
          </div>
        );
      })()}

      <p className="text-[10px] text-muted-foreground/40 mt-2 italic text-right">
        Prototype · управленческий timeline для согласования UX
      </p>
    </div>
  );
};

/* ── Main component ────────────────────────────────────── */
const EmployeeChangeHistory: React.FC = () => {
  const [salary, setSalary] = useState<HistoryEvent[]>(INIT_SALARY);
  const [projects, setProjects] = useState<HistoryEvent[]>(INIT_PROJECTS);
  const [roles, setRoles] = useState<HistoryEvent[]>(INIT_ROLES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<EventType>('salary');
  const [editingEvent, setEditingEvent] = useState<HistoryEvent | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ type: EventType; id: string } | null>(null);

  const getList = (type: EventType) => type === 'salary' ? salary : type === 'project' ? projects : roles;
  const setList = (type: EventType, list: HistoryEvent[]) => {
    if (type === 'salary') setSalary(list);
    else if (type === 'project') setProjects(list);
    else setRoles(list);
  };

  const handleAdd = (type: EventType) => {
    setDialogType(type);
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const handleEdit = (event: HistoryEvent) => {
    setDialogType(event.type);
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleSave = (event: HistoryEvent) => {
    const list = getList(event.type);
    const exists = list.find(e => e.id === event.id);
    const updated = exists
      ? list.map(e => e.id === event.id ? event : e)
      : [event, ...list];
    setList(event.type, updated.sort((a, b) => b.date.localeCompare(a.date)));
  };

  const handleDelete = (type: EventType, id: string) => {
    setDeleteTarget({ type, id });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setList(deleteTarget.type, getList(deleteTarget.type).filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const showEmpty = salary.length === 0 && projects.length === 0 && roles.length === 0;

  return (
    <div className="space-y-5 mt-4">
      {/* Intro */}
      <div className="bg-muted/30 border border-border rounded-lg px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Здесь отображается история ключевых изменений по сотруднику: зарплата, проекты, должность / роль.
          Динамика, добавление событий и просмотр прошлых изменений — доступны в каждой секции ниже.
        </p>
      </div>

      {showEmpty ? (
        /* Empty state */
        <div className="bg-card border border-border rounded-lg px-6 py-12 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">История изменений по сотруднику пока не заполнена</p>
          <p className="text-xs text-muted-foreground mt-1">Добавьте первое событие, чтобы начать вести историю</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleAdd('salary')}>
              <DollarSign className="w-3 h-3" /> Зарплата
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleAdd('project')}>
              <Briefcase className="w-3 h-3" /> Проект
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleAdd('role')}>
              <User className="w-3 h-3" /> Роль
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Dynamics visualization */}
          <DynamicsBlock salary={salary} projects={projects} roles={roles} />

          {/* Three sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <HistorySection type="salary" events={salary} onAdd={() => handleAdd('salary')} onEdit={handleEdit} onDelete={id => handleDelete('salary', id)} />
            <HistorySection type="project" events={projects} onAdd={() => handleAdd('project')} onEdit={handleEdit} onDelete={id => handleDelete('project', id)} />
            <HistorySection type="role" events={roles} onAdd={() => handleAdd('role')} onEdit={handleEdit} onDelete={id => handleDelete('role', id)} />
          </div>
        </>
      )}

      {/* Add / Edit dialog */}
      <EmployeeHistoryEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={dialogType}
        event={editingEvent}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Это действие нельзя отменить. Запись будет удалена из истории.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeChangeHistory;
