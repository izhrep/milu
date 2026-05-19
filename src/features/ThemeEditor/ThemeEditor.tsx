import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { RotateCcw, Copy, Download, Bookmark, Copy as CopyIcon, Pencil, Trash2, Plus, Check, Undo2, Redo2 } from "@/components/icons";
import {
  applyOverridesToDom,
  loadOverridesFromStorage,
  saveOverridesToStorage,
  emptyOverrides,
  buildTypographyClassRulesPublic,
  STORAGE_KEY,
  type ThemeMode,
  type ThemeOverrides,
} from './themeOverrides';

type ColorToken = { name: string; label: string };
type ColorGroup = { title: string; tokens: ColorToken[] };

const COLOR_GROUPS: ColorGroup[] = [
  {
    title: 'Surface & Foreground',
    tokens: [
      { name: '--background', label: 'Background' },
      { name: '--foreground', label: 'Foreground' },
      { name: '--surface', label: 'Surface' },
      { name: '--surface-secondary', label: 'Surface Secondary' },
      { name: '--card', label: 'Card' },
      { name: '--popover', label: 'Popover' },
      { name: '--muted', label: 'Muted' },
    ],
  },
  {
    title: 'Primary & Accent',
    tokens: [
      { name: '--primary', label: 'Primary' },
      { name: '--primary-foreground', label: 'Primary FG' },
      { name: '--accent', label: 'Accent' },
      { name: '--accent-foreground', label: 'Accent FG' },
      { name: '--secondary', label: 'Secondary' },
    ],
  },
  {
    title: 'Brand (Milu)',
    tokens: [
      { name: '--brand-navy', label: 'Brand Navy' },
      { name: '--brand-teal', label: 'Brand Teal' },
      { name: '--brand-primary', label: 'Brand Primary' },
      { name: '--brand-accent', label: 'Brand Accent' },
      { name: '--accent-orange', label: 'Accent Orange' },
    ],
  },
  {
    title: 'Status',
    tokens: [
      { name: '--success', label: 'Success' },
      { name: '--warning', label: 'Warning' },
      { name: '--error', label: 'Error' },
    ],
  },
  {
    title: 'Structure',
    tokens: [
      { name: '--border', label: 'Border' },
      { name: '--ring', label: 'Ring' },
      { name: '--divider', label: 'Divider' },
    ],
  },
  {
    title: 'Sidebar',
    tokens: [
      { name: '--sidebar-background', label: 'Sidebar BG' },
      { name: '--sidebar-foreground', label: 'Sidebar FG' },
      { name: '--sidebar-primary', label: 'Sidebar Primary' },
      { name: '--sidebar-accent', label: 'Sidebar Accent' },
    ],
  },
];

const FONT_OPTIONS = ['Rubik', 'Inter', 'Plus Jakarta Sans', 'SF Pro', 'Source Serif 4', 'system-ui'];

/* Typography per-type registry */
type TypoToken = {
  sizeVar: string;
  weightVar: string;
  leadingVar: string;
  familyVar: string;
  label: string;
  sampleClass: string;
  defaultSize: number;
};

const DISPLAY_TYPOS: TypoToken[] = [
  { sizeVar: '--text-display',   weightVar: '--font-weight-display',   leadingVar: '--leading-display',   familyVar: '--font-family-display',   label: 'Display',   sampleClass: 'text-display',   defaultSize: 48 },
  { sizeVar: '--text-heading-1', weightVar: '--font-weight-heading-1', leadingVar: '--leading-heading-1', familyVar: '--font-family-heading-1', label: 'Heading 1', sampleClass: 'text-heading-1', defaultSize: 40 },
  { sizeVar: '--text-heading-2', weightVar: '--font-weight-heading-2', leadingVar: '--leading-heading-2', familyVar: '--font-family-heading-2', label: 'Heading 2', sampleClass: 'text-heading-2', defaultSize: 32 },
  { sizeVar: '--text-heading-3', weightVar: '--font-weight-heading-3', leadingVar: '--leading-heading-3', familyVar: '--font-family-heading-3', label: 'Heading 3', sampleClass: 'text-heading-3', defaultSize: 24 },
  { sizeVar: '--text-heading-4', weightVar: '--font-weight-heading-4', leadingVar: '--leading-heading-4', familyVar: '--font-family-heading-4', label: 'Heading 4', sampleClass: 'text-heading-4', defaultSize: 20 },
];

