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
  const [isLoading, setIsLoading] = useState(true); // Estado específico para carga
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('texto');
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [enableGazeHighlight, setEnableGazeHighlight] = useState(false);
  const [bookTitle, setBookTitle] = useState('Cargando...'); // Estado para el título del libro
  const [showIndexModal, setShowIndexModal] = useState(false); // Modal del índice
  const [bookIndex, setBookIndex] = useState([]); // Capítulos del libro
  const [indexSearch, setIndexSearch] = useState(''); // Búsqueda en el índice
  
  // Estados para el sistema de bloques de lectura
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(1);
  const [blockTimer, setBlockTimer] = useState(0); // en segundos
  const [isBlockActive, setIsBlockActive] = useState(false);
  const [blockTimerPosition, setBlockTimerPosition] = useState('center'); // 'center' | 'bottom'
  const blockTimerRef = useRef(null);
  const blockStartTime = useRef(null);
  
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
      html, body {
        font-family: ${fontMap[prefs.font]} !important;
        font-size: ${prefs.fontSize}% !important;
        line-height: ${prefs.lineHeight} !important;
        background: ${prefs.theme === 'dark' ? '#0b0c0c' : prefs.theme === 'sepia' ? '#f4ecd8' : '#ffffff'} !important;
        color: ${prefs.theme === 'dark' ? '#e8f6f5' : '#222222'} !important;
        filter: brightness(${prefs.brightness}) !important;
        margin: 0 !important;
        padding: 20px !important;
      }
      body * {
        font-family: inherit !important;
        line-height: inherit !important;
      }
      p, div, span {
        margin-bottom: 1em !important;
      }
    `;
    
    try {
      // Inyectar CSS directamente en el iframe
      setTimeout(() => {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc && iframeDoc.body) {
              // Remover style anterior si existe
              const oldStyle = iframeDoc.getElementById('epub-user-prefs');
              if (oldStyle) oldStyle.remove();
              
              // Crear nuevo style
              const style = iframeDoc.createElement('style');
              style.id = 'epub-user-prefs';
              style.textContent = css;
              iframeDoc.head.appendChild(style);
              
              // Asegurar visibilidad del contenido
              if (iframeDoc.body) {
                iframeDoc.body.style.visibility = 'visible';
                iframeDoc.body.style.opacity = '1';
              }
            }
          } catch (e) {
            console.log('[lector] No se pudo acceder al iframe:', e);
          }
        });
      }, 100);
    } catch (e) {
      console.log('[lector] Error aplicando estilos:', e);
    }
  }, [prefs]);

  // Inicializar libro
  useEffect(() => {
    if (!archivo) return;
    let mounted = true;
    
    // Resetear estados de carga
    setIsLoading(true);
    setReady(false);

    const init = async () => {
      try {
        const book = ePub(archivo);
        bookRef.current = book;
        await book.ready;
        if (!mounted) return;

        // Obtener título del libro de los metadatos
        const metadata = book.packaging.metadata;
        const title = metadata.title || archivo.split('/').pop().replace('.epub', '') || 'Libro sin título';
        setBookTitle(title);

        // Extraer índice/tabla de contenidos
        const navigation = book.navigation;
        if (navigation && navigation.toc) {
          const indexItems = await Promise.all(
            navigation.toc.map(async (item, index) => {
              let pageNumber = null;
              // Intentar obtener el número de página
              try {
                if (item.href && book.locations.length()) {
                  const cfi = book.canonical(item.href);
                  const percentage = book.locations.percentageFromCfi(cfi);
                  pageNumber = Math.floor(percentage * book.locations.length());
                }
              } catch (e) {
                // Si no se puede obtener, usar el índice
                pageNumber = index + 1;
              }
              
              return {
                id: index,
                label: item.label,
                href: item.href,
                cfi: item.cfi || null,
                page: pageNumber
              };
            })
          );
          setBookIndex(indexItems);
        }

        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none' // Una sola columna
        });
        renditionRef.current = rendition;

        // Generar locations
        if (!book.locations.length()) {
          console.log('[lector] Generando locations...');
          await book.locations.generate(256);
          console.log('[lector] Locations generadas:', book.locations.length());
        }
        const total = book.locations.length();
        setTotalPages(total);

        // Mostrar primera página con mejor manejo
        console.log('[lector] Mostrando primera página...');
        await rendition.display();
        console.log('[lector] Primera página mostrada');

        // Eventos
        rendition.on('relocated', (loc) => {
          const cfi = loc.start?.cfi || loc.cfi;
          if (cfi && book.locations.length()) {
            const pct = book.locations.percentageFromCfi(cfi) * 100;
            setProgress(pct);
            setCurrentPage(Math.max(1, Math.floor((pct / 100) * total)));
          }
          // Aplicar estilos cuando la página cambia
          setTimeout(() => applyPrefsToBook(), 100);
        });

        // Asegurar que el libro es visible
        rendition.on('rendered', () => {
          console.log('[lector] Página renderizada');
          setIsLoading(false); // Ocultar carga cuando se renderiza
          applyPrefsToBook();
        });

        setReady(true);
        setIsLoading(false); // Por si acaso, ocultar carga también aquí
        console.log('[lector] Libro listo para lectura');
      } catch (e) {
        console.error('Error inicializando libro:', e);
        setReady(true);
        setIsLoading(false); // Ocultar carga en caso de error
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

  // Si Gazepoint se desconecta, desactivar subrayado ocular
  useEffect(() => {
    if (!gazeConnected && enableGazeHighlight) {
      console.warn('[lector] Gazepoint desconectado, desactivando subrayado ocular');
      setEnableGazeHighlight(false);
    }
  }, [gazeConnected, enableGazeHighlight]);

  // Limpiar timer de bloques al desmontar componente
  useEffect(() => {
    return () => {
      if (blockTimerRef.current) {
        clearInterval(blockTimerRef.current);
        blockTimerRef.current = null;
      }
    };
  }, []);

  const goNext = () => {
    if (!renditionRef.current) return;
    renditionRef.current.next().catch(() => {});
  };

  const goPrev = () => {
    if (!renditionRef.current) return;
    renditionRef.current.prev().catch(() => {});
  };

  const openIndex = () => {
    setShowIndexModal(true);
    setIndexSearch(''); // Limpiar búsqueda al abrir
  };

  const navigateToChapter = (item) => {
    const rendition = renditionRef.current;
    if (rendition && item.href) {
      rendition.display(item.href).catch(() => {});
      setShowIndexModal(false);
    }
  };

  // Filtrar capítulos según la búsqueda
  const filteredIndex = bookIndex.filter(item =>
    item.label.toLowerCase().includes(indexSearch.toLowerCase())
  );

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
      // Generar timestamp único para esta sesión
      const recordingTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      // Guardar el timestamp para usar cuando termine la grabación
      mediaRecorderRef.current.recordingTimestamp = recordingTimestamp;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstart = () => {
        // Iniciar gazepoint con información del timestamp
        startGaze(recordingTimestamp);
        setIsRecording(true);
        console.log('Grabación iniciada:', recordingTimestamp);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const sessionTimestamp = mediaRecorderRef.current.recordingTimestamp;
        const fd = new FormData();
        fd.append('video', blob, `${sessionTimestamp}.webm`);
        fd.append('sessionId', sessionTimestamp); // Agregar el sessionId
        try {
          await fetch('/api/upload', { method: 'POST', body: fd });
          stopGaze();
        } catch (e) {
          console.error('Error upload:', e);
          stopGaze();
        }
        chunksRef.current = [];
      };

      mediaRecorder.start();
      // No establecer isRecording aquí, se hace en onstart
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
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
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

  // Funciones para el sistema de bloques
  const startBlockTimer = () => {
    if (blockTimerRef.current) return; // Ya hay un timer activo
    
    blockStartTime.current = Date.now();
    setBlockTimer(0);
    setIsBlockActive(true);
    
    // Animar el cronómetro al área inferior derecha
    setTimeout(() => {
      setBlockTimerPosition('bottom');
    }, 500);
    
    blockTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - blockStartTime.current) / 1000);
      setBlockTimer(elapsed);
      
      // Si han pasado 5 minutos (300 segundos), terminar el bloque
      if (elapsed >= 300) {
        endCurrentBlock();
      }
    }, 1000);
  };

  const endCurrentBlock = () => {
    if (blockTimerRef.current) {
      clearInterval(blockTimerRef.current);
      blockTimerRef.current = null;
    }
    
    setIsBlockActive(false);
    setBlockTimerPosition('center');
    
    // Si es el bloque 5, reiniciar. Si no, pasar al siguiente
    if (currentBlock >= 5) {
      setCurrentBlock(1);
    } else {
      setCurrentBlock(prev => prev + 1);
    }
    
    // Mostrar modal para el siguiente bloque
    setShowBlockModal(true);
  };

  const cancelBlockActivity = () => {
    if (blockTimerRef.current) {
      clearInterval(blockTimerRef.current);
      blockTimerRef.current = null;
    }
    
    setIsBlockActive(false);
    setBlockTimerPosition('center');
    setShowBlockModal(false);
    setCurrentBlock(1); // Reiniciar al bloque 1
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimestamp = () => {
    return new Date().toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
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

          {/* Botón de pausa/reanudar (solo visible durante grabación) */}
          {isRecording && (
            <button
              className={`pause-btn ${isPaused ? 'active' : ''}`}
              onClick={isPaused ? resumeRecording : pauseRecording}
              title={isPaused ? 'Reanudar grabación' : 'Pausar grabación'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          )}

          {/* Botón de grabación */}
          <button
            className={`record-btn ${isRecording ? 'active' : ''} ${isPaused ? 'paused' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'Detener grabación' : 'Iniciar grabación'}
          >
            {isRecording ? '⏹' : '●'}
          </button>

          {/* Botón de bloques de lectura */}
          <button
            className={`blocks-btn ${isBlockActive ? 'active' : ''}`}
            onClick={() => setShowBlockModal(true)}
            title="Iniciar bloques de lectura"
          >
            🧩
          </button>
        </div>

        <header className="Lector-header">
          <div className="Lector-title">📖 {bookTitle}</div>
          <div className="Lector-controls">
            <button
              className="HeaderBtn"
              onClick={openIndex}
              title="Índice del libro"
            >
              📑
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
              className={`NavArrow left visible ${isRecording ? 'disabled' : ''}`}
              onClick={(e) => { 
                e.stopPropagation(); 
                if (!isRecording) goPrev(); 
              }}
              disabled={isRecording}
              title={isRecording ? 'No disponible durante grabación' : 'Página anterior'}
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
          
          {isLoading && <div className="Lector-loading">Cargando libro…</div>}
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

        {/* Modal de bloques de lectura */}
        {showBlockModal && (
          <div className="Block-modal-overlay">
            <div className="Block-modal">
              <h2>Bloque de lectura {currentBlock}</h2>
              <p className="Block-timestamp">{getTimestamp()}</p>
              <button
                className="Block-start-btn"
                onClick={() => {
                  setShowBlockModal(false);
                  startBlockTimer();
                }}
              >
                Iniciar Bloque {currentBlock}
              </button>
              <button
                className="Block-cancel-btn"
                onClick={cancelBlockActivity}
              >
                Cancelar Actividad
              </button>
            </div>
          </div>
        )}

        {/* Cronómetro de bloques */}
        {isBlockActive && (
          <div className={`Block-timer ${blockTimerPosition === 'bottom' ? 'bottom-position' : 'center-position'}`}>
            <div className="Block-timer-content">
              <span className="Block-number">Bloque {currentBlock}</span>
              <span className="Block-time">{formatTime(blockTimer)}</span>
              <span className="Block-remaining">{formatTime(300 - blockTimer)}</span>
            </div>
          </div>
        )}

        {/* Modal del índice del libro */}
        {showIndexModal && (
          <div className="Index-modal-overlay" onClick={() => setShowIndexModal(false)}>
            <div className="Index-modal" onClick={(e) => e.stopPropagation()}>
              <div className="Index-header">
                <h3>📑 Índice del Libro</h3>
                <button 
                  className="Index-close"
                  onClick={() => setShowIndexModal(false)}
                >
                  ✕
                </button>
              </div>
              
              {/* Barra de búsqueda */}
              {bookIndex.length > 0 && (
                <div className="Index-search">
                  <input
                    type="text"
                    placeholder="Buscar capítulo..."
                    value={indexSearch}
                    onChange={(e) => setIndexSearch(e.target.value)}
                    className="Index-search-input"
                  />
                  {indexSearch && (
                    <button 
                      className="Index-search-clear"
                      onClick={() => setIndexSearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}
              
              <div className="Index-content">
                {bookIndex.length > 0 ? (
                  <>
                    {filteredIndex.length > 0 ? (
                      <ul className="Index-list">
                        {filteredIndex.map((item) => (
                          <li 
                            key={item.id}
                            className="Index-item"
                            onClick={() => navigateToChapter(item)}
                          >
                            <span className="Index-item-label">{item.label}</span>
                            {item.page && (
                              <span className="Index-item-page">Pág. {item.page}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="Index-no-results">
                        <p>No se encontraron capítulos que coincidan con "{indexSearch}"</p>
                        <button 
                          className="Index-clear-search"
                          onClick={() => setIndexSearch('')}
                        >
                          Limpiar búsqueda
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="Index-empty">
                    <p>No se encontró índice en este libro</p>
                    <button 
                      className="Index-goto-start"
                      onClick={() => {
                        goToStart();
                        setShowIndexModal(false);
                      }}
                    >
                      Ir al inicio del libro
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
