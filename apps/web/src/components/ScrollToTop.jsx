import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ScrollToTop({ scrollContainerRef }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = scrollContainerRef 
        ? scrollContainerRef.current?.scrollTop || 0
        : window.scrollY;

      if (scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    const target = scrollContainerRef?.current || window;
    target.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    handleScroll();

    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef]);

  const handleScrollToTop = () => {
    if (scrollContainerRef?.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!visible) return null;

  return (
    <Button
      onClick={handleScrollToTop}
      size="icon"
      className="fixed bottom-20 right-6 md:bottom-8 md:right-8 z-50 rounded-full h-11 w-11 bg-brand text-brand-foreground hover:bg-brand/90 shadow-lg hover:scale-105 active:scale-95 transition-all duration-200"
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