const BODY_TYPOS: TypoToken[] = [
  { sizeVar: '--text-body-lg',       weightVar: '--font-weight-body-lg',       leadingVar: '--leading-body-lg',       familyVar: '--font-family-body-lg',       label: 'Body Large',  sampleClass: 'text-body-lg',       defaultSize: 18 },
  { sizeVar: '--text-body-base',     weightVar: '--font-weight-body-base',     leadingVar: '--leading-body-base',     familyVar: '--font-family-body-base',     label: 'Body Base',   sampleClass: 'text-body-base',     defaultSize: 16 },
  { sizeVar: '--text-body-md',       weightVar: '--font-weight-body-md',       leadingVar: '--leading-body-md',       familyVar: '--font-family-body-md',       label: 'Body Medium', sampleClass: 'text-body-md',       defaultSize: 14 },
  { sizeVar: '--text-caption-sm',    weightVar: '--font-weight-caption-sm',    leadingVar: '--leading-caption-sm',    familyVar: '--font-family-caption-sm',    label: 'Caption',     sampleClass: 'text-caption-sm',    defaultSize: 12 },
  { sizeVar: '--text-helpertext-xs', weightVar: '--font-weight-helpertext-xs', leadingVar: '--leading-helpertext-xs', familyVar: '--font-family-helpertext-xs', label: 'Helper',      sampleClass: 'text-helpertext-xs', defaultSize: 10 },
];

const WEIGHT_OPTIONS: { value: string; label: string }[] = [
  { value: '300', label: 'Light (300)' },
  { value: '400', label: 'Regular (400)' },
  { value: '500', label: 'Medium (500)' },
  { value: '600', label: 'Semibold (600)' },
  { value: '700', label: 'Bold (700)' },
  { value: '800', label: 'Extrabold (800)' },
];

const FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: 'var(--font-display)', label: 'Display (global)' },
  { value: 'var(--font-text)',    label: 'Text (global)' },
  { value: "'Rubik', system-ui, sans-serif",              label: 'Rubik' },
  { value: "'Inter', system-ui, sans-serif",              label: 'Inter' },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif",  label: 'Plus Jakarta Sans' },
  { value: "'SF Pro', system-ui, sans-serif",             label: 'SF Pro' },
  { value: "'Source Serif 4', serif",                     label: 'Source Serif 4' },
  { value: 'system-ui, sans-serif',                       label: 'system-ui' },
];

function hexToHslString(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const cmax = Math.max(r, g, b);
  const cmin = Math.min(r, g, b);
  const delta = cmax - cmin;
  const l = (cmax + cmin) / 2;
  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslStringToHex(hsl: string): string {
  const m = hsl.trim().match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!m) return '#000000';
  const [, hStr, sStr, lStr] = m;
  const h = parseFloat(hStr);
  const s = parseFloat(sStr) / 100;
  const l = parseFloat(lStr) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* ============================================
   Color space converters: OKLCH → HSL
   ============================================ */

function oklchToHslString(L: number, C: number, hDeg: number): string {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  const toSrgb = (c: number) =>
    c <= 0 ? 0 : c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  r = Math.max(0, Math.min(1, toSrgb(r)));
  g = Math.max(0, Math.min(1, toSrgb(g)));
  bb = Math.max(0, Math.min(1, toSrgb(bb)));

  const cmax = Math.max(r, g, bb);
  const cmin = Math.min(r, g, bb);
  const delta = cmax - cmin;
  const lHsl = (cmax + cmin) / 2;
  let hHsl = 0;
  let sHsl = 0;
  if (delta !== 0) {
    sHsl = lHsl === 0 || lHsl === 1 ? 0 : delta / (1 - Math.abs(2 * lHsl - 1));
    if (cmax === r) hHsl = ((g - bb) / delta) % 6;
    else if (cmax === g) hHsl = (bb - r) / delta + 2;
    else hHsl = (r - g) / delta + 4;
    hHsl *= 60;
    if (hHsl < 0) hHsl += 360;
  }
  return `${Math.round(hHsl)} ${Math.round(sHsl * 100)}% ${Math.round(lHsl * 100)}%`;
}

function colorValueToHsl(value: string): string | null {
  const v = value.trim();

  const oklchMatch = v.match(/oklch\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+(-?[\d.]+)/i);
  if (oklchMatch) {
    return oklchToHslString(
      parseFloat(oklchMatch[1]),
      parseFloat(oklchMatch[2]),
      parseFloat(oklchMatch[3]),
    );
  }

  const hslMatch = v.match(/hsl\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (hslMatch) {
    return `${Math.round(parseFloat(hslMatch[1]))} ${Math.round(parseFloat(hslMatch[2]))}% ${Math.round(parseFloat(hslMatch[3]))}%`;
  }

  const rawHsl = v.match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (rawHsl) {
    return `${Math.round(parseFloat(rawHsl[1]))} ${Math.round(parseFloat(rawHsl[2]))}% ${Math.round(parseFloat(rawHsl[3]))}%`;
  }

  const hexMatch = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1].length === 3
      ? `#${hexMatch[1][0]}${hexMatch[1][0]}${hexMatch[1][1]}${hexMatch[1][1]}${hexMatch[1][2]}${hexMatch[1][2]}`
      : `#${hexMatch[1]}`;
    return hexToHslString(hex);
  }

  return null;
}

