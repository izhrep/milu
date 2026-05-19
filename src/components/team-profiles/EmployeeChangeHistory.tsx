import React, { useState, useRef } from 'react';
import { Calendar, DollarSign, Briefcase, User, Plus, Pencil, Trash2, TrendingUp, Info, ChevronDown, ChevronUp, ArrowUpRight } from "@/components/icons";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
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

const pctChange = (from: number, to: number) => {
  if (!from || from === 0) return null;
  const diff = ((to - from) / from) * 100;
  return Math.round(diff);
};

/* ── Color palettes per section type ───────────────────── */
const PALETTES: Record<EventType, {
  dot: string; dotFirst: string; line: string;
  iconBg: string; iconText: string;
  dateBgFirst: string; dateTextFirst: string;
  scrollGradient: string;
}> = {
  salary: {
    dot: 'border-success/40 dark:border-success',
    dotFirst: 'border-success bg-success/20 dark:border-success/40 dark:bg-success/20',
    line: 'bg-success/20 dark:bg-success/50',
    iconBg: 'bg-success/10 dark:bg-success/40',
    iconText: 'text-success dark:text-success/80',
    dateBgFirst: 'bg-success/10 text-success dark:bg-success/40 dark:text-success/70',
    dateTextFirst: 'text-success dark:text-success/70',
    scrollGradient: 'from-card',
  },
  project: {
    dot: 'border-primary/40 dark:border-primary',
    dotFirst: 'border-primary bg-primary/20 dark:border-primary/40 dark:bg-primary/20',
    line: 'bg-primary/20 dark:bg-primary/50',
    iconBg: 'bg-primary/10 dark:bg-primary/40',
    iconText: 'text-primary dark:text-primary/80',
    dateBgFirst: 'bg-primary/10 text-primary dark:bg-primary/40 dark:text-primary/70',
    dateTextFirst: 'text-primary dark:text-primary/70',
    scrollGradient: 'from-card',
  },
  role: {
    dot: 'border-chart-3/40 dark:border-chart-3',
    dotFirst: 'border-chart-3 bg-chart-3/20 dark:border-chart-3/40 dark:bg-chart-3/20',
    line: 'bg-chart-3/20 dark:bg-chart-3/50',
    iconBg: 'bg-chart-3/10 dark:bg-chart-3/40',
    iconText: 'text-chart-3 dark:text-chart-3/80',
    dateBgFirst: 'bg-chart-3/10 text-chart-3 dark:bg-chart-3/40 dark:text-chart-3/70',
    dateTextFirst: 'text-chart-3 dark:text-chart-3/70',
    scrollGradient: 'from-card',
  },
};

/* ── Section meta ──────────────────────────────────────── */
const SECTION_META: Record<EventType, { label: string; Icon: React.FC<{ className?: string }> }> = {
  salary: { label: 'История зарплаты', Icon: DollarSign },
  project: { label: 'История проектов', Icon: Briefcase },
  role: { label: 'История должности / роли', Icon: User },
};

