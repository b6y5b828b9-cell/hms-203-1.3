import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Plus,
  RotateCcw,
  Layers,
  Check,
} from 'lucide-react';
import { useHospital, NavigationTab } from '../context/HospitalContext';
import { getTabInfo, WORKSPACE_TAB_DEFINITIONS } from '../utils/workspaceTabs';
import { getThemeClasses, normalizeTheme } from '../utils/theme';

export const WorkspaceTabBar: React.FC = () => {
  const {
    openTabs,
    activeTab,
    setActiveTab,
    closeWorkspaceTab,
    closeOtherWorkspaceTabs,
    closeAllWorkspaceTabs,
    appTheme,
  } = useHospital();

  const themeClasses = getThemeClasses(appTheme);
  const isDark = normalizeTheme(appTheme) === 'dark';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Check scroll overflow
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [openTabs]);

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
    if (activeEl) {
      const containerLeft = el.scrollLeft;
      const containerRight = containerLeft + el.clientWidth;
      const elemLeft = activeEl.offsetLeft;
      const elemRight = elemLeft + activeEl.offsetWidth;

      if (elemLeft < containerLeft) {
        el.scrollTo({ left: elemLeft - 16, behavior: 'smooth' });
      } else if (elemRight > containerRight) {
        el.scrollTo({ left: elemRight - el.clientWidth + 16, behavior: 'smooth' });
      }
    }
    checkScroll();
  }, [activeTab]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = 240;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 200);
  };

  // Quick categories for "+ Add Tab" menu
  const quickCategories = [
    {
      name: 'Billing & Cashier',
      items: [
        { id: 'billing' as NavigationTab, label: 'Invoicing' },
        { id: 'billing-dues' as NavigationTab, label: 'Due Settlement' },
        { id: 'billing-advance' as NavigationTab, label: 'Advance Payment' },
        { id: 'billing-refunds' as NavigationTab, label: 'Refund' },
        { id: 'billing-pos' as NavigationTab, label: 'POS Transactions' },
        { id: 'insurance-approvals' as NavigationTab, label: 'Insurance Approval' },
      ],
    },
    {
      name: 'Clinical & Patient Care',
      items: [
        { id: 'overview' as NavigationTab, label: 'Dashboard' },
        { id: 'registration' as NavigationTab, label: 'Patient Registration' },
        { id: 'patients' as NavigationTab, label: 'Patient EMR Records' },
        { id: 'appointments' as NavigationTab, label: 'Appointments' },
        { id: 'triage' as NavigationTab, label: 'Nurse Triage Station' },
        { id: 'inpatient' as NavigationTab, label: 'Inpatients (IPD)' },
        { id: 'outpatient' as NavigationTab, label: 'Outpatients (OPD)' },
      ],
    },
    {
      name: 'Diagnostics & Facilities',
      items: [
        { id: 'pharmacy' as NavigationTab, label: 'Pharmacy Stock' },
        { id: 'labs' as NavigationTab, label: 'Lab & Diagnostics' },
        { id: 'coder' as NavigationTab, label: 'Medical Coder Desk' },
        { id: 'pricelist' as NavigationTab, label: 'Price List & Tariffs' },
        { id: 'wards' as NavigationTab, label: 'Ward & Beds' },
        { id: 'reports' as NavigationTab, label: 'Analytics & Reports' },
      ],
    },
  ];

  return (
    <div
      className={`sticky top-0 z-20 flex items-center border-b ${
        isDark
          ? 'bg-slate-900/95 border-slate-800 text-slate-200'
          : 'bg-slate-100/90 border-slate-200 text-slate-700'
      } backdrop-blur px-2 sm:px-4 py-1.5 gap-1.5 select-none transition-colors`}
      role="region"
      aria-label="Workspace tabs"
    >
      {/* Scroll Left Button if overflow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScroll('left')}
          className={`shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer`}
          title="Scroll tabs left"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Tabs Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0 py-0.5"
      >
        {openTabs.map((tab) => {
          const isActive = activeTab === tab.id || activeTab === tab.tabKey;
          const meta = getTabInfo(tab.tabKey);
          const TabIcon = meta.icon;

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onClick={() => setActiveTab(tab.tabKey)}
              onAuxClick={(e) => {
                if (e.button === 1 && tab.closable) {
                  e.preventDefault();
                  closeWorkspaceTab(tab.id);
                }
              }}
              title={`${tab.title} (${meta.category})`}
              className={`group shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                isActive
                  ? isDark
                    ? 'bg-slate-800 text-white border-blue-500/50 shadow-sm ring-1 ring-blue-500/30'
                    : 'bg-white text-blue-900 border-slate-300 shadow-sm ring-1 ring-blue-500/20'
                  : isDark
                  ? 'bg-slate-900/60 text-slate-400 border-transparent hover:bg-slate-800/60 hover:text-slate-200'
                  : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <span
                className={`p-1 rounded-md ${meta.color} flex items-center justify-center shrink-0`}
              >
                <TabIcon className="w-3.5 h-3.5" />
              </span>

              <span className="truncate max-w-[140px] sm:max-w-[180px]">
                {tab.title}
              </span>

              {/* Active Tab indicator dot */}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
              )}

              {/* Close Button */}
              {tab.closable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWorkspaceTab(tab.id);
                  }}
                  className={`p-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition ml-0.5 shrink-0 ${
                    isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
                  }`}
                  title={`Close ${tab.title}`}
                  aria-label={`Close ${tab.title} tab`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button if overflow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScroll('right')}
          className={`shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition cursor-pointer`}
          title="Scroll tabs right"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Actions: Add Sub-Option Tab Dropdown */}
      <div className="relative shrink-0" ref={addMenuRef}>
        <button
          type="button"
          onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
          className={`p-1.5 rounded-lg border text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 ${
            isDark
              ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          } shadow-sm transition flex items-center gap-1 cursor-pointer text-xs font-semibold`}
          title="Open another sub-option in tab"
          aria-label="Open new tab"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Open Tab</span>
        </button>

        {isAddMenuOpen && (
          <div
            className={`absolute right-0 mt-1 w-64 rounded-xl shadow-xl border ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200 divide-slate-800'
                : 'bg-white border-slate-200 text-slate-800 divide-slate-100'
            } divide-y z-50 text-xs py-1 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1`}
          >
            <div className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Open Sub-Option in Tab</span>
              <span className="font-mono">{openTabs.length} open</span>
            </div>

            {quickCategories.map((group) => (
              <div key={group.name} className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {group.name}
                </div>
                {group.items.map((item) => {
                  const isAlreadyOpen = openTabs.some(
                    (t) => t.id === item.id || t.tabKey === item.id
                  );
                  const isCurrent = activeTab === item.id;
                  const itemMeta = getTabInfo(item.id);
                  const ItemIcon = itemMeta.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsAddMenuOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`p-1 rounded ${itemMeta.color}`}>
                          <ItemIcon className="w-3 h-3" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isAlreadyOpen && (
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>open</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Menu (Close Others, Close All, Counter) */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-1.5 rounded-lg border text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 ${
            isDark
              ? 'bg-slate-800/80 border-slate-700 hover:bg-slate-700'
              : 'bg-white border-slate-200 hover:bg-slate-50'
          } shadow-sm transition flex items-center gap-1 cursor-pointer text-xs`}
          title="Tab workspace options"
          aria-label="Tab management options"
        >
          <span className="font-mono text-[11px] px-1 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 rounded font-bold">
            {openTabs.length}
          </span>
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {isMenuOpen && (
          <div
            className={`absolute right-0 mt-1 w-52 rounded-xl shadow-xl border ${
              isDark
                ? 'bg-slate-900 border-slate-800 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800'
            } z-50 text-xs py-1 animate-in fade-in slide-in-from-top-1`}
          >
            <div className="px-3 py-2 font-bold text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span>Workspace Tabs</span>
              <span className="font-mono">{openTabs.length} active</span>
            </div>

            <button
              type="button"
              onClick={() => {
                closeOtherWorkspaceTabs(activeTab);
                setIsMenuOpen(false);
              }}
              disabled={openTabs.length <= 1}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Close Other Tabs</span>
            </button>

            <button
              type="button"
              onClick={() => {
                closeAllWorkspaceTabs();
                setIsMenuOpen(false);
              }}
              disabled={openTabs.length <= 1 && openTabs[0]?.id === 'overview'}
              className={`w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Close All (Reset to Dashboard)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
