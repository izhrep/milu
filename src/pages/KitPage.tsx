import React, { useState } from 'react';
import { usePermission } from '@/hooks/usePermission';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Home, User, Bell, Settings, Search, Plus, Loader2,
  CheckSquare, TrendingUp, Users, Calendar, Activity, Database,
  Shield, X, ChevronDown, ChevronRight, Users2, CalendarCheck,
} from "@/components/icons";
import EmptyState from '@/components/visuals/EmptyState';
import logoExpanded from '@/assets/Logo_expanded.svg';
import miluLogo from '@/assets/milu-logo.png';
import ThemeEditor from '@/features/ThemeEditor/ThemeEditor';

/* ─── Section wrapper ─── */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
    <Separator />
    <div>{children}</div>
  </section>
);

/* ─── Semantic color tokens (Layer 2) ─── */
type ColorGroup = { group: string; tokens: { name: string; label: string }[] };

const COLOR_GROUPS: ColorGroup[] = [
  {
    group: 'Surface & Background',
    tokens: [
      { name: '--background', label: 'background' },
      { name: '--background-primary', label: 'background-primary' },
      { name: '--background-secondary', label: 'background-secondary' },
      { name: '--background-tertiary', label: 'background-tertiary' },
      { name: '--background-disabled', label: 'background-disabled' },
      { name: '--surface', label: 'surface' },
      { name: '--surface-secondary', label: 'surface-secondary' },
    ],
  },
  {
    group: 'Foreground & Text',
    tokens: [
      { name: '--foreground', label: 'foreground' },
      { name: '--foreground-primary', label: 'foreground-primary' },
      { name: '--foreground-secondary', label: 'foreground-secondary' },
      { name: '--foreground-disabled', label: 'foreground-disabled' },
      { name: '--text-primary', label: 'text-primary' },
      { name: '--text-secondary', label: 'text-secondary' },
      { name: '--text-tertiary', label: 'text-tertiary' },
      { name: '--text-muted', label: 'text-muted' },
      { name: '--text-inverse', label: 'text-inverse' },
      { name: '--text-accent', label: 'text-accent' },
    ],
  },
  {
    group: 'Brand',
    tokens: [
      { name: '--primary', label: 'primary' },
      { name: '--primary-foreground', label: 'primary-fg' },
      { name: '--brand-primary', label: 'brand-primary' },
      { name: '--brand-primary-foreground', label: 'brand-primary-fg' },
      { name: '--brand-accent', label: 'brand-accent' },
      { name: '--brand-accent-foreground', label: 'brand-accent-fg' },
      { name: '--brand-navy', label: 'brand-navy' },
      { name: '--brand-navy-light', label: 'brand-navy-light' },
      { name: '--brand-navy-dark', label: 'brand-navy-dark' },
      { name: '--brand-teal', label: 'brand-teal' },
      { name: '--brand-teal-foreground', label: 'brand-teal-fg' },
    ],
  },
  {
    group: 'Status',
    tokens: [
      { name: '--success', label: 'success' },
      { name: '--success-foreground', label: 'success-fg' },
      { name: '--warning', label: 'warning' },
      { name: '--warning-foreground', label: 'warning-fg' },
      { name: '--error', label: 'error' },
      { name: '--error-foreground', label: 'error-fg' },
      { name: '--destructive', label: 'destructive' },
      { name: '--info', label: 'info' },
    ],
  },
  {
    group: 'Structure & Static',
    tokens: [
      { name: '--border', label: 'border' },
      { name: '--border-2', label: 'border-2' },
      { name: '--divider', label: 'divider' },
      { name: '--input', label: 'input' },
      { name: '--ring', label: 'ring' },
      { name: '--static-white', label: 'static-white' },
      { name: '--static-black', label: 'static-black' },
      { name: '--towhite', label: 'towhite' },
      { name: '--primitive', label: 'primitive' },
    ],
  },
  {
    group: 'shadcn Compatibility',
    tokens: [
      { name: '--card', label: 'card' },
      { name: '--card-foreground', label: 'card-fg' },
      { name: '--popover', label: 'popover' },
      { name: '--popover-foreground', label: 'popover-fg' },
      { name: '--muted', label: 'muted' },
      { name: '--muted-foreground', label: 'muted-fg' },
      { name: '--accent', label: 'accent' },
      { name: '--accent-foreground', label: 'accent-fg' },
      { name: '--secondary', label: 'secondary' },
      { name: '--secondary-foreground', label: 'secondary-fg' },
    ],
  },
  {
    group: 'Sidebar',
    tokens: [
      { name: '--sidebar-background', label: 'sidebar-bg' },
      { name: '--sidebar-foreground', label: 'sidebar-fg' },
      { name: '--sidebar-primary', label: 'sidebar-primary' },
      { name: '--sidebar-accent', label: 'sidebar-accent' },
      { name: '--sidebar-border', label: 'sidebar-border' },
      { name: '--sidebar-muted', label: 'sidebar-muted' },
    ],
  },
];

