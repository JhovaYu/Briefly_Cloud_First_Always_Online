export type FontSize = 'small' | 'normal' | 'large';

export interface LocalPreferences {
  theme: 'dark' | 'light';
  fontSize: FontSize;
  reduceMotion: boolean;
  showInstitution: boolean;
  showCareer: boolean;
  openLastWorkspace: boolean;
}

const DEFAULTS: LocalPreferences = {
  theme: 'dark',
  fontSize: 'normal',
  reduceMotion: false,
  showInstitution: true,
  showCareer: false,
  openLastWorkspace: false,
};

const STORAGE_KEY = 'fluent-preferences';

export function getPreferences(): LocalPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const existing = localStorage.getItem('fluent-theme');
      return {
        ...DEFAULTS,
        theme: (existing === 'light' || existing === 'dark') ? existing : DEFAULTS.theme,
      };
    }
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePreferences(prefs: Partial<LocalPreferences>): void {
  const current = getPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  applyPreferences(updated);
}

export function applyPreferences(prefs: LocalPreferences): void {
  const root = document.documentElement;

  root.setAttribute('data-theme', prefs.theme);
  localStorage.setItem('fluent-theme', prefs.theme);

  root.classList.remove('briefly-font-small', 'briefly-font-normal', 'briefly-font-large');
  root.classList.add(`briefly-font-${prefs.fontSize}`);

  if (prefs.reduceMotion) {
    root.classList.add('briefly-reduce-motion');
  } else {
    root.classList.remove('briefly-reduce-motion');
  }
}

export function resetPreferences(): void {
  localStorage.removeItem(STORAGE_KEY);
  const existing = localStorage.getItem('fluent-theme');
  const reset: LocalPreferences = {
    ...DEFAULTS,
    theme: (existing === 'light' || existing === 'dark') ? existing : DEFAULTS.theme,
  };
  applyPreferences(reset);
}

export function clearUserProfile(): void {
  localStorage.removeItem('fluent-user-profile');
}