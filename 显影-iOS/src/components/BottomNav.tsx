import { motion, AnimatePresence } from 'motion/react';
import { Home, BookOpen, Image, Settings } from 'lucide-react';

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  const navItems = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'history', label: '记录', icon: BookOpen },
    { id: 'gallery', label: '作品库', icon: Image },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  const hiddenPages = ['recording', 'recording-mode-selection', 'post-recording-edit', 'scene-setup', 'record-preparation', 'data-analysis', 'visualization'];
  const isVisible = !hiddenPages.includes(currentPage);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom"
        >
          <div className="flex items-center justify-around px-2 py-2" style={{ minHeight: '68px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all relative"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="relative z-10"
                  >
                    <Icon className="w-5 h-5" />
                  </motion.div>
                  
                  <span
                    className={`text-xs relative z-10 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
