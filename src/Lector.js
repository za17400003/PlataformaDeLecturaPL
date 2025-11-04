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

  // Sistema de navegación
  const { goNext: baseGoNext, goPrev: baseGoPrev, goToLocation } = useNavigation(
    renditionRef,
    bookRef,
    DEBUG,
    updateProgressFromRendition
  );

  const goNext = useCallback(() => {
    if (isTwoPages) {
      baseGoNext();
      baseGoNext();
    } else {
      baseGoNext();
    }
  }, [isTwoPages, baseGoNext]);

  const goPrev = useCallback(() => {
    if (isTwoPages) {
      baseGoPrev();
      baseGoPrev();
    } else {
      baseGoPrev();
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
    if (!rendition?.manager?.container || !mountedRef.current) return;
    
    return new Promise((resolve) => {
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

  // Inicialización y cleanup
  useEffect(() => {
    if (!archivo) return;

    // Asegurarse de que empezamos en modo una página
    setIsTwoPages(false);
    mountedRef.current = true;
    
    // Detener y limpiar ResizeObserver anterior si existe
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    async function initBook() {
      // Limpiar cualquier instancia previa
      if (renditionRef.current) {
        try {
          renditionRef.current.destroy();
        } catch (e) {}
        renditionRef.current = null;
      }
      if (bookRef.current) {
        try {
          bookRef.current.destroy();
        } catch (e) {}
        bookRef.current = null;
      }
      
      // Detener ResizeObserver anterior si existe
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      try {
        // Limpieza previa si es necesaria
        if (bookRef.current) {
          try {
            renditionRef.current?.destroy();
            bookRef.current.destroy();
          } catch (e) {
            console.warn('[reader] cleanup error:', e);
          }
          bookRef.current = null;
          renditionRef.current = null;
        }

        // Crear y cargar el libro
        const book = ePub(archivo);
        await book.ready;
        bookRef.current = book;

        // Configuración básica del rendition
        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          manager: 'default',
          spread: false
        });

        renditionRef.current = rendition;
        
        // Esperar a que el libro esté listo
        await book.ready;
        
        // Mostrar la primera página
        await rendition.display();
        
        // Asegurar que estamos en modo una página
        rendition.spread(false);

        renditionRef.current = rendition;

        // Configurar ResizeObserver después de tener el rendition
        const resizeObserver = new ResizeObserver((entries) => {
          if (!mountedRef.current) return;
          
          requestAnimationFrame(() => {
            if (!mountedRef.current) return;
            
            for (let entry of entries) {
              if (entry.target === viewerRef.current && renditionRef.current) {
                try {
                  renditionRef.current.resize();
                  // Re-aplicar preferencias después del resize
                  applyPrefsToRendition(renditionRef.current, prefs);
                } catch (e) {
                  if (DEBUG) console.warn('[reader] resize error:', e);
                }
              }
            }
          });
        });

        if (viewerRef.current) {
          resizeObserver.observe(viewerRef.current);
          resizeObserverRef.current = resizeObserver;
        }

        // Configurar tema por defecto
        rendition.themes.default({
          body: { 
            margin: '0 auto !important',
            padding: '2rem !important',
            'max-width': '800px !important',
            'font-size': 'initial !important',
            'line-height': 'initial !important'
          }
        });

        // Event handlers
        const onRelocated = (loc) => {
          updateProgressFromRendition(loc).catch(() => {});
          applyPrefsToRendition(rendition, prefs);
        };

        const onRendered = () => {
          applyPrefsToRendition(rendition, prefs);
        };

        rendition.on('relocated', onRelocated);
        rendition.on('rendered', onRendered);

        renditionRef.current = rendition;

        // Configurar tema por defecto y navegación
        rendition.themes.default({
          body: { 
            margin: '0 auto',
            padding: '1rem',
            'max-width': '800px'
          }
        });

        // Aplicar preferencias iniciales
        applyPrefsToRendition(rendition, prefs);

        // Generar locations
        await book.locations.generate(300);
        locationsReadyRef.current = true;
        setTotalLocations(book.locations.length());
        
        setReady(true);

      } catch (error) {
        console.error('[reader] initialization error:', error);
        setReady(true); // Marcar como ready incluso en error
      }
    }

    initBook();

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
  }, [archivo, DEBUG, prefs, applyPrefsToRendition, updateProgressFromRendition, isTwoPages]);

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
            max-width: 800px !important;
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

    updateLayout();
  }, [isTwoPages, renditionRef, safeRenditionResize, injectCssIntoContents]);

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

  // Gestión de flechas de navegación
  const handleMouseMove = useCallback(() => {
    setShowPageArrows(true);
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
    }
    hideArrowsTimerRef.current = setTimeout(() => {
      setShowPageArrows(false);
    }, 2000);
  }, []);

  // Toggle settings panel
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  // Recording functions
  const startRecording = useCallback(async () => {
    try {
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
          formData.append('video', blob, 'recording.webm');
          
          const response = await fetch('http://localhost:3001/upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error('Error al guardar la grabación');
          }
          
          chunksRef.current = [];
        } catch (error) {
          console.error('Error saving recording:', error);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, []);

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
            filter: `brightness(${prefs.brightness})`,
            display: 'flex',
            justifyContent: 'center'
          }}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseMove}
          onMouseLeave={() => setShowPageArrows(false)}
        >
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