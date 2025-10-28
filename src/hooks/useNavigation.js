import { useCallback, useEffect } from 'react';

export function useNavigation(renditionRef, bookRef, DEBUG, updateProgressFromRendition) {

  const goNext = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    try {
      rendition.next();
      updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] next error:', e);
    }
  }, [DEBUG, renditionRef, updateProgressFromRendition]);

  const goPrev = useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    try {
      rendition.prev();
      updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] prev error:', e);
    }
  }, [DEBUG, renditionRef, updateProgressFromRendition]);

  const goToLocation = useCallback(async (location) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    try {
      if (!location) {
        // Si no hay location, ir al inicio
        await rendition.display(0);
      } else {
        await rendition.display(location);
      }
      updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] goToLocation error:', e);
    }
  }, [DEBUG, renditionRef, updateProgressFromRendition]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [goNext, goPrev]);

  return {
    goNext,
    goPrev,
    goToLocation
  };
}