const pluralRecords = (n: number) => {
  const mod = n % 10;
  const mod100 = n % 100;
  if (mod === 1 && mod100 !== 11) return `${n} запись`;
  if (mod >= 2 && mod <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} записи`;
  return `${n} записей`;
};

/* ── Section component ─────────────────────────────────── */
interface SectionProps {
  type: EventType;
  events: HistoryEvent[];
  onAdd: () => void;
  onEdit: (e: HistoryEvent) => void;
  onDelete: (id: string) => void;
}

const HistorySection: React.FC<SectionProps> = ({ type, events, onAdd, onEdit, onDelete }) => {
  const meta = SECTION_META[type];
  const pal = PALETTES[type];
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const renderDetail = (e: HistoryEvent, isFirst: boolean) => {
    if (type === 'salary') {
      const pct = e.amountFrom && e.amount ? pctChange(e.amountFrom, e.amount) : null;
      return (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body-md font-semibold text-foreground">{e.amount ? fmtMoney(e.amount) : '—'}</span>
            {pct !== null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success dark:text-success/80 bg-success/10 dark:bg-success/40 rounded-md px-1.5 py-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {pct > 0 ? '+' : ''}{pct}%
              </span>
            )}
          </div>
          {e.amountFrom && e.amount && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {fmtMoney(e.amountFrom)} → {fmtMoney(e.amount)}
            </p>
          )}
        </div>
      );
    }
    if (type === 'project') {
      return (
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-body-md font-medium text-foreground">{e.to}</p>
            {isFirst && !e.endDate && (
              <span className="text-helpertext-xs font-medium text-primary dark:text-primary/80 bg-primary/10 dark:bg-primary/40 rounded px-1.5 py-0.5">сейчас</span>
            )}
          </div>
          {e.from && <p className="text-[11px] text-muted-foreground">Клиент: {e.from}</p>}
          <p className="text-[11px] text-muted-foreground">
            {fmt(e.date)}{e.endDate ? ` — ${fmt(e.endDate)}` : ' — настоящее время'}
          </p>
        </div>
      );
    }
    return (
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-body-md font-medium text-foreground">{e.to}</p>
          {isFirst && !e.endDate && (
            <span className="text-helpertext-xs font-medium text-chart-3 dark:text-chart-3/80 bg-chart-3/10 dark:bg-chart-3/40 rounded px-1.5 py-0.5">сейчас</span>
          )}
        </div>
        {e.from && <p className="text-[11px] text-muted-foreground">Ранее: {e.from}</p>}
        <p className="text-[11px] text-muted-foreground">
          с {fmt(e.date)}{e.endDate ? ` по ${fmt(e.endDate)}` : ''}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
      {/* Header — clickable to collapse */}
      <button
        type="button"
        className="flex items-center justify-between w-full px-4 py-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pal.iconBg}`}>
            <meta.Icon className={`w-4 h-4 ${pal.iconText}`} />
          </div>
          <div>
            <h3 className="text-body-md font-semibold text-foreground">{meta.label}</h3>
            <span className="text-[11px] text-muted-foreground">{pluralRecords(events.length)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={e2 => { e2.stopPropagation(); onAdd(); }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-caption-sm">Добавить</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Events — collapsible */}
      {expanded && (
        <>
          {events.length === 0 ? (
            <div className="px-4 py-6 text-center border-t border-border/50">
              <p className="text-body-md text-muted-foreground">Нет записей</p>
              <p className="text-caption-sm text-muted-foreground/60 mt-1">Нажмите «+», чтобы внести первое изменение</p>
            </div>
          ) : (
            <div className="relative border-t border-border/50">
              <div ref={scrollRef} className="overflow-y-auto max-h-[320px] px-4 py-3">
                <div className="relative">
                  {/* Vertical line */}
                  <div className={`absolute left-[5px] top-2 bottom-2 w-0.5 rounded-full ${pal.line}`} />
                  <div className="space-y-0">
                    {events.map((e, i) => (
                      <div
                        key={e.id}
                        className={`relative pl-6 group py-2.5 ${i < events.length - 1 ? 'border-b border-border/50' : ''}`}
                      >
                        {/* Dot */}
                        <div
                          className={`absolute left-0 top-4 w-2.5 h-2.5 rounded-full border-2 transition-transform group-hover:scale-125 ${
                            i === 0 ? `${pal.dotFirst} scale-110` : `${pal.dot} bg-background`
                          }`}
                        />

                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-helpertext-xs rounded-md px-2 py-0.5 ${
                                i === 0 ? pal.dateBgFirst : 'bg-muted text-muted-foreground'
                              }`}>
                                <Calendar className="w-2.5 h-2.5 inline mr-1" />
                                {fmt(e.date)}
                              </span>
                            </div>
                            {renderDetail(e, i === 0)}
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
                                <TooltipContent side="top" className="text-caption-sm">Редактировать</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(e.id)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-caption-sm">Удалить</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Scroll fade indicator */}
              <div className={`sticky bottom-0 h-4 bg-gradient-to-t ${pal.scrollGradient} to-transparent pointer-events-none`} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ── Dynamics visualization ────────────────────────────── */
const DynamicsBlock: React.FC<{
  salary: HistoryEvent[];
  projects: HistoryEvent[];
  roles: HistoryEvent[];
}> = ({ salary, projects, roles }) => {
  const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

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

  const padMs = 30 * 24 * 60 * 60 * 1000;
  const tMin = minDate.getTime() - padMs;
  const tMax = maxDate.getTime() + padMs;
  const totalMs = tMax - tMin;

  const pct = (iso: string) => {
    const t = new Date(iso + 'T00:00:00').getTime();
    return ((t - tMin) / totalMs) * 100;
  };
  const pctTs = (ts: number) => ((ts - tMin) / totalMs) * 100;

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
      const prevY = salaryY(sortedSalary[i - 1].amount || 0);
      stepPath += ` L ${x} ${prevY} L ${x} ${y}`;
    }
    salaryPoints.push({ x, y, val: s.amount || 0, id: s.id, date: s.date });
  });
  if (sortedSalary.length > 0) {
    const lastY = salaryY(sortedSalary[sortedSalary.length - 1].amount || 0);
    const nowPct = pctTs(now.getTime());
    stepPath += ` L ${nowPct} ${lastY}`;
  }

  let fillPath = stepPath;
  if (sortedSalary.length > 0) {
    const nowPct = pctTs(now.getTime());
    const firstX = pct(sortedSalary[0].date);
    fillPath += ` L ${nowPct} ${TRACK_H} L ${firstX} ${TRACK_H} Z`;
  }

  const sortedProjects = [...projects].sort((a, b) => a.date.localeCompare(b.date));
  const sortedRoles = [...roles].sort((a, b) => a.date.localeCompare(b.date));
  const SEG_H = 36;
  const isHighlighted = (id: string) => hoveredMilestone === id;

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-body-md font-semibold text-foreground flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          Динамика сотрудника
        </h3>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="text-caption-sm max-w-[280px]">
              Единый timeline: зарплата как ступенчатая числовая динамика, проекты и роли как интервальные периоды.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="overflow-x-auto pb-2 -mx-5 px-5">
        <div className="relative" style={{ minWidth: 700 }}>
          {/* Grid lines */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            {gridLines.map((g, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-border/40" style={{ left: `${g.pct}%` }} />
            ))}
          </div>

          {/* Milestone markers */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
            {milestones.map(m => (
              <div
                key={`ml-${m.id}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${m.pct}%`,
                  borderLeft: '1px dashed',
                  borderColor: hoveredMilestone === m.id ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.15)',
                  opacity: hoveredMilestone === m.id ? 1 : 0.6,
                }}
              />
            ))}
          </div>

          <div className="space-y-1 relative" style={{ zIndex: 1 }}>
            {/* Track 1: Salary */}
            <div className="flex items-stretch">
              <div className="w-[80px] flex-shrink-0 flex items-center">
                <span className="text-[11px] font-medium text-success dark:text-success/80 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Зарплата
                </span>
              </div>
              <div className="flex-1 relative bg-muted/20 rounded border border-border/60" style={{ height: TRACK_H }}>
                <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox={`0 0 100 ${TRACK_H}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="salaryFillGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <path d={fillPath} fill="url(#salaryFillGrad)" />
                  <path d={stepPath} fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>

                {salaryPoints.map((pt) => (
                  <React.Fragment key={pt.id}>
                    <div
                      className={`absolute w-2.5 h-2.5 rounded-full border-2 border-success -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 ${
                        isHighlighted(pt.id) ? 'bg-success scale-150 shadow-lg shadow-emerald-500/30' : 'bg-background'
                      }`}
                      style={{ left: `${pt.x}%`, top: `${(pt.y / TRACK_H) * 100}%` }}
                      onMouseEnter={() => setHoveredMilestone(pt.id)}
                      onMouseLeave={() => setHoveredMilestone(null)}
                    />
                    <div
                      className="absolute -translate-x-1/2 pointer-events-none"
                      style={{ left: `${pt.x}%`, top: `${Math.max((pt.y / TRACK_H) * 100 - 22, 0)}%` }}
                    >
                      <span className={`text-[11px] font-bold whitespace-nowrap ${isHighlighted(pt.id) ? 'text-success dark:text-success/80' : 'text-foreground/80'}`}>
                        {fmtMoney(pt.val)}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Track 2: Projects */}
            <div className="flex items-stretch">
              <div className="w-[80px] flex-shrink-0 flex items-center">
                <span className="text-[11px] font-medium text-primary dark:text-primary/80 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Проекты
                </span>
              </div>
              <div className="flex-1 relative bg-primary/50 dark:bg-primary/20 rounded border border-primary/20 dark:border-primary/40" style={{ height: SEG_H }}>
                {sortedProjects.map((p) => {
                  const left = pct(p.date);
                  const right = p.endDate ? pct(p.endDate) : pctTs(now.getTime());
                  const width = Math.max(right - left, 0.5);
                  const highlighted = isHighlighted(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`absolute top-1 bottom-1 rounded-md flex items-center cursor-pointer bg-primary/80 dark:bg-primary/30 border border-primary/20 dark:border-primary/40 ${
                        highlighted ? 'ring-2 ring-primary shadow-md bg-primary/80 dark:bg-primary/40' : ''
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onMouseEnter={() => setHoveredMilestone(p.id)}
                      onMouseLeave={() => setHoveredMilestone(null)}
                    >
                      <span className={`text-helpertext-xs font-medium truncate px-2 ${highlighted ? 'text-primary dark:text-primary/70' : 'text-primary/70 dark:text-primary/70'}`}>
                        {p.to}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Roles */}
            <div className="flex items-stretch">
              <div className="w-[80px] flex-shrink-0 flex items-center">
                <span className="text-[11px] font-medium text-chart-3 dark:text-chart-3/80 flex items-center gap-1">
                  <User className="w-3 h-3" /> Роль
                </span>
              </div>
              <div className="flex-1 relative bg-chart-3/50 dark:bg-chart-3/20 rounded border border-chart-3/20 dark:border-chart-3/40" style={{ height: SEG_H }}>
                {sortedRoles.map((r) => {
                  const left = pct(r.date);
                  const right = r.endDate ? pct(r.endDate) : pctTs(now.getTime());
                  const width = Math.max(right - left, 0.5);
                  const highlighted = isHighlighted(r.id);
                  return (
                    <div
                      key={r.id}
                      className={`absolute top-1 bottom-1 rounded-md flex items-center cursor-pointer bg-chart-3/80 dark:bg-chart-3/30 border border-chart-3/20 dark:border-chart-3/40 ${
                        highlighted ? 'ring-2 ring-chart-3 shadow-md bg-chart-3/80 dark:bg-chart-3/40' : ''
                      }`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onMouseEnter={() => setHoveredMilestone(r.id)}
                      onMouseLeave={() => setHoveredMilestone(null)}
                    >
                      <span className={`text-helpertext-xs font-medium truncate px-2 ${highlighted ? 'text-chart-3 dark:text-chart-3/70' : 'text-chart-3/70 dark:text-chart-3/70'}`}>
                        {r.to}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time axis */}
          <div className="flex items-stretch mt-2">
            <div className="w-[80px] flex-shrink-0" />
            <div className="flex-1 relative h-5 border-t border-border/40">
              {gridLines.map((g, i) => (
                <div key={i} className="absolute flex flex-col items-center -translate-x-1/2" style={{ left: `${g.pct}%`, top: 0 }}>
                  <div className="w-px h-1.5 bg-border" />
                  <span className="text-helpertext-xs font-medium text-muted-foreground mt-0.5 whitespace-nowrap">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredMilestone && (() => {
        const m = milestones.find(x => x.id === hoveredMilestone);
        if (!m) return null;
        const typeLabel = m.type === 'salary' ? 'Зарплата' : m.type === 'project' ? 'Проект' : 'Роль';
        return (
          <div className="mt-3 px-3 py-2 bg-muted/50 border border-primary/20 rounded-md flex items-center gap-3 text-caption-sm transition-all">
            <Badge variant="outline" className="text-helpertext-xs gap-1">
              <Calendar className="w-2.5 h-2.5" />
              {fmt(m.date)}
            </Badge>
            <span className="text-muted-foreground">{typeLabel}:</span>
            <span className="font-medium text-foreground">{m.label}</span>
            {m.type === 'salary' && (() => {
              const ev = salary.find(s => s.id === m.id);
              return ev?.amount ? <span className="text-success dark:text-success/80 font-semibold">{fmtMoney(ev.amount)}</span> : null;
            })()}
          </div>
        );
      })()}
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

  const handleAdd = (type: EventType) => { setDialogType(type); setEditingEvent(null); setDialogOpen(true); };
  const handleEdit = (event: HistoryEvent) => { setDialogType(event.type); setEditingEvent(event); setDialogOpen(true); };
  const handleSave = (event: HistoryEvent) => {
    const list = getList(event.type);
    const exists = list.find(e => e.id === event.id);
    const updated = exists ? list.map(e => e.id === event.id ? event : e) : [event, ...list];
    setList(event.type, updated.sort((a, b) => b.date.localeCompare(a.date)));
  };
  const handleDelete = (type: EventType, id: string) => { setDeleteTarget({ type, id }); };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setList(deleteTarget.type, getList(deleteTarget.type).filter(e => e.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const showEmpty = salary.length === 0 && projects.length === 0 && roles.length === 0;

  return (
    <div className="mt-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <div className="space-y-5">
        {showEmpty ? (
          <div className="bg-card border border-border rounded-xl px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-body-md font-medium text-foreground">История изменений по сотруднику пока не заполнена</p>
            <p className="text-caption-sm text-muted-foreground mt-1">Добавьте первое событие, чтобы начать вести историю</p>
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <Button variant="outline" size="sm" className="text-caption-sm gap-1 rounded-lg" onClick={() => handleAdd('salary')}>
                <DollarSign className="w-3 h-3" /> Зарплата
              </Button>
              <Button variant="outline" size="sm" className="text-caption-sm gap-1 rounded-lg" onClick={() => handleAdd('project')}>
                <Briefcase className="w-3 h-3" /> Проект
              </Button>
              <Button variant="outline" size="sm" className="text-caption-sm gap-1 rounded-lg" onClick={() => handleAdd('role')}>
                <User className="w-3 h-3" /> Роль
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DynamicsBlock salary={salary} projects={projects} roles={roles} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <HistorySection type="salary" events={salary} onAdd={() => handleAdd('salary')} onEdit={handleEdit} onDelete={id => handleDelete('salary', id)} />
              <HistorySection type="project" events={projects} onAdd={() => handleAdd('project')} onEdit={handleEdit} onDelete={id => handleDelete('project', id)} />
              <HistorySection type="role" events={roles} onAdd={() => handleAdd('role')} onEdit={handleEdit} onDelete={id => handleDelete('role', id)} />
            </div>
          </>
        )}
      </div>

      <EmployeeHistoryEventDialog open={dialogOpen} onOpenChange={setDialogOpen} type={dialogType} event={editingEvent} onSave={handleSave} />

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-body-base">Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription className="text-body-md">Это действие нельзя отменить. Запись будет удалена из истории.</AlertDialogDescription>
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
