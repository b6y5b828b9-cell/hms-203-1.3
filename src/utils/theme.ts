import { AppTheme } from '../types';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  subtitle: string;
  accentHex: string;
  accentClass: string;
  iconName: string;
  isDark: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'clinical',
    name: 'Care Operations',
    subtitle: 'Calm clinical surfaces with ink navigation and teal actions',
    accentHex: '#087d78',
    accentClass: 'bg-teal-700 text-white',
    iconName: 'Stethoscope',
    isDark: false,
  },
  {
    id: 'ocean',
    name: 'Ocean Care',
    subtitle: 'Soothing seafoam teal & mint, gentle on eyes',
    accentHex: '#0d9488',
    accentClass: 'bg-teal-600 text-white',
    iconName: 'Waves',
    isDark: false,
  },
  {
    id: 'indigo',
    name: 'Royal Navy',
    subtitle: 'Executive hospital sapphire & deep slate',
    accentHex: '#4f46e5',
    accentClass: 'bg-indigo-600 text-white',
    iconName: 'Building',
    isDark: false,
  },
  {
    id: 'dark',
    name: 'Midnight Shift',
    subtitle: 'Low-glare dark charcoal for night duty',
    accentHex: '#0ea5e9',
    accentClass: 'bg-sky-500 text-slate-900',
    iconName: 'Moon',
    isDark: true,
  },
];

export const normalizeTheme = (theme: AppTheme): 'clinical' | 'ocean' | 'indigo' | 'dark' => {
  if (theme === 'emerald' || theme === 'ocean') return 'ocean';
  if (theme === 'cyan' || theme === 'clinical') return 'clinical';
  if (theme === 'indigo') return 'indigo';
  if (theme === 'dark' || theme === 'slate') return 'dark';
  return 'clinical';
};

export interface ThemeClasses {
  appBackground: string;
  headerBackground: string;
  headerBorder: string;
  headerText: string;
  sidebarBackground: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarActiveItem: string;
  sidebarHoverItem: string;
  sidebarHeaderColor: string;
  mainBackground: string;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  accentBadge: string;
  quickActionBar: string;
}

export const getThemeClasses = (theme: AppTheme): ThemeClasses => {
  const norm = normalizeTheme(theme);
  switch (norm) {
    case 'ocean':
      return {
        appBackground: 'bg-teal-50/25',
        headerBackground: 'bg-white/95 backdrop-blur-md',
        headerBorder: 'border-teal-100 shadow-2xs',
        headerText: 'text-slate-800',
        sidebarBackground: 'bg-teal-950/95',
        sidebarBorder: 'border-teal-900/60 shadow-2xs',
        sidebarText: 'text-teal-100/90',
        sidebarActiveItem: 'bg-teal-600 text-white shadow-xs font-semibold',
        sidebarHoverItem: 'hover:bg-teal-900/80 hover:text-white text-teal-200',
        sidebarHeaderColor: 'text-teal-400/80 font-bold',
        mainBackground: 'bg-teal-50/40',
        cardBackground: 'bg-white',
        cardBorder: 'border-teal-100/80 shadow-2xs',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-teal-700/80',
        accentBadge: 'bg-teal-50 text-teal-700 border-teal-200',
        quickActionBar: 'bg-white/90 border-teal-100 shadow-2xs',
      };
    case 'indigo':
      return {
        appBackground: 'bg-slate-50',
        headerBackground: 'bg-white/95 backdrop-blur-md',
        headerBorder: 'border-indigo-100 shadow-2xs',
        headerText: 'text-slate-800',
        sidebarBackground: 'bg-slate-900',
        sidebarBorder: 'border-slate-800 shadow-2xs',
        sidebarText: 'text-slate-200',
        sidebarActiveItem: 'bg-indigo-600 text-white shadow-xs font-semibold',
        sidebarHoverItem: 'hover:bg-slate-800 hover:text-white text-slate-300',
        sidebarHeaderColor: 'text-slate-400 font-bold',
        mainBackground: 'bg-slate-100/80',
        cardBackground: 'bg-white',
        cardBorder: 'border-indigo-100 shadow-2xs',
        textPrimary: 'text-slate-900',
        textSecondary: 'text-slate-500',
        accentBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        quickActionBar: 'bg-white/90 border-indigo-100 shadow-2xs',
      };
    case 'dark':
      return {
        appBackground: 'bg-slate-950',
        headerBackground: 'bg-slate-900/95 backdrop-blur-md',
        headerBorder: 'border-slate-800 shadow-2xs',
        headerText: 'text-slate-100',
        sidebarBackground: 'bg-slate-900',
        sidebarBorder: 'border-slate-800 shadow-2xs',
        sidebarText: 'text-slate-200',
        sidebarActiveItem: 'bg-sky-500 text-slate-950 shadow-xs font-bold',
        sidebarHoverItem: 'hover:bg-slate-800 hover:text-white text-slate-300',
        sidebarHeaderColor: 'text-slate-400 font-bold',
        mainBackground: 'bg-slate-950',
        cardBackground: 'bg-slate-900',
        cardBorder: 'border-slate-800 shadow-2xs',
        textPrimary: 'text-slate-100',
        textSecondary: 'text-slate-400',
        accentBadge: 'bg-sky-950/80 text-sky-300 border-sky-800',
        quickActionBar: 'bg-slate-900/90 border-slate-800 shadow-2xs',
      };
    case 'clinical':
    default:
      return {
        appBackground: 'bg-[var(--app-canvas)]',
        headerBackground: 'bg-[var(--surface-header)]',
        headerBorder: 'border-[var(--border-subtle)] shadow-[var(--shadow-header)]',
        headerText: 'text-[var(--text-primary)]',
        sidebarBackground: 'bg-[var(--surface-nav)]',
        sidebarBorder: 'border-[var(--border-nav)] shadow-sm',
        sidebarText: 'text-[var(--text-nav)]',
        sidebarActiveItem: 'bg-[var(--brand-primary)] text-white shadow-sm font-semibold',
        sidebarHoverItem: 'hover:bg-[var(--nav-hover)] hover:text-white text-[var(--text-nav)]',
        sidebarHeaderColor: 'text-[var(--text-nav-muted)] font-bold',
        mainBackground: 'bg-[var(--app-canvas)]',
        cardBackground: 'bg-[var(--surface-card)]',
        cardBorder: 'border-[var(--border-subtle)] shadow-[var(--shadow-card)]',
        textPrimary: 'text-[var(--text-primary)]',
        textSecondary: 'text-[var(--text-secondary)]',
        accentBadge: 'bg-[var(--brand-tint)] text-[var(--brand-primary)] border-[var(--brand-border)]',
        quickActionBar: 'bg-[var(--surface-header)] border-[var(--border-subtle)] shadow-[var(--shadow-card)]',
      };
  }
};
