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
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
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
  const [bookPathToName, setBookPathToName] = useState({}); // Mapeo de path -> nombre del libro
  const [isLectorReady, setIsLectorReady] = useState(false); // Indica si el Lector está cargado
  const [currentBookId, setCurrentBookId] = useState(null); // Track del libro actualmente cargado
  const [pythonConnected, setPythonConnected] = useState(false); // Track si Python está conectado
  const debounceTimerRef = useRef(null); // Para debounce de guardado
  const pythonPollRef = useRef(null); // Para polling de Python

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

  // Monitor de comunicación con Python - DESACTIVADO porque Flask está comentado en start.js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!runId || !isRunning) return;
    
    // ⚠️ FLASK DESACTIVADO - No hacer polling a puerto 5000
    setPythonConnected(false);
    console.log('[ExperimentRunner] ℹ️ Modo sin Python (Flask desactivado en start.js)');
    
    return () => {
      if (pythonPollRef.current) clearInterval(pythonPollRef.current);
    };
  }, [runId, isRunning]);

  // Función para formatear segundos a MM:SS
  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Listener para barra espaciadora
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleKeyPress = (e) => {
      // ESPACIO durante intro del bloque: cerrar intro y abrir Lector
      if (e.code === 'Space' && showBlockIntro && !showLector) {
        e.preventDefault();
        console.log('\n=== 🔑 SPACEBAR EN INTRO ===');
        console.log('[ExperimentRunner] ✅ ESPACIO presionado durante intro');
        console.log('[ExperimentRunner] showBlockIntro=true → false');
        console.log('[ExperimentRunner] showLector=false → true');
        console.log('[ExperimentRunner] Próximo estado esperado en Lector: shouldStart=true');
        setShowBlockIntro(false);
        setShowLector(true);
      }
      // ESPACIO durante confirmación entre bloques: continuar al siguiente
      if (e.code === 'Space' && showConfirmation && !showLector) {
        e.preventDefault();
        handleContinueToNextBlock();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showConfirmation, showLector, showBlockIntro]);

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
      console.log('[ExperimentRunner] ===== FETCHBLOCKS INICIADO =====');
      console.log('[ExperimentRunner] experiment completo:', experiment);
      console.log('[ExperimentRunner] experiment.config (raw):', experiment.config);
      console.log('[ExperimentRunner] typeof experiment.config:', typeof experiment.config);
      setLoading(true);
      
      // Parsear configuración del experimento
      const config = typeof experiment.config === 'string' 
        ? JSON.parse(experiment.config) 
        : experiment.config || {};
      
      const numBlocks = config.num_blocks || 5;
      const minutesPerBlock = config.minutes_per_block || 5.22;
      const durationSeconds = Math.round(minutesPerBlock * 60); // Convertir minutos a segundos
      const bookId = config.epubFile || null; // Obtener el libro configurado
      const initialPage = config.initial_page || 1; // Obtener página inicial configurada
      
      console.log('[ExperimentRunner] Config:', { numBlocks, minutesPerBlock, durationSeconds, bookId, initialPage });
      
      // Generar N bloques automáticamente (sin guardar en BD)
      const generatedBlocks = Array.from({ length: numBlocks }, (_, i) => ({
        id: `local_${i}`, // ID temporal local
        blockNumber: i + 1,
        blockIndex: i,
        name: `Bloque ${i + 1}`,
        duration: durationSeconds, // En SEGUNDOS
        bookId: bookId, // Usar el libro configurado en el experimento
        pageNumber: initialPage, // Usar página inicial configurada
        config: config
      }));
      
      setBlocks(generatedBlocks);
      console.log('[ExperimentRunner] Bloques generados automáticamente:', generatedBlocks);
      console.log('[ExperimentRunner] ✅ Cada bloque tiene bookId:', generatedBlocks[0]?.bookId);
      
      // Si hay libro configurado, obtener su información (nombre, metadata)
      if (bookId) {
        console.log('[ExperimentRunner] Obteniendo información del libro:', bookId);
        // Usar la API de libros para obtener el nombre del libro
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch('/api/books', {
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
          });
          if (response.ok) {
            const allBooks = await response.json();
            console.log('[ExperimentRunner] Todos los libros del servidor:', allBooks);
            const pathToNameMap = {};
            let found = false;
            allBooks.forEach(book => {
              const bookPath = book.path || book.file || book.filePath || '';
              const bookName = book.name || book.title || 'Libro sin nombre';
              pathToNameMap[bookPath] = bookName;
              // También mapear por filename sin path completo
              if (bookPath.includes(bookId) || bookId.includes(bookPath)) {
                console.log('[ExperimentRunner] ✅ COINCIDENCIA ENCONTRADA:', { bookId, bookPath, bookName });
                found = true;
              }
            });
            if (!found) {
              console.log('[ExperimentRunner] ⚠️ NO SE ENCONTRÓ COINCIDENCIA PARA:', bookId);
            }
            setBookPathToName(pathToNameMap);
            console.log('[ExperimentRunner] Mapa de libros cargado:', pathToNameMap);
          }
        } catch (err) {
          console.error('[ExperimentRunner] Error cargando información de libros:', err);
        }
      }
      
      if (generatedBlocks.length === 0) {
        setError('Error generando bloques desde configuración');
      }
    } catch (err) {
      setError('Error al generar bloques: ' + err.message);
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
        const pathToNameMap = {};
        bookIds.forEach(bookId => {
          const book = allBooks.find(b => b.id === bookId || b.id === parseInt(bookId));
          if (book) {
            const bookPath = book.path || book.file || book.filePath || '';
            booksMap[bookId] = bookPath;
            const bookName = book.name || book.title || 'Libro sin nombre';
            booksInfoMap[bookId] = {
              name: bookName,
              path: bookPath
            };
            // Mapear también por path para búsqueda rápida
            pathToNameMap[bookPath] = bookName;
          }
        });
        setBookFiles(booksMap);
        setBooksInfo(booksInfoMap);
        setBookPathToName(pathToNameMap);
        console.log('[ExperimentRunner] Libros cargados:', booksMap);
        console.log('[ExperimentRunner] Info de libros:', booksInfoMap);
        console.log('[ExperimentRunner] Path a nombre:', pathToNameMap);
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
    
    // SI ya hay bloques generados en state, usarlos directamente
    if (blocks && blocks.length > 0) {
      console.log('[ExperimentRunner] ✓ Usando', blocks.length, 'bloques ya generados');
      // Los bloques ya existen, continuar sin regenerar
    } else {
      // Si no hay bloques en state, algo salió mal en fetchBlocks
      console.error('[ExperimentRunner] ❌ No hay bloques generados');
      setError('Error: No se pudieron generar los bloques');
      return;
    }
    
    console.log('[ExperimentRunner] Iniciando experimento con', blocks.length, 'bloques');
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Llamar a nuevo endpoint que inicia en Flask Y crea la corrida
      const response = await fetch('/api/experiment-runs/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ experimentId: experiment.id }),
        credentials: 'include'
      });
      
      if (response.ok) {
        const run = await response.json();
        console.log('\n=== 🚀 EXPERIMENTO INICIADO ===');
        console.log('[ExperimentRunner] Run ID:', run.runId);
        console.log('[ExperimentRunner] Bloques totales:', blocks.length);
        console.log('[ExperimentRunner] Duración total:', formatTime(blocks.reduce((sum, b) => sum + b.duration, 0)));
        console.log('[ExperimentRunner] Python status:', run.pythonStatus);
        
        setRunId(run.runId);
        setCurrentBlockIndex(0);
        setCapturedData([]);
        setError('');
        setIsRunning(true);
        setShowLector(false);  // Iniciar sin mostrar - el intro lo mostrará con shouldStart=false
        setShowBlockIntro(true);  // Mostrar intro primero
        console.log('[ExperimentRunner] Estados configurados: showBlockIntro=true, showLector=false');
        console.log('[ExperimentRunner] ⏳ Esperando SPACEBAR en intro...');
        
        // Asegurarse de que los libros estén cargados
        let loadedBooks = {};
        const uniqueBookIds = [...new Set(blocks.filter(b => b.bookId).map(b => b.bookId))];
        if (uniqueBookIds.length > 0) {
          console.log('[ExperimentRunner] Cargando libros:', uniqueBookIds);
          loadedBooks = await fetchBooksInfo(uniqueBookIds);
          setBookFiles(loadedBooks);
        }
        
        // Iniciar primer bloque
        startBlock(0, run.runId, loadedBooks);
      } else {
        const errorData = await response.json();
        console.error('[ExperimentRunner] Error:', errorData);
        setError(`❌ ${errorData.error || 'Error al iniciar experimento'}`);
      }
    } catch (err) {
      setError(`❌ Error: ${err.message}`);
      console.error('[ExperimentRunner] Error al iniciar:', err);
    }
  }, [blocks, experiment.id, experiment.config]);

  const startBlock = async (blockIndex, passedRunId, passedBooks) => {
    const block = blocks[blockIndex];
    const actualRunId = passedRunId || runId;
    const booksToUse = passedBooks || bookFiles; // Usar los libros pasados o los del estado
    console.log('\n=== 📦 INICIANDO BLOQUE ===');
    console.log(`[ExperimentRunner] Bloque ${blockIndex + 1} de ${blocks.length}`);
    console.log('[ExperimentRunner] ID bloque:', block.id);
    console.log('[ExperimentRunner] Nombre:', block.name);
    console.log('[ExperimentRunner] Duración:', formatTime(block.duration));
    console.log('[ExperimentRunner] Libro asignado:', block.bookId || 'NINGUNO');
    console.log('[ExperimentRunner] Página inicial:', block.pageNumber || 1);
    
    if (!actualRunId) {
      console.error('[ExperimentRunner] No hay runId, no se puede iniciar bloque');
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      console.log('[ExperimentRunner] Iniciando bloque - Token disponible:', !!token);
      console.log('[ExperimentRunner] Datos a enviar:', JSON.stringify({
        runId: actualRunId, blockId: block.id, blockNumber: block.blockNumber,
        bookId: block.bookId, pageNumber: block.pageNumber
      }, null, 2));
      
      const response = await fetch('/api/experiment-runs/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          runId: actualRunId, blockId: block.id, blockNumber: block.blockNumber,
          bookId: block.bookId, pageNumber: block.pageNumber
        }),
        credentials: 'include'
      });
      
      console.log('[ExperimentRunner] Response status:', response.status);
      console.log('[ExperimentRunner] Response headers:', {
        'content-type': response.headers.get('content-type')
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
            // Mostrar pantalla intro del bloque - permanece hasta que presione ESPACIO
            console.log('[ExperimentRunner] Mostrando intro de bloque (espera ESPACIO)...');
            // Resetear estado de carga y actualizar libro actual
            setIsLectorReady(false);
            setCurrentBookId(block.bookId);
            setShowBlockIntro(true);
          } else {
            console.error('[ExperimentRunner] No se encontró el archivo del libro:', block.bookId);
            setError('No se pudo cargar el libro configurado');
          }
        } else {
          console.log('[ExperimentRunner] Bloque sin libro - pero se renderiza Lector de todas formas');
          // Nota: El timer es manejado INTERNAMENTE por Lector.js en su useEffect de experimentMode
          // No debemos crear un timer duplicado aquí
          setShowBlockIntro(true);
        }
      } else {
        const errorText = await response.text();
        console.error('[ExperimentRunner] Error al iniciar bloque en BD:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        setError(`Error ${response.status}: ${errorText}`);
      }
    } catch (err) {
      console.error('[ExperimentRunner] Error al iniciar bloque:', err);
      setError('Error al iniciar bloque: ' + err.message);
    }
  };

  const completeExperiment = useCallback(async () => {
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
  }, [runId]);

  // Timer ahora es manejado INTERNAMENTE por Lector.js en su useEffect de experimentMode
  // ExperimentRunner NO debe tener timer separado para evitar duplicados

  const handleBlockComplete = useCallback(async (runBlockId) => {
    console.log('[ExperimentRunner] ====== handleBlockComplete INICIADO ======');
    console.log('[ExperimentRunner] runBlockId:', runBlockId);
    console.log('[ExperimentRunner] currentBlockData:', currentBlockData);
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
        // Encontrar el índice del bloque completado
        const completedIndex = blocks.findIndex(b => b.id === currentBlockData?.blockId);
        const nextBlockIndex = completedIndex + 1;
        console.log('[ExperimentRunner] Evaluando transición: completedIndex=', completedIndex, 'blocks.length=', blocks.length, 'nextBlockIndex=', nextBlockIndex);
        
        if (nextBlockIndex < blocks.length) {
          console.log('[ExperimentRunner] ✅ Hay más bloques. Preparando siguiente...');
          const currentBook = blocks[completedIndex]?.bookId;
          const nextBook = blocks[nextBlockIndex]?.bookId;
          const bookChanged = currentBook !== nextBook;
          console.log('[ExperimentRunner] Libro actual:', currentBook, 'Siguiente:', nextBook, 'Cambió:', bookChanged);
          
          // Auto-continuar al siguiente bloque tras breve pausa
          setTimeout(() => {
            console.log('[ExperimentRunner] Auto-continuando al bloque', nextBlockIndex + 1);
            setCurrentBlockIndex(nextBlockIndex);
            setCurrentBlockData(null); // Limpiar datos del bloque anterior
            
            // Si cambia de libro, cerrar Lector antes de cargar el nuevo
            if (bookChanged) {
              console.log('[ExperimentRunner] Libro diferente - cerrando Lector actual');
              setShowLector(false);
            } else {
              console.log('[ExperimentRunner] Mismo libro - Lector permanecerá cargado');
            }
            
            // Resetear estado de carga y cambiar a intro del siguiente bloque
            setIsLectorReady(false);
            setShowConfirmation(false);
            startBlock(nextBlockIndex, runId, bookFiles);
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
  }, [currentBlockData, blocks, runId, bookFiles, completeExperiment, currentBookId]);

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
    
    console.log('[ExperimentRunner] ====== RENDERIZANDO BLOCK INTRO ======');
    console.log('[ExperimentRunner] isLectorReady:', isLectorReady);
    console.log('[ExperimentRunner] currentBlock:', currentBlock);
    console.log('[ExperimentRunner] archivo:', bookFiles[currentBlock.bookId] || '(vacío - sin libro)');
    
    const epubFile = currentBlock.bookId ? bookFiles[currentBlock.bookId] : null;
    // Extraer nombre del archivo del path (ej: /public/libros/Coraline - Neil Gaiman.epub → Coraline - Neil Gaiman)
    const extractBookName = (path) => {
      if (!path) return 'Libro sin nombre';
      const filename = path.split('/').pop(); // Obtener última parte después de /
      return filename.replace('.epub', '').replace(/\..*$/, ''); // Remover extensión
    };
    const bookName = currentBlock.bookId ? extractBookName(currentBlock.bookId) : 'Libro sin asignar';
    console.log('[ExperimentRunner] Libro del bloque:', { bookId: currentBlock.bookId, epubFile, hasFile: !!epubFile, bookName });
    
    return (
      <>
        {/* Renderizar Lector invisible en segundo plano para precargarlo */}
        <div style={{ display: 'none' }}>
          <Lector
            archivo={bookFiles[currentBlock.bookId] || ''}
            bookId={currentBlock.bookId}
            initialPage={currentBlock.pageNumber || 1}
            experimentMode={true}
            blockDuration={currentBlock.duration}
            currentRunId={runId}
            shouldStart={false}
            onReady={() => {
              console.log('[ExperimentRunner] ✅ Lector está listo para el bloque', currentBlockIndex + 1);
              console.log('[ExperimentRunner] Seteando isLectorReady = true');
              setIsLectorReady(true);
            }}
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

        {/* Pantalla visible de introducción */}
        <div className="block-intro-screen">
          <div className="block-intro-content">
            <div className="block-intro-number">
              Bloque {currentBlockIndex + 1} de {blocks.length}
            </div>
            <h2 className="block-intro-title">{currentBlock.name}</h2>
            <div className="block-intro-details">
              <div className="detail-item">
                <span className="detail-label">📖 Libro:</span>
                <span className="detail-value" style={{color: !currentBlock.bookId ? '#ff9800' : '#fff'}}>{bookName}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">📄 Página de inicio:</span>
                <span className="detail-value">{currentBlock.pageNumber || 1}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">⏱️ Duración:</span>
                <span className="detail-value">{formatTime(currentBlock.duration)}</span>
              </div>
              {totalDurationSeconds > 0 && (
                <div className="detail-item">
                  <span className="detail-label">⏳ Total sesión:</span>
                  <span className="detail-value">{formatTime(totalDurationSeconds)}</span>
                </div>
              )}
            </div>
            <div className="block-intro-animation">
              {!isLectorReady && <div className="block-intro-spinner"></div>}
              <p style={{ fontSize: isLectorReady ? '24px' : '18px', marginTop: isLectorReady ? '0' : '20px' }}>
                {isLectorReady ? '✓ Presiona ESPACIO para comenzar' : `Iniciando Bloque ${currentBlockIndex + 1}...`}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (showLector && blocks[currentBlockIndex]) {
    const currentBlock = blocks[currentBlockIndex];
    const epubFile = currentBlock.config?.epubFile || experiment.config?.epubFile || '';
    console.log('[ExperimentRunner] Renderizando Lector:', { 
      currentBlock, 
      epubFile,
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
          archivo={epubFile}
          bookId={epubFile}
          initialPage={currentBlock.pageNumber || 1}
          experimentMode={true}
          blockDuration={currentBlock.duration}
          currentRunId={runId}
          shouldStart={true}
          onClose={onClose}
          onBlockComplete={() => {
            console.log('[ExperimentRunner] onBlockComplete callback ejecutado');
            if (currentBlockData && currentBlockData.id) {
              handleBlockComplete(currentBlockData.id);
            } else {
              console.error('[ExperimentRunner] No hay currentBlockData.id');
            }
          }}
          onPause={() => {
            console.log('[ExperimentRunner] onPause callback - Mostrando pantalla de pausa');
            setIsPaused(true);
          }}
          onResume={() => {
            console.log('[ExperimentRunner] onResume callback - Reanudando experimento');
            setIsPaused(false);
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
