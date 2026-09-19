import { useEffect, useRef } from 'react';

/**
 * Custom hook to close a modal when the mobile back button is pressed.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Function to call when the back button is pressed
 */
export function useModalBack(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Track whether this specific modal instance successfully pushed a history state
    let isPushed = true;
    try {
      window.history.pushState({ modalOpen: true }, '');
    } catch {
      isPushed = false;
    }

    const handlePopState = () => {
      // The browser already popped the history entry when the back button was pressed
      isPushed = false;
      onCloseRef.current?.();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      
      // If closed programmatically or unmounted while still on the pushed state, pop it manually
      if (isPushed) {
        isPushed = false;
        if (window.history.state && window.history.state.modalOpen) {
          window.history.back();
        }
      }
    };
  }, [isOpen]);
}
