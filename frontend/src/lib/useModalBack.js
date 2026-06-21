import { useEffect } from 'react';

/**
 * Custom hook to close a modal when the mobile back button is pressed.
 * 
 * @param {boolean} isOpen - Whether the modal is currently open
 * @param {function} onClose - Function to call when the back button is pressed
 */
export function useModalBack(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;

    // Push a dummy state to the history stack when the modal opens
    window.history.pushState({ modalOpen: true }, '');

    const handlePopState = (e) => {
      // If the back button is pressed, the state we pushed is popped off.
      // We prevent the default navigation and close the modal instead.
      e.preventDefault();
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      
      // If the modal unmounts or closes normally, and we are still on the "modalOpen" state,
      // we should pop it off manually so we don't trap the user with a broken back button.
      // We check if the current state is the one we pushed.
      if (window.history.state && window.history.state.modalOpen) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);
}
