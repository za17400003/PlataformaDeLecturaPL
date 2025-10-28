import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import './lector.css';

export default function Lector(props) {
  const { archivo, onClose } = props;
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const iframeObserverRef = useRef(null);

  const [isTwoPages, setIsTwoPages] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [ready, setReady] = useState(false);
  const [totalLocations, setTotalLocations] = useState(0);

  // flechas laterales dentro del lector: visibilidad y timeout de ocultado
  const [showPageArrows, setShowPageArrows] = useState(false);
  const hideArrowsTimerRef = useRef(null);

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

  // --- POPUP: estado y preferencias mínimas ---
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('texto'); // 'texto' | 'iluminacion'
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

  const updatePref = (patch) => {
    const newPrefs = { ...prefs, ...patch };
    setPrefs(newPrefs);
    localStorage.setItem('readerPrefs', JSON.stringify(newPrefs));
    applyPrefsToAll(newPrefs);
  };
  const toggleSettings = () => setShowSettings(v => !v);

  // Aplica las preferencias a todas las secciones del libro
  const applyPrefsToAll = (newPrefs) => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    // Aplicar a la sección actual y contenedor
    applyPrefsToRendition(rendition, newPrefs);
    if (viewerRef.current) {
      viewerRef.current.style.filter = `brightness(${newPrefs.brightness})`;
    }
    
    // Aplicar a todas las secciones cargadas
    try {
      const css = buildPrefsCss(newPrefs);
      rendition.getContents().forEach(content => {
        if (content.document && content.document.body) {
          const style = content.document.createElement('style');
          style.innerHTML = css;
          content.document.head.appendChild(style);
        }
      });
    } catch (e) {
      console.warn('Error applying prefs to all sections:', e);
    }
  };

  // crea CSS con mayor especificidad para vencer estilos internos
  const buildPrefsCss = (p) => {
    const fontMap = {
      original: 'serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
      merri: '"Merriweather", Georgia, serif'
    };
    const fontFamily = fontMap[p.font] || 'serif';
    const bg = p.theme === 'dark' ? '#0b0c0c' : p.theme === 'sepia' ? '#f4ecd8' : '#ffffff';
    const color = p.theme === 'dark' ? '#e8f6f5' : '#222222';
    // CSS con alta especificidad y !important
    return `
      /* user prefs (high specificity) */
      html, body, body * {
        background: ${bg} !important;
        color: ${color} !important;
        font-family: ${fontFamily} !important;
        font-size: ${p.fontSize}% !important;
        line-height: ${p.lineHeight} !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      body { padding: 1.4rem !important; }
      img, table { max-width: 100% !important; height: auto !important; }
      /* asegurar columnas/llens si se usa spread */
      body { -webkit-column-fill: auto !important; column-fill: auto !important; }
    `;
  };

  // inyecta css directo en cada document/iframe que epubjs haya creado
  const injectCssIntoContents = (rendition, css) => {
    if (!rendition) return;
    try {
      const contents = typeof rendition.getContents === 'function' ? rendition.getContents() : (rendition.contents || []);
      contents.forEach((c) => {
        const doc = c && (c.document || c.contentDocument || c.doc || (c.contents && c.contents[0]));
        const documentEl = doc && (doc.contentDocument || doc.ownerDocument || doc);
        if (!documentEl || !documentEl.head) return;
        let styleEl = documentEl.getElementById('user-prefs-style');
        if (!styleEl) {
          styleEl = documentEl.createElement('style');
          styleEl.id = 'user-prefs-style';
          documentEl.head.insertBefore(styleEl, documentEl.head.firstChild);
        }
        styleEl.textContent = css;
      });
    } catch (e) {
      // silencioso — no detener render
    }
  };

  // apply prefs: registra tema (fallback) y además inyecta con alta especificidad
  const applyPrefsToRendition = (rendition, p) => {
    if (!rendition) return;
    const css = buildPrefsCss(p);
    try {
      rendition.themes && rendition.themes.register && rendition.themes.register('user-prefs', css);
      rendition.themes && rendition.themes.select && rendition.themes.select('user-prefs');
    } catch (e) {
      // ignore
    }
    injectCssIntoContents(rendition, css);
  };

  // Aplica prefs también de forma inmediata al renderer y al contenedor,
  // para que los controles del popup muestren efecto sin esperar el re-render.
  const applyPrefsImmediate = (nextPrefs) => {
    const r = renditionRef.current;
    if (r) applyPrefsToRendition(r, nextPrefs);
    if (viewerRef.current) viewerRef.current.style.filter = `brightness(${nextPrefs.brightness})`;
  };

  // Handlers que actualizan estado y aplican inmediatamente
  const handleFontChange = (font) => {
    const next = { ...prefs, font };
    setPrefs(next);
    applyPrefsImmediate(next);
  };
  const handleFontSizeChange = (value) => {
    const next = { ...prefs, fontSize: Number(value) };
    setPrefs(next);
    applyPrefsImmediate(next);
  };
  const handleLineHeightChange = (percentValue) => {
    const next = { ...prefs, lineHeight: Number(percentValue) / 100 };
    setPrefs(next);
    applyPrefsImmediate(next);
  };
  const handleBrightnessChange = (value) => {
    const b = Math.max(0.5, Math.min(1.2, Number(value) / 100));
    const next = { ...prefs, brightness: b };
    setPrefs(next);
    applyPrefsImmediate(next);
  };
  const handleThemeChange = (theme) => {
    const next = { ...prefs, theme };
    setPrefs(next);
    applyPrefsImmediate(next);
  };

  // aplicar prefs cuando cambian y cuando el rendition esté listo (fallback react-way)
  useEffect(() => {
    const r = renditionRef.current;
    if (r) applyPrefsToRendition(r, prefs);
    if (viewerRef.current) viewerRef.current.style.filter = `brightness(${prefs.brightness})`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  // Observador que fuerza allow-scripts / allow-same-origin en iframes tan pronto se agregan
  const startIframeObserver = useCallback(() => {
    const root = viewerRef.current;
    if (!root) return null;

    const fixIframe = (iframe) => {
      try {
        // Forzar permisos (riesgo de seguridad — solo para EPUBs de confianza)
        iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        // Reaplicar srcdoc para forzar recarga con nuevo sandbox (si existe)
        if ('srcdoc' in iframe) {
          const s = iframe.srcdoc;
          iframe.srcdoc = s;
        } else {
          try { iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.reload(); } catch (e) {}
        }
      } catch (e) {
        // no bloquear la app por errores aquí
      }
    };

    // arreglar iframes ya existentes
    try {
      const list = root.querySelectorAll && root.querySelectorAll('iframe');
      list && list.forEach(fixIframe);
    } catch (e) {}

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node) continue;
          if (node.tagName === 'IFRAME') fixIframe(node);
          else if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(fixIframe);
        }
      }
    });
    mo.observe(root, { childList: true, subtree: true });
    return mo;
  }, []);

  useEffect(() => {
    if (!archivo) return;
    const book = ePub(archivo);
    bookRef.current = book;

    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'paginated',
      spread: 'auto'
    });
    renditionRef.current = rendition;

    // arrancar observador para asegurar permisos en iframes creados por epub.js
    try {
      iframeObserverRef.current = startIframeObserver();
    } catch (e) {}

    const applyTheme = () => {
      const css = `
        body { font-family: "Georgia", serif; padding: 1.2rem; color: #222; line-height: 1.4; }
        img { max-width: 100%; height: auto; }
      `;
      try { rendition.themes.register('base', css); rendition.themes.select('base'); } catch (e) {}
    };

    const updateProgressFromRendition = () => {
      try {
        const loc = rendition.currentLocation && rendition.currentLocation();
        if (loc && book.locations) {
          const cfi = loc.start ? loc.start.cfi : loc.cfi || null;
          if (cfi) {
            const pct = book.locations.percentageFromCfi(cfi) * 100;
            setProgress(Math.round(pct));
          }
        }
      } catch (e) {}
    };

    const onRendered = async () => {
      try {
        await book.ready;
        await book.locations.generate(300);
        const total = book.locations.length();
        setTotalLocations(total || 0);
        updateProgressFromRendition();
        setReady(true);

        // aplicar prefs iniciales (ahora inyecta dentro de cada iframe)
        applyPrefsToRendition(rendition, prefs);
        if (viewerRef.current) viewerRef.current.style.filter = `brightness(${prefs.brightness})`;
      } catch (e) {
        console.error('Error preparando libro:', e);
      }
    };

    // cada vez que se renderiza una sección nueva inyectamos prefs, así sobrevivimos a re-renders parciales
    const onSectionRendered = () => {
      applyPrefsToRendition(rendition, prefs);
    };

    rendition.on && rendition.on('relocated', updateProgressFromRendition);
    rendition.on && rendition.on('rendered', onSectionRendered);

    applyTheme();
    rendition.display().then(onRendered).catch((e) => {
      console.error('Error display:', e);
    });

    return () => {
      try { rendition.off && rendition.off('relocated', updateProgressFromRendition); } catch (e) {}
      try { rendition.off && rendition.off('rendered', onSectionRendered); } catch (e) {}
      // desconectar observer de iframes
      try { iframeObserverRef.current && iframeObserverRef.current.disconnect(); } catch (e) {}
      try { rendition.destroy(); } catch (e) {}
      try { book.destroy(); } catch (e) {}
      bookRef.current = null;
      renditionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo]);

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

    // CSS para spread (no usar como href ni pasar texto como link)
    const css = `
      body { column-count: 2; column-gap: 2.2rem !important; }
      /* fuerza que cada columna se parezca a una página */
      .epubjs-container { display: block !important; }
      html, body { height: 100% !important; }
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
      try { await rendition.resize && rendition.resize(); } catch (e) {}
      try {
        const loc = rendition.currentLocation && rendition.currentLocation();
        const cfi = loc && (loc.start ? loc.start.cfi : loc.cfi) || null;
        if (cfi) await rendition.display(cfi);
        else await rendition.display();
      } catch (e) {}
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTwoPages]);

  const goNext = () => {
    const r = renditionRef.current;
    if (r) r.next && r.next();
  };
  const goPrev = () => {
    const r = renditionRef.current;
    if (r) r.prev && r.prev();
  };

  const onSliderChange = (e) => {
    const val = Number(e.target.value); // 0..100
    setProgress(val);
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (!book || !rendition || !book.locations) return;
    try {
      const cfi = book.locations.cfiFromPercentage(val / 100);
      rendition.display(cfi);
    } catch (err) {
      console.warn('no se pudo mover a posición exacta:', err);
    }
  };

  const goToStart = () => {
    const r = renditionRef.current;
    if (r) r.display && r.display();
  };

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
          {/* epub.js renderiza aquí */}

          {/* Flechas laterales dentro del área de lectura */}
          <button 
            className={`NavArrow left ${showPageArrows ? 'visible' : ''}`}
            onClick={(e) => { e.stopPropagation(); goPrev(); triggerShowPageArrows(); }}
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
            onClick={(e) => { e.stopPropagation(); goNext(); triggerShowPageArrows(); }}
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
            <span>Página {Math.ceil((progress / 100) * (totalLocations * (prefs.fontSize / 100)))} de {Math.ceil(totalLocations * (prefs.fontSize / 100))}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={onSliderChange}
            className="Lector-slider"
          />
        </footer>
      </div>
    </div>
  );
}