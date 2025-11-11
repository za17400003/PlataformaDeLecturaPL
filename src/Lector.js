import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import './lector.css';
import { useBuildPrefsCss, useInjectCssIntoContents, useApplyPrefsToRendition } from './hooks/usePreferences';
import { useNavigation } from './hooks/useNavigation';
import { useGazepoint } from './hooks/useGazepoint';

export default function Lector(props) {
  const { archivo, onClose } = props;

  // Debug flag
  const DEBUG = true;

  // Función para reaplicar estilos (simplificada como backup)
  const reapplyAdaptiveStyles = useCallback(async () => {
    const rendition = renditionRef.current;
    if (!rendition || !mountedRef.current) return;

    try {
      // Simplemente aplicar las preferencias como en backup
      applyPrefsToRendition(rendition, prefs);
    } catch (e) {
      if (DEBUG) console.warn('[reader] Error reaplicando estilos adaptativos:', e);
    }
  }, [prefs, applyPrefsToRendition]);

  // Referencias principales
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const mountedRef = useRef(true);
  const resizeObserverRef = useRef(null);

  // Estados generales del lector
  const [isTwoPages, setIsTwoPages] = useState(false); // Comienza en modo una página
  const [progress, setProgress] = useState(0); // 0..100
  const [ready, setReady] = useState(false);
  const [totalLocations, setTotalLocations] = useState(0);
  
  // Estados de UI
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('texto');
  const [showPageArrows, setShowPageArrows] = useState(false);
  
  // Estados de grabación
  const [isRecording, setIsRecording] = useState(false);
  
  // Referencias para control de estado
  const locationsReadyRef = useRef(false);
  const progressRef = useRef(0);
  const hideArrowsTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // Preference hooks y estado
  const buildPrefsCss = useBuildPrefsCss();
  const injectCssIntoContents = useInjectCssIntoContents(DEBUG);
  const applyPrefsToRendition = useApplyPrefsToRendition(buildPrefsCss, injectCssIntoContents, DEBUG);

  const [prefs, setPrefs] = useState(() => {
    const savedPrefs = localStorage.getItem('readerPrefs');
    return savedPrefs ? JSON.parse(savedPrefs) : {
      font: 'original',
      fontSize: 100,
      lineHeight: 1.45,
      theme: 'light',
      brightness: 1.0
    };
  });

  // Gestión de flechas de navegación
  const handleMouseMove = useCallback(() => {
    // Keep arrows visible while the mouse is over the reader area.
    // We show arrows on mouse move/enter and rely on onMouseLeave to hide them.
    setShowPageArrows(true);
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
      hideArrowsTimerRef.current = null;
    }
  }, []);

  // Función para actualizar el progreso desde la ubicación actual
  const updateProgressFromRendition = useCallback(async (locObj) => {
    const rendition = renditionRef.current;
    const book = bookRef.current;
    if (!book || !rendition) return;

    try {
      if (!locationsReadyRef.current) {
        await book.locations.generate(300);
        locationsReadyRef.current = true;
        setTotalLocations(book.locations.length());
      }

      const loc = locObj || (rendition.currentLocation && rendition.currentLocation());
      if (!loc) return;

      const cfi = (loc.start ? loc.start.cfi : loc.cfi) || null;
      if (!cfi || !book.locations) return;

      const progress = book.locations.percentageFromCfi(cfi) * 100;
      setProgress(Number(progress.toFixed(2)));
      progressRef.current = progress;

      if (DEBUG) console.debug('[reader] progress updated:', progress.toFixed(2));
      
      // Asegurar que las flechas sean visibles después de actualizar el progreso
      handleMouseMove();
    } catch (e) {
      if (DEBUG) console.warn('[reader] progress update error:', e);
    }
  }, [DEBUG, setProgress, setTotalLocations, handleMouseMove]);

  // Sistema de navegación
  const { goNext: baseGoNext, goPrev: baseGoPrev, goToLocation } = useNavigation(
    renditionRef,
    bookRef,
    DEBUG,
    updateProgressFromRendition
  );

  const goNext = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (isTwoPages) {
      try {
        baseGoNext();
        baseGoNext();
      } catch (e) {
        if (DEBUG) console.warn('[reader] goNext error, attempting safe fallback', e);
        const r = renditionRef.current;
        if (r && r.display) {
          // try a safe redisplay to recover
          try { r.display(); } catch (err) { if (DEBUG) console.warn('[reader] fallback display failed', err); }
        }
      }
    } else {
      try {
        baseGoNext();
      } catch (e) {
        if (DEBUG) console.warn('[reader] goNext error, attempting safe fallback', e);
        const r = renditionRef.current;
        if (r && r.display) {
          try { r.display(); } catch (err) { if (DEBUG) console.warn('[reader] fallback display failed', err); }
        }
      }
    }
  }, [isTwoPages, baseGoNext]);

  const goPrev = useCallback(() => {
    if (!mountedRef.current) return;
    
    if (isTwoPages) {
      try {
        baseGoPrev();
        baseGoPrev();
      } catch (e) {
        if (DEBUG) console.warn('[reader] goPrev error, attempting safe fallback', e);
        const r = renditionRef.current;
        if (r && r.display) {
          try { r.display(); } catch (err) { if (DEBUG) console.warn('[reader] fallback display failed', err); }
        }
      }
    } else {
      try {
        baseGoPrev();
      } catch (e) {
        if (DEBUG) console.warn('[reader] goPrev error, attempting safe fallback', e);
        const r = renditionRef.current;
        if (r && r.display) {
          try { r.display(); } catch (err) { if (DEBUG) console.warn('[reader] fallback display failed', err); }
        }
      }
    }
  }, [isTwoPages, baseGoPrev]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyPress(e) {
      if (!ready) return;
      
      switch (e.key) {
        case 'ArrowRight':
          goNext();
          break;
        case 'ArrowLeft':
          goPrev();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [ready, goNext, goPrev]);

  // eslint-disable-next-line no-unused-vars
  const handleResize = useCallback((renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container || !mountedRef.current) return;

    requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      
      try {
        rendition.resize();
        if (DEBUG) console.debug('[reader] resize applied');
        
        // Re-aplicar preferencias después del resize
        applyPrefsToRendition(rendition, prefs);
      } catch (e) {
        if (DEBUG) console.warn('[reader] resize error:', e);
      }
    });
  }, [DEBUG, prefs, applyPrefsToRendition]);

  // Handler de resize seguro con debounce y RAF
  const safeRenditionResize = useCallback(async (renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container || !mountedRef.current || !rendition.display) return;
    
    return new Promise((resolve) => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      
      requestAnimationFrame(() => {
        try {
          if (mountedRef.current) {
            rendition.resize();
            applyPrefsToRendition(rendition, prefs);
          }
        } catch (e) {
          if (DEBUG) console.warn('[reader] resize error:', e);
        }
        resolve();
      });
    });
  }, [DEBUG, prefs, applyPrefsToRendition]);



  // Función para actualizar preferencias
  const updatePref = useCallback((newPref) => {
    setPrefs(prev => {
      const updated = { ...prev, ...newPref };
      localStorage.setItem('readerPrefs', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Función para aplicar preferencias a todos los elementos
  const applyPrefsToAll = useCallback((prefs) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    applyPrefsToRendition(rendition, prefs);
  }, [applyPrefsToRendition]);

  // Handlers que actualizan estado y aplican inmediatamente
  const handleFontChange = useCallback((font) => {
    updatePref({ font });
  }, [updatePref]);

  const handleFontSizeChange = useCallback((value) => {
    updatePref({ fontSize: Number(value) });
  }, [updatePref]);

  const handleLineHeightChange = useCallback((percentValue) => {
    updatePref({ lineHeight: Number(percentValue) / 100 });
  }, [updatePref]);

  const handleBrightnessChange = useCallback((value) => {
    const b = Math.max(0.5, Math.min(1.2, Number(value) / 100));
    updatePref({ brightness: b });
  }, [updatePref]);

  const handleThemeChange = useCallback((theme) => {
    updatePref({ theme });
  }, [updatePref]);

  // aplicar prefs cuando cambian y cuando el rendition esté listo
  useEffect(() => {
    applyPrefsToAll(prefs);
  }, [prefs, applyPrefsToAll]);

  // Efecto para limpiar el timer de flechas al desmontar
  useEffect(() => {
    return () => {
      if (hideArrowsTimerRef.current) {
        clearTimeout(hideArrowsTimerRef.current);
        hideArrowsTimerRef.current = null;
      }
    };
  }, []);

  // Efecto para manejar cambios de orientación/tamaño (como Google Play Libros)
  useEffect(() => {
    let resizeTimeout;
    
    const handleAdaptiveResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(async () => {
        const rendition = renditionRef.current;
        if (!rendition || !mountedRef.current) return;
        
        try {
          // Reconfigurar estilos adaptativos
          await reapplyAdaptiveStyles();
          if (DEBUG) console.log('[reader] Estilos adaptativos reaplicados por cambio de tamaño');
        } catch (e) {
          if (DEBUG) console.warn('[reader] Error reaplicando estilos adaptativos:', e);
        }
      }, 300); // Debounce de 300ms
    };

    window.addEventListener('resize', handleAdaptiveResize);
    window.addEventListener('orientationchange', handleAdaptiveResize);

    return () => {
      window.removeEventListener('resize', handleAdaptiveResize);
      window.removeEventListener('orientationchange', handleAdaptiveResize);
      clearTimeout(resizeTimeout);
    };
  }, [reapplyAdaptiveStyles, DEBUG]);

  // Inicialización y cleanup
  useEffect(() => {
    if (!archivo) return;

    // Siempre empezar en modo una página
    setIsTwoPages(false);
    mountedRef.current = true;
    
    // Limpiar ResizeObserver anterior
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    const initBook = async () => {
      if (!mountedRef.current) return;

      try {
        // Limpiar cualquier instancia previa
        if (renditionRef.current) {
          try {
            renditionRef.current.destroy();
          } catch (e) {
            if (DEBUG) console.warn('[reader] error destroying rendition:', e);
          }
          renditionRef.current = null;
        }

        if (bookRef.current) {
          try {
            bookRef.current.destroy();
          } catch (e) {
            if (DEBUG) console.warn('[reader] error destroying book:', e);
          }
          bookRef.current = null;
        }
        
        // Detener ResizeObserver anterior si existe
        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }
        
        // Crear y cargar el libro
        if (DEBUG) {
          console.log('Creando nueva instancia del libro...', {
            archivo,
            tipo: typeof archivo,
            url: archivo instanceof Blob ? URL.createObjectURL(archivo) : archivo
          });
        }
        const book = ePub(archivo);
        bookRef.current = book;
        
        // Esperar a que el libro esté completamente cargado
        if (DEBUG) console.log('Esperando a que el libro esté listo...');
        await book.ready;
        if (DEBUG) {
          console.log('Libro cargado:', {
            spine: book.spine.length,
            metadata: book.package.metadata
          });
        }
        
        if (!mountedRef.current) return;

        // Crear el rendition con configuración simple (como backup)
        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'auto' // Usar la configuración simple del backup
        });
        
        renditionRef.current = rendition;
        
        // Esperar a que el rendition esté listo (o timeout)
        if (DEBUG) console.log('Esperando a que el rendition esté listo...');
        await Promise.race([
          new Promise((resolve) => {
            try {
              rendition.once('rendered', () => {
                if (DEBUG) console.log('Rendition rendered event fired');
                resolve('rendered');
              });
            } catch (e) {
              if (DEBUG) console.warn('[reader] error attaching rendered listener', e);
              resolve('error');
            }
          }),
          new Promise((resolve) => setTimeout(() => {
            console.warn('[reader] rendition.rendered timeout after 4000ms, continuing');
            resolve('timeout');
          }, 4000))
        ]);
        
        if (!mountedRef.current) return;

        // Ahora cargar el resto de los componentes (no bloquear si alguno tarda)
        if (DEBUG) console.log('Cargando componentes del libro...');
        try {
          const loadedPromises = [
            book.loaded?.navigation,
            book.loaded?.metadata,
            book.loaded?.cover,
            book.loaded?.spine
          ].filter(Boolean);

          const settled = await Promise.allSettled(loadedPromises.map(p => (
            // wrap each promise with a small timeout to avoid indefinite wait
            Promise.race([p, new Promise((res) => setTimeout(() => res('timeout'), 3000))])
          )));
          if (DEBUG) console.log('[reader] loaded components status:', settled);
        } catch (e) {
          if (DEBUG) console.warn('[reader] error loading components:', e);
        }

        // Generar locations antes de mostrar la primera página
        if (!book.locations.length()) {
          if (DEBUG) console.log('Generando locations...');
          await book.locations.generate(300);
          locationsReadyRef.current = true;
          setTotalLocations(book.locations.length());
        }

        // Mostrar la primera página (con protección)
        if (DEBUG) console.log('Mostrando primera página...');
        try {
          const firstHref = book.spine && book.spine.get && book.spine.get(0) && book.spine.get(0).href;
          if (firstHref) {
            await rendition.display(firstHref);
          } else {
            await rendition.display();
          }
        } catch (err) {
          if (DEBUG) console.warn('[reader] rendition.display failed, trying fallback', err);
          try { await rendition.display(); } catch (err2) { if (DEBUG) console.error('[reader] fallback rendition.display also failed', err2); }
        }

        // Asegurar que estamos en modo una página
        rendition.spread(false);
        
        // Configurar ResizeObserver después de tener el rendition
        const resizeObserver = new ResizeObserver(() => {
          if (!mountedRef.current || !renditionRef.current) return;
          
          requestAnimationFrame(() => {
            if (!mountedRef.current || !renditionRef.current) return;
            
            try {
              renditionRef.current.resize();
              // DESACTIVAR CSS personalizado
              // applyPrefsToRendition(renditionRef.current, prefs);
              if (showPageArrows) {
                handleMouseMove();
              }
            } catch (e) {
              if (DEBUG) console.warn('[reader] resize error:', e);
            }
          });
        });

        if (viewerRef.current) {
          resizeObserver.observe(viewerRef.current);
          resizeObserverRef.current = resizeObserver;
        }

        // Configuración simple y básica - SIN temas personalizados
        console.log('Rendition creado, aplicando configuración mínima...');
        
        // NO aplicar ningún tema personalizado - dejar que ePub.js maneje todo por defecto
        // Configurar event handlers
        renditionRef.current.on('relocated', (loc) => {
          if (!mountedRef.current) return;
          updateProgressFromRendition(loc).catch(() => {});
          // DESACTIVAR CSS personalizado
          // try { applyPrefsToRendition(renditionRef.current, prefs); } catch (e) { if (DEBUG) console.warn('[reader] applyPrefs relocated error', e); }
        });

        renditionRef.current.on('rendered', (section) => {
          if (!mountedRef.current) return;
          try {
            // Aplicar solo las preferencias básicas (tema, fuente) SIN CSS restrictivo
            applyPrefsToRendition(renditionRef.current, prefs);
          } catch (e) {
            if (DEBUG) console.warn('[reader] applyPrefs rendered error', e);
          }
          // Ensure internal content exists before touching it
          try {
            if (section && section.document) {
              // set background color inside iframe/doc to reduce white flashes
              try { section.document.body.style.background = ''; } catch (e) {}
            }
          } catch (ee) {
            if (DEBUG) console.warn('[reader] section safety check failed', ee);
          }
          handleMouseMove();

          // Reveal viewer after first render
          try {
            if (viewerRef.current) {
              viewerRef.current.classList.remove('hidden');
              // small delay to ensure CSS applied
              setTimeout(() => {
                if (viewerRef.current) viewerRef.current.classList.add('fade-in');
              }, 30);
            }
          } catch (e) { if (DEBUG) console.warn('[reader] reveal viewer failed', e); }
        });

        // Marcar como listo
        setReady(true);
      } catch (error) {
        console.error('[reader] initialization error:', error);
        setReady(true); // Marcar como ready incluso en error
      }
    };    initBook();

    // Cleanup function
    return () => {
      mountedRef.current = false;
      
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      try {
        if (renditionRef.current) {
          renditionRef.current.destroy();
          renditionRef.current = null;
        }
        if (bookRef.current) {
          bookRef.current.destroy();
          bookRef.current = null;
        }
      } catch (e) {
        if (DEBUG) console.warn('[reader] cleanup error:', e);
      }
    };
  }, [archivo, DEBUG, prefs, applyPrefsToRendition, updateProgressFromRendition, isTwoPages, handleMouseMove, showPageArrows]);

  // limpiar timer de flechas al desmontar
  useEffect(() => {
    return () => {
      if (hideArrowsTimerRef.current) {
        clearTimeout(hideArrowsTimerRef.current);
        hideArrowsTimerRef.current = null;
      }
    };
  }, []);

  // cambiar entre 1 y 2 páginas y configurar spread
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    // Función que actualiza el layout basado en el modo de visualización
    async function updateLayout() {
      try {
        if (isTwoPages) {
          rendition.spread('both');
        } else {
          rendition.spread(false);
        }
        await rendition.display();
        const containerClass = isTwoPages ? 'two-pages' : 'single-page';
        viewerRef.current.className = `Lector-viewer ${containerClass}`;

        if (isTwoPages) {
          // Primero limpiar el rendition actual
          await rendition.clear();
          
          // Configurar el spread para dos páginas
          rendition.settings.spread = true;
          rendition._layout.spread = true;
          rendition.spread('both');
          
          // Re-renderizar la página actual
          await rendition.display();
        } else {
          // Limpiar y configurar para una página
          await rendition.clear();
          rendition.settings.spread = false;
          rendition._layout.spread = false;
          rendition.spread(false);
          
          // Re-renderizar la página actual
          await rendition.display();
        }
        
        // Dar tiempo para que el cambio se aplique
        await new Promise(resolve => setTimeout(resolve, 200));

        // CSS específico para cada modo
        const css = isTwoPages ? `
          .epub-container {
            background: white !important;
          }
          .epub-view {
            display: flex !important;
            width: 100% !important;
            justify-content: center !important;
          }
          .epub-view > iframe {
            width: 50% !important;
            max-width: 50% !important;
            margin: 0 !important;
          }
        ` : `
          .epub-container {
            background: white !important;
          }
          .epub-view {
            display: block !important;
            width: 100% !important;
          }
          .epub-view > iframe {
            width: 100% !important;
            margin: 0 auto !important;
            display: block !important;
          }
        `;

        // Aplicar CSS
        await injectCssIntoContents(rendition, css);
        
        // Realizar el resize después de aplicar el CSS
        await safeRenditionResize();

        // Re-mostrar en la ubicación actual para asegurar el layout correcto
        const loc = rendition.currentLocation();
        if (loc) {
          const cfi = loc.start ? loc.start.cfi : loc.cfi;
          if (cfi) {
            await rendition.display(cfi);
          }
        }
      } catch (e) {
        console.warn('Error al cambiar modo de visualización:', e);
      }
    }

    if (rendition.manager?.container) {
      updateLayout();
    }
  }, [isTwoPages, renditionRef, bookRef, safeRenditionResize, injectCssIntoContents, DEBUG]);

  // Recalcular ubicaciones cuando cambian ajustes que afectan el layout
  useEffect(() => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book?.locations || !rendition) return;
    let alive = true;

    (async () => {
        try {
          // esperar un momento para que el CSS aplicado tenga efecto
          await new Promise((r) => setTimeout(r, 120));
          // regenerar localizaciones con mayor resolución
          await book.locations.generate(300);
          locationsReadyRef.current = true;
          if (!alive || !book?.locations) return;
          const total = book.locations.length();
          setTotalLocations(total || 0);
          // actualizar progreso basado en la ubicación actual
          if (alive) {
            await updateProgressFromRendition();
            // Asegurar que las flechas sean visibles después de actualizar el layout
            handleMouseMove();
          }
        } catch (e) {
          // ignore
        }
    })();

    return () => { alive = false; };
  }, [prefs.fontSize, prefs.lineHeight, isTwoPages, updateProgressFromRendition, handleMouseMove]);

  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  // Recording functions
  const { startRecording: startGazeTracking, stopRecording: stopGazeTracking } = useGazepoint();
  
  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.error('getUserMedia no soportado');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const recordingPath = `recordings/${timestamp}`;

      // Iniciar eye tracking
      startGazeTracking(recordingPath);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const formData = new FormData();
          const videoBlob = new Blob([blob], { type: 'video/webm' });
          formData.append('video', videoBlob, `${timestamp}.webm`);
          
          const response = await fetch('http://localhost:3001/api/upload', {
            method: 'POST',
            body: formData,
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error de servidor:', errorText);
            throw new Error('Error al guardar la grabación');
          }

          // Detener eye tracking después de guardar el video
          stopGazeTracking();
          
          chunksRef.current = [];
        } catch (error) {
          console.error('Error saving recording:', error);
          stopGazeTracking(); // Asegurar que el eye tracking se detiene incluso en error
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [startGazeTracking, stopGazeTracking]);

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    const stream = streamRef.current;

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
      videoPreviewRef.current.style.display = 'none';
    }

    setIsRecording(false);
    mediaRecorderRef.current = null;
    streamRef.current = null;
  }, []);

  // goToStart utiliza hook de navegación
  const goToStart = useCallback(() => {
    const r = renditionRef.current;
    if (!r || !r.display) return;
    goToLocation();
  }, [goToLocation]);

  const onPageSliderChange = useCallback((e) => {
    if (showSettings) return;
    const page = Number(e.target.value);
    const book = bookRef.current;
    if (!book?.locations || !locationsReadyRef.current) return;
    
    try {
      const total = book.locations.length() || 1;
      const cfi = book.locations.cfiFromPercentage((page - 0.5) / total);
      setProgress(Number(((page - 0.5) / total * 100).toFixed(2)));
      goToLocation(cfi);
    } catch (err) {
      if (DEBUG) console.warn('[reader] navigation error:', err);
    }
  }, [DEBUG, setProgress, goToLocation, showSettings]);

  // Página actual y total (basado en locations); progreso es 0..100
  const totalPages = totalLocations || 0;
  const currentPage = (() => {
    if (!totalPages) return 0;
    const r = renditionRef.current;
    const book = bookRef.current;
    const hasLocations = book && book.locations && locationsReadyRef.current;
    const canUsePercentage = r && typeof book?.locations?.percentageFromCfi === 'function';
    
    if (hasLocations && canUsePercentage) {
      try {
        const loc = r.currentLocation && r.currentLocation();
        const cfi = loc && ((loc.start ? loc.start.cfi : loc.cfi) || null);
        if (cfi) {
          const pct = book.locations.percentageFromCfi(cfi);
          const idx = Math.min(totalPages - 1, Math.max(0, Math.floor(pct * totalPages)));
          return idx + 1;
        }
      } catch (e) {
        if (DEBUG) console.warn('[reader] currentPage compute error:', e);
      }
    }
    return Math.max(1, Math.min(totalPages, Math.ceil((progress / 100) * totalPages)));
  })();

  return (
    <div className="Lector-overlay" onClick={() => setShowSettings(false)}>
      <div className="Lector-panel">
        <header className="Lector-header">
          <div className="Lector-title">Lector</div>
          <div className="Lector-controls">
            <label className="Switch">
              <input
                type="checkbox"
                checked={isTwoPages}
                onChange={() => setIsTwoPages(v => !v)}
              />
              <span className="Slider-visual" />
              <span className="Switch-label">{isTwoPages ? '2 páginas' : '1 página'}</span>
            </label>

            <button 
              className="HeaderBtn" 
              onClick={goToStart} 
              title="Inicio"
              style={{
                width: '42px',
                height: '42px',
                background: '#ffffff',
                border: '1px solid #e6e6e6',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#1b5e5a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >⤺</button>

            {/* botón de ajustes que abre popup */}
            <button 
              className="HeaderBtn" 
              onClick={(e) => { e.stopPropagation(); toggleSettings(); }} 
              title="Ajustes"
              style={{
                width: '42px',
                height: '42px',
                background: '#ffffff',
                border: '1px solid #e6e6e6',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#1b5e5a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >A</button>

            <button 
              className="HeaderBtn close" 
              onClick={onClose} 
              title="Cerrar"
              style={{
                width: '42px',
                height: '42px',
                background: '#ff4757',
                border: '1px solid #ff6b6b',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >✕</button>
          </div>

          {/* POPUP: ajustes de lectura */}
          {showSettings && (
            <div className="Settings-popover" role="dialog" aria-label="Ajustes de lectura" onClick={(e) => e.stopPropagation()}>
              <div className="Settings-tabs">
                <button className={`tab ${activeTab === 'texto' ? 'active' : ''}`} onClick={() => setActiveTab('texto')}>Texto</button>
                <button className={`tab ${activeTab === 'iluminacion' ? 'active' : ''}`} onClick={() => setActiveTab('iluminacion')}>Iluminación</button>
              </div>

              <div className="Settings-body">
                {activeTab === 'texto' && (
                  <>
                    <div className="Settings-section">
                      <div className="section-title">Fuente</div>
                      <div className="font-options">
                        <button className={`font-btn ${prefs.font === 'original' ? 'active' : ''}`} onClick={() => handleFontChange('original')}>Original</button>
                        <button className={`font-btn ${prefs.font === 'sans' ? 'active' : ''}`} onClick={() => handleFontChange('sans')}>Sans</button>
                        <button className={`font-btn ${prefs.font === 'merri' ? 'active' : ''}`} onClick={() => handleFontChange('merri')}>Merri</button>
                      </div>
                    </div>

                    <div className="Settings-section">
                      <div className="section-title">Tamaño</div>
                      <div className="range-row">
                        <input type="range" min="70" max="160" value={prefs.fontSize}
                          onChange={(e) => handleFontSizeChange(e.target.value)} />
                        <div className="range-value">{prefs.fontSize}%</div>
                      </div>
                    </div>

                    <div className="Settings-section">
                      <div className="section-title">Interlineado</div>
                      <div className="range-row">
                        <input type="range" min="110" max="200" value={Math.round(prefs.lineHeight * 100)}
                          onChange={(e) => handleLineHeightChange(e.target.value)} />
                        <div className="range-value">{Math.round(prefs.lineHeight * 100)}%</div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'iluminacion' && (
                  <>
                    <div className="Settings-section">
                      <div className="section-title">Brillo para leer</div>
                      <div className="range-row">
                        <input type="range" min="50" max="120" value={Math.round(prefs.brightness * 100)}
                          onChange={(e) => handleBrightnessChange(e.target.value)} />
                        <div className="range-value">{Math.round(prefs.brightness * 100)}%</div>
                      </div>
                    </div>

                    <div className="Settings-section">
                      <div className="section-title">Tema de visualización</div>
                      <div className="theme-options">
                        <button className={`theme-btn ${prefs.theme === 'light' ? 'active' : ''}`} onClick={() => handleThemeChange('light')}> </button>
                        <button className={`theme-btn ${prefs.theme === 'sepia' ? 'active' : ''}`} onClick={() => handleThemeChange('sepia')}> </button>
                        <button className={`theme-btn ${prefs.theme === 'dark' ? 'active' : ''}`} onClick={() => handleThemeChange('dark')}> </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        {/* Recording panel: top-centered, always visible */}
        <div className="Recording-panel" role="region" aria-label="Panel de grabación">
          <div className="Recording-grid">
            <button className="RecBtn" onClick={(e) => { e.stopPropagation(); if (isRecording) stopRecording(); else startRecording(); }} title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}>
              <span className="RecIcon">{isRecording ? '⏹' : '●'}</span>
            </button>
            </div>
        </div>

        <main
          className="Lector-viewer single-page"
          ref={viewerRef}
          style={{ 
            filter: `brightness(${prefs.brightness})`
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseMove}
          onMouseLeave={() => setShowPageArrows(false)}
        >
          {/* inline styles removed: they hid epub.js container in some renderers */}
          {!ready && <div className="Lector-loading">Cargando libro…</div>}
          {/* hidden video preview for webcam when recording (kept hidden by default) */}
          <video ref={videoPreviewRef} autoPlay playsInline muted style={{ display: 'none' }} />
          {/* epub.js renderiza aquí */}

          {/* Flechas laterales para navegación */}
          <div className="NavArrows">
            <button 
              className={`NavArrow left ${showPageArrows ? 'visible' : ''}`}
              onClick={(e) => { 
                e.stopPropagation();
                e.preventDefault(); 
                goPrev();
                handleMouseMove();
              }}
            >◀</button>

            <button
              className={`NavArrow right ${showPageArrows ? 'visible' : ''}`}
              onClick={(e) => { 
                e.stopPropagation();
                e.preventDefault();
                goNext();
                handleMouseMove();
              }}
            >▶</button>
          </div>
        </main>

        <footer className="Lector-footer">
          <div className="Progress-info">
            <span>Página {currentPage} de {totalPages} ({typeof progress === 'number' ? progress.toFixed(2) : progress}%)</span>
          </div>
          <input
            type="range"
            min={1}
            max={totalPages || 1}
            value={currentPage || 1}
            onChange={onPageSliderChange}
            step={1}
            className="Lector-slider"
            aria-label="Ir a página"
          />
        </footer>
      </div>
    </div>
  );
}