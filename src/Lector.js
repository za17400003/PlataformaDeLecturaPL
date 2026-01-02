/**
 * LECTOR - Componente principal para leer libros EPUB
 * 
 * Características:
 * - Lectura de libros en formato EPUB
 * - Navegación por páginas con flechas
 * - Ajustes de texto (fuente, tamaño, espaciado)
 * - Temas de color (claro, sepia, oscuro)
 * - Grabación de sesión con cámara
 * - Sistema de bloques de lectura (5 bloques de 5 minutos)
 * - Índice navegable con búsqueda
 * - Indicador visual de conexión eye-tracking (manejado desde Python)
 */

import React, { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import './lector.css';

// ============ CONSTANTES ============
const PROGRESS_SAVE_DEBOUNCE_MS = 2000; // Esperar 2 segundos antes de guardar progreso
const MIN_PAGES_ESTIMATE = 100; // Número mínimo de "páginas" para calcular locationsPerPage
const SKIP_RELOCATION_FLAG_TIMEOUT_MS = 300; // Tiempo para resetear el flag de skip (aumentado a 300ms)
const RETRY_MAX_ATTEMPTS = 2; // Número máximo de reintentos para guardar progreso
const RETRY_BASE_DELAY_MS = 500; // Retraso base para reintentos con backoff exponencial

export default function Lector(props) {
  const { 
    archivo, 
    onClose, 
    initialPreferences,
    // Props para modo experimento
    experimentMode = false,
    blockDuration = 300,
    onBlockComplete,
    onDataCapture,
    bookId,
    initialPage = 1
  } = props;
  
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
  const skipNextRelocationRef = useRef(false); // Flag para ignorar relocated cuando aplicamos prefs
  
  // ============ ESTADOS DEL LIBRO ============
  const [ready, setReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sliderValue, setSliderValue] = useState(1); // Para que el slider responda al usuario inmediatamente
  const [bookTitle, setBookTitle] = useState('Cargando...');
  const [bookIndex, setBookIndex] = useState([]);
  
  // ============ ESTADOS DE UI ============
  const [showIndexModal, setShowIndexModal] = useState(false);
  const [indexSearch, setIndexSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('text'); // 'text', 'theme', 'recording'
  
  // ============ ESTADOS DE BLOQUES DE LECTURA ============
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(1);
  const [blockTimer, setBlockTimer] = useState(0);
  const [isBlockActive, setIsBlockActive] = useState(false);
  const [blockTimerPosition, setBlockTimerPosition] = useState('center');
  
  // Estado para cronómetro en modo experimento
  const [experimentTimer, setExperimentTimer] = useState(0);
  const [timerStarted, setTimerStarted] = useState(false);
  const experimentTimerRef = useRef(null);
  const experimentTimeoutRef = useRef(null);
  
  // ============ PREFERENCIAS DE LECTURA ============
  const [prefs, setPrefs] = useState(
    initialPreferences || {
      fontSize: 100,
      lineHeight: 1.45,
      theme: 'light',
      font: 'original',
      brightness: 1.0
    }
  );

  // ============ ESTADO DE EYE-TRACKING ============
  // Eye-tracking ahora manejado desde Python - solo mostramos indicador visual
  const [gazeConnected, setGazeConnected] = useState(false);

  // ============ FUNCIÓN PARA GUARDAR PROGRESO ============
  /**
   * Guarda el progreso de lectura actual en el servidor y localStorage como backup
   * Implementa reintentos automáticos con backoff exponencial
   * @param {number} retryCount - Número de intentos realizados (por defecto 0)
   * @returns {Promise<void>}
   */
  // ============ FUNCIÓN PARA GUARDAR PROGRESO ============
  /**
   * Guarda el progreso de lectura actual en el servidor y localStorage como backup
   * @param {number} retryCount - Número de intentos realizados (por defecto 0)
   * @returns {Promise<void>}
   */
  const saveReadingProgress = React.useCallback(async (progressToSave, retryCount = 0) => {
    const token = localStorage.getItem('authToken');
    if (!token || !archivo) {
      console.warn('[lector] No se puede guardar: falta token o archivo');
      return;
    }

    try {
      // Usar valores pasados como parámetros o del state
      const currentPageVal = progressToSave?.currentPage || currentPage;
      const totalPagesVal = progressToSave?.totalPages || totalPages;
      const progressVal = progressToSave?.progress || progress;

      const progressData = {
        bookFile: archivo,
        currentPage: currentPageVal,
        totalPages: totalPagesVal,
        progress: progressVal
      };

      console.log('[lector] 💾 Guardando progreso:', { currentPage: currentPageVal, totalPages: totalPagesVal, progress: progressVal.toFixed(1) + '%' });

      const response = await fetch('/api/reading-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(progressData)
      });

      if (response.ok) {
        console.log('[lector] ✅ Progreso guardado en servidor');
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      } else if (response.status === 401) {
        console.warn('[lector] Sesión expirada');
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      } else if (retryCount < RETRY_MAX_ATTEMPTS) {
        console.warn('[lector] ⚠️ Error (status', response.status + '), reintentando...');
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        setTimeout(() => saveReadingProgress(progressToSave, retryCount + 1), delay);
      } else {
        console.error('[lector] ❌ Error después de reintentos');
        localStorage.setItem(`progress_${archivo}`, JSON.stringify(progressData));
      }
    } catch (err) {
      console.error('[lector] ❌ Error en saveReadingProgress:', err);
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
  /**
   * Carga el progreso de lectura guardado desde el servidor
   * Si falla, intenta cargar desde localStorage como fallback
   * @returns {Promise<void>}
   */
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
        
        // Si no hay progreso (0), simplemente no cargar nada (mostrar portada)
        if (!data.progress || data.progress === 0) {
          console.log('[lector] ℹ️ Sin progreso previo, mostrando portada');
          return;
        }
        
        // Usar el porcentaje guardado
        if (data.progress > 0 && renditionRef.current && bookRef.current?.locations.length()) {
          try {
            const percentage = data.progress / 100;
            const targetCfi = bookRef.current.locations.cfiFromPercentage(percentage);
            if (targetCfi) {
              console.log('[lector] 📖 Cargando progreso:', (data.progress).toFixed(1), '%');
              await renditionRef.current.display(targetCfi);
              await new Promise(resolve => setTimeout(resolve, 300));
              return;
            }
          } catch (err) {
            console.error('[lector] Error cargando progreso:', err);
          }
        }
      }
    } catch (err) {
      console.error('[lector] Error en loadReadingProgress:', err);
    }
  }, [archivo]);

  // ============ FUNCIÓN PARA CARGAR PÁGINA INICIAL (EXPERIMENTOS) ============
  /**
   * Carga una página específica (para modo experimento)
   * Recibe el número de página y la carga usando spines
   * Actualiza también el estado de currentPage
   */
  const loadInitialPage = React.useCallback(async (pageNum) => {
    if (!bookRef.current || !renditionRef.current) {
      console.log('[lector] Libro no listo, no se puede cargar página inicial');
      return;
    }

    try {
      if (!bookRef.current.locations.length()) {
        console.log('[lector] Esperando localizaciones...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (bookRef.current.locations.length()) {
        // Calcular totalPages basado en locations (igual que en ready hook)
        const totalLocs = bookRef.current.locations.length();
        const locationsPerPage = Math.max(1, Math.floor(totalLocs / MIN_PAGES_ESTIMATE));
        const calculatedTotalPages = Math.max(1, Math.ceil(totalLocs / locationsPerPage));
        
        const percentage = Math.max(0, Math.min(1, (pageNum - 1) / calculatedTotalPages));
        const cfi = bookRef.current.locations.cfiFromPercentage(percentage);
        if (cfi) {
          console.log('[lector] 📄 Cargando página inicial:', pageNum, 'de', calculatedTotalPages, 'CFI:', cfi);
          await renditionRef.current.display(cfi);
          await new Promise(resolve => setTimeout(resolve, 300));
          // Actualizar los estados para que el contador refleje la página inicial
          setCurrentPage(pageNum);
          setSliderValue(pageNum);
          setTotalPages(calculatedTotalPages);
          const initialProgress = (pageNum / calculatedTotalPages) * 100;
          setProgress(initialProgress);
          console.log('[lector] 📊 Página actual:', pageNum, 'Progreso:', initialProgress.toFixed(1) + '%');
        }
      }
    } catch (err) {
      console.error('[lector] Error cargando página inicial:', err);
    }
  }, []);

  // ============ FUNCIÓN PARA GUARDAR PROGRESO ============
  /**
   * Guarda el progreso de lectura actual en el servidor y localStorage como backup
   * @param {number} retryCount - Número de intentos realizados (por defecto 0)
   * @returns {Promise<void>}
   */

  // ============ FUNCIONES DE APLICACIÓN DE ESTILOS ============
  
  /**
   * Aplica las preferencias de usuario al libro (fuente, tema, tamaño, espaciado, brillo)
   * Se inyecta CSS directamente en cada iframe del EPUB
   * Optimizado para evitar reflow global mediante selectores específicos
   * @returns {void}
   */
  const applyPrefsToBook = React.useCallback(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    
    const fontMap = {
      original: 'serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto',
      merri: '"Merriweather", Georgia, serif'
    };
    
    // CSS optimizado para evitar reflow global
    // NO usar selector * ya que causa reflow en todos los elementos
    // En su lugar, aplicar font-size solo a elementos de contenido específicos
    const css = `
      body, p, div, span, h1, h2, h3, h4, h5, h6, a, em, strong, li {
        font-size: ${prefs.fontSize}% !important;
        font-family: ${fontMap[prefs.font]} !important;
      }
      body {
        line-height: ${prefs.lineHeight}!important;
        background: ${prefs.theme === 'dark' ? '#0b0c0c' : prefs.theme === 'sepia' ? '#f4ecd8' : '#ffffff'} !important;
        color: ${prefs.theme === 'dark' ? '#e8f6f5' : '#222222'} !important;
        filter: brightness(${prefs.brightness}) !important;
        padding: 20px !important;
        margin: 0 !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    `;
    
    try {
      // Marcar para ignorar relocated
      skipNextRelocationRef.current = true;
      
      // Inyectar CSS directamente en el iframe
      requestAnimationFrame(() => {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc && iframeDoc.head) {
              let styleEl = iframeDoc.getElementById('epub-user-prefs');
              
              // Si no existe el style tag, crearlo
              if (!styleEl) {
                styleEl = iframeDoc.createElement('style');
                styleEl.id = 'epub-user-prefs';
                iframeDoc.head.appendChild(styleEl);
              }
              
              // Solo actualizar el contenido del CSS
              if (styleEl.textContent !== css) {
                styleEl.textContent = css;
              }
              
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
      
      // Limpiar flag después de un pequeño delay
      setTimeout(() => {
        skipNextRelocationRef.current = false;
      }, SKIP_RELOCATION_FLAG_TIMEOUT_MS);
    } catch (e) {
      console.log('[lector] Error aplicando estilos:', e);
      skipNextRelocationRef.current = false;
    }
  }, [prefs]);

  // Cargar preferencias del usuario al montar el componente (solo si no vinieron en props)
  useEffect(() => {
    if (initialPreferences) {
      // Ya tenemos las preferencias desde props
      console.log('[lector] Usando preferencias de props:', initialPreferences);
      return;
    }
    
    const loadUserPreferences = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      
      try {
        const response = await fetch('/api/user-preferences', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const userPrefs = await response.json();
          setPrefs(userPrefs);
          console.log('[lector] Preferencias cargadas del servidor:', userPrefs);
        }
      } catch (err) {
        console.error('[lector] Error cargando preferencias:', err);
      }
    };
    
    loadUserPreferences();
  }, [initialPreferences]);

  // Inicializar libro
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('[Lector] useEffect de inicialización:', { archivo, experimentMode, bookId, initialPage });
    if (!archivo) {
      console.warn('[Lector] No hay archivo especificado');
      return;
    }
    let mounted = true;
    
    // Resetear estados de carga
    setIsLoading(true);
    setReady(false);

    const init = async () => {
      try {
        // Construir URL válida para el libro
        const bookUrl = archivo.startsWith('http') ? archivo : `http://localhost:3000${archivo}`;
        console.log('[Lector] Cargando libro desde:', bookUrl);
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
        const locationsPerPage = Math.max(1, Math.floor(totalLocs / MIN_PAGES_ESTIMATE));
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

        // -------- EVENTOS DE RENDITION --------
        /**
         * Evento 'relocated': se dispara al cambiar de página en el EPUB
         * Recalcula el número de página actual y guarda el progreso con debounce
         * @param {Object} loc - Ubicación actual en el EPUB (contiene CFI)
         * @returns {void}
         */
        rendition.on('relocated', (loc) => {
          // Si acabamos de aplicar preferencias, ignorar este evento
          if (skipNextRelocationRef.current) {
            return;
          }
          
          if (!loc || !book.locations.length()) {
            console.warn('[lector] ⚠️ relocated sin location o sin locations cargadas');
            return;
          }
          
          try {
            // Obtener el CFI del libro actual
            const cfi = loc.start?.cfi || loc.cfi;
            if (!cfi) {
              console.warn('[lector] ⚠️ relocated sin CFI válido');
              return;
            }
            
            console.log('[lector] 🔄 RELOCATED EVENT:', { cfi: cfi.substring(0, 30) });
            
            // Intentar obtener porcentaje de varias formas
            let pct = 0;
            
            // Opción 1: percentageFromCfi (método estándar de epubjs)
            pct = book.locations.percentageFromCfi(cfi);
            console.log('[lector]   → percentageFromCfi():', (pct * 100).toFixed(1) + '%');
            
            // Si aún es 0, intentar calcular manualmente desde locations
            if (pct === 0 && book.locations.length() > 0) {
              // Buscar el CFI en el array de locations
              const locArray = book.locations._locations || [];
              const index = locArray.indexOf(cfi);
              if (index >= 0) {
                pct = index / locArray.length;
                console.log('[lector]   → calculado manualmente:', (pct * 100).toFixed(1) + '%');
              } else {
                console.log('[lector]   ⚠️ CFI no encontrado en locations array');
              }
            }
            
            // Si aún es 0, no actualizar nada
            if (pct === 0) {
              console.warn('[lector] ⚠️ Porcentaje es 0, no se actualiza progreso');
              return;
            }
            
            // Actualizar progreso
            const newProgress = Math.max(0, Math.min(100, pct * 100));
            setProgress(newProgress);
            
            // Calcular página
            const { totalPages: totalPagesCalc } = pageCalcRef.current;
            const pageNum = Math.max(1, Math.ceil(pct * totalPagesCalc));
            
            console.log('[lector] ✅ ACTUALIZADO - Página:', pageNum, '/', totalPagesCalc, '- Progreso:', newProgress.toFixed(1) + '%');
            
            // Guardar progreso ANTES de actualizar el state
            // Pasar los valores actuales explícitamente
            saveReadingProgress({
              currentPage: pageNum,
              totalPages: totalPagesCalc,
              progress: newProgress
            });
            
            // Ahora actualizar el state
            setCurrentPage(pageNum);
            setSliderValue(pageNum);
            setProgress(newProgress);
          } catch (e) {
            console.error('[lector] ❌ Error en relocated:', e);
          }
          
          // Aplicar estilos
          setTimeout(() => applyPrefsToBook(), 100);
        });

        // Asegurar que el libro es visible
        rendition.on('rendered', () => {
          console.log('[lector] Página renderizada');
          applyPrefsToBook();
        });

        // Cargar progreso guardado después de que los eventos estén registrados
        // En modo experimento, carga la página inicial especificada
        // En modo lectura normal, carga el último progreso guardado
        if (!progressLoadedRef.current) {
          progressLoadedRef.current = true;
          setTimeout(() => {
            if (experimentMode && initialPage && initialPage > 1) {
              console.log('[lector] Modo EXPERIMENTO: cargando página inicial', initialPage);
              loadInitialPage(initialPage);
            } else {
              console.log('[lector] Modo LECTURA: cargando progreso guardado');
              loadReadingProgress();
            }
          }, 500);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivo, applyPrefsToBook]);

  // Aplicar estilos cuando cambien las preferencias
  // IMPORTANTE: NO recalcular totalPages cuando cambia fontSize/lineHeight
  // Esto es como Google Play Libros: mantiene totalPages constante y usa porcentaje
  // Los cambios visuales (fontSize, lineHeight, tema) NO afectan la paginación
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // applyPrefsToBook se define dentro del mismo scope y cambiarla causaría loops infinitos
  useEffect(() => {
    if (ready && renditionRef.current) {
      // Usar requestAnimationFrame para aplicar estilos sin disparar relocated
      // Esto previene que relocated se active mientras cambiamos estilos
      requestAnimationFrame(() => {
        // Aplicar clase de tema al body para CSS tema completo
        document.body.classList.remove('light-theme', 'sepia-theme', 'dark-theme');
        if (prefs.theme !== 'light') {
          document.body.classList.add(`${prefs.theme}-theme`);
        }
        
        // Aplicar preferencias de texto (fontSize, lineHeight, fuente)
        // Esto solo afecta la visualización, NO la paginación
        applyPrefsToBook();
      });
      
      // NOTA: No recalcular totalPages aquí
      // La paginación se basa en locations (fijo) y porcentaje de progreso (variable)
      // Cambiar fontSize solo afecta cuánto contenido se VE en pantalla,
      // pero no cambia el totalPages ni deben ser necesarios relocated events adicionales
    }
  }, [prefs, ready]);

  // Limpiar timer de bloques al desmontar componente
  useEffect(() => {
    return () => {
      if (blockTimerRef.current) {
        clearInterval(blockTimerRef.current);
        blockTimerRef.current = null;
      }
    };
  }, []);

  // ============ MODO EXPERIMENTO ============
  // Preparar cronómetro cuando se monta en modo experimento
  useEffect(() => {
    if (experimentMode && blockDuration) {
      console.log(`[lector] MODO EXPERIMENTO: Preparando bloque de ${blockDuration}s (esperando ESPACIO)`);
      setExperimentTimer(blockDuration);
      setTimerStarted(false);
    }
    
    return () => {
      if (experimentTimerRef.current) {
        clearInterval(experimentTimerRef.current);
        experimentTimerRef.current = null;
      }
      if (experimentTimeoutRef.current) {
        clearTimeout(experimentTimeoutRef.current);
        experimentTimeoutRef.current = null;
      }
    };
  }, [experimentMode, blockDuration]);

  // Mantener refs para evitar listeners stale
  const readyRef = useRef(false);
  const timerStartedRef = useRef(false);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { timerStartedRef.current = timerStarted; }, [timerStarted]);

  // Listener para SPACEBAR en modo experimento - Global sin importar focus
  useEffect(() => {
    if (!experimentMode) return undefined;

    const handleSpaceBar = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const started = timerStartedRef.current;
      const isReady = readyRef.current;
      console.log('[lector] SPACEBAR detectada - timerStarted:', started, 'ready:', isReady);
      if (started || !isReady) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[lector] SPACEBAR presionada - Iniciando cronómetro');
      setTimerStarted(true);
      timerStartedRef.current = true;
      
      // Capturar datos iniciales
      if (onDataCapture) {
        onDataCapture('block_start', {
          blockDuration,
          bookId,
          initialPage,
          timestamp: new Date().toISOString()
        });
      }
      
      // Actualizar cronómetro cada segundo
      experimentTimerRef.current = setInterval(() => {
        setExperimentTimer(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Timer para completar bloque
      const duration = blockDuration * 1000;
      experimentTimeoutRef.current = setTimeout(() => {
        console.log('[lector] MODO EXPERIMENTO: Bloque completado');
        if (experimentTimerRef.current) {
          clearInterval(experimentTimerRef.current);
          experimentTimerRef.current = null;
        }
        if (onDataCapture) {
          onDataCapture('block_end', {
            timestamp: new Date().toISOString()
          });
        }
        if (onBlockComplete) {
          console.log('[lector] Llamando a onBlockComplete()');
          onBlockComplete();
        }
      }, duration);
    };

    const cleanups = [];
    
    // Listeners en captura TRUE para asegurar que se ejecute primero
    window.addEventListener('keydown', handleSpaceBar, true);
    document.addEventListener('keydown', handleSpaceBar, true);
    document.body.addEventListener('keydown', handleSpaceBar, true);
    document.documentElement.addEventListener('keydown', handleSpaceBar, true);
    
    cleanups.push(() => window.removeEventListener('keydown', handleSpaceBar, true));
    cleanups.push(() => document.removeEventListener('keydown', handleSpaceBar, true));
    cleanups.push(() => document.body.removeEventListener('keydown', handleSpaceBar, true));
    cleanups.push(() => document.documentElement.removeEventListener('keydown', handleSpaceBar, true));

    // Intentar adjuntar a iframes de epub si es posible (pueden tener CORS)
    const attachToContents = () => {
      if (!renditionRef.current) return;
      try {
        if (renditionRef.current.getContents) {
          const contents = renditionRef.current.getContents();
          if (Array.isArray(contents)) {
            contents.forEach(c => {
              try {
                if (c.document) {
                  c.document.addEventListener('keydown', handleSpaceBar, true);
                  cleanups.push(() => c.document?.removeEventListener('keydown', handleSpaceBar, true));
                }
                if (c.window) {
                  c.window.addEventListener('keydown', handleSpaceBar, true);
                  cleanups.push(() => c.window?.removeEventListener('keydown', handleSpaceBar, true));
                }
              } catch (_) {
                // CORS error o contenido no accesible
              }
            });
          }
        }
      } catch (_) {
        // Silenciar errores de CORS
      }
    };

    attachToContents();
    
    // Re-attach cuando se renderiza nuevo contenido del epub
    try {
      if (renditionRef.current?.on) {
        renditionRef.current.on('rendered', attachToContents);
        cleanups.push(() => renditionRef.current?.off?.('rendered', attachToContents));
      }
    } catch (_) {}

    return () => {
      cleanups.forEach(fn => { try { fn(); } catch (_) {} });
    };
  }, [experimentMode, blockDuration, onBlockComplete, onDataCapture, bookId, initialPage]);

  // ============ FUNCIONES DE NAVEGACIÓN ============
  
  /**
   * Avanza a la siguiente página del libro
   * Aplica estilos antes de cambiar para evitar parpadeo
   */
  const goNext = () => {
    if (!renditionRef.current) return;
    // Aplicar estilos antes de cambiar página para evitar parpadeo blanco
    applyPrefsToBook();
    renditionRef.current.next().catch(() => {});
  };

  /**
   * Retrocede a la página anterior del libro
   * Aplica estilos antes de cambiar para evitar parpadeo
   */
  const goPrev = () => {
    if (!renditionRef.current) return;
    // Aplicar estilos antes de cambiar página para evitar parpadeo blanco
    applyPrefsToBook();
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

  // ============ NAVEGACIÓN POR SLIDER ============
  
  /**
   * Navega a una página específica usando el slider
   * En Google Play Books style, cada página es una location
   * @param {Event} e - Evento del input range
   */
  const handleSliderChange = (e) => {
    const pageNum = parseInt(e.target.value, 10);
    
    // Actualizar inmediatamente el slider para feedback visual
    setSliderValue(pageNum);
    
    const book = bookRef.current;
    const rendition = renditionRef.current;
    
    if (book && rendition && book.locations.length()) {
      // Calcular porcentaje basado en el número de página
      const { totalPages: totalPagesCalc } = pageCalcRef.current;
      const percentage = (pageNum - 1) / Math.max(1, totalPagesCalc - 1);
      const cfi = book.locations.cfiFromPercentage(percentage);
      if (cfi) {
        // Navegar
        rendition.display(cfi).catch((err) => {
          console.error('[lector] Error en display():', err);
        });
      }
    }
  };

  const updatePref = React.useCallback((newPref) => {
    setPrefs(prev => {
      const updated = { ...prev, ...newPref };
      
      // Guardar preferencias en el servidor
      const token = localStorage.getItem('authToken');
      if (token) {
        fetch('/api/user-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updated)
        }).catch(err => {
          console.error('[lector] Error guardando preferencias:', err);
        });
      }
      
      return updated;
    });
  }, []);

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
    <div className="Lector-overlay" onClick={experimentMode ? undefined : onClose}>
      <div className="Lector-panel" onClick={(e) => e.stopPropagation()}>
        <header className="Lector-header">
          <div className="Lector-title">📖 {bookTitle}</div>
          <div className="Lector-controls">
            {!experimentMode && (
              <>
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
                  title="Ajustes de lectura"
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
              </>
            )}
          </div>
        </header>

        <main className="Lector-viewer">
          <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />
          
          {/* Flechas laterales */}
          {!experimentMode && (
            <div className="NavArrows">
              <button 
                className="NavArrow left visible"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  goPrev(); 
                }}
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
          )}
          
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
            value={sliderValue}
            onChange={handleSliderChange}
            className="Lector-slider"
            aria-label="Ir a página"
          />
        </footer>

        {/* Cronómetro visible en modo experimento */}
        {experimentMode && (
          <div className={`experiment-timer-overlay ${experimentTimer <= 30 && timerStarted ? 'warning' : ''}`}>
            <div className="experiment-timer-display">
              <span className="timer-icon">⏱️</span>
              <span className="timer-value">{formatTime(experimentTimer)}</span>
              {!timerStarted && (
                <span className="timer-waiting">Presiona ESPACIO</span>
              )}
            </div>
          </div>
        )}

        {/* Panel de configuración */}
        {showSettings && !experimentMode && (
          <div className="Settings-popover">
            <div className="Settings-tabs">
              <button
                className={`tab ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
              >
                Texto
              </button>
              <button
                className={`tab ${activeTab === 'theme' ? 'active' : ''}`}
                onClick={() => setActiveTab('theme')}
              >
                Iluminación
              </button>
              <button
                className={`tab ${activeTab === 'navigation' ? 'active' : ''}`}
                onClick={() => setActiveTab('navigation')}
              >
                Seguimiento
              </button>
            </div>
            <div className="Settings-body">
              {activeTab === 'text' && (
                <div className="Settings-section">
                  <label>FUENTE</label>
                  <div style={{display:'flex', gap:'8px', marginBottom:'12px'}}>
                    {['original', 'sans', 'serif'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setPrefs(prev => ({...prev, font: f}))}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: prefs.font === f ? '2px solid #5bd8cf' : '1px solid #444',
                          background: prefs.font === f ? 'rgba(91, 216, 207, 0.2)' : 'transparent',
                          color: '#e8f6f5',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {f === 'original' ? 'Original' : f === 'sans' ? 'Sans' : 'Serif'}
                      </button>
                    ))}
                  </div>
                  <label>TAMAÑO: {prefs.fontSize}%</label>
                  <input
                    type="range"
                    min="80"
                    max="200"
                    value={prefs.fontSize}
                    onChange={(e) => setPrefs(prev => ({...prev, fontSize: Number(e.target.value)}))}
                    style={{width: '100%'}}
                  />
                  <label>ESPACIADO: {prefs.lineHeight.toFixed(2)}</label>
                  <input
                    type="range"
                    min="1.2"
                    max="2.5"
                    step="0.05"
                    value={prefs.lineHeight}
                    onChange={(e) => setPrefs(prev => ({...prev, lineHeight: Number(e.target.value)}))}
                    style={{width: '100%'}}
                  />
                </div>
              )}
              {activeTab === 'theme' && (
                <div className="Settings-section">
                  <label>TEMA</label>
                  <div style={{display:'flex', gap:'8px', marginBottom:'12px'}}>
                    {[{val:'light',lbl:'☀️ Claro'},{val:'sepia',lbl:'📜 Sepia'},{val:'dark',lbl:'🌙 Oscuro'}].map(({val,lbl}) => (
                      <button
                        key={val}
                        onClick={() => setPrefs(prev => ({...prev, theme: val}))}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: prefs.theme === val ? '2px solid #5bd8cf' : '1px solid #444',
                          background: prefs.theme === val ? 'rgba(91, 216, 207, 0.2)' : 'transparent',
                          color: '#e8f6f5',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <label>BRILLO: {(prefs.brightness * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={prefs.brightness}
                    onChange={(e) => setPrefs(prev => ({...prev, brightness: Number(e.target.value)}))}
                    style={{width: '100%'}}
                  />
                </div>
              )}
              {activeTab === 'navigation' && (
                <div className="Settings-section">
                  <p style={{fontSize:'0.9rem', color:'#aaa', margin:0}}>
                    Seguimiento de lectura y análisis de comportamiento.
                  </p>
                  <div style={{marginTop:'12px', padding:'12px', background:'rgba(91,216,207,0.1)', borderRadius:'6px'}}>
                    <p style={{margin:0, fontSize:'0.85rem', color:'#5bd8cf'}}>
                      ℹ️ Las funciones de seguimiento ocular y grabación están disponibles durante los experimentos configurados.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
