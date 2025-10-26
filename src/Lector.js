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

  // --- POPUP: estado y preferencias mínimas ---
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('texto'); // 'texto' | 'iluminacion'
  const [prefs, setPrefs] = useState({
    font: 'original', // 'original' | 'sans' | 'merri'
    fontSize: 100, // %
    lineHeight: 1.45, // number
    theme: 'light', // 'light'|'sepia'|'dark'
    brightness: 1.0
  });

  const updatePref = (patch) => setPrefs(prev => ({ ...prev, ...patch }));
  const toggleSettings = () => setShowSettings(v => !v);

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

            <button className="Btn-small" onClick={goPrev} title="Anterior">◀</button>
            <button className="Btn-small" onClick={goNext} title="Siguiente">▶</button>
            <button className="Btn-small" onClick={goToStart} title="Inicio">⤺</button>

            {/* botón de ajustes que abre popup */}
            <button className="Btn-small" onClick={(e) => { e.stopPropagation(); toggleSettings(); }} title="Ajustes">A</button>

            <button className="Btn-close" onClick={onClose} title="Cerrar">✕</button>
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

        <main className="Lector-viewer" ref={viewerRef} style={{ filter: `brightness(${prefs.brightness})` }}>
          {!ready && <div className="Lector-loading">Cargando libro…</div>}
          {/* epub.js renderiza aquí */}
        </main>

        <footer className="Lector-footer">
          <div className="Progress-info">
            <span>{progress}%</span>
            <span className="Locations-info">{totalLocations ? ` · ${totalLocations} locs` : ''}</span>
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