/**
 * LECTOR - Componente principal para leer libros EPUB
 * 
 * Características:
 * - Lectura de libros en formato EPUB
 * - Navegación por páginas con flechas
 * - Ajustes de texto (fuente, tamaño, espaciado)
 * - Temas de color (claro, sepia, oscuro)
 * - Grabación de sesión con cámara
 * - Integración con Gazepoint para seguimiento ocular
 * - Sistema de bloques de lectura (5 bloques de 5 minutos)
 * - Índice navegable con búsqueda
 */

import React, { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import './lector.css';
import { useGazepoint } from './hooks/useGazepoint';
import { useGazeHighlight } from './hooks/useGazeHighlight';

export default function Lector(props) {
  const { archivo, onClose } = props;
  
  // ============ REFERENCIAS ============
  const viewerRef = useRef(null);
  const bookRef = useRef(null);
  const renditionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const blockTimerRef = useRef(null);
  const blockStartTime = useRef(null);
  const pageCalcRef = useRef({ locationsPerPage: 1, totalLocs: 0, totalPages: 0 });
  const progressLoadedRef = useRef(false); // Bandera para cargar progreso solo una vez
  const saveProgressTimeoutRef = useRef(null); // Para debounce del guardado
  
  // ============ ESTADOS DEL LIBRO ============
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [bookTitle, setBookTitle] = useState('Cargando...');
  const [bookIndex, setBookIndex] = useState([]);
  
  // ============ ESTADOS DE UI ============
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('texto');
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  
  // ============ ESTADOS DE GRABACIÓN ============
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [enableGazeHighlight, setEnableGazeHighlight] = useState(false);
  
  // ============ ESTADOS DE BLOQUES DE LECTURA ============
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(1);
  const [blockTimer, setBlockTimer] = useState(0);
  const [isBlockActive, setIsBlockActive] = useState(false);
  const [blockTimerPosition, setBlockTimerPosition] = useState('center');
  
  // ============ PREFERENCIAS DE LECTURA ============
  const [prefs, setPrefs] = useState({
    fontSize: 100,
    lineHeight: 1.45,
    theme: 'light',
    font: 'original',
    brightness: 1.0
  });

  // ============ HOOKS PERSONALIZADOS ============
  const { startRecording: startGaze, stopRecording: stopGaze, isConnected: gazeConnected } = useGazepoint();
  useGazeHighlight(viewerRef, enableGazeHighlight && gazeConnected);

  // ============ FUNCIÓN PARA GUARDAR PROGRESO ============
  const saveReadingProgress = React.useCallback(async (retryCount = 0) => {
    const token = localStorage.getItem('authToken');
    if (!token || !archivo) return;

    try {
      const progressData = {
        bookFile: archivo,
        currentPage,
        totalPages,
        progress
      };

      const response = await fetch('/api/reading-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(progressData)
      });

      if (response.ok) {
        console.log('[lector] Progreso guardado:', { currentPage, totalPages });
        // Guardar en localStorage como backup
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      } else if (response.status === 401) {
        console.warn('[lector] Sesión expirada al guardar progreso');
        // Guardar en localStorage como backup
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      } else if (retryCount < 2) {
        // Reintentar hasta 2 veces si falla
        console.warn('[lector] Error guardando progreso, reintentando...');
        setTimeout(() => saveReadingProgress(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.error('[lector] Error guardando progreso después de reintentos');
        // Guardar en localStorage como backup
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      }
    } catch (err) {
      console.error('[lector] Error en saveReadingProgress:', err);
      // Guardar en localStorage como backup
      if (archivo) {
        localStorage.setItem(`progress_${archivo}`, JSON.stringify({
          bookFile: archivo,
          currentPage,
          totalPages,
          progress
        }));
      }
    }
  }, [archivo, currentPage, totalPages, progress]);

  // ============ FUNCIÓN PARA CARGAR PROGRESO ============
  const loadReadingProgress = React.useCallback(async () => {
    const token = localStorage.getItem('authToken');
    if (!token || !archivo || !bookRef.current) return;

    try {
      const encodedFile = encodeURIComponent(archivo);
      const response = await fetch(`/api/reading-progress/${encodedFile}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.currentPage > 1 && renditionRef.current && bookRef.current?.locations.length()) {
          // Ir a la página guardada
          const percentage = (data.currentPage - 1) / (data.totalPages || 1);
          try {
            const targetCfi = bookRef.current.locations.cfiFromPercentage(percentage);
            if (targetCfi) {
              await renditionRef.current.display(targetCfi);
              console.log('[lector] Progreso cargado del servidor:', data.currentPage, '/', data.totalPages);
              return; // Éxito
            }
          } catch (err) {
            console.error('[lector] Error al navegar al progreso guardado:', err);
          }
        }
      } else if (response.status === 404) {
        console.log('[lector] No hay progreso guardado para este libro');
      } else if (response.status === 401) {
        console.warn('[lector] Sesión expirada al cargar progreso');
      } else {
        console.error('[lector] Error cargando progreso del servidor');
      }
    } catch (err) {
      console.error('[lector] Error en loadReadingProgress:', err);
    }

    // Intentar cargar desde localStorage como fallback
    try {
      const localProgress = localStorage.getItem(`progress_${archivo}`);
      if (localProgress && renditionRef.current && bookRef.current?.locations.length()) {
        const data = JSON.parse(localProgress);
        if (data.currentPage > 1) {
          const percentage = (data.currentPage - 1) / (data.totalPages || 1);
          try {
            const targetCfi = bookRef.current.locations.cfiFromPercentage(percentage);
            if (targetCfi) {
              await renditionRef.current.display(targetCfi);
              console.log('[lector] Progreso cargado del localStorage:', data.currentPage, '/', data.totalPages);
            }
          } catch (err) {
            console.error('[lector] Error navegando con progreso del localStorage:', err);
          }
        }
      }
    } catch (err) {
      console.error('[lector] Error cargando progreso del localStorage:', err);
    }
  }, [archivo]);

  // ============ FUNCIONES DE APLICACIÓN DE ESTILOS ============
  
  /**
   * Aplica las preferencias de usuario al libro (fuente, tema, tamaño, etc.)
   * Se ejecuta cada vez que cambian las preferencias o se navega a una nueva página
   */
  const applyPrefsToBook = React.useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    const fontMap = {
      original: 'serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto',
      merri: '"Merriweather", Georgia, serif'
    };
    
    const css = `
      body {
        font-family: ${fontMap[prefs.font]} !important;
        font-size: ${prefs.fontSize}% !important;
        line-height: ${prefs.lineHeight}!important;
        background: ${prefs.theme === 'dark' ? '#0b0c0c' : prefs.theme === 'sepia' ? '#f4ecd8' : '#ffffff'} !important;
        color: ${prefs.theme === 'dark' ? '#e8f6f5' : '#222222'} !important;
        filter: brightness(${prefs.brightness}) !important;
        padding: 20px !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
    
    try {
      // Inyectar CSS directamente en el iframe
      // Usar requestAnimationFrame para aplicar inmediatamente
      requestAnimationFrame(() => {
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
      });
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
        // Construir URL válida para el libro
        const bookUrl = archivo.startsWith('http') ? archivo : `http://localhost:3000${archivo}`;
        const book = ePub(bookUrl);
        bookRef.current = book;
        await book.ready;
        if (!mounted) return;

        // -------- EXTRAER METADATOS DEL LIBRO --------
        const metadata = book.packaging.metadata;
        const title = metadata.title || archivo.split('/').pop().replace('.epub', '') || 'Libro sin título';
        setBookTitle(title);

        // -------- EXTRAER ÍNDICE/TABLA DE CONTENIDOS --------
        // Incluye capítulos y subcapítulos de manera recursiva
        const navigation = book.navigation;
        if (navigation && navigation.toc) {
          /**
           * Función recursiva para extraer todos los capítulos y subcapítulos
           * @param {Array} toc - Array de elementos del índice
           * @param {string} parentIndex - ID del capítulo padre (ej: "1.2")
           * @returns {Array} Array plano con todos los capítulos y subcapítulos
           */
          const extractAllChapters = (toc, parentIndex = '') => {
            const chapters = [];
            toc.forEach((item, index) => {
              const chapterId = parentIndex ? `${parentIndex}.${index + 1}` : `${index + 1}`;
              chapters.push({
                id: chapterId,
                label: item.label,
                href: item.href,
                cfi: item.cfi || null,
                level: parentIndex ? parentIndex.split('.').length : 0 // Nivel de anidación
              });
              // Si tiene subcapítulos, extraerlos recursivamente
              if (item.subitems && item.subitems.length > 0) {
                chapters.push(...extractAllChapters(item.subitems, chapterId));
              }
            });
            return chapters;
          };

          const allChapters = extractAllChapters(navigation.toc);
          
          // Preparar items del índice (número de página se calculará después)
          const indexItems = allChapters.map((item, index) => {
            return {
              ...item,
              id: index,
              page: null // Se calculará después de generar locations
            };
          });
          
          setBookIndex(indexItems);
        }

        // -------- RENDERIZAR LIBRO --------
        // Modo paginado horizontal: cada página se muestra completa sin scroll
        // Similar a Google Play Books en landscape
        const rendition = book.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          spread: 'none'        // Una sola columna por página
        });
        renditionRef.current = rendition;

        // -------- GENERAR LOCATIONS (SISTEMA DE PÁGINAS) --------
        // epubjs genera "locations" que dividen el libro en páginas virtuales
        if (!book.locations.length()) {
          console.log('[lector] Generando locations...');
          await book.locations.generate(256); // 256 caracteres por "location"
          console.log('[lector] Locations generadas:', book.locations.length());
        }
        
        // Para modo paginated, calcular total de páginas de forma diferente
        // No usar locations directamente, sino calcular basado en spine items y caracteres
        const totalLocs = book.locations.length();
        
        // Alternativa más precisa: dividir locations en "pantallas"
        // Cada pantalla debería ser aproximadamente 30 locations (ajustable)
        const locationsPerPage = Math.max(1, Math.floor(totalLocs / 100));
        const totalPagesCalc = Math.max(1, Math.ceil(totalLocs / locationsPerPage));
        
        // Guardar en ref para usar en relocated event
        pageCalcRef.current = { locationsPerPage, totalLocs, totalPages: totalPagesCalc };
        
        setTotalPages(totalPagesCalc);
        console.log('[lector] Total de páginas calculado:', totalPagesCalc, '(locations:', totalLocs, ', per page:', locationsPerPage, ')');

        // -------- CALCULAR NÚMEROS DE PÁGINA DEL ÍNDICE --------
        // Ahora que tenemos locations, asignamos número de página a cada capítulo
        if (navigation && navigation.toc && book.locations.length()) {
          setBookIndex(prevIndex => 
            prevIndex.map(item => {
              let pageNumber = null;
              try {
                if (item.href) {
                  const cfi = book.canonical(item.href); // CFI = Canonical Fragment Identifier
                  const percentage = book.locations.percentageFromCfi(cfi);
                  pageNumber = Math.floor(percentage * totalPagesCalc) + 1;
                }
              } catch (e) {
                console.log('[lector] No se pudo calcular página para:', item.label);
              }
              return { ...item, page: pageNumber };
            })
          );
        }

        // -------- MOSTRAR PRIMERA PÁGINA --------
        console.log('[lector] Mostrando primera página...');
        await rendition.display();
        console.log('[lector] Primera página mostrada');
        
        // Ocultar spinner de carga
        setIsLoading(false);
        
        // Cargar progreso guardado solo una vez
        if (!progressLoadedRef.current) {
          progressLoadedRef.current = true;
          setTimeout(() => {
            loadReadingProgress();
          }, 500);
        }

        // -------- EVENTOS DE RENDITION --------
        // relocated: se dispara al cambiar de página
        // Calcula página usando locations normalizadas a "páginas visibles"
        rendition.on('relocated', (loc) => {
          if (!loc || !book.locations.length()) return;
          
          try {
            const cfi = loc.start?.cfi || loc.cfi;
            if (!cfi) return;
            
            // Obtener porcentaje del libro
            const pct = book.locations.percentageFromCfi(cfi);
            setProgress(pct * 100);
            
            // Calcular página usando los parámetros guardados
            const { locationsPerPage, totalPages: totalPagesCalc } = pageCalcRef.current;
            
            // Página = (porcentaje * total de páginas)
            const pageNum = Math.max(1, Math.ceil(pct * totalPagesCalc));
            
            setCurrentPage(pageNum);
            console.log('[lector] Página:', pageNum, '/', totalPagesCalc, '- Porcentaje:', (pct * 100).toFixed(1), '%');
            
            // Guardar progreso con debounce para evitar saturar el servidor
            // Limpia timeout anterior si existe
            if (saveProgressTimeoutRef.current) {
              clearTimeout(saveProgressTimeoutRef.current);
            }
            
            // Guardar inmediatamente (sin esperar debounce) y luego nuevamente después del debounce
            saveReadingProgress();
            
            // Debounce: guardar de nuevo después de 2 segundos si no hay más cambios
            saveProgressTimeoutRef.current = setTimeout(() => {
              saveReadingProgress();
              saveProgressTimeoutRef.current = null;
            }, 2000);
          } catch (e) {
            console.error('[lector] Error calculando página:', e);
          }
          
          // Aplicar estilos cuando la página cambia
          setTimeout(() => applyPrefsToBook(), 100);
        });

        // Asegurar que el libro es visible
        rendition.on('rendered', () => {
          console.log('[lector] Página renderizada');
          applyPrefsToBook();
        });

        setReady(true);
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
      // Limpiar timeout de guardado de progreso
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
        saveProgressTimeoutRef.current = null;
      }
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

  // ============ FUNCIONES DE NAVEGACIÓN ============
  
  /**
   * Avanza a la siguiente página del libro
   */
  const goNext = () => {
    if (!renditionRef.current) return;
    renditionRef.current.next().catch(() => {});
  };

  /**
   * Retrocede a la página anterior del libro
   */
  const goPrev = () => {
    if (!renditionRef.current) return;
    renditionRef.current.prev().catch(() => {});
  };

  /**
   * Abre el modal del índice del libro
   */
  const openIndex = () => {
    setShowIndexModal(true);
    setIndexSearch(''); // Limpiar búsqueda al abrir
  };

  /**
   * Navega a un capítulo específico del índice
   * @param {Object} item - Item del índice con propiedad href
   */
  const navigateToChapter = (item) => {
    const rendition = renditionRef.current;
    if (rendition && item.href) {
      rendition.display(item.href).catch(() => {});
      setShowIndexModal(false);
    }
  };

  // Filtrar capítulos según búsqueda en el índice
  const filteredIndex = bookIndex.filter(item =>
    item.label.toLowerCase().includes(indexSearch.toLowerCase())
  );

  /**
   * Vuelve al inicio del libro (primera página)
   */
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

  // ============ FUNCIONES DE GRABACIÓN ============
  
  /**
   * Inicia la grabación de video de la sesión de lectura
   * Usa MediaRecorder API y sincroniza con el sistema Gazepoint
   */
  const startRecording = async () => {
    try {
      // Generar timestamp único para identificar esta sesión
      const recordingTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Solicitar acceso a la cámara
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      // Configurar grabador de video
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      // Guardar timestamp en el recorder para usarlo al terminar
      mediaRecorderRef.current.recordingTimestamp = recordingTimestamp;

      // Acumular fragmentos de video conforme se graban
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Al iniciar grabación: sincronizar con Gazepoint
      mediaRecorder.onstart = () => {
        startGaze(recordingTimestamp); // Iniciar eye-tracking con mismo timestamp
        setIsRecording(true);
        console.log('Grabación iniciada:', recordingTimestamp);
      };

      // Al detener grabación: subir video al servidor
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const sessionTimestamp = mediaRecorderRef.current.recordingTimestamp;
        const fd = new FormData();
        fd.append('video', blob, `${sessionTimestamp}.webm`);
        fd.append('sessionId', sessionTimestamp); // ID de sesión para correlacionar con datos de Gazepoint
        try {
          await fetch('/api/upload', { method: 'POST', body: fd });
          stopGaze(); // Detener eye-tracking
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

  /**
   * Detiene la grabación de video y cierra la cámara
   */
  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Liberar recursos de la cámara
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  /**
   * Pausa la grabación (sin detenerla completamente)
   */
  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  /**
   * Resume una grabación pausada
   */
  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    }
  };

  // ============ NAVEGACIÓN POR SLIDER ============
  
  /**
   * Navega a una página específica usando el slider
   * En Google Play Books style, cada página es una location
   * @param {Event} e - Evento del input range
   */
  const handleSliderChange = (e) => {
    const pageNum = parseInt(e.target.value, 10);
    const book = bookRef.current;
    const rendition = renditionRef.current;
    if (book && rendition && book.locations.length()) {
      // Calcular porcentaje basado en el número de página
      const { totalPages: totalPagesCalc } = pageCalcRef.current;
      const percentage = (pageNum - 1) / Math.max(1, totalPagesCalc - 1);
      const cfi = book.locations.cfiFromPercentage(percentage);
      if (cfi) {
        rendition.display(cfi).catch(() => {});
      }
    }
  };

  const updatePref = (newPref) => {
    setPrefs(prev => ({ ...prev, ...newPref }));
  };

  // ============ SISTEMA DE BLOQUES DE LECTURA ============
  // El usuario puede configurar bloques de 5 minutos para organizar su lectura
  
  /**
   * Inicia un bloque de lectura (cronómetro de 5 minutos)
   */
  const startBlockTimer = () => {
    if (blockTimerRef.current) return; // Ya hay un timer activo
    
    blockStartTime.current = Date.now();
    setBlockTimer(0);
    setIsBlockActive(true);
    
    // Animar el cronómetro al área inferior derecha
    setTimeout(() => {
      setBlockTimerPosition('bottom');
    }, 500);
    
    // Actualizar cronómetro cada segundo
    blockTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - blockStartTime.current) / 1000);
      setBlockTimer(elapsed);
      
      // Si han pasado 5 minutos (300 segundos), terminar el bloque
      if (elapsed >= 300) {
        endCurrentBlock();
      }
    }, 1000);
  };

  /**
   * Finaliza el bloque actual y avanza al siguiente
   */
  const endCurrentBlock = () => {
    if (blockTimerRef.current) {
      clearInterval(blockTimerRef.current);
      blockTimerRef.current = null;
    }
    
    setIsBlockActive(false);
    setBlockTimerPosition('center');
    
    // Si es el bloque 5, reiniciar desde 1. Si no, pasar al siguiente
    if (currentBlock >= 5) {
      setCurrentBlock(1);
    } else {
      setCurrentBlock(prev => prev + 1);
    }
    
    // Mostrar modal para el siguiente bloque
    setShowBlockModal(true);
  };

  /**
   * Cancela la actividad de bloques completamente
   */
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

  /**
   * Formatea segundos a MM:SS
   * @param {number} seconds - Segundos a formatear
   * @returns {string} Tiempo formateado (ej: "05:23")
   */
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
            
            <button
              className="HeaderBtn close"
              onClick={onClose}
              title="Cerrar"
            >
              ✕
            </button>
            
            {/* Indicador de estado Gazepoint - al lado del botón cerrar */}
            <div
              className={`Gaze-indicator ${gazeConnected ? 'connected' : ''}`}
              title={gazeConnected ? 'Gazepoint conectado' : 'Gazepoint desconectado'}
            />
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
                            data-level={item.level || 0}
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
