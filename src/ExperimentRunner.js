/**
 * EXPERIMENT RUNNER - Sistema de ejecución de experimentos de lectura con eye-tracking
 * 
 * FLUJO COMPLETO:
 * 1. Usuario hace clic en "Iniciar Experimento" desde ConfigurarExperimentos
 * 2. Se carga automáticamente el primer bloque con su libro y configuraciones
 * 3. Los bloques se ejecutan secuencialmente con confirmación de espacio entre cada uno
 * 4. Indicador "Bloque X de Y" muestra el progreso
 * 5. Al finalizar todos los bloques, regresa automáticamente a la biblioteca
 * 6. Los resultados quedan guardados y disponibles en "Ver Resultados"
 * 
 * CARACTERÍSTICAS IMPLEMENTADAS:
 * ✅ Carga automática del lector con libro y página especificados
 * ✅ Pausa entre bloques con confirmación por barra espaciadora
 * ✅ Indicador de progreso "Bloque X de Y"
 * ✅ Pausar/Reanudar experimento
 * ✅ Cancelar experimento con verificación de contraseña
 * ✅ Captura y almacenamiento de múltiples corridas (runs)
 * ✅ Sistema de visualización de resultados fullscreen
 * ✅ Regreso automático a biblioteca al completar
 * 
 * DATOS CAPTURADOS POR CORRIDA:
 * - Timestamp de inicio y fin
 * - Duración total
 * - Estado (completed/cancelled/running)
 * - Bloques ejecutados con sus tiempos
 * - Datos de eye-tracking (coordenadas, fijaciones, sacádicos)
 * - Respuestas a estímulos
 * - Progreso de lectura (páginas, posición)
 * 
 * INTEGRACIÓN FUTURA CON PYTHON:
 * - Eye tracker (Gazepoint) vía WebSocket
 * - Dispositivos de estímulos externos (vibración, auditivo, visual)
 * - Detección de divagaciones mentales
 * - Análisis de patrones de lectura
 * 
 * CONFIGURACIÓN DE ESTÍMULOS:
 * - vibrationEnabled: Activar vibración física
 * - auditoryEnabled: Reproducir sonidos/tonos
 * - visualEnabled: Mostrar overlays visuales
 * - randomFrequency: Frecuencia de aparición aleatoria
 * - frequencyCross: Cruzar frecuencias entre tipos de estímulos
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Lector from './Lector';
import './ExperimentRunner.css';

const ExperimentRunner = ({ experiment, userData, onClose, onExperimentComplete }) => {
  const [runId, setRunId] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentBlockData, setCurrentBlockData] = useState(null);
  const [showLector, setShowLector] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelPassword, setCancelPassword] = useState('');
  const [capturedData, setCapturedData] = useState([]);
  const [bookFiles, setBookFiles] = useState({}); // Map de bookId -> archivo
  const [showBlockIntro, setShowBlockIntro] = useState(false); // Pantalla de inicio de bloque
  const [showFinalScreen, setShowFinalScreen] = useState(false); // Pantalla final de opciones
  const [booksInfo, setBooksInfo] = useState({}); // Información completa de libros (id -> {name, path})
  const debounceTimerRef = useRef(null); // Para debounce de guardado

  useEffect(() => {
    console.log('[ExperimentRunner] Componente montado con experimento:', experiment);
    fetchBlocks();
  }, [experiment.id]);

  // Auto-iniciar el experimento cuando los bloques estén cargados
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('[ExperimentRunner] Bloques cargados:', blocks, 'isRunning:', isRunning, 'loading:', loading);
    if (blocks.length > 0 && !isRunning && !loading) {
      console.log('[ExperimentRunner] Auto-iniciando experimento con', blocks.length, 'bloques');
      handleStartExperiment();
    }
  }, [blocks, isRunning, loading]);

  // Listener para barra espaciadora
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && showConfirmation && !showLector) {
        e.preventDefault();
        handleContinueToNextBlock();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showConfirmation, showLector]);

  // Monitor para estados de visualización
  useEffect(() => {
    console.log('[ExperimentRunner] ===== ESTADOS ACTUALES =====');
    console.log('showBlockIntro:', showBlockIntro);
    console.log('showLector:', showLector);
    console.log('showConfirmation:', showConfirmation);
    console.log('showCancelConfirm:', showCancelConfirm);
    console.log('isRunning:', isRunning);
    console.log('currentBlockIndex:', currentBlockIndex);
    console.log('========================================');
  }, [showBlockIntro, showLector, showConfirmation, showCancelConfirm, isRunning, currentBlockIndex]);

  const fetchBlocks = async () => {
    try {
      console.log('[ExperimentRunner] fetchBlocks iniciado para experimento:', experiment.id);
      setLoading(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiments/${experiment.id}/blocks`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      console.log('[ExperimentRunner] Respuesta del servidor:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('[ExperimentRunner] Datos de bloques recibidos:', data);
        const sortedBlocks = data.sort((a, b) => a.blockNumber - b.blockNumber);
        setBlocks(sortedBlocks);
        console.log('[ExperimentRunner] Bloques ordenados y guardados:', sortedBlocks);
        if (sortedBlocks.length === 0) {
          setError('Este experimento no tiene bloques configurados');
        }
        
        // Cargar información de los libros
        const uniqueBookIds = [...new Set(sortedBlocks.filter(b => b.bookId).map(b => b.bookId))];
        console.log('[ExperimentRunner] IDs de libros únicos:', uniqueBookIds);
        if (uniqueBookIds.length > 0) {
          fetchBooksInfo(uniqueBookIds);
        }
      } else {
        const errorText = await response.text();
        console.error('[ExperimentRunner] Error en respuesta:', errorText);
        setError('Error al cargar bloques: ' + errorText);
      }
    } catch (err) {
      setError('Error al cargar bloques');
      console.error('[ExperimentRunner] Error en fetchBlocks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooksInfo = async (bookIds) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/books', {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        const allBooks = await response.json();
        const booksMap = {};
        const booksInfoMap = {};
        bookIds.forEach(bookId => {
          const book = allBooks.find(b => b.id === bookId || b.id === parseInt(bookId));
          if (book) {
            booksMap[bookId] = book.path || book.file || book.filePath || '';
            booksInfoMap[bookId] = {
              name: book.name || book.title || 'Libro sin nombre',
              path: book.path || book.file || book.filePath || ''
            };
          }
        });
        setBookFiles(booksMap);
        setBooksInfo(booksInfoMap);
        console.log('[ExperimentRunner] Libros cargados:', booksMap);
        console.log('[ExperimentRunner] Info de libros:', booksInfoMap);
        return booksMap; // Retornar el mapa para uso inmediato
      }
    } catch (err) {
      console.error('Error cargando información de libros:', err);
      return {};
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleStartExperiment = useCallback(async () => {
    console.log('[ExperimentRunner] *** BOTÓN INICIAR PRESIONADO ***');
    if (blocks.length === 0) {
      setError('No hay bloques para ejecutar');
      console.log('[ExperimentRunner] Error: No hay bloques');
      return;
    }
    
    console.log('[ExperimentRunner] Iniciando experimento con', blocks.length, 'bloques');
    
    // Asegurarse de que los libros estén cargados antes de empezar
    let loadedBooks = {};
    const uniqueBookIds = [...new Set(blocks.filter(b => b.bookId).map(b => b.bookId))];
    if (uniqueBookIds.length > 0) {
      console.log('[ExperimentRunner] Cargando libros:', uniqueBookIds);
      loadedBooks = await fetchBooksInfo(uniqueBookIds);
      console.log('[ExperimentRunner] Libros cargados:', loadedBooks);
      setBookFiles(loadedBooks);
    }
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiment-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ experimentId: experiment.id, totalBlocks: blocks.length }),
        credentials: 'include'
      });
      if (response.ok) {
        const run = await response.json();
        console.log('[ExperimentRunner] Corrida creada:', run.id);
        setRunId(run.id);
        setCurrentBlockIndex(0);
        setCapturedData([]);
        setError('');
        setIsRunning(true);
        // Llamar startBlock con el runId y los libros que acabamos de cargar
        console.log('[ExperimentRunner] Iniciando primer bloque con runId:', run.id);
        startBlock(0, run.id, loadedBooks);
      } else {
        const errorText = await response.text();
        console.error('[ExperimentRunner] Error en respuesta:', errorText);
        setError('Error al crear la corrida del experimento');
      }
    } catch (err) {
      setError('Error al iniciar experimento');
      console.error('[ExperimentRunner] Error al iniciar:', err);
    }
  }, [blocks, experiment.id]);

  const startBlock = async (blockIndex, passedRunId, passedBooks) => {
    const block = blocks[blockIndex];
    const actualRunId = passedRunId || runId;
    const booksToUse = passedBooks || bookFiles; // Usar los libros pasados o los del estado
    console.log('[ExperimentRunner] startBlock llamado:', { 
      blockIndex, 
      block, 
      booksToUse, 
      actualRunId,
      isRunning
    });
    
    if (!actualRunId) {
      console.error('[ExperimentRunner] No hay runId, no se puede iniciar bloque');
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/experiment-runs/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          runId: actualRunId, blockId: block.id, blockNumber: block.blockNumber,
          bookId: block.bookId, pageNumber: block.pageNumber
        }),
        credentials: 'include'
      });
      if (response.ok) {
        const runBlock = await response.json();
        console.log('[ExperimentRunner] Bloque iniciado en BD:', runBlock.id);
        setCurrentBlockData(runBlock);
        if (block.bookId) {
          const bookFile = booksToUse[block.bookId];
          console.log('[ExperimentRunner] Bloque con libro detectado:', {
            blockId: block.id,
            blockNumber: block.blockNumber,
            bookId: block.bookId,
            archivo: bookFile,
            pageNumber: block.pageNumber,
            duration: block.duration
          });
          if (bookFile) {
            // Mostrar pantalla intro del bloque por 3 segundos
            console.log('[ExperimentRunner] Mostrando intro de bloque...');
            setShowBlockIntro(true);
            setTimeout(() => {
              setShowBlockIntro(false);
              if (bookChanged) {
                // Si cambió de libro, mostrar Lector. Si es el mismo, ya está abierto
                setShowLector(true);
              }
              console.log('[ExperimentRunner] showLector = true, iniciando lectura');
            }, 3000);
          } else {
            console.error('[ExperimentRunner] No se encontró el archivo del libro:', block.bookId);
            setError('No se pudo cargar el libro configurado');
          }
        } else {
          console.log('[ExperimentRunner] Bloque sin libro, iniciando timer');
          executeBlockTimer(block, runBlock.id);
        }
      } else {
        console.error('[ExperimentRunner] Error al iniciar bloque en BD');
      }
    } catch (err) {
      console.error('[ExperimentRunner] Error al iniciar bloque:', err);
      setError('Error al iniciar bloque');
    }
  };

  const executeBlockTimer = (block, runBlockId) => {
    const duration = (block.duration || 30) * 1000;
    setTimeout(() => {
      handleBlockComplete(runBlockId);
    }, duration);
  };

  const [showFinalScreen, setShowFinalScreen] = useState(false);

  const handleBlockComplete = async (runBlockId) => {
    console.log('[ExperimentRunner] ====== handleBlockComplete INICIADO ======');
    console.log('[ExperimentRunner] runBlockId:', runBlockId);
    console.log('[ExperimentRunner] currentBlockIndex:', currentBlockIndex);
    console.log('[ExperimentRunner] total blocks:', blocks.length);
    
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`/api/experiment-runs/blocks/${runBlockId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      
      console.log('[ExperimentRunner] Bloque marcado como completado en servidor');
      
      // Pequeño delay para asegurar que se actualicen los estados
      setTimeout(() => {
        const nextBlockIndex = currentBlockIndex + 1;
        console.log('[ExperimentRunner] Evaluando transición: currentBlockIndex=', currentBlockIndex, 'blocks.length=', blocks.length, 'nextBlockIndex=', nextBlockIndex);
        
        if (nextBlockIndex < blocks.length) {
          console.log('[ExperimentRunner] ✅ Hay más bloques. Preparando siguiente...');
          const currentBook = blocks[currentBlockIndex].bookId;
          const nextBook = blocks[nextBlockIndex].bookId;
          const bookChanged = currentBook !== nextBook;
          console.log('[ExperimentRunner] Libro actual:', currentBook, 'Siguiente:', nextBook, 'Cambió:', bookChanged);
          
          // Si cambia de libro, cerrar Lector. Si es el mismo, mantenerlo abierto
          if (bookChanged) {
            setShowLector(false);
            console.log('[ExperimentRunner] Cerrando Lector (libro diferente)');
          } else {
            console.log('[ExperimentRunner] Manteniendo Lector abierto (mismo libro)');
          }
          
          setShowConfirmation(true);

          // Auto-continuar al siguiente bloque tras breve pausa
          setTimeout(() => {
            console.log('[ExperimentRunner] Auto-continuando al bloque', nextBlockIndex + 1);
            setCurrentBlockIndex(nextBlockIndex);
            startBlock(nextBlockIndex, runId, bookFiles);
            setShowConfirmation(false);
          }, 1200);
        } else {
          console.log('[ExperimentRunner] ✅ Experimento completado (no hay más bloques)');
          setShowLector(false);
          completeExperiment();
        }
      }, 500);
    } catch (err) {
      console.error('[ExperimentRunner] Error al completar bloque:', err);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleContinueToNextBlock = useCallback(() => {
    console.log('[ExperimentRunner] handleContinueToNextBlock llamado');
    console.log('[ExperimentRunner] currentBlockIndex:', currentBlockIndex);
    console.log('[ExperimentRunner] runId:', runId);
    console.log('[ExperimentRunner] bookFiles:', bookFiles);
    
    setShowConfirmation(false);
    const nextIndex = currentBlockIndex + 1;
    
    console.log('[ExperimentRunner] Avanzando a siguiente bloque:', nextIndex);
    
    // Actualizar currentBlockIndex primero
    setCurrentBlockIndex(nextIndex);
    
    // Usar setTimeout para asegurar que el estado se actualiza
    setTimeout(() => {
      console.log('[ExperimentRunner] Iniciando bloque:', nextIndex, 'con runId:', runId, 'y bookFiles');
      startBlock(nextIndex, runId, bookFiles);
    }, 50);
  }, [currentBlockIndex, runId, bookFiles]);

  const completeExperiment = async () => {
    try {
      const token = localStorage.getItem('authToken');
      await fetch(`/api/experiment-runs/${runId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      setIsRunning(false);
      console.log('[ExperimentRunner] Experimento completado, mostrando pantalla final');
      setShowFinalScreen(true);
    } catch (err) {
      console.error('Error al completar experimento:', err);
    }
  };

  const handleRepeatExperiment = () => {
    console.log('[ExperimentRunner] Reiniciando experimento');
    setShowFinalScreen(false);
    setCurrentBlockIndex(0);
    setCapturedData([]);
    setError('');
    setIsRunning(true);
    handleStartExperiment();
  };

  const handleViewResults = () => {
    console.log('[ExperimentRunner] Viendo resultados');
    // Navegar a la página de resultados
    window.location.href = `/resultados?runId=${runId}`;
  };

  const handleCloseFinal = () => {
    console.log('[ExperimentRunner] Cerrando desde pantalla final');
    if (onExperimentComplete) {
      onExperimentComplete();
    } else {
      onClose();
    }
  };

  const handlePauseExperiment = () => {
    setIsPaused(true);
    // TODO: Pausar timers, eye tracking, etc.
  };

  const handleResumeExperiment = () => {
    setIsPaused(false);
    // TODO: Reanudar timers, eye tracking, etc.
  };

  const handleCancelExperiment = () => {
    setShowCancelConfirm(true);
  };

  const confirmCancelExperiment = async () => {
    if (!cancelPassword.trim()) {
      alert('Debes ingresar tu contraseña para cancelar');
      return;
    }
    try {
      const token = localStorage.getItem('authToken');
      const verifyResponse = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password: cancelPassword }),
        credentials: 'include'
      });
      if (!verifyResponse.ok) {
        alert('Contraseña incorrecta');
        return;
      }
      await fetch(`/api/experiment-runs/${runId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      setIsRunning(false);
      setShowCancelConfirm(false);
      alert('Experimento cancelado');
      onClose();
    } catch (err) {
      console.error('Error al cancelar experimento:', err);
      alert('Error al cancelar el experimento');
    }
  };

  // ===== PLACEHOLDER PARA INTEGRACIÓN CON EYE TRACKER =====
  // TODO: Integrar con el código Python del eye tracker
  // - Configurar conexión con Gazepoint/eye tracker vía WebSocket
  // - Aplicar estímulos externos según configuración del bloque:
  //   * vibrationEnabled: activar dispositivo de vibración
  //   * auditoryEnabled: reproducir sonidos/tonos
  //   * visualEnabled: mostrar elementos visuales en pantalla
  //   * randomFrequency: frecuencia de estímulos aleatorios
  //   * frequencyCross: cruzar frecuencias entre estímulos
  // - Capturar datos de eye tracking:
  //   * Coordenadas de mirada (x, y)
  //   * Fijaciones (duración, posición)
  //   * Sacádicos (velocidad, dirección)
  //   * Dilatación pupilar
  //   * Frecuencia de parpadeo
  // - Detectar divagaciones mentales basado en patrones de mirada
  // - Enviar todos los datos capturados usando captureData()
  // ========================================================

  const captureData = useCallback((dataType, data) => {
    const dataPoint = {
      runId, runBlockId: currentBlockData?.id,
      timestamp: new Date().toISOString(), dataType,
      data: JSON.stringify(data)
    };
    setCapturedData(prev => [...prev, dataPoint]);
    
    // Agregar debounce para evitar saturar el servidor
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem('authToken');
      fetch('/api/experiment-runs/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dataPoint),
        credentials: 'include'
      }).catch(err => console.error('Error guardando datos:', err));
    }, 500); // Enviar después de 500ms sin más datos
  }, [runId, currentBlockData]);

  if (showBlockIntro && blocks[currentBlockIndex]) {
    const currentBlock = blocks[currentBlockIndex];
    const totalDurationSeconds = blocks.reduce((sum, b) => sum + (b.duration || 0), 0);
    const bookName = booksInfo[currentBlock.bookId]?.name || 'Libro sin asignar';
    return (
      <div className="block-intro-screen">
        <div className="block-intro-content">
          <div className="block-intro-number">
            Bloque {currentBlockIndex + 1} de {blocks.length}
          </div>
          <h2 className="block-intro-title">{currentBlock.name}</h2>
          <div className="block-intro-details">
            <div className="detail-item">
              <span className="detail-label">📖 Libro:</span>
              <span className="detail-value">{bookName}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">📄 Página de inicio:</span>
              <span className="detail-value">{currentBlock.pageNumber || 1}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">⏱️ Duración:</span>
              <span className="detail-value">{currentBlock.duration}s</span>
            </div>
            {totalDurationSeconds > 0 && (
              <div className="detail-item">
                <span className="detail-label">⏳ Total sesión:</span>
                <span className="detail-value">{totalDurationSeconds}s</span>
              </div>
            )}
          </div>
          <div className="block-intro-animation">
            <div className="block-intro-spinner"></div>
            <p>Iniciando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showLector && blocks[currentBlockIndex]) {
    const currentBlock = blocks[currentBlockIndex];
    console.log('[ExperimentRunner] Renderizando Lector:', { 
      currentBlock, 
      archivo: bookFiles[currentBlock.bookId],
      bookFiles,
      initialPage: currentBlock.pageNumber
    });
    return (
      <div className="experiment-runner-fullscreen">
        <div className="experiment-header">
          <div className="experiment-progress">
            Bloque {currentBlockIndex + 1} de {blocks.length}: {currentBlock.name}
          </div>
          <div className="experiment-controls">
            {!isPaused ? (
              <button onClick={handlePauseExperiment} className="btn-pause">⏸ Pausar</button>
            ) : (
              <button onClick={handleResumeExperiment} className="btn-resume">▶ Reanudar</button>
            )}
            <button onClick={handleCancelExperiment} className="btn-cancel">✖ Cancelar</button>
          </div>
        </div>
        <Lector 
          archivo={bookFiles[currentBlock.bookId] || ''}
          bookId={currentBlock.bookId}
          initialPage={currentBlock.pageNumber || 1}
          experimentMode={true}
          blockDuration={currentBlock.duration}
          onBlockComplete={() => {
            console.log('[ExperimentRunner] onBlockComplete callback ejecutado');
            if (currentBlockData && currentBlockData.id) {
              handleBlockComplete(currentBlockData.id);
            } else {
              console.error('[ExperimentRunner] No hay currentBlockData.id');
            }
          }}
          onDataCapture={captureData}
        />
      </div>
    );
  }

  if (showConfirmation) {
    console.log('[ExperimentRunner] ====== RENDERIZANDO PANTALLA DE CONFIRMACIÓN ======');
    console.log('[ExperimentRunner] currentBlockIndex:', currentBlockIndex);
    console.log('[ExperimentRunner] blocks.length:', blocks.length);
    console.log('[ExperimentRunner] Siguiente bloque:', blocks[currentBlockIndex + 1]);
    return (
      <div className="experiment-runner">
        <div className="confirmation-screen">
          <h2>Bloque Completado</h2>
          <p>Has completado el bloque {currentBlockIndex + 1} de {blocks.length}</p>
          <p className="next-block-info">
            Siguiente: <strong>{blocks[currentBlockIndex + 1]?.name}</strong>
          </p>
          <div className="space-instruction">
            <div className="space-key">ESPACIO</div>
            <p>Presiona la barra espaciadora para continuar</p>
          </div>
          <button onClick={handleContinueToNextBlock} className="btn btn-primary">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  if (showFinalScreen) {
    console.log('[ExperimentRunner] ====== RENDERIZANDO PANTALLA FINAL ======');
    return (
      <div className="experiment-runner">
        <div className="final-screen">
          <h2>¡Experimento Completado!</h2>
          <p>Has completado exitosamente todos los bloques del experimento.</p>
          <div className="final-options">
            <button onClick={handleRepeatExperiment} className="btn btn-primary btn-large">
              🔄 Repetir Experimento
            </button>
            <button onClick={handleViewResults} className="btn btn-secondary btn-large">
              📊 Ver Resultados
            </button>
            <button onClick={handleCloseFinal} className="btn btn-cancel btn-large">
              ✖ Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showCancelConfirm) {
    return (
      <div className="experiment-runner">
        <div className="modal-overlay">
          <div className="modal-content cancel-modal">
            <h3>⚠️ Cancelar Experimento</h3>
            <p>Para cancelar el experimento, ingresa tu contraseña:</p>
            <input
              type="password"
              value={cancelPassword}
              onChange={(e) => setCancelPassword(e.target.value)}
              placeholder="Contraseña"
              className="password-input"
              autoFocus
            />
            <div className="modal-buttons">
              <button onClick={() => setShowCancelConfirm(false)} className="btn btn-cancel">
                Volver
              </button>
              <button onClick={confirmCancelExperiment} className="btn btn-danger">
                Confirmar Cancelación
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="experiment-runner">
      {console.log('[ExperimentRunner] Renderizando con estados:', { loading, isRunning, showLector, showConfirmation, error, blocksCount: blocks.length })}
      <div className="experiment-header">
        <h2>{experiment.name}</h2>
        <button onClick={onClose} className="close-btn">✖</button>
      </div>
      {error && <div className="error-message">{error}</div>}
      {loading ? (
        <p className="loading">Cargando configuración del experimento...</p>
      ) : !isRunning ? (
        <div className="experiment-start">
          <div className="experiment-info">
            <h3>Información del Experimento</h3>
            {experiment.description && <p>{experiment.description}</p>}
            <p><strong>Bloques:</strong> {blocks.length}</p>
            <p><strong>Duración estimada:</strong> {blocks.reduce((sum, b) => sum + (b.duration || 0), 0)} segundos</p>
          </div>
          <div className="blocks-preview">
            <h4>Bloques a Ejecutar:</h4>
            <ol>
              {blocks.map((block, idx) => (
                <li key={block.id}>
                  <strong>{block.name}</strong> - {block.duration}s
                  {block.bookId && <span> 📖 (Libro asignado)</span>}
                </li>
              ))}
            </ol>
          </div>
          <div style={{display:'flex', gap:'1rem', justifyContent:'center', marginTop:'1.5rem'}}>
            {console.log('[ExperimentRunner] Renderizando botón. blocks.length =', blocks.length, 'disabled =', blocks.length === 0)}
            <button 
              onClick={(e) => {
                console.log('[ExperimentRunner] *** BOTÓN CLICKEADO *** evento:', e);
                handleStartExperiment();
              }} 
              onMouseEnter={() => console.log('[ExperimentRunner] Botón: mouse enter')}
              onMouseDown={() => console.log('[ExperimentRunner] Botón: mouse down')}
              className="btn btn-primary btn-large" 
              disabled={blocks.length === 0}
              style={{
                cursor: blocks.length === 0 ? 'not-allowed' : 'pointer',
                backgroundColor: '#4CAF50',
                color: 'white',
                fontSize: '1.2rem',
                padding: '15px 30px',
                fontWeight: 'bold',
                border: '3px solid #2E7D32',
                borderRadius: '8px',
                minWidth: '250px',
                opacity: blocks.length === 0 ? 0.5 : 1,
                boxShadow: blocks.length === 0 ? 'none' : '0 4px 12px rgba(76, 175, 80, 0.4)'
              }}
            >
              ▶ INICIAR EXPERIMENTO (click aquí)
            </button>
            <button onClick={() => alert('Función de resultados en desarrollo')} className="btn btn-secondary btn-large">
              📊 Ver Resultados
            </button>
          </div>
        </div>
      ) : (
        <div className="experiment-running">
          <div className="progress-indicator">
            <div className="progress-bar">
              <div className="progress-fill" style={{width: `${((currentBlockIndex + 1) / blocks.length) * 100}%`}} />
            </div>
            <p>Ejecutando bloque {currentBlockIndex + 1} de {blocks.length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExperimentRunner;
