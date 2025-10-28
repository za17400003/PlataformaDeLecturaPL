import { useCallback, useRef, useEffect, useState } from 'react';

export function useNavigation(renditionRef, bookRef, DEBUG, updateProgressFromRendition) {
  const [isReady, setIsReady] = useState(false);
  const isNavigating = useRef(false);
  const navigationTimeoutRef = useRef(null);
  const navigationQueue = useRef([]);
  const pagesCache = useRef(new Map());
  const currentSpineIndex = useRef(0);
  const spineLength = useRef(0);

  // Inicialización y cleanup
  useEffect(() => {
    const book = bookRef.current;
    if (!book || !book.spine) return;

    spineLength.current = book.spine.length;
    setIsReady(true);

    return () => {
      const currentPagesCache = pagesCache.current;
      if (currentPagesCache) {
        currentPagesCache.clear();
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [bookRef]);

  // Función auxiliar para generar y cachear páginas
  const ensurePagesCached = useCallback(async (spineIndex) => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition || !book.spine) return null;

    try {
      // Si ya está en caché, retornar
      if (pagesCache.current.has(spineIndex)) {
        return pagesCache.current.get(spineIndex);
      }

      // Obtener el item del spine
      const spineItem = book.spine.get(spineIndex);
      if (!spineItem) return null;

      // Cargar y procesar el contenido
      const content = await spineItem.load();
      pagesCache.current.set(spineIndex, {
        cfi: spineItem.cfiBase,
        content,
        index: spineIndex
      });

      return pagesCache.current.get(spineIndex);
    } catch (e) {
      if (DEBUG) console.warn('[reader] cache error:', e);
      return null;
    }
  }, [DEBUG, bookRef, renditionRef]);

  const goNext = useCallback(async () => {
    if (!isReady || isNavigating.current) return;
    
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;

    isNavigating.current = true;
    
    try {
      // Determinar siguiente índice del spine
      const nextIndex = currentSpineIndex.current + 1;
      if (nextIndex >= spineLength.current) {
        isNavigating.current = false;
        return; // Final del libro
      }

      // Pre-cachear la siguiente sección
      await ensurePagesCached(nextIndex);

      // Realizar la navegación
      const nextSection = book.spine.get(nextIndex);
      if (nextSection) {
        await rendition.display(nextSection.cfiBase);
        currentSpineIndex.current = nextIndex;
        
        // Pre-cachear la siguiente sección para una navegación más fluida
        ensurePagesCached(nextIndex + 1).catch(() => {});
      }

      await updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] next error:', e);
    } finally {
      isNavigating.current = false;
    }
  }, [DEBUG, isReady, updateProgressFromRendition, ensurePagesCached, bookRef, renditionRef]);

  const goPrev = useCallback(async () => {
    if (!isReady || isNavigating.current) return;
    
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;

    isNavigating.current = true;
    
    try {
      // Determinar índice anterior del spine
      const prevIndex = currentSpineIndex.current - 1;
      if (prevIndex < 0) {
        isNavigating.current = false;
        return; // Inicio del libro
      }

      // Pre-cachear la sección anterior
      await ensurePagesCached(prevIndex);

      // Realizar la navegación
      const prevSection = book.spine.get(prevIndex);
      if (prevSection) {
        await rendition.display(prevSection.cfiBase);
        currentSpineIndex.current = prevIndex;
        
        // Pre-cachear la sección anterior para una navegación más fluida
        ensurePagesCached(prevIndex - 1).catch(() => {});
      }

      await updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] prev error:', e);
    } finally {
      isNavigating.current = false;
    }
  }, [DEBUG, isReady, updateProgressFromRendition, ensurePagesCached, bookRef, renditionRef]);

  const goToLocation = useCallback(async (location) => {
    if (!isReady || isNavigating.current) return;
    
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition) return;

    isNavigating.current = true;
    
    try {
      let targetLocation = location;
      let targetIndex = 0;

      if (!location) {
        // Si no hay location, ir al inicio
        const firstSection = book.spine.get(0);
        if (firstSection) {
          targetLocation = firstSection.cfiBase;
          targetIndex = 0;
        }
      } else {
        // Encontrar el índice del spine para la location dada
        const spinePos = book.spine.find(targetLocation);
        if (spinePos > -1) {
          targetIndex = spinePos;
        }
      }

      // Pre-cachear la sección objetivo
      await ensurePagesCached(targetIndex);

      // Realizar la navegación
      await rendition.display(targetLocation);
      currentSpineIndex.current = targetIndex;

      // Pre-cachear secciones adyacentes
      Promise.all([
        ensurePagesCached(targetIndex - 1),
        ensurePagesCached(targetIndex + 1)
      ]).catch(() => {});

      await updateProgressFromRendition();
    } catch (e) {
      if (DEBUG) console.warn('[reader] goToLocation error:', e);
    } finally {
      isNavigating.current = false;
    }
  }, [DEBUG, isReady, updateProgressFromRendition, ensurePagesCached, bookRef, renditionRef]);

  // Keyboard navigation setup
  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [goNext, goPrev]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      navigationQueue.current = [];
      isNavigating.current = false;
    };
  }, []);

  const processNavigationQueue = useCallback(async () => {
    if (navigationQueue.current.length === 0 || isNavigating.current) return;

    const nextNavigation = navigationQueue.current[0];
    navigationQueue.current = navigationQueue.current.slice(1);

    try {
      switch (nextNavigation.type) {
        case 'next':
          await goNext();
          break;
        case 'prev':
          await goPrev();
          break;
        case 'location':
          await goToLocation(nextNavigation.location);
          break;
      }
    } catch (e) {
      if (DEBUG) console.warn('[reader] navigation queue error:', e);
    }

    if (navigationQueue.current.length > 0) {
      navigationTimeoutRef.current = setTimeout(processNavigationQueue, 100);
    }
  }, [goNext, goPrev, goToLocation, DEBUG]);

  return {
    goNext,
    goPrev,
    goToLocation,
    processNavigationQueue
  };
}