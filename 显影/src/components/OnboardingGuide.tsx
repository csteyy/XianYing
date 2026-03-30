import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface OnboardingGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingGuide({ isOpen, onClose }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: '欢迎使用',
      description: '互动场域可视化分析 APP 帮助您记录、分析和艺术化呈现互动数据',
      image: '📊',
    },
    {
      title: '创建记录',
      description: '通过麦克风和摄像头记录互动场景，系统将自动采集语音、视频及互动数据',
      image: '🎙️',
    },
    {
      title: '数据分析',
      description: '查看详细的数据分析结果，包括发言详情、个人累计数据和气氛转折事件',
      image: '📈',
    },
    {
      title: '可视化呈现',
      description: '将数据转化为粒子和光束的艺术化可视化作品，可导出分享',
      image: '✨',
    },
  ];

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-3 rounded-full active:bg-muted transition-colors z-10 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 mb-6">
                  <span className="text-5xl">{steps[currentStep].image}</span>
                </div>
                <h2 className="mb-4 font-serif">{steps[currentStep].title}</h2>
                <p className="text-muted-foreground">
                  {steps[currentStep].description}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-primary'
                    : 'w-1.5 bg-muted'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (currentStep > 0) setCurrentStep(currentStep - 1);
              }}
              disabled={currentStep === 0}
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              上一步
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button type="button" onClick={handleClose} className="flex-1">
                完成
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleClose}
                  className="flex-1"
                >
                  跳过
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex-1"
                >
                  下一步
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