/* ─── Layer 1 primitives (RAKETA Foundations) ─── */
const FOUNDATIONS_GROUPS: ColorGroup[] = [
  {
    group: 'Slate (neutral)',
    tokens: [
      { name: '--slate-50', label: 'slate-50' },
      { name: '--slate-100', label: 'slate-100' },
      { name: '--slate-200', label: 'slate-200' },
      { name: '--slate-300', label: 'slate-300' },
      { name: '--slate-400', label: 'slate-400' },
      { name: '--slate-500', label: 'slate-500' },
      { name: '--slate-600', label: 'slate-600' },
      { name: '--slate-700', label: 'slate-700' },
      { name: '--slate-800', label: 'slate-800' },
      { name: '--slate-900', label: 'slate-900' },
      { name: '--slate-950', label: 'slate-950' },
    ],
  },
  {
    group: 'Navy (brand)',
    tokens: [
      { name: '--navy-50', label: 'navy-50' },
      { name: '--navy-100', label: 'navy-100' },
      { name: '--navy-300', label: 'navy-300' },
      { name: '--navy-500', label: 'navy-500' },
      { name: '--navy-700', label: 'navy-700' },
      { name: '--navy-900', label: 'navy-900' },
    ],
  },
  {
    group: 'Teal (accent)',
    tokens: [
      { name: '--teal-300', label: 'teal-300' },
      { name: '--teal-500', label: 'teal-500' },
      { name: '--teal-700', label: 'teal-700' },
    ],
  },
  {
    group: 'Brown (warm neutral)',
    tokens: [
      { name: '--brown-50', label: 'brown-50' },
      { name: '--brown-100', label: 'brown-100' },
      { name: '--brown-200', label: 'brown-200' },
    ],
  },
  {
    group: 'Crimson (error scale)',
    tokens: [
      { name: '--crimson-50', label: 'crimson-50' },
      { name: '--crimson-100', label: 'crimson-100' },
      { name: '--crimson-500', label: 'crimson-500' },
      { name: '--crimson-800', label: 'crimson-800' },
    ],
  },
  {
    group: 'Green (success scale)',
    tokens: [
      { name: '--green-50', label: 'green-50' },
      { name: '--green-500', label: 'green-500' },
    ],
  },
  {
    group: 'Egg (warning accent)',
    tokens: [
      { name: '--egg-400', label: 'egg-400' },
    ],
  },
  {
    group: 'Base',
    tokens: [
      { name: '--white', label: 'white' },
      { name: '--black', label: 'black' },
    ],
  },
];

const ColorSwatch = ({ name, label }: { name: string; label: string }) => {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2">
      <div
        className="h-10 w-10 shrink-0 rounded-md border border-border"
        style={{ backgroundColor: `hsl(${hsl})` }}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{hsl || '—'}</p>
      </div>
    </div>
  );
};

