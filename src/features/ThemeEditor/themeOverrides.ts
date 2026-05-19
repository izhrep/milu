/**
 * Theme Editor — глобальная инжекция overrides для обеих тем.
 * Light overrides → :root, Dark overrides → .dark.
 */

export const STORAGE_KEY = 'milu-theme-editor-overrides-v2';
const STORAGE_KEY_V1 = 'milu-theme-editor-overrides-v1';
const STYLE_ID = 'theme-editor-overrides';

export const TYPO_TYPES_EXPORT = [
  'display', 'heading-1', 'heading-2', 'heading-3', 'heading-4',
  'body-lg', 'body-base', 'body-md', 'caption-sm', 'helpertext-xs',
] as const;

export function buildTypographyClassRulesPublic(modeOverrides: Record<string, string>): string[] {
  return buildTypographyClassRules(modeOverrides);
}

export type ThemeMode = 'light' | 'dark';

export type ThemeOverrides = {
  light: Record<string, string>;
  dark: Record<string, string>;
};

export function emptyOverrides(): ThemeOverrides {
  return { light: {}, dark: {} };
}

export function applyOverridesToDom(overrides: ThemeOverrides): void {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const lightEntries = Object.entries(overrides.light);
  const darkEntries = Object.entries(overrides.dark);

  if (lightEntries.length === 0 && darkEntries.length === 0) {
    styleEl.textContent = '';
    return;
  }

  const lightVarRules = lightEntries.map(([k, v]) => `${k}: ${v} !important;`).join(' ');
  const darkVarRules = darkEntries.map(([k, v]) => `${k}: ${v} !important;`).join(' ');

  const lightClassRules = buildTypographyClassRules(overrides.light);
  const darkClassRules = buildTypographyClassRules(overrides.dark);

  const sections: string[] = [];

  if (lightVarRules) {
    sections.push(`:root { ${lightVarRules} }`);
    sections.push(`@media (min-width: 768px) { :root { ${lightVarRules} } }`);
    sections.push(`@media (min-width: 1024px) { :root { ${lightVarRules} } }`);
  }
  if (lightClassRules.length > 0) {
    sections.push(lightClassRules.join('\n'));
  }

  if (darkVarRules) {
    sections.push(`.dark { ${darkVarRules} }`);
    sections.push(`@media (min-width: 768px) { .dark { ${darkVarRules} } }`);
    sections.push(`@media (min-width: 1024px) { .dark { ${darkVarRules} } }`);
  }
  if (darkClassRules.length > 0) {
    sections.push(darkClassRules.map(r => `.dark ${r}`).join('\n'));
  }

  styleEl.textContent = sections.join('\n');
}

export function loadOverridesFromStorage(): ThemeOverrides {
  if (typeof localStorage === 'undefined') return emptyOverrides();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      // Миграция со старого формата (v1) — плоский Record = light
      const legacy = localStorage.getItem(STORAGE_KEY_V1);
      if (legacy) {
        try {
          const parsed = JSON.parse(legacy);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return { light: parsed as Record<string, string>, dark: {} };
          }
        } catch {}
      }
      return emptyOverrides();
    }
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && 'light' in parsed && 'dark' in parsed) {
      return parsed as ThemeOverrides;
    }
    return emptyOverrides();
  } catch {
    return emptyOverrides();
  }
}

export function saveOverridesToStorage(overrides: ThemeOverrides): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {}
}

export function initThemeOverrides(): void {
  const overrides = loadOverridesFromStorage();
  applyOverridesToDom(overrides);
}

const TYPO_TYPES = [
  'display',
  'heading-1',
  'heading-2',
  'heading-3',
  'heading-4',
  'body-lg',
  'body-base',
  'body-md',
  'caption-sm',
  'helpertext-xs',
] as const;

function buildTypographyClassRules(modeOverrides: Record<string, string>): string[] {
  const rules: string[] = [];
  for (const t of TYPO_TYPES) {
    const props: string[] = [];
    const size = modeOverrides[`--text-${t}`];
    const leading = modeOverrides[`--leading-${t}`];
    const weight = modeOverrides[`--font-weight-${t}`];
    const family = modeOverrides[`--font-family-${t}`];
    if (size)    props.push(`font-size: ${size} !important;`);
    if (leading) props.push(`line-height: ${leading} !important;`);
    if (weight)  props.push(`font-weight: ${weight} !important;`);
    if (family)  props.push(`font-family: ${family} !important;`);
    if (props.length === 0) continue;
    rules.push(`.text-${t} { ${props.join(' ')} }`);
    if (t.startsWith('heading-')) {
      const n = t.replace('heading-', '');
      rules.push(`h${n} { ${props.join(' ')} }`);
    }
  }
  return rules;
}
