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
  const { goNext, goPrev, goToLocation } = useNavigation(
    renditionRef,
    bookRef,
    DEBUG,
    updateProgressFromRendition
  );

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

  // Handler de resize seguro con debounce
  const safeRenditionResize = useCallback(async (renditionArg) => {
    const rendition = renditionArg || renditionRef.current;
    if (!rendition?.manager?.container) return;
    
    try {
      await new Promise(resolve => setTimeout(resolve, 50)); // dar tiempo al DOM
      if (mountedRef.current) {
        rendition.resize();
      }
    } catch (e) {
      if (DEBUG) console.warn('[reader] resize error:', e);
    }
  }, [DEBUG]);



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

  // Inicialización y cleanup
  useEffect(() => {
    if (!archivo) return;

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
        minSpreadWidth: 800,
        manager: 'default',
        fullsize: true,
        stylesheet: `
          body { 
            margin: 0 auto !important;
            padding: 2rem !important;
            max-width: 800px !important;
            font-size: initial !important;
            line-height: initial !important;
          }
        `
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

        // Asegurarnos de que displayOptions esté inicializado
        if (!rendition.displayOptions) {
          rendition.displayOptions = {
            width: '100%',
            height: '100%',
            flow: 'paginated',
            spread: 'none'
          };
        }

        // Inicializar navigation si es necesario
        if (!rendition.navigation) {
          rendition.navigation = {};
        }
      } catch (e) {
        if (DEBUG) console.warn('[reader] failed to set default theme:', e);
      }

      bookRef.current = book;
      renditionRef.current = rendition;

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
        try { rendition.destroy(); } catch (e) {}
        try { book.destroy(); } catch (e) {}
        
        bookRef.current = null;
        renditionRef.current = null;
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
  }, [archivo, DEBUG, prefs, applyPrefsToRendition, updateProgressFromRendition]);

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

  // Gestión de flechas de navegación
  const triggerShowPageArrows = useCallback(() => {
    setShowPageArrows(true);
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
    }
    hideArrowsTimerRef.current = setTimeout(() => {
      setShowPageArrows(false);
    }, 2000);
  }, []);

  const hidePageArrows = useCallback(() => {
    setShowPageArrows(false);
    if (hideArrowsTimerRef.current) {
      clearTimeout(hideArrowsTimerRef.current);
      hideArrowsTimerRef.current = null;
    }
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
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.style.display = 'block';
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = 'recording.webm';
        a.click();
        window.URL.revokeObjectURL(url);
        chunksRef.current = [];
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
          className="Lector-viewer"
          ref={viewerRef}
          style={{ filter: `brightness(${prefs.brightness})` }}
          onMouseMove={triggerShowPageArrows}
          onMouseEnter={triggerShowPageArrows}
          onMouseLeave={hidePageArrows}
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
                triggerShowPageArrows();
              }}
            >◀</button>

            <button
              className={`NavArrow right ${showPageArrows ? 'visible' : ''}`}
              onClick={(e) => { 
                e.stopPropagation();
                e.preventDefault();
                goNext();
                triggerShowPageArrows();
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