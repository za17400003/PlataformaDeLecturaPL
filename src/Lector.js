import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import './lector.css';
import { useBuildPrefsCss, useInjectCssIntoContents, useApplyPrefsToRendition } from './hooks/usePreferences';
import { useNavigation } from './hooks/useNavigation';

export default function Lector(props) {
  const { archivo, onClose } = props;

  // Debug flag
  const DEBUG = true;

  // Referencias principales
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const iframeObserverRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Estados generales del lector
  const [isTwoPages, setIsTwoPages] = useState(false);
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
  const totalLocationsRef = useRef(0);
  const progressRef = useRef(0);
  const hideArrowsTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const mountedRef = useRef(true);

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
    } catch (e) {
      if (DEBUG) console.warn('[reader] progress update error:', e);
    }
  }, [DEBUG, setProgress, setTotalLocations]);

  // Sistema de navegación (inicializado después de definir updateProgressFromRendition)
  const { goNext, goPrev, goToLocation } = useNavigation(
    renditionRef,
    bookRef,
    DEBUG,
    updateProgressFromRendition
  );
  
  /* Sistema original de resize (comentado temporalmente)
  const handleResize = useCallback((renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container || !mountedRef.current) return;

    // Usar requestAnimationFrame para sincronizar con el repaint del navegador
    if (!resizePendingRef.current) {
      resizePendingRef.current = true;
      requestAnimationFrame(() => {
        if (!mountedRef.current) return;
        
        try {
          rendition.resize();
          if (DEBUG) console.debug('[reader] resize applied');
        } catch (e) {
          if (DEBUG) console.warn('[reader] resize error:', e);
        }
        
        resizePendingRef.current = false;
      });
    }
  }, [DEBUG]); */
  
  // Sistema simplificado de resize
  const handleResize = useCallback((renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container) return;

    // Aplicar resize inmediatamente
    try {
      rendition.resize();
      if (DEBUG) console.debug('[reader] resize applied');
    } catch (e) {
      if (DEBUG) console.warn('[reader] resize error:', e);
    }
  }, [DEBUG]);

  /* Sistema original de safeRenditionResize (comentado temporalmente)
  const safeRenditionResize = useCallback(async (renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition || !rendition.manager?.container) return;

    // Limitar frecuencia a máximo 1 cada 200ms
    const now = Date.now();
    if (now - lastResizeTimeRef.current < 200) {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = setTimeout(() => handleResize(rendition), 200);
      return;
    }

    lastResizeTimeRef.current = now;
    
    safeResizeInProgressRef.current = true;
    lastResizeTimeRef.current = now;

    try {
      // Dar tiempo al DOM para actualizarse
      await new Promise(res => setTimeout(res, 50));
      
      if (!mountedRef.current || !rendition.manager?.container) return;

      if (typeof rendition.resize === 'function') {
        rendition.resize();
        if (DEBUG) console.debug('[reader] resize completed');
      }
    } catch (e) {
      if (DEBUG) console.warn('[reader] resize error:', e);
    } finally {
      safeResizeInProgressRef.current = false;
      resizeDebounceRef.current = null;
    }
  }, [DEBUG]); */
  
  // Sistema simplificado de safeRenditionResize
  const safeRenditionResize = useCallback(async (renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container) return;
    
    try {
      rendition.resize();
    } catch (e) {
      if (DEBUG) console.warn('[reader] resize error:', e);
    }
  }, [DEBUG]);

  // Variables de estado y refs ya declarados al inicio del componente
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // start/stop recorder (embedded). Uploads to '/upload' like the camera app.
  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;

      // choose best mimeType
      const options = (() => {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return { mimeType: 'video/webm;codecs=vp9' };
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return { mimeType: 'video/webm;codecs=vp8' };
        return { mimeType: 'video/webm' };
      })();

      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'video/webm' });
        chunksRef.current = [];
        // try uploading, fallback to download
        try {
          const fd = new FormData();
          const filename = `recording-${Date.now()}.webm`;
          fd.append('file', blob, filename);
          await fetch('http://localhost:3001/upload', { 
            method: 'POST', 
            body: fd,
            // Permitir CORS
            mode: 'cors'
          });
          if (DEBUG) console.debug('[reader] upload successful');
        } catch (err) {
          if (DEBUG) console.warn('[reader] upload failed, creating local download', err);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `recording-${Date.now()}.webm`; document.body.appendChild(a); a.click(); a.remove();
        }
        try { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } } catch (e) {}
      };

      mr.start(1000);
      setIsRecording(true);
      if (DEBUG) console.debug('[reader] recording started');
    } catch (e) {
      console.error('No se pudo acceder a la cámara/micrófono:', e);
      if (DEBUG) console.warn('[reader] startRecording error:', e);
    }
  };

  const stopRecording = () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    try {
      if (mr.state !== 'inactive') mr.stop();
    } catch (e) { if (DEBUG) console.warn('[reader] stopRecording error:', e); }
    setIsRecording(false);
    try { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } } catch (e) {}
    if (DEBUG) console.debug('[reader] recording stopped');
  };

  // cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try { if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop(); } catch (e) {}
      try { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } } catch (e) {}
    };
  }, []);

  // Simple window resize handler
  useEffect(() => {
    if (!renditionRef.current) return;
    
    const onResize = () => handleResize(renditionRef.current);
    const timeoutRef = resizeTimeoutRef.current;
    window.addEventListener('resize', onResize);
    
    return () => {
      window.removeEventListener('resize', onResize);
      if (timeoutRef) {
        clearTimeout(timeoutRef);
      }
    };
  }, [DEBUG, handleResize, mountedRef]);

  // Suppress repeated ResizeObserver loop errors (use capture so we run early)
  /* useEffect(() => {
    const matchResizeMsg = (text) => {
      if (typeof text !== 'string') return false;
      return text.includes('ResizeObserver loop') || 
             text.includes('ResizeObserver loop completed with undelivered notifications') ||
             text.includes('ResizeObserver loop limit exceeded');
    };

    const onError = (ev) => {
      try {
        const msg = ev && (ev.message || (ev.error && ev.error.message)) ? (ev.message || ev.error.message).toString() : '';
        if (matchResizeMsg(msg)) {
          if (DEBUG) console.debug('[reader] suppressed ResizeObserver loop error (error)');
          try { ev.preventDefault && ev.preventDefault(); } catch (e) {}
          try { ev.stopImmediatePropagation && ev.stopImmediatePropagation(); } catch (e) {}
        }
      } catch (e) {}
    };

    const onRejection = (ev) => {
      try {
        const reason = ev && ev.reason;
        const msg = reason && (reason.message || reason.toString()) ? (reason.message || reason.toString()) : '';
        if (matchResizeMsg(msg)) {
          if (DEBUG) console.debug('[reader] suppressed ResizeObserver loop error (unhandledrejection)');
          try { ev.preventDefault && ev.preventDefault(); } catch (e) {}
          try { ev.stopImmediatePropagation && ev.stopImmediatePropagation(); } catch (e) {}
        }
      } catch (e) {}
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection, true);
    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection, true);
    };
  }, [DEBUG]); */

  // Cargar preferencias guardadas o usar valores por defecto
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

  // Variables de estado y refs ya declarados al inicio del componente

  // Set mounted to false on unmount
  useEffect(() => {
    return () => {
    };
  }, []);

  const triggerShowPageArrows = useCallback(() => {
    setShowPageArrows(true);
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
    }
    hideArrowsTimerRef.current = setTimeout(() => {
      setShowPageArrows(false);
      hideArrowsTimerRef.current = null;
    }, 3000);
  }, []);

  // Preference hooks imported from usePreferences.js
  const buildPrefsCss = useBuildPrefsCss();
  const injectCssIntoContents = useInjectCssIntoContents(DEBUG);
  const applyPrefsToRendition = useApplyPrefsToRendition(buildPrefsCss, injectCssIntoContents, DEBUG);



  // keep refs synced with state for use by imperative functions
  useEffect(() => { totalLocationsRef.current = totalLocations; }, [totalLocations]);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  // Utility functions for preferences






  // --- POPUP: estado y preferencias mínimas ---
  // Variables de estado ya declaradas al inicio del componente

  // Aplica las preferencias a todas las secciones del libro con debounce
  const applyPrefsToAll = useCallback((newPrefs) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    // Aplicar a la sección actual y contenedor
    requestAnimationFrame(() => {
      try {
        applyPrefsToRendition(rendition, newPrefs);
        if (viewerRef.current) {
          viewerRef.current.style.filter = `brightness(${newPrefs.brightness})`;
        }
      
        // Aplicar a todas las secciones cargadas (delegate to hook which de-duplicates and batches)
        const css = buildPrefsCss(newPrefs);
        try {
          injectCssIntoContents(rendition, css);
        } catch (e) {
          if (DEBUG) console.warn('[reader] injectCssIntoContents failed in applyPrefsToAll', e);
        }
      } catch (e) {
        if (DEBUG) console.warn('[reader] Error in applyPrefsToAll:', e);
      }
    });

    // Guardar preferencias
    localStorage.setItem('readerPrefs', JSON.stringify(newPrefs));
    // Aplicar tema también al contenedor del lector (UI fuera de iframes)
    try {
      const panel = viewerRef.current && viewerRef.current.closest && viewerRef.current.closest('.Lector-panel');
      if (panel) {
        // usar los mismos colores que buildPrefsCss
        const bg = newPrefs.theme === 'dark' ? '#0b0c0c' : newPrefs.theme === 'sepia' ? '#f4ecd8' : '#ffffff';
        const color = newPrefs.theme === 'dark' ? '#e8f6f5' : '#222222';
        panel.style.background = bg;
        panel.style.color = color;
      }
      const overlay = viewerRef.current && viewerRef.current.closest && viewerRef.current.closest('.Lector-overlay');
      if (overlay) {
        // slightly dim overlay in dark mode for full-window effect
        overlay.style.background = newPrefs.theme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)';
      }
    } catch (e) {
      // ignore
    }
  }, [applyPrefsToRendition, buildPrefsCss, injectCssIntoContents, DEBUG]);

  // Actualiza y guarda las preferencias
  const updatePref = useCallback((patch) => {
    const newPrefs = { ...prefs, ...patch };
    setPrefs(newPrefs);
    applyPrefsToAll(newPrefs);
  }, [prefs, applyPrefsToAll]);
  
  const toggleSettings = () => setShowSettings(v => !v);



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

  // Observador que fuerza allow-scripts / allow-same-origin en iframes tan pronto se agregan
  const startIframeObserver = useCallback(() => {
    // Temporarily disabled to test ResizeObserver issues
    return () => {};
  }, []);

  useEffect(() => {
    if (!archivo) {
      return;
    }

    let cleanup = () => {};

    async function initBook() {
      const book = ePub(archivo);
      if (!book) {
        if (DEBUG) console.warn('[reader] failed to create book');
        return;
      }

      const renderOptions = {
        width: '100%',
        height: '100%',
        flow: 'paginated',
        spread: 'none',
        minSpreadWidth: 1000,
        manager: 'default',
        fullsize: true
      };

      const rendition = book.renderTo(viewerRef.current, renderOptions);
      if (!rendition) {
        if (DEBUG) console.warn('[reader] failed to create rendition');
        return;
      }

      // Configurar opciones de visualización
      try {
        rendition.themes.default({
          body: { 
            'margin': '0 !important',
            'padding': '0 !important'
          }
        });
      } catch (e) {
        if (DEBUG) console.warn('[reader] failed to set default theme:', e);
      }

      bookRef.current = book;
      renditionRef.current = rendition;

      // Set up observers and handlers
      try {
        iframeObserverRef.current = startIframeObserver();
      } catch (e) {
        if (DEBUG) console.warn('[reader] observer init error:', e);
      }

      // Event handlers
      const onRelocated = loc => {
        updateProgressFromRendition(loc).catch(() => {});
        applyPrefsToRendition(rendition, prefs);
      };

      const onRendered = () => {
        applyPrefsToRendition(rendition, prefs);
      };

      rendition.on('relocated', onRelocated);
      rendition.on('rendered', onRendered);

      // Initial display
      rendition.display().then(async () => {
        try {
          // Generar locations antes de marcar como ready
          await book.locations.generate(300);
          locationsReadyRef.current = true;
          setReady(true);
        } catch (e) {
          if (DEBUG) console.warn('[reader] locations generation error:', e);
          // Marcar como ready incluso si locations falla
          setReady(true);
        }
      }).catch(e => {
        if (DEBUG) console.warn('[reader] display error:', e);
      });

      cleanup = () => {
        try { rendition.off('relocated', onRelocated); } catch (e) {}
        try { rendition.off('rendered', onRendered); } catch (e) {}
        try { iframeObserverRef.current?.disconnect(); } catch (e) {}
        try { rendition.destroy(); } catch (e) {}
        try { book.destroy(); } catch (e) {}
        
        bookRef.current = null;
        renditionRef.current = null;
        iframeObserverRef.current = null;
      };
    }

    initBook();

    // Cleanup function
    return () => {
      try {
        cleanup();
      } catch (e) {
        if (DEBUG) console.warn('[reader] cleanup error:', e);
      }
    };
  }, [archivo, DEBUG, prefs, startIframeObserver, applyPrefsToRendition, updateProgressFromRendition]);

  // limpiar timer de flechas al desmontar
  useEffect(() => {
    return () => {
      if (hideArrowsTimerRef.current) {
        clearTimeout(hideArrowsTimerRef.current);
        hideArrowsTimerRef.current = null;
      }
    };
  }, []);

  // cambiar entre 1 y 2 páginas usando tema (column-count)
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    // CSS para spread (ajustar según isTwoPages)
    const css = isTwoPages ? `
      body { column-count: 2; column-gap: 2.2rem !important; }
      /* fuerza que cada columna se parezca a una página */
      .epubjs-container { display: block !important; }
      html, body { height: 100% !important; }
    ` : `
      /* Single page mode: 1 column, expandir horizontalmente */
      body { column-count: 1 !important; column-gap: 0 !important; }
      .epubjs-container { display: block !important; width: 100% !important; max-width: none !important; }
      html, body { height: 100% !important; }
      /* asegurar que los elementos internos no limiten el ancho */
      body, body * { max-width: 100% !important; }
    `;

    try {
      // Forzar settings del renderer si está disponible
      if (typeof rendition.settings === 'function') {
        rendition.settings({ spread: isTwoPages ? 'both' : 'none' });
      } else if (rendition.settings && typeof rendition.settings === 'object') {
        rendition.settings.spread = isTwoPages ? 'both' : 'none';
      }
    } catch (e) {
      // no crítico
    }

    // INYECTAR CSS DIRECTAMENTE en cada iframe/document (evita crear <link href="CSS-TEXT">)
    try {
      injectCssIntoContents(rendition, css);
    } catch (e) {
      // fallback si algo falla
      console.warn('injectCssIntoContents falló:', e);
    }

    // forzar resize/display para reflujo correcto
    (async () => {
  try { await safeRenditionResize(); } catch (e) {}
      try {
        const loc = rendition.currentLocation && rendition.currentLocation();
        const cfi = ((loc && (loc.start ? loc.start.cfi : loc.cfi)) || null);
        if (cfi) await rendition.display(cfi);
        else await rendition.display();
      } catch (e) {}
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTwoPages]);

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
          }
        } catch (e) {
          // ignore
        }
    })();

    return () => { alive = false; };
  }, [prefs.fontSize, prefs.lineHeight, isTwoPages, updateProgressFromRendition]);



  // goToStart utiliza hook de navegación
  const goToStart = useCallback(() => {
    const r = renditionRef.current;
    if (!r || !r.display) return;
    goToLocation();
  }, [goToLocation]);

  const onPageSliderChange = useCallback((e) => {
    const page = Number(e.target.value); // 1..totalPages
    const book = bookRef.current;
    const r = renditionRef.current;
    if (!book || !r || !book.locations) return;

    const navigateToPage = async () => {
      try {
        if (!locationsReadyRef.current) {
          if (DEBUG) console.debug('[reader] onPageSliderChange: generating locations');
          await book.locations.generate(300);
          locationsReadyRef.current = true;
          setTotalLocations(book.locations.length());
        }

        const total = book.locations.length() || 1;
        const frac = Math.max(0, Math.min(0.999999, (page - 0.5) / total));
        const cfi = book.locations.cfiFromPercentage(frac);
        const pct = frac * 100;
        
        if (DEBUG) console.debug('[reader] onPageSliderChange:', { page, frac, cfi, total });
        setProgress(Number(pct.toFixed(2)));
        
        goToLocation(cfi);
      } catch (err) {
        if (DEBUG) console.warn('[reader] slider navigation error:', err);
      }
    };

    navigateToPage();
  }, [DEBUG, setProgress, setTotalLocations, goToLocation]);

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
          className="Lector-viewer"
          ref={viewerRef}
          style={{ filter: `brightness(${prefs.brightness})` }}
          onMouseMove={(e) => { e.stopPropagation(); triggerShowPageArrows(); }}
          onMouseEnter={(e) => { e.stopPropagation(); triggerShowPageArrows(); }}
          onMouseLeave={(e) => {
            // iniciar timeout (triggerShowPageArrows ya inicia/renueva), aquí solo dejar que expire
            if (hideArrowsTimerRef.current) {
              clearTimeout(hideArrowsTimerRef.current);
            }
            hideArrowsTimerRef.current = setTimeout(() => {
              setShowPageArrows(false);
              hideArrowsTimerRef.current = null;
            }, 3000);
          }}
        >
          {!ready && <div className="Lector-loading">Cargando libro…</div>}
          {/* hidden video preview for webcam when recording (kept hidden by default) */}
          <video ref={videoPreviewRef} autoPlay playsInline muted style={{ display: 'none' }} />
          {/* epub.js renderiza aquí */}

          {/* Flechas laterales dentro del área de lectura */}
          <button 
            className={`NavArrow left ${showPageArrows ? 'visible' : ''}`}
            onClick={(e) => { 
              e.stopPropagation(); 
              goPrev(); 
              triggerShowPageArrows(); 
            }}
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: showPageArrows ? 1 : 0,
              visibility: showPageArrows ? 'visible' : 'hidden',
              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              pointerEvents: showPageArrows ? 'auto' : 'none',
              zIndex: 50,
              width: '56px',
              height: '56px',
              background: '#ffffff',
              border: '1px solid #e6e6e6',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#1b5e5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ◀
          </button>

          <button
            className={`NavArrow right ${showPageArrows ? 'visible' : ''}`}
            onClick={(e) => { 
              e.stopPropagation(); 
              goNext(); 
              triggerShowPageArrows(); 
            }}
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: showPageArrows ? 1 : 0,
              visibility: showPageArrows ? 'visible' : 'hidden',
              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                pointerEvents: showPageArrows ? 'auto' : 'none',
              zIndex: 50,
              width: '56px',
              height: '56px',
              background: '#ffffff',
              border: '1px solid #e6e6e6',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1.2rem',
              color: '#1b5e5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ▶
          </button>
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