/* ─── Page ─── */
const KitPage = () => {
  const { hasPermission, isLoading } = usePermission('security.view_admin_panel');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [motionKey, setMotionKey] = useState<Record<string, number>>({});

  const replay = (name: string) => setMotionKey(prev => ({ ...prev, [name]: (prev[name] || 0) + 1 }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Milu Design System</h1>
        <p className="mt-2 text-lg text-muted-foreground">Витрина компонентов</p>
      </div>

      {/* Theme Editor — встроенный конструктор темы (только для admin) */}
      {hasPermission && <ThemeEditor />}

      {/* ─── Colors ─── */}
      {/* ─── Brand ─── */}
      <Section title="Brand">
        <div className="space-y-6">
          {/* Logo sizes */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Logo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-xs text-muted-foreground">На светлом фоне (PNG)</p>
                  <div className="flex items-end gap-4 p-4 rounded-md bg-background border border-border">
                    {[24, 48, 96].map(s => (
                      <div key={s} className="flex flex-col items-center gap-1">
                        <img src={miluLogo} alt="Milu logo" style={{ height: s }} />
                        <span className="text-xs text-muted-foreground">{s}px</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <p className="text-xs text-muted-foreground">На тёмном фоне (SVG)</p>
                   <div className="flex items-end gap-4 p-4 rounded-md bg-brand-navy-dark">
                    {[24, 48, 96].map(s => (
                      <div key={s} className="flex flex-col items-center gap-1">
                        <img src={logoExpanded} alt="Milu logo expanded" style={{ height: s }} />
                        <span className="text-xs text-sidebar-foreground/60">{s}px</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          {/* Brand color in context */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Brand color in context</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-md border border-border bg-background p-6 flex items-center justify-center">
                <span className="text-brand-primary font-semibold">--brand-primary на --background</span>
              </div>
              <div className="rounded-md border border-border bg-surface p-6 flex items-center justify-center">
                <span className="text-brand-primary font-semibold">--brand-primary на --surface</span>
              </div>
              <div className="rounded-md bg-sidebar-background p-6 flex items-center justify-center">
                <span className="text-brand-primary font-semibold">--brand-primary на тёмном</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Foundations (Layer 1 primitives) ─── */}
      <Section title="Foundations">
        <div className="space-y-6">
          {FOUNDATIONS_GROUPS.map(g => (
            <div key={g.group}>
              <p className="text-sm font-medium text-muted-foreground mb-3">{g.group}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {g.tokens.map(t => (
                  <ColorSwatch key={t.name} name={t.name} label={t.label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Colors (Layer 2 semantic) ─── */}
      <Section title="Colors">
        <div className="space-y-6">
          {COLOR_GROUPS.map(g => (
            <div key={g.group}>
              <p className="text-sm font-medium text-muted-foreground mb-3">{g.group}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {g.tokens.map(t => (
                  <ColorSwatch key={t.name} name={t.name} label={t.label} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Typography ─── */}
      <Section title="Typography">
        <div className="space-y-8">

          {/* Существующие Tailwind defaults */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Tailwind defaults</p>
            <div className="space-y-4">
              <div><h1 className="text-4xl font-bold tracking-tight text-foreground">h1 — Heading 1</h1><p className="text-xs text-muted-foreground">text-4xl font-bold</p></div>
              <div><h2 className="text-3xl font-semibold tracking-tight text-foreground">h2 — Heading 2</h2><p className="text-xs text-muted-foreground">text-3xl font-semibold</p></div>
              <div><h3 className="text-2xl font-semibold tracking-tight text-foreground">h3 — Heading 3</h3><p className="text-xs text-muted-foreground">text-2xl font-semibold</p></div>
              <div><h4 className="text-xl font-semibold tracking-tight text-foreground">h4 — Heading 4</h4><p className="text-xs text-muted-foreground">text-xl font-semibold</p></div>
              <div><p className="text-base text-foreground">p — Body text. Основной текст параграфа с нормальным размером шрифта.</p><p className="text-xs text-muted-foreground">text-base</p></div>
              <div><small className="text-sm text-muted-foreground">small — Вспомогательный текст, подписи, caption.</small><p className="text-xs text-muted-foreground">text-sm text-muted-foreground</p></div>
            </div>
          </div>

          {/* RAKETA responsive scale — меняется на брейкпоинтах 768px и 1024px */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">
              RAKETA responsive scale (Mobile / Tablet ≥768px / Desktop ≥1024px)
            </p>
            <div className="space-y-4">
              <div>
                <div className="text-display font-display font-bold text-foreground">Display — Aa</div>
                <p className="text-xs text-muted-foreground">text-display font-display font-bold · 48 / 60 / 72px</p>
              </div>
              <div>
                <div className="text-heading-1 font-display font-bold text-foreground">Heading 1 — Aa</div>
                <p className="text-xs text-muted-foreground">text-heading-1 font-display font-bold · 40 / 48 / 60px</p>
              </div>
              <div>
                <div className="text-heading-2 font-display font-semibold text-foreground">Heading 2 — Aa</div>
                <p className="text-xs text-muted-foreground">text-heading-2 font-display font-semibold · 32 / 40 / 48px</p>
              </div>
              <div>
                <div className="text-heading-3 font-display font-semibold text-foreground">Heading 3 — Aa</div>
                <p className="text-xs text-muted-foreground">text-heading-3 font-display font-semibold · 24 / 32 / 32px</p>
              </div>
              <div>
                <div className="text-heading-4 font-display font-semibold text-foreground">Heading 4 — Aa</div>
                <p className="text-xs text-muted-foreground">text-heading-4 font-display font-semibold · 20 / 24 / 24px</p>
              </div>
              <div>
                <div className="text-body-lg font-text text-foreground">Body Large — основной текст крупный.</div>
                <p className="text-xs text-muted-foreground">text-body-lg font-text · 18 / 18 / 20px</p>
              </div>
              <div>
                <div className="text-body-base font-text text-foreground">Body Base — основной текст параграфа.</div>
                <p className="text-xs text-muted-foreground">text-body-base font-text · 16 / 16 / 18px</p>
              </div>
              <div>
                <div className="text-body-md font-text text-foreground">Body Medium — вторичный текст.</div>
                <p className="text-xs text-muted-foreground">text-body-md font-text · 14 / 14 / 16px</p>
              </div>
              <div>
                <div className="text-caption-sm font-text text-muted-foreground">Caption — подпись, метаинформация.</div>
                <p className="text-xs text-muted-foreground">text-caption-sm font-text · 12 / 12 / 14px</p>
              </div>
              <div>
                <div className="text-helpertext-xs font-text text-muted-foreground">Helper — самый мелкий вспомогательный текст.</div>
                <p className="text-xs text-muted-foreground">text-helpertext-xs font-text · 10 / 10 / 12px</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Buttons ─── */}
      {/* ─── Iconography ─── */}
      <Section title="Iconography">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
          {([
            { Icon: Home, name: 'Home', hint: 'главная' },
            { Icon: User, name: 'User', hint: 'профиль' },
            { Icon: CheckSquare, name: 'CheckSquare', hint: 'задачи' },
            { Icon: TrendingUp, name: 'TrendingUp', hint: 'карьера' },
            { Icon: Users, name: 'Users', hint: '360 feedback' },
            { Icon: Calendar, name: 'Calendar', hint: 'встречи' },
            { Icon: Activity, name: 'Activity', hint: 'диагностика' },
            { Icon: Database, name: 'Database', hint: 'справочники' },
            { Icon: Shield, name: 'Shield', hint: 'безопасность' },
            { Icon: Settings, name: 'Settings', hint: 'настройки' },
            { Icon: Bell, name: 'Bell', hint: 'уведомления' },
            { Icon: Search, name: 'Search', hint: 'поиск' },
            { Icon: Plus, name: 'Plus', hint: 'добавить' },
            { Icon: X, name: 'X', hint: 'закрыть' },
            { Icon: ChevronDown, name: 'ChevronDown', hint: 'раскрыть' },
            { Icon: ChevronRight, name: 'ChevronRight', hint: 'далее' },
          ] as const).map(({ Icon, name, hint }) => (
            <div key={name} className="flex flex-col items-center gap-1 p-3 rounded-md border border-border bg-card text-center">
              <Icon className="h-6 w-6 text-foreground" />
              <span className="text-xs font-medium text-foreground">{name}</span>
              <span className="text-[10px] text-muted-foreground">{hint}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Buttons ─── */}
      <Section title="Buttons">
        <div className="space-y-6">
          {/* Variants */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Variants</p>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button variant="brand">Brand</Button>
              <Button variant="accent">Accent</Button>
              <Button variant="teal">Teal</Button>
              <Button variant="success">Success</Button>
            </div>
          </div>
          {/* Sizes */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Sizes</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
              <Button size="icon"><Home className="h-4 w-4" /></Button>
              <Button size="icon-sm"><Home className="h-4 w-4" /></Button>
              <Button size="icon-lg"><Home className="h-5 w-5" /></Button>
            </div>
          </div>
          {/* States */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">States</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
              <Button loading loadingText="Сохранение…">Save</Button>
              <Button leftIcon={<Plus className="h-4 w-4" />}>С иконкой</Button>
              <Button rightIcon={<Settings className="h-4 w-4" />}>Настройки</Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Inputs ─── */}
      <Section title="Inputs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
          <div className="space-y-2">
            <Label>Text Input</Label>
            <Input placeholder="Введите текст…" />
          </div>
          <div className="space-y-2">
            <Label>Disabled Input</Label>
            <Input placeholder="Заблокировано" disabled />
          </div>
          <div className="space-y-2">
            <Label>Textarea</Label>
            <Textarea placeholder="Многострочный ввод…" />
          </div>
          <div className="space-y-2">
            <Label>Select</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Выберите опцию" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Опция A</SelectItem>
                <SelectItem value="b">Опция B</SelectItem>
                <SelectItem value="c">Опция C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Checkbox id="kit-cb" />
              <Label htmlFor="kit-cb">Checkbox</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="kit-sw" />
              <Label htmlFor="kit-sw">Switch</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Radio Group</Label>
            <RadioGroup defaultValue="opt1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="opt1" id="r1" />
                <Label htmlFor="r1">Вариант 1</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="opt2" id="r2" />
                <Label htmlFor="r2">Вариант 2</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Section>

      {/* ─── Cards ─── */}
      <Section title="Cards">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Простая карточка</CardTitle>
              <CardDescription>Описание карточки с базовым стилем.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-foreground">Контент карточки.</p></CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>С действием</CardTitle>
              <CardDescription>Карточка с кнопкой в footer.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-foreground">Основной блок информации.</p></CardContent>
            <CardFooter><Button size="sm">Действие</Button></CardFooter>
          </Card>
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-primary-foreground">Акцентная</CardTitle>
              <CardDescription className="text-primary-foreground/70">Карточка с акцентным фоном.</CardDescription>
            </CardHeader>
            <CardContent><p className="text-sm text-primary-foreground/90">Контрастный контент.</p></CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Radius ─── */}
      <Section title="Radius">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {[
            { cls: 'rounded-none', label: 'none · 0px' },
            { cls: 'rounded-xs',   label: 'xs · 4px' },
            { cls: 'rounded-sm',   label: 'sm · 8px' },
            { cls: 'rounded-md',   label: 'md · 12px' },
            { cls: 'rounded-lg',   label: 'lg · 16px' },
            { cls: 'rounded-xl',   label: 'xl · 20px' },
            { cls: 'rounded-2xl',  label: '2xl · 24px' },
            { cls: 'rounded-full', label: 'full · 9999px' },
          ].map(r => (
            <div key={r.cls} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-16 bg-primary ${r.cls}`} />
              <p className="text-xs text-muted-foreground text-center">{r.label}</p>
              <code className="text-[10px] text-muted-foreground">{r.cls}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Border-width ─── */}
      <Section title="Border-width">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { cls: 'border-1', label: 'border-1 · 1px' },
            { cls: 'border-2', label: 'border-2 · 2px' },
            { cls: 'border-6', label: 'border-6 · 6px' },
            { cls: 'border-8', label: 'border-8 · 8px' },
          ].map(b => (
            <div key={b.cls} className="flex flex-col items-center gap-2">
              <div className={`h-16 w-24 bg-surface border-primary rounded-md ${b.cls}`} />
              <code className="text-xs text-muted-foreground">{b.label}</code>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Visuals ─── */}
      <Section title="Visuals">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="Нет задач"
                description="Когда задачи появятся, они будут здесь"
                action={<Button variant="brand" size="sm"><Plus className="h-4 w-4 mr-1" />Создать задачу</Button>}
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                title="Всё выполнено"
                description="Отличная работа — все задачи завершены!"
                illustration={
                  <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-brand-primary/40">
                    <circle cx="80" cy="80" r="70" fill="currentColor" />
                    <path d="M55 82L72 99L105 66" stroke="hsl(var(--background))" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Dialogs & Sheets ─── */}
      {/* ─── Layout ─── */}
      <Section title="Layout">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sidebar preview */}
          <Card>
            <CardHeader><CardTitle>Sidebar Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="w-[240px] h-[400px] rounded-md bg-sidebar-background text-sidebar-foreground overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-sidebar-border/20">
                  <img src={logoExpanded} alt="Milu" className="h-5 w-auto" />
                </div>
                <div className="flex-1 px-2 py-2 space-y-0.5 overflow-auto text-sm">
                  {[
                    { Icon: Home, label: 'Главная', active: true },
                    { Icon: User, label: 'Профиль' },
                    { Icon: CheckSquare, label: 'Мои задачи' },
                    { Icon: Users, label: 'Обратная связь 360' },
                    { Icon: Calendar, label: 'Встречи 1:1' },
                    { Icon: CalendarCheck, label: 'Мониторинг встреч' },
                    { Icon: Users2, label: 'Моя команда' },
                    { Icon: Activity, label: 'Мониторинг диагностики' },
                    { Icon: Database, label: 'Справочники' },
                    { Icon: Shield, label: 'Безопасность' },
                  ].map(({ Icon, label, active }) => (
                    <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-md ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/80'}`}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Header preview */}
          <Card>
            <CardHeader><CardTitle>Header Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="w-full max-w-[800px] h-14 rounded-md bg-card border border-border flex items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <img src={miluLogo} alt="Milu" className="h-6" />
                  <span className="text-sm font-semibold text-foreground">Milu Platform</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon-sm"><Search className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon-sm"><Bell className="h-4 w-4" /></Button>
                  <Avatar className="h-8 w-8"><AvatarFallback>U</AvatarFallback></Avatar>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* ─── Dialogs & Sheets ─── */}
      <Section title="Dialogs & Sheets">
        <div className="flex flex-wrap gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Открыть Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Заголовок диалога</DialogTitle>
                <DialogDescription>Описание действия, которое пользователь собирается выполнить.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-foreground">Контент диалога.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
                <Button onClick={() => setDialogOpen(false)}>Подтвердить</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Открыть Sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Боковая панель</SheetTitle>
                <SheetDescription>Дополнительная информация или форма.</SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <p className="text-sm text-foreground">Содержимое панели.</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </Section>

      {/* ─── Table ─── */}
      <Section title="Tables">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { name: 'Иван Петров', position: 'Разработчик', status: 'Активен' },
                { name: 'Мария Сидорова', position: 'Дизайнер', status: 'В отпуске' },
                { name: 'Алексей Козлов', position: 'Менеджер', status: 'Активен' },
              ].map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>{row.position}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'Активен' ? 'success' : 'warning'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Ред.</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      {/* ─── Tabs ─── */}
      <Section title="Tabs">
        <Tabs defaultValue="tab1" className="max-w-lg">
          <TabsList>
            <TabsTrigger value="tab1">Обзор</TabsTrigger>
            <TabsTrigger value="tab2">Аналитика</TabsTrigger>
            <TabsTrigger value="tab3">Настройки</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="mt-4">
            <p className="text-sm text-foreground">Содержимое первой вкладки.</p>
          </TabsContent>
          <TabsContent value="tab2" className="mt-4">
            <p className="text-sm text-foreground">Содержимое второй вкладки с аналитикой.</p>
          </TabsContent>
          <TabsContent value="tab3" className="mt-4">
            <p className="text-sm text-foreground">Настройки приложения.</p>
          </TabsContent>
        </Tabs>
      </Section>

      {/* ─── Badges & Avatars ─── */}
      <Section title="Badges & Avatars">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Badge Variants</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="teal">Teal</Badge>
              <Badge variant="navy">Navy</Badge>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Avatars</p>
            <div className="flex items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback>ИП</AvatarFallback>
              </Avatar>
              <Avatar className="h-10 w-10">
                <AvatarFallback>МС</AvatarFallback>
              </Avatar>
              <Avatar className="h-12 w-12">
                <AvatarFallback>АК</AvatarFallback>
              </Avatar>
              <Avatar className="h-16 w-16">
                <AvatarImage src="https://i.pravatar.cc/64?u=kit" alt="Аватар" />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </Section>

      {/* ─── Toasts ─── */}
      {/* ─── Spacing & Motion ─── */}
      <Section title="Spacing & Motion">
        <div className="space-y-8">
          {/* Spacing */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Spacing</p>
            <div className="space-y-2">
              {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map(size => (
                <div key={size} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 text-right">--spacing-{size}</span>
                  <div className="h-4 rounded bg-brand-primary" style={{ width: `var(--spacing-${size})` }} />
                </div>
              ))}
            </div>
          </div>
          {/* Radius */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Border Radius</p>
            <div className="flex flex-wrap gap-4">
              {([
                { cls: 'rounded-sm', label: 'sm' },
                { cls: 'rounded-md', label: 'md' },
                { cls: 'rounded-lg', label: 'lg' },
                { cls: 'rounded-xl', label: 'xl' },
              ] as const).map(({ cls, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`h-16 w-16 border-2 border-brand-primary bg-muted ${cls}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Shadow */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Shadows</p>
            <div className="flex flex-wrap gap-4">
              {([
                { cls: 'shadow-sm', label: 'sm' },
                { cls: 'shadow-md', label: 'md' },
                { cls: 'shadow-lg', label: 'lg' },
                { cls: 'shadow-card', label: 'card' },
              ] as const).map(({ cls, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`h-16 w-16 rounded-md bg-card border border-border ${cls}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Motion */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-3">Motion</p>
            <div className="flex flex-wrap gap-4">
              {([
                { name: 'fade-in', animation: 'fadeIn 0.5s ease-out forwards' },
                { name: 'scale-in', animation: 'scaleIn 0.4s ease-out forwards' },
                { name: 'slide-in-up', animation: 'slideInUp 0.4s ease-out forwards' },
              ] as const).map(({ name, animation }) => (
                <div key={name} className="flex flex-col items-center gap-2">
                  <div
                    key={motionKey[name] || 0}
                    className="h-12 w-12 rounded-md bg-brand-primary"
                    style={{ animation }}
                  />
                  <Button variant="outline" size="sm" onClick={() => replay(name)}>{name}</Button>
                </div>
              ))}
            </div>
            <style>{`
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
              @keyframes slideInUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
          </div>
        </div>
      </Section>

      {/* ─── Toasts ─── */}
      <Section title="Toasts">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast('Обычное уведомление')}>Toast</Button>
          <Button variant="outline" onClick={() => toast.success('Операция выполнена')}>Success</Button>
          <Button variant="outline" onClick={() => toast.error('Произошла ошибка')}>Error</Button>
          <Button variant="outline" onClick={() => toast('Событие создано', { description: 'Понедельник, 5 мая в 18:00' })}>С описанием</Button>
        </div>
      </Section>
    </div>
  );
};

export default KitPage;