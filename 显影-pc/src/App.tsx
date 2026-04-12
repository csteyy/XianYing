import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { AppShell } from './layouts/AppShell';
import { WelcomePage } from './pages/WelcomePage';
import { DashboardPage } from './pages/DashboardPage';
import { RecordPage } from './pages/RecordPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { VisualizationPage } from './pages/VisualizationPage';
import { HistoryPage } from './pages/HistoryPage';
import { GalleryPage } from './pages/GalleryPage';
import { SettingsPage } from './pages/SettingsPage';

export type Page =
  | 'dashboard'
  | 'record'
  | 'analysis'
  | 'visualization'
  | 'history'
  | 'gallery'
  | 'settings';

const SHORTCUT_MAP: Record<string, Page> = {
  '1': 'dashboard',
  '2': 'record',
  '3': 'history',
  '4': 'gallery',
  '5': 'settings',
};

const ONBOARD_KEY = 'xianying-pc-onboarded';

export default function App() {
  const [onboarded, setOnboarded] = useState(
    () => localStorage.getItem(ONBOARD_KEY) === 'true'
  );
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [pageData, setPageData] = useState<any>(null);

  const navigate = useCallback((page: string, data?: any) => {
    setCurrentPage(page as Page);
    setPageData(data ?? null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (!e.metaKey && !e.ctrlKey) return;
      const page = SHORTCUT_MAP[e.key];
      if (page) { e.preventDefault(); navigate(page); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const renderPage = () => {
    const props = { onNavigate: navigate, pageData };
    switch (currentPage) {
      case 'dashboard':    return <DashboardPage {...props} />;
      case 'record':       return <RecordPage {...props} />;
      case 'analysis':     return <AnalysisPage {...props} />;
      case 'visualization': return <VisualizationPage {...props} />;
      case 'history':      return <HistoryPage {...props} />;
      case 'gallery':      return <GalleryPage {...props} />;
      case 'settings':     return <SettingsPage {...props} />;
      default:             return <DashboardPage {...props} />;
    }
  };

  if (!onboarded) {
    return (
      <WelcomePage onComplete={() => {
        localStorage.setItem(ONBOARD_KEY, 'true');
        setOnboarded(true);
      }} />
    );
  }

  return (
    <AppShell currentPage={currentPage} onNavigate={navigate}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
      <Toaster
        position="top-right"
        duration={2500}
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--color-surface-2)',
            color: 'var(--color-ink)',
            border: '1px solid var(--border)',
          },
        }}
      />
    </AppShell>
  );
}