function parseCssBlock(css: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const blockRegex = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\}`, 'i');
  const blockMatch = css.match(blockRegex);
  if (!blockMatch) return out;
  const body = blockMatch[1];
  const declRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = declRegex.exec(body)) !== null) {
    out[`--${m[1]}`] = m[2].trim();
  }
  return out;
}

const IMPORTABLE_COLOR_TOKENS = new Set(
  COLOR_GROUPS.flatMap(g => g.tokens.map(t => t.name)),
);

const IMPORTABLE_NON_COLOR = new Set([
  '--radius',
  '--font-sans', '--font-serif', '--font-mono',
  '--shadow-sm', '--shadow-card', '--shadow-md', '--shadow-lg', '--shadow-xl', '--shadow-2xl', '--shadow-xs', '--shadow-2xs',
]);

function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ============================================
   Presets
   ============================================ */

type Preset = {
  id: string;
  name: string;
  overrides: ThemeOverrides;
  createdAt: number;
  updatedAt: number;
};

const PRESETS_STORAGE_KEY = 'milu-theme-presets-v1';
const ACTIVE_PRESET_KEY = 'milu-theme-active-preset-v1';

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {}
}

function generateId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ThemeEditor() {
  const { resolvedTheme, setTheme } = useTheme();
  const activeMode: ThemeMode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [overrides, setOverrides] = useState<ThemeOverrides>(emptyOverrides);
  const [past, setPast] = useState<ThemeOverrides[]>([]);
  const [future, setFuture] = useState<ThemeOverrides[]>([]);
  const MAX_HISTORY = 100;
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'light' | 'dark'>('light');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    const saved = loadOverridesFromStorage();
    if (Object.keys(saved.light).length > 0 || Object.keys(saved.dark).length > 0) {
      setOverrides(saved);
      applyOverridesToDom(saved);
    }
  }, []);

  useEffect(() => {
    setPresets(loadPresets());
    try {
      const active = localStorage.getItem(ACTIVE_PRESET_KEY);
      if (active) setActivePresetId(active);
    } catch {}
  }, []);

  useEffect(() => {
    savePresets(presets);
  }, [presets]);

  useEffect(() => {
    try {
      if (activePresetId) localStorage.setItem(ACTIVE_PRESET_KEY, activePresetId);
      else localStorage.removeItem(ACTIVE_PRESET_KEY);
    } catch {}
  }, [activePresetId]);

  useEffect(() => {
    saveOverridesToStorage(overrides);
  }, [overrides]);

  const commitOverrides = useCallback((next: ThemeOverrides) => {
    setOverrides(prev => {
      setPast(p => {
        const trimmed = p.length >= MAX_HISTORY ? p.slice(-(MAX_HISTORY - 1)) : p;
        return [...trimmed, prev];
      });
      setFuture([]);
      applyOverridesToDom(next);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setOverrides(curr => {
        setFuture(f => [curr, ...f.slice(0, MAX_HISTORY - 1)]);
        applyOverridesToDom(prev);
        return prev;
      });
      return p.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      setOverrides(curr => {
        setPast(p => {
          const trimmed = p.length >= MAX_HISTORY ? p.slice(-(MAX_HISTORY - 1)) : p;
          return [...trimmed, curr];
        });
        applyOverridesToDom(next);
        return next;
      });
      return f.slice(1);
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const setToken = useCallback((name: string, value: string) => {
    const next: ThemeOverrides = {
      ...overrides,
      [activeMode]: { ...overrides[activeMode], [name]: value },
    };
    commitOverrides(next);
  }, [overrides, activeMode, commitOverrides]);

  const resetAll = useCallback(() => {
    const empty = emptyOverrides();
    commitOverrides(empty);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    toast.success('Theme reset to defaults');
  }, [commitOverrides]);

  const exportCSS = useCallback(() => {
    const lightEntries = Object.entries(overrides.light);
    const darkEntries = Object.entries(overrides.dark);
    if (lightEntries.length === 0 && darkEntries.length === 0) {
      toast.info('No overrides — theme unchanged');
      return;
    }

    const lightClassRules = buildTypographyClassRulesPublic(overrides.light);
    const darkClassRules = buildTypographyClassRulesPublic(overrides.dark);

    const lines: string[] = [];
    lines.push('/*');
    lines.push(' * Theme Editor export — вставить в самый конец src/index.css.');
    lines.push(' * Имеет максимальный приоритет — перебивает responsive media-queries');
    lines.push(' * и не сбрасывается при последующих правках Lovable.');
    lines.push(' */');
    lines.push('');

    if (lightEntries.length > 0) {
      lines.push(':root {');
      lightEntries.forEach(([k, v]) => lines.push(`  ${k}: ${v} !important;`));
      lines.push('}');
      lines.push('@media (min-width: 768px) {');
      lines.push('  :root {');
      lightEntries.forEach(([k, v]) => lines.push(`    ${k}: ${v} !important;`));
      lines.push('  }');
      lines.push('}');
      lines.push('@media (min-width: 1024px) {');
      lines.push('  :root {');
      lightEntries.forEach(([k, v]) => lines.push(`    ${k}: ${v} !important;`));
      lines.push('  }');
      lines.push('}');
    }

    if (lightClassRules.length > 0) {
      lines.push('');
      lines.push('/* Light: typography utility-class overrides (точно побеждают Tailwind defaults) */');
      lightClassRules.forEach(r => lines.push(r));
    }

    if (darkEntries.length > 0) {
      lines.push('');
      lines.push('.dark {');
      darkEntries.forEach(([k, v]) => lines.push(`  ${k}: ${v} !important;`));
      lines.push('}');
      lines.push('@media (min-width: 768px) {');
      lines.push('  .dark {');
      darkEntries.forEach(([k, v]) => lines.push(`    ${k}: ${v} !important;`));
      lines.push('  }');
      lines.push('}');
      lines.push('@media (min-width: 1024px) {');
      lines.push('  .dark {');
      darkEntries.forEach(([k, v]) => lines.push(`    ${k}: ${v} !important;`));
      lines.push('  }');
      lines.push('}');
    }

    if (darkClassRules.length > 0) {
      lines.push('');
      lines.push('/* Dark: typography utility-class overrides */');
      darkClassRules.forEach(r => lines.push(`.dark ${r}`));
    }

    const css = lines.join('\n');

    const prompt = `В src/index.css добавь в самый конец файла следующий блок без изменений:\n\n\`\`\`css\n${css}\n\`\`\`\n\nЕсли в файле уже есть блок с комментарием "Theme Editor export" — замени его целиком на этот. Никакие другие части src/index.css не трогай.`;

    navigator.clipboard.writeText(prompt).then(() => {
      const total = lightEntries.length + darkEntries.length + lightClassRules.length + darkClassRules.length;
      toast.success(`Скопирован промт для Lovable (${total} правил)`);
    });
  }, [overrides]);

  const runImport = useCallback(() => {
    if (!importText.trim()) {
      toast.error('Вставь CSS-блок темы');
      return;
    }
    const selector = importMode === 'dark' ? '.dark' : ':root';
    const parsed = parseCssBlock(importText, selector);
    const keys = Object.keys(parsed);
    if (keys.length === 0) {
      toast.error(`Не нашёл блок ${selector} { … } в CSS`);
      return;
    }

    let applied = 0;
    let skipped = 0;
    const newOverrides: ThemeOverrides = {
      ...overrides,
      [importMode]: { ...overrides[importMode] },
    };

    for (const [token, rawValue] of Object.entries(parsed)) {
      if (IMPORTABLE_COLOR_TOKENS.has(token)) {
        const hsl = colorValueToHsl(rawValue);
        if (hsl) {
          newOverrides[importMode][token] = hsl;
          applied++;
        } else {
          skipped++;
        }
      } else if (IMPORTABLE_NON_COLOR.has(token)) {
        newOverrides[importMode][token] = rawValue;
        applied++;
      } else {
        skipped++;
      }
    }

    commitOverrides(newOverrides);
    toast.success(`Импортировано ${applied} токенов · пропущено ${skipped}`);
    setImportOpen(false);
    setImportText('');
  }, [importText, importMode, overrides, commitOverrides]);

  const savePresetAsNew = useCallback(() => {
    const name = newPresetName.trim();
    if (!name) {
      toast.error('Введи имя пресета');
      return;
    }
    const totalCount = Object.keys(overrides.light).length + Object.keys(overrides.dark).length;
    if (totalCount === 0) {
      toast.error('Нечего сохранять — нет изменений');
      return;
    }
    const id = generateId();
    const preset: Preset = {
      id,
      name,
      overrides: { light: { ...overrides.light }, dark: { ...overrides.dark } },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPresets(prev => [preset, ...prev]);
    setActivePresetId(id);
    setNewPresetName('');
    toast.success(`Пресет «${name}» сохранён (${totalCount} токенов)`);
  }, [newPresetName, overrides]);

  const applyPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id);
    if (!preset) return;
    // Совместимость со старыми пресетами (плоский overrides) — кладём в light
    const raw = preset.overrides as unknown as ThemeOverrides | Record<string, string>;
    const themed: ThemeOverrides =
      raw && typeof raw === 'object' && 'light' in raw && 'dark' in raw
        ? { light: { ...(raw as ThemeOverrides).light }, dark: { ...(raw as ThemeOverrides).dark } }
        : { light: { ...(raw as Record<string, string>) }, dark: {} };
    commitOverrides(themed);
    setActivePresetId(id);
    toast.success(`Применён пресет «${preset.name}»`);
  }, [presets, commitOverrides]);

  const duplicatePreset = useCallback((id: string) => {
    const original = presets.find(p => p.id === id);
    if (!original) return;
    const raw = original.overrides as unknown as ThemeOverrides | Record<string, string>;
    const cloned: ThemeOverrides =
      raw && typeof raw === 'object' && 'light' in raw && 'dark' in raw
        ? { light: { ...(raw as ThemeOverrides).light }, dark: { ...(raw as ThemeOverrides).dark } }
        : { light: { ...(raw as Record<string, string>) }, dark: {} };
    const copy: Preset = {
      id: generateId(),
      name: `${original.name} (копия)`,
      overrides: cloned,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setPresets(prev => [copy, ...prev]);
    toast.success(`Дубликат «${copy.name}» создан`);
  }, [presets]);

  const deletePreset = useCallback((id: string) => {
    const target = presets.find(p => p.id === id);
    if (!target) return;
    if (!confirm(`Удалить пресет «${target.name}»?`)) return;
    setPresets(prev => prev.filter(p => p.id !== id));
    if (activePresetId === id) setActivePresetId(null);
    toast.success(`Пресет «${target.name}» удалён`);
  }, [presets, activePresetId]);

  const startRename = useCallback((id: string, current: string) => {
    setRenamingId(id);
    setRenameDraft(current);
  }, []);

  const commitRename = useCallback(() => {
    if (!renamingId) return;
    const name = renameDraft.trim();
    if (!name) {
      toast.error('Имя не может быть пустым');
      return;
    }
    setPresets(prev => prev.map(p => p.id === renamingId ? { ...p, name, updatedAt: Date.now() } : p));
    setRenamingId(null);
    setRenameDraft('');
  }, [renamingId, renameDraft]);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
    setRenameDraft('');
  }, []);

  const updateActivePreset = useCallback(() => {
    if (!activePresetId) return;
    setPresets(prev => prev.map(p => p.id === activePresetId
      ? { ...p, overrides: { light: { ...overrides.light }, dark: { ...overrides.dark } }, updatedAt: Date.now() }
      : p));
    toast.success('Активный пресет обновлён');
  }, [activePresetId, overrides]);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col">
          <CardTitle className="text-body-lg">🎨 Theme Editor (live preview)</CardTitle>
          <p className="text-caption-sm text-muted-foreground mt-1">
            Редактируем тему: <span className="font-medium text-foreground">{activeMode === 'dark' ? 'Dark' : 'Light'}</span>
            {activeMode === 'light' ? ' (изменения сохраняются в :root)' : ' (изменения сохраняются в .dark)'}
          </p>
          {activePresetId && (
            <p className="text-caption-sm text-muted-foreground mt-1">
              Активный пресет: <span className="font-medium text-foreground">{presets.find(p => p.id === activePresetId)?.name ?? '—'}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={undo}
              disabled={past.length === 0}
              title={`Отменить (${past.length})`}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={redo}
              disabled={future.length === 0}
              title={`Вернуть (${future.length})`}
            >
              <Redo2 className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(o => !o)}>
            {open ? 'Свернуть' : 'Открыть'}
          </Button>
          <div className="inline-flex items-center gap-1 rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`px-2 py-1 rounded text-caption-sm font-medium transition-colors ${
                activeMode === 'light'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`px-2 py-1 rounded text-caption-sm font-medium transition-colors ${
                activeMode === 'dark'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              Dark
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPresetsOpen(true)}>
            <Bookmark className="size-4 mr-1" />
            Presets {presets.length > 0 && <span className="ml-1 text-caption-sm opacity-70">({presets.length})</span>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} leftIcon={<Download />}>
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSS} leftIcon={<Copy />}>
            Export CSS
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll} leftIcon={<RotateCcw />}>
            Reset
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-8">
          <p className="text-sm text-muted-foreground">
            Изменения применяются мгновенно ко всему UI на странице через CSS-переменные.
            Сохраняются в localStorage между сессиями. Export CSS даёт готовый блок для вставки в src/index.css.
          </p>

          {COLOR_GROUPS.map(group => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.tokens.map(t => (
                  <ColorRow key={t.name} token={t} onChange={setToken} />
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Radius (base shadcn)</h3>
            <RadiusRow onChange={(rem) => setToken('--radius', rem)} />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Fonts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FontRow name="--font-display" label="Display font" onChange={(v) => setToken('--font-display', v)} />
              <FontRow name="--font-text" label="Body font" onChange={(v) => setToken('--font-text', v)} />
            </div>
          </div>

          {/* Typography — два шрифта в колонках */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-body-md font-semibold text-foreground">Typography</p>
              <p className="text-caption-sm text-muted-foreground">size · weight · live preview</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between border-b border-border pb-2 mb-1">
                  <p className="text-caption-sm font-semibold text-foreground uppercase tracking-wider">Display font</p>
                  <p
                    className="text-caption-sm text-muted-foreground"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {(readVar('--font-display') || '').split(',')[0].replace(/['"]/g, '').trim() || 'Display'}
                  </p>
                </div>
                {DISPLAY_TYPOS.map(t => (
                  <TypographyCard key={t.sizeVar} token={t} familyKind="display" onChange={setToken} />
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline justify-between border-b border-border pb-2 mb-1">
                  <p className="text-caption-sm font-semibold text-foreground uppercase tracking-wider">Body copy font</p>
                  <p
                    className="text-caption-sm text-muted-foreground"
                    style={{ fontFamily: 'var(--font-text)' }}
                  >
                    {(readVar('--font-text') || '').split(',')[0].replace(/['"]/g, '').trim() || 'Body'}
                  </p>
                </div>
                {BODY_TYPOS.map(t => (
                  <TypographyCard key={t.sizeVar} token={t} familyKind="text" onChange={setToken} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      )}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Импорт темы из CSS</DialogTitle>
            <DialogDescription>
              Вставь CSS-блок темы (с tweakcn.com, shadcn/ui themes, realtimecolors.com или любой совместимый). Парсер
              вытащит токены из :root или .dark, конвертирует oklch → hsl, применит к существующим переменным.
              Milu-расширения (brand-*, surface-secondary, alpha-*, accent-orange и т.д.) не трогаются.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label className="text-sm">Импортировать блок:</Label>
              <Select value={importMode} onValueChange={(v) => setImportMode(v as 'light' | 'dark')}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">:root (light)</SelectItem>
                  <SelectItem value="dark">.dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={':root {\n  --background: oklch(1 0 0);\n  --primary: oklch(0.475 0.247 290);\n  ...\n}'}
              className="min-h-[280px] font-mono text-caption-sm"
              spellCheck={false}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Отмена</Button>
            <Button onClick={runImport}>Импортировать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={presetsOpen} onOpenChange={setPresetsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Пресеты темы</DialogTitle>
            <DialogDescription>
              Сохраняй разные варианты темы для сравнения и переключения. Сохраняется в localStorage браузера.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-end gap-2 pb-3 border-b border-border">
            <div className="flex-1">
              <Label className="text-caption-sm text-muted-foreground">Сохранить текущие изменения как новый пресет</Label>
              <Input
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Например: Milu Navy, Tweakcn Purple, ..."
                className="mt-1 h-9"
                onKeyDown={(e) => { if (e.key === 'Enter') savePresetAsNew(); }}
              />
            </div>
            <Button onClick={savePresetAsNew} size="sm">
              <Plus className="size-4 mr-1" /> Сохранить
            </Button>
          </div>

          {activePresetId && (
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <p className="text-caption-sm text-muted-foreground">
                Изменения после применения активного пресета не сохранены.
              </p>
              <Button variant="outline" size="sm" onClick={updateActivePreset}>
                <Check className="size-4 mr-1" /> Обновить активный
              </Button>
            </div>
          )}

          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {presets.length === 0 ? (
              <p className="text-body-md text-muted-foreground text-center py-8">
                Нет сохранённых пресетов. Сохрани первый — введи имя выше.
              </p>
            ) : (
              presets.map(p => {
                const isActive = p.id === activePresetId;
                const isRenaming = p.id === renamingId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-md border p-3 ${
                      isActive ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex gap-2">
                          <Input
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            className="h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') cancelRename();
                            }}
                          />
                          <Button size="sm" onClick={commitRename}>OK</Button>
                          <Button size="sm" variant="ghost" onClick={cancelRename}>Отмена</Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-body-md font-medium text-foreground truncate">
                            {p.name}
                            {isActive && <span className="ml-2 text-caption-sm text-primary">● активный</span>}
                          </p>
                          <p className="text-caption-sm text-muted-foreground">
                    {(() => {
                      const o = p.overrides as unknown as ThemeOverrides | Record<string, string>;
                      const count = o && typeof o === 'object' && 'light' in o && 'dark' in o
                        ? Object.keys((o as ThemeOverrides).light).length + Object.keys((o as ThemeOverrides).dark).length
                        : Object.keys(o as Record<string, string>).length;
                      return count;
                    })()} токенов · обновлён {new Date(p.updatedAt).toLocaleString('ru-RU')}
                          </p>
                        </>
                      )}
                    </div>
                    {!isRenaming && (
                      <div className="flex gap-1 shrink-0">
                        {!isActive && (
                          <Button size="sm" variant="outline" onClick={() => applyPreset(p.id)} title="Применить">
                            <Check className="size-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => startRename(p.id, p.name)} title="Переименовать">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => duplicatePreset(p.id)} title="Дублировать">
                          <CopyIcon className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deletePreset(p.id)} title="Удалить">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPresetsOpen(false)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ColorRow({ token, onChange }: { token: ColorToken; onChange: (name: string, hsl: string) => void }) {
  const [hex, setHex] = useState<string>('#000000');
  const [draft, setDraft] = useState<string>('#000000');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const hsl = readVar(token.name);
        if (hsl) {
          const v = hslStringToHex(hsl);
          setHex(v);
          setDraft(v);
        }
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [token.name, resolvedTheme]);

  const applyHex = (value: string) => {
    setHex(value);
    setDraft(value);
    onChange(token.name, hexToHslString(value));
  };

  const handlePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyHex(e.target.value);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.trim();
    if (v && !v.startsWith('#')) v = '#' + v;
    setDraft(v);

    // Полный 6-символьный hex — применяем
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      applyHex(v.toLowerCase());
      return;
    }
    // Короткий 3-символьный hex — расширяем до 6
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      const expanded = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
      setHex(expanded);
      onChange(token.name, hexToHslString(expanded));
    }
  };

  const handleTextBlur = () => {
    // Если в draft невалидный hex — откатываем visible value к последнему валидному hex
    if (!/^#[0-9a-fA-F]{6}$/.test(draft)) {
      setDraft(hex);
    }
  };

  const isInvalid = draft.length > 0 && !/^#[0-9a-fA-F]{6}$/.test(draft) && !/^#[0-9a-fA-F]{3}$/.test(draft);

  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-2" title={token.name}>
      <input
        type="color"
        value={hex}
        onChange={handlePicker}
        className="h-10 w-10 shrink-0 rounded cursor-pointer border-0 bg-transparent"
        aria-label={token.label}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-body-md font-medium text-foreground truncate">{token.label}</p>
        <input
          type="text"
          value={draft}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          maxLength={7}
          placeholder="#ffffff"
          className={`h-7 w-full rounded border bg-surface px-2 font-mono text-caption-sm focus:outline-none focus:ring-2 focus:ring-ring ${
            isInvalid ? 'border-error' : 'border-border'
          }`}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

function RadiusRow({ onChange }: { onChange: (rem: string) => void }) {
  const [val, setVal] = useState(6);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const cur = readVar('--radius');
        if (cur.endsWith('rem')) setVal(parseFloat(cur) * 16);
        else if (cur.endsWith('px')) setVal(parseFloat(cur));
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [resolvedTheme]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value, 10);
    setVal(n);
    onChange(`${n / 16}rem`);
  };

  return (
    <div className="flex items-center gap-4">
      <Label className="w-24 font-mono text-xs">--radius</Label>
      <input
        type="range"
        min={0}
        max={24}
        step={1}
        value={val}
        onChange={handleChange}
        className="flex-1"
      />
      <span className="w-16 text-sm tabular-nums text-muted-foreground">{val}px</span>
    </div>
  );
}

function FontRow({ name, label, onChange }: { name: string; label: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState('');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const cur = readVar(name);
        const first = cur.replace(/['"]/g, '').split(',')[0].trim();
        setVal(first);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [name, resolvedTheme]);

  const handleChange = (newVal: string) => {
    setVal(newVal);
    onChange(`'${newVal}', system-ui, sans-serif`);
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={val || undefined} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick font" />
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map(f => (
            <SelectItem key={f} value={f}>{f}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TypographyCard({
  token,
  familyKind,
  onChange,
}: {
  token: TypoToken;
  familyKind: 'display' | 'text';
  onChange: (name: string, value: string) => void;
}) {
  const [size, setSize] = useState<number>(token.defaultSize);
  const [weight, setWeight] = useState<string>('400');
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const curSize = readVar(token.sizeVar);
        if (curSize.endsWith('px')) setSize(parseFloat(curSize));
        const curWeight = readVar(token.weightVar);
        if (curWeight) setWeight(curWeight);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [token.sizeVar, token.weightVar, resolvedTheme]);

  const handleSize = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = parseInt(e.target.value, 10);
    if (Number.isNaN(n) || n < 6 || n > 120) return;
    setSize(n);
    onChange(token.sizeVar, `${n}px`);
  };

  const handleWeight = (v: string) => {
    setWeight(v);
    onChange(token.weightVar, v);
  };

  const fontFamily = familyKind === 'display' ? 'var(--font-display)' : 'var(--font-text)';

  return (
    <div className="rounded-md border border-border p-3 space-y-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-caption-sm font-medium text-foreground shrink-0">{token.label}</Label>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={6}
            max={120}
            value={size}
            onChange={handleSize}
            className="w-14 h-7 px-1.5 text-caption-sm"
          />
          <span className="text-caption-sm text-muted-foreground">px</span>
          <Select value={weight} onValueChange={handleWeight}>
            <SelectTrigger className="h-7 w-32 text-caption-sm px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_OPTIONS.map(w => (
                <SelectItem key={w.value} value={w.value} className="text-caption-sm">
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className="text-foreground leading-tight truncate"
        style={{
          fontFamily,
          fontSize: `${size}px`,
          fontWeight: weight,
        }}
      >
        The quick brown fox jumps
      </div>
    </div>
  );
}