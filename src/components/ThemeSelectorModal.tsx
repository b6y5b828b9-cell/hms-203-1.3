import React from 'react';
import { X, Check, Sun, Waves, Stethoscope, Building, Moon, Sparkles } from 'lucide-react';
import { useHospital } from '../context/HospitalContext';
import { THEME_OPTIONS, normalizeTheme } from '../utils/theme';
import { AppTheme } from '../types';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({ isOpen, onClose }) => {
  const { appTheme, setAppTheme, addNotification } = useHospital();

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentNormalized = normalizeTheme(appTheme);

  const handleSelect = (themeId: AppTheme) => {
    setAppTheme(themeId);
    const selected = THEME_OPTIONS.find((t) => t.id === themeId);
    addNotification(
      'Theme Updated',
      `Applied ${selected?.name || themeId} theme successfully.`,
      'success'
    );
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Waves':
        return <Waves className="w-5 h-5 text-teal-600" />;
      case 'Building':
        return <Building className="w-5 h-5 text-indigo-600" />;
      case 'Moon':
        return <Moon className="w-5 h-5 text-sky-400" />;
      case 'Stethoscope':
      default:
        return <Stethoscope className="w-5 h-5 text-blue-600" />;
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150 select-none"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800">
                  Settings & Appearance
                </span>
              </div>
              <h3 className="font-bold text-sm text-white mt-0.5">Application Theme & Appearance</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = currentNormalized === normalizeTheme(theme.id);
              return (
                <div
                  key={theme.id}
                  onClick={() => handleSelect(theme.id)}
                  className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-md bg-white border border-slate-200 shadow-2xs">
                        {getIcon(theme.iconName)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{theme.name}</span>
                          {theme.isDark ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-200">
                              Dark
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                              Light
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {theme.subtitle}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/70">
                    <span className="text-[10px] text-slate-400 font-medium">Palette:</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10"
                      style={{ backgroundColor: theme.accentHex }}
                      title="Primary Accent"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-slate-300 ${
                        theme.isDark ? 'bg-slate-900' : 'bg-slate-100'
                      }`}
                      title="Canvas Background"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded-full border border-slate-300 ${
                        theme.isDark ? 'bg-slate-800' : 'bg-white'
                      }`}
                      title="Card Surface"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Accessibility & Legibility Standard</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All themes are tuned to pass WCAG AA contrast standards for clinical telemetry, vital alerts, and medication schedules.
            </p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
