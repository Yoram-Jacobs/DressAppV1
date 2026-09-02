import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scan, Palette, Shirt, Sparkles, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ScanningPipeline({ variant = 'inline' }) {
  const { t } = useTranslation();
  
  const steps = [
    { text: t('scanning.bounds', { defaultValue: 'Detecting Garment Bounds...' }), icon: Scan },
    { text: t('scanning.colors', { defaultValue: 'Extracting Color Palette...' }), icon: Palette },
    { text: t('scanning.silhouette', { defaultValue: 'Analyzing Silhouette...' }), icon: Shirt },
    { text: t('scanning.materials', { defaultValue: 'Inferring Fabric Materials...' }), icon: Sparkles },
    { text: t('scanning.tags', { defaultValue: 'Generating Stylist Tags...' }), icon: Wand2 },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // 1500ms keeps it readable but fast enough to distract during AI latency
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % steps.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [steps.length]);

  const CurrentIcon = steps[currentIndex].icon;

  if (variant === 'block') {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="relative h-14 w-14 mb-3">
          <div className="absolute inset-0 rounded-full bg-[hsl(var(--accent))] opacity-20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 rounded-full bg-secondary flex items-center justify-center border-2 border-[hsl(var(--accent))] shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]">
             <CurrentIcon className="h-6 w-6 text-[hsl(var(--accent))] animate-pulse" />
          </div>
        </div>
        <div className="h-12 relative w-full flex justify-center items-center font-display text-xl mb-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="absolute whitespace-nowrap text-[hsl(var(--accent))]"
            >
              {steps[currentIndex].text}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center overflow-hidden h-5 w-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 absolute start-0"
        >
          <CurrentIcon className="h-3.5 w-3.5 text-[hsl(var(--accent))] animate-pulse shrink-0" />
          <span className="font-medium whitespace-nowrap text-xs">{steps[currentIndex].text}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
