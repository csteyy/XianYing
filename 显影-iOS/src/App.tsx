import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Toaster } from 'sonner';
import { HomePage } from './components/HomePage';
import { OnboardingGuide } from './components/OnboardingGuide';
import { RecordingModeSelectionPage } from './components/RecordingModeSelectionPage';
import { RecordingPage } from './components/RecordingPage';
import { PostRecordingEditPage } from './components/PostRecordingEditPage';
import { DataAnalysisPage } from './components/DataAnalysisPage';
import { Visualization3DPage } from './components/Visualization3DPage';
import { HistoryPage } from './components/HistoryPage';
import { GalleryPage } from './components/GalleryPage';
import { SettingsPage } from './components/SettingsPage';
import { BottomNav } from './components/BottomNav';

type Page = 
  | 'home' 
  | 'recording-mode-selection'
  | 'recording'
  | 'post-recording-edit'
  | 'data-analysis' 
  | 'visualization' 
  | 'history' 
  | 'gallery'
  | 'settings';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [showGuide, setShowGuide] = useState(false);
  const [pageData, setPageData] = useState<any>(null);

  useEffect(() => {
    const hasSeenGuide = localStorage.getItem('hasSeenGuide');
    if (!hasSeenGuide) {
      setShowGuide(true);
      localStorage.setItem('hasSeenGuide', 'true');
    }
  }, []);

  const handleNavigate = (page: string, data?: any) => {
    setCurrentPage(page as Page);
    setPageData(data ?? null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            onNavigate={handleNavigate}
            onShowGuide={() => setShowGuide(true)}
          />
        );
      
      case 'recording-mode-selection':
        return (
          <RecordingModeSelectionPage 
            onNavigate={handleNavigate} 
            onBack={() => setCurrentPage('home')}
          />
        );
      
      case 'recording':
        return (
          <RecordingPage 
            onNavigate={handleNavigate} 
            mode={pageData?.mode}
            sceneName={pageData?.sceneName}
          />
        );
      
      case 'post-recording-edit':
        return (
          <PostRecordingEditPage 
            onNavigate={handleNavigate}
            transcripts={pageData?.transcripts}
            speakers={pageData?.speakers}
            mode={pageData?.mode}
            sceneName={pageData?.sceneName}
            titleEditedByUser={pageData?.titleEditedByUser}
            recordingTime={pageData?.recordingTime}
            wavBuffer={pageData?.wavBuffer}
            streamingText={pageData?.streamingText}
          />
        );
      
      case 'data-analysis':
        return (
          <DataAnalysisPage
            onNavigate={handleNavigate}
            from={pageData?.from}
            readOnly={pageData?.readOnly}
            transcripts={pageData?.transcripts}
            speakers={pageData?.speakers}
            annotatedData={pageData?.annotatedData}
            sessionId={pageData?.sessionId}
          />
        );
      
      case 'visualization':
        return (
          <Visualization3DPage
            onNavigate={handleNavigate}
            annotatedData={pageData?.annotatedData}
            from={pageData?.from}
            sessionId={pageData?.sessionId}
          />
        );
      
      case 'history':
        return <HistoryPage onNavigate={handleNavigate} />;
      
      case 'gallery':
        return <GalleryPage onNavigate={handleNavigate} />;
      
      case 'settings':
        return <SettingsPage onNavigate={handleNavigate} />;
      
      default:
        return (
          <HomePage
            onNavigate={handleNavigate}
            onShowGuide={() => setShowGuide(true)}
          />
        );
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-1 overflow-y-auto"
        >
          {renderPage()}
        </motion.div>
      </AnimatePresence>
      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
      <OnboardingGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      <Toaster
        position="top-center"
        duration={1000}
        theme="light"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#1a1a1a',
            border: '1px solid #e5e5e5',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          },
        }}
      />
    </div>
  );
}