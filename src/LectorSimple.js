import React, { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import './lector.css';
import { useGazepoint } from './hooks/useGazepoint';
import { useGazeHighlight } from './hooks/useGazeHighlight';

export default function LectorSimple(props) {
  const { archivo, onClose } = props;
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('texto');
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [enableGazeHighlight, setEnableGazeHighlight] = useState(false);
  const [prefs, setPrefs] = useState({
    fontSize: 100,
    lineHeight: 1.45,
    theme: 'light',
    font: 'original',
    brightness: 1.0
  });

  const { startRecording: startGaze, stopRecording: stopGaze, isConnected: gazeConnected } = useGazepoint();
  useGazeHighlight(viewerRef, enableGazeHighlight && gazeConnected);

  const applyPrefsToBook = React.useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    const fontMap = {
      original: 'serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto',
      merri: '"Merriweather", Georgia, serif'
    };
    
    const css = `
      html, body, body * {
        font-family: ${fontMap[prefs.font]} !important;
        font-size: ${prefs.fontSize}% !important;
        line-height: ${prefs.lineHeight} !important;
      }
      body {
        background: ${prefs.theme === 'dark' ? '#0b0c0c' : prefs.theme === 'sepia' ? '#f4ecd8' : '#ffffff'} !important;
        color: ${prefs.theme === 'dark' ? '#e8f6f5' : '#222222'} !important;
        filter: brightness(${prefs.brightness}) !important;
      }
    `;
    
    try {
      // Inyectar CSS directamente en el iframe en lugar de usar themes
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (iframeDoc) {
            // Remover style anterior si existe
            const oldStyle = iframeDoc.getElementById('epub-user-prefs');
            if (oldStyle) oldStyle.remove();
            
            // Crear nuevo style
            const style = iframeDoc.createElement('style');
            style.id = 'epub-user-prefs';
            style.textContent = css;
            iframeDoc.head.appendChild(style);
          }
        } catch (_) {}
      });
    } catch (_) {}
  }, [prefs]);

  // Inicializar libro
  useEffect(() => {
    if (!archivo) return;
    let mounted = true;

    const init = async () => {
      try {
        const book = ePub(archivo);
        bookRef.current = book;
        await book.ready;
        if (!mounted) return;

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated'
        });
        renditionRef.current = rendition;

        // Generar locations
        if (!book.locations.length()) {
          await book.locations.generate(256);
        }
        const total = book.locations.length();
        setTotalPages(total);

        // Mostrar primera página
        await rendition.display();

        // Eventos
        rendition.on('relocated', (loc) => {
          const cfi = loc.start?.cfi || loc.cfi;
          if (cfi && book.locations.length()) {
            const pct = book.locations.percentageFromCfi(cfi) * 100;
            setProgress(pct);
            setCurrentPage(Math.max(1, Math.floor((pct / 100) * total)));
          }
          // Aplicar estilos cuando la página cambia
          applyPrefsToBook();
        });

        setReady(true);
        applyPrefsToBook();
      } catch (e) {
        console.error('Error inicializando libro:', e);
        setReady(true);
      }
    };

    init();
    return () => {
      mounted = false;
      try {
        if (renditionRef.current) renditionRef.current.destroy();
        if (bookRef.current) bookRef.current.destroy();
      } catch (_) {}
    };
  }, [archivo, applyPrefsToBook]);

  // Aplicar estilos cuando cambien las preferencias
  useEffect(() => {
    if (ready) {
      applyPrefsToBook();
    }
  }, [prefs, applyPrefsToBook, ready]);

  // Si Gazepoint se desconecta durante grabación, detener
  useEffect(() => {
    if (!gazeConnected && isRecording) {
      console.warn('[lector] Gazepoint desconectado, deteniendo grabación');
      stopRecording();
    }
  }, [gazeConnected, isRecording]);

  const goNext = () => {
    if (!renditionRef.current) return;
    renditionRef.current.next().catch(() => {});
  };

  const goPrev = () => {
    if (!renditionRef.current) return;
    renditionRef.current.prev().catch(() => {});
  };

  const goToStart = () => {
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (book && rendition && book.spine.length) {
      const firstHref = book.spine.get(0)?.href;
      if (firstHref) {
        rendition.display(firstHref).catch(() => {});
      }
    }
  };

  const startRecording = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      startGaze(`recordings/${timestamp}`);

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fd = new FormData();
        fd.append('video', blob, `${timestamp}.webm`);
        try {
          await fetch('http://localhost:3001/api/upload', { method: 'POST', body: fd });
          stopGaze();
        } catch (e) {
          console.error('Error upload:', e);
          stopGaze();
        }
        chunksRef.current = [];
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error('Error recording:', e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
  };

  const handleSliderChange = (e) => {
    const page = parseInt(e.target.value, 10);
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (book && rendition && book.locations.length()) {
      const pct = (page - 1) / totalPages;
      const cfi = book.locations.cfiFromPercentage(pct);
      rendition.display(cfi).catch(() => {});
    }
  };

  const updatePref = (newPref) => {
    setPrefs(prev => ({ ...prev, ...newPref }));
  };

  return (
    <div className="Lector-overlay" onClick={onClose}>
      <div className="Lector-panel" onClick={(e) => e.stopPropagation()}>
        {/* Barra de grabación flotante centrada en la parte superior */}
        <div className="Recording-bar">
          {/* Botón de subrayado por detección ocular */}
          <button
            className={`gaze-btn ${enableGazeHighlight ? 'active' : ''} ${!gazeConnected ? 'disabled' : ''}`}
            onClick={() => gazeConnected && setEnableGazeHighlight(!enableGazeHighlight)}
            disabled={!gazeConnected}
            title={
              !gazeConnected 
                ? 'Gazepoint no conectado' 
                : enableGazeHighlight 
                  ? 'Desactivar subrayado ocular' 
                  : 'Activar subrayado ocular'
            }
          >
            👁️
          </button>

          {/* Botón de grabación */}
          <button
            className={`record-btn ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
          >
            {isRecording ? '⏹' : '●'}
          </button>
        </div>

        <header className="Lector-header">
          <div className="Lector-title">📖 Leyendo</div>
          <div className="Lector-controls">
            <button
              className="HeaderBtn"
              onClick={goToStart}
              title="Ir al inicio"
            >
              ⤺
            </button>
            <button
              className="HeaderBtn"
              onClick={() => setShowSettings(!showSettings)}
              title="Configuración del lector"
            >
              Aa
            </button>
            
            {/* Indicador de estado Gazepoint */}
            <div
              className={`Gaze-indicator ${gazeConnected ? 'connected' : ''}`}
              title={gazeConnected ? 'Gazepoint conectado' : 'Gazepoint desconectado'}
            />
            
            <button
              className="HeaderBtn close"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Popup de configuración */}
        {showSettings && (
          <div className="Settings-popover" onClick={(e) => e.stopPropagation()}>
            {/* Tabs */}
            <div className="Settings-tabs">
              <button
                className={`Settings-tab-btn ${settingsTab === 'texto' ? 'active' : ''}`}
                onClick={() => setSettingsTab('texto')}
              >
                Texto
              </button>
              <button
                className={`Settings-tab-btn ${settingsTab === 'iluminacion' ? 'active' : ''}`}
                onClick={() => setSettingsTab('iluminacion')}
              >
                Iluminación
              </button>
              <button
                className={`Settings-tab-btn ${settingsTab === 'seguimiento' ? 'active' : ''}`}
                onClick={() => setSettingsTab('seguimiento')}
              >
                Seguimiento
              </button>
            </div>

            {/* Body */}
            <div className="Settings-content">
              {settingsTab === 'texto' && (
                <>
                  <div>
                    <div className="Settings-section-title">FUENTE</div>
                    <div className="Settings-font-buttons">
                      {['original', 'sans', 'merri'].map((f) => (
                        <button
                          key={f}
                          className={`Settings-font-btn ${prefs.font === f ? 'active' : ''}`}
                          onClick={() => updatePref({ font: f })}
                        >
                          {f === 'original' ? 'Original' : f === 'sans' ? 'Sans' : 'Serif'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="Settings-section-title">
                      TAMAÑO: {prefs.fontSize}%
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="160"
                      value={prefs.fontSize}
                      onChange={(e) => updatePref({ fontSize: Number(e.target.value) })}
                      className="Settings-range-input"
                    />
                  </div>

                  <div>
                    <div className="Settings-section-title">
                      ESPACIADO: {Math.round(prefs.lineHeight * 100)}%
                    </div>
                    <input
                      type="range"
                      min="110"
                      max="200"
                      value={Math.round(prefs.lineHeight * 100)}
                      onChange={(e) => updatePref({ lineHeight: Number(e.target.value) / 100 })}
                      className="Settings-range-input"
                    />
                  </div>
                </>
              )}

              {settingsTab === 'iluminacion' && (
                <>
                  <div>
                    <div className="Settings-section-title">
                      BRILLO: {Math.round(prefs.brightness * 100)}%
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={Math.round(prefs.brightness * 100)}
                      onChange={(e) => updatePref({ brightness: Number(e.target.value) / 100 })}
                      className="Settings-range-input"
                    />
                  </div>

                  <div>
                    <div className="Settings-section-title">TEMA</div>
                    <div className="Settings-theme-buttons">
                      <button
                        className={`Settings-theme-btn ${prefs.theme === 'light' ? 'active' : ''}`}
                        onClick={() => updatePref({ theme: 'light' })}
                        title="Claro"
                        style={{ background: '#ffffff' }}
                      />
                      <button
                        className={`Settings-theme-btn ${prefs.theme === 'sepia' ? 'active' : ''}`}
                        onClick={() => updatePref({ theme: 'sepia' })}
                        title="Sepia"
                        style={{ background: '#f4ecd8' }}
                      />
                      <button
                        className={`Settings-theme-btn ${prefs.theme === 'dark' ? 'active' : ''}`}
                        onClick={() => updatePref({ theme: 'dark' })}
                        title="Oscuro"
                        style={{ background: '#0b0c0c' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'seguimiento' && (
                <>
                  <div>
                    <div className="Settings-section-title">
                      RESALTAR PALABRAS AL LEER
                    </div>
                    <button
                      className={`Settings-toggle-btn ${enableGazeHighlight ? 'enabled' : ''}`}
                      onClick={() => setEnableGazeHighlight(!enableGazeHighlight)}
                    >
                      {enableGazeHighlight ? '✓ Habilitado' : 'Deshabilitado'}
                    </button>
                    <p className="Settings-description">
                      Resalta la palabra donde están enfocados tus ojos mientras lees. Requiere Gazepoint conectado.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <main className="Lector-viewer">
          <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Flechas laterales */}
          <div className="NavArrows">
            <button 
              className="NavArrow left visible"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              title="Página anterior"
            >
              ◀
            </button>
            <button
              className="NavArrow right visible"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              title="Página siguiente"
            >
              ▶
            </button>
          </div>
          
          {!ready && <div className="Lector-loading">Cargando libro…</div>}
        </main>

        <footer className="Lector-footer">
          <div className="Progress-info">
            <span>Página {currentPage} de {totalPages} ({progress.toFixed(1)}%)</span>
          </div>
          <input
            type="range"
            min="1"
            max={totalPages || 1}
            value={currentPage}
            onChange={handleSliderChange}
            className="Lector-slider"
            aria-label="Ir a página"
          />
        </footer>
      </div>
    </div>
  );
}
