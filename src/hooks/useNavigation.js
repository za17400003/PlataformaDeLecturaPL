import { useCallback, useEffect } from 'react';

export function useNavigation(renditionRef, bookRef, DEBUG, updateProgressFromRendition) {

  const goNext = useCallback(async () => {
    const rendition = renditionRef.current;
    const book = bookRef.current;
    if (!rendition || !book) return;

    try {
      const loc = rendition.currentLocation();
      const section = loc?.start?.index || 0;
      
      if (section < book.spine.length - 1) {
        await rendition.next();
        updateProgressFromRendition();
      }
    } catch (e) {
      if (DEBUG) console.warn('[reader] next error:', e);
    }
  }, [renditionRef, bookRef, DEBUG, updateProgressFromRendition]);

  const goPrev = useCallback(async () => {
    const rendition = renditionRef.current;
    const book = bookRef.current;
    if (!rendition || !book) return;

    try {
      const loc = rendition.currentLocation();
      const section = loc?.start?.index || 0;
      
      if (section > 0) {
        await rendition.prev();
        updateProgressFromRendition();
      }
    } catch (e) {
      if (DEBUG) console.warn('[reader] prev error:', e);
    }
  }, [renditionRef, bookRef, DEBUG, updateProgressFromRendition]);

  const goToLocation = useCallback(async (location) => {
    const rendition = renditionRef.current;
    const book = bookRef.current;
    if (!rendition || !book) return;
    
    try {
      if (typeof location === 'number' && !isNaN(location)) {
        // Si es un número, usar locations
        const totalLocs = book.locations.length();
        const targetLoc = Math.max(0, Math.min(location, totalLocs));
        const cfi = book.locations.cfiFromLocation(targetLoc);
        if (cfi) {
          await rendition.display(cfi);
          updateProgressFromRendition();
          return;
        }
      } else if (!location) {
        // Si no hay location, ir al inicio usando el primer ítem del spine
        const firstSection = book.spine.get(0);
        if (firstSection) {
          await rendition.display(firstSection.href);
        }
      } else {
        await rendition.display(location);
      }
      await updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] goToLocation error:', e);
    }
  }, [DEBUG, renditionRef, bookRef, updateProgressFromRendition]);

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