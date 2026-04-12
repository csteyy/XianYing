import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Mic,
  Clock,
  Image,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Page } from '../App';

interface AppShellProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: string) => void;
}

const NAV_ITEMS: { id: Page; label: string; icon: typeof LayoutDashboard; group: 'main' | 'library' | 'system'; shortcut: string }[] = [
  { id: 'dashboard', label: '首页',   icon: LayoutDashboard, group: 'main',    shortcut: '⌘1' },
  { id: 'record',    label: '录制',   icon: Mic,             group: 'main',    shortcut: '⌘2' },
  { id: 'history',   label: '记录',   icon: Clock,           group: 'library', shortcut: '⌘3' },
  { id: 'gallery',   label: '作品库', icon: Image,           group: 'library', shortcut: '⌘4' },
  { id: 'settings',  label: '设置',   icon: Settings,        group: 'system',  shortcut: '⌘5' },
];

export function AppShell({ children, currentPage, onNavigate }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarW = collapsed ? 64 : 200;

  const groups = {
    main: NAV_ITEMS.filter(i => i.group === 'main'),
    library: NAV_ITEMS.filter(i => i.group === 'library'),
    system: NAV_ITEMS.filter(i => i.group === 'system'),
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarW }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-30 flex flex-col border-r border-[var(--border)] bg-[var(--color-surface-1)] select-none shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[var(--primary-foreground)]">影</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="font-serif text-sm font-medium tracking-wide whitespace-nowrap overflow-hidden"
              >
                显·影
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          {(['main', 'library', 'system'] as const).map((groupKey) => (
            <div key={groupKey} className="space-y-0.5">
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-2 pb-1 text-[10px] uppercase tracking-widest text-[var(--color-ink-faint)]"
                  >
                    {groupKey === 'main' ? '创作' : groupKey === 'library' ? '资料库' : '系统'}
                  </motion.p>
                )}
              </AnimatePresence>
              {groups[groupKey].map((item) => {
                const Icon = item.icon;
                const active = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`
                      relative flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm transition-colors duration-150
                      ${active
                        ? 'text-[var(--color-accent)] bg-[var(--color-accent-glow)]'
                        : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="flex-1 whitespace-nowrap overflow-hidden text-left"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.kbd
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.4 }}
                          exit={{ opacity: 0 }}
                          className="kbd"
                        >
                          {item.shortcut}
                        </motion.kbd>
                      )}
                    </AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--color-accent)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-[var(--border)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-2)] transition-colors focus-ring"
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
