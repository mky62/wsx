import { useEffect, useState } from 'react';

export function useScrollToggle() {
  const [isScrollEnabled, setIsScrollEnabled] = useState(false);

  useEffect(() => {
    // Function to update the class on body
    const updateScrollState = (enabled: boolean) => {
      if (enabled) {
        document.body.classList.add('scroll-enabled');
        document.documentElement.classList.add('scroll-enabled');
      } else {
        document.body.classList.remove('scroll-enabled');
        document.documentElement.classList.remove('scroll-enabled');
      }
    };

    // Initial state
    updateScrollState(isScrollEnabled);

    // Keyboard listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsScrollEnabled(prev => {
          const newState = !prev;
          updateScrollState(newState);
          console.log(`Scroll lock ${newState ? 'disabled' : 'enabled'} (Desktop)`);
          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Clean up classes on unmount
      document.body.classList.remove('scroll-enabled');
      document.documentElement.classList.remove('scroll-enabled');
    };
  }, [isScrollEnabled]); // Re-bind if needed, or better just rely on ref/state inside

  return isScrollEnabled;
}
