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
    onReady,
    bookId,
    initialPage = 1,
    currentRunId = null,
    shouldStart = false,  // Nueva prop: indica cuándo el experimento debe comenzar
    onPause = null,       // Callback cuando el experimento se pausa
    onResume = null       // Callback cuando el experimento se reanuda
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
  
  // ============ ESTADOS DE PAUSE/ABORT EN EXPERIMENTO ============
  const [isPaused, setIsPaused] = useState(false);
  
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
    if (!token || !archivo || !bookRef.current) {
      console.log('[lector] ⚠️ No se puede cargar progreso: token=', !!token, 'archivo=', !!archivo, 'bookRef=', !!bookRef.current);
      return;
    }

    try {
      const encodedFile = encodeURIComponent(archivo);
      console.log('[lector] 📥 Solicitando progreso del servidor para:', archivo);
      
      const response = await fetch(`/api/reading-progress/${encodedFile}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[lector] 📦 Datos recibidos del servidor:', data);
        
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
              console.log('[lector] 📖 Navegando a progreso:', (data.progress).toFixed(1), '%');
              await renditionRef.current.display(targetCfi);
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // IMPORTANTE: Actualizar estados con los valores cargados
              // para que al cerrar el libro se guarde el progreso correcto
              console.log('[lector] 🔄 Actualizando estados React...');
              console.log('[lector]   currentPage:', data.currentPage, '→ será estado');
              console.log('[lector]   totalPages:', data.totalPages, '→ será estado');
              console.log('[lector]   progress:', data.progress, '% → será estado');
              
              setCurrentPage(data.currentPage || 1);
              setTotalPages(data.totalPages || 0);
              setProgress(data.progress || 0);
              setSliderValue(data.currentPage || 1);
              
              console.log('[lector] ✅ Estados actualizados correctamente - Página:', data.currentPage, '/', data.totalPages);
              return;
            }
          } catch (err) {
            console.error('[lector] Error cargando progreso:', err);
          }
        }
      } else {
        console.warn('[lector] ⚠️ Error en respuesta:', response.status, response.statusText);
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
        width: auto !important;
        display: block !important;
        margin: 0 auto !important;
        object-fit: contain !important;
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
        backface-visibility: hidden !important;
        -webkit-backface-visibility: hidden !important;
        transform: translateZ(0) !important;
        -webkit-transform: translateZ(0) !important;
      }
      svg {
        max-width: 100% !important;
        height: auto !important;
        width: 100% !important;
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
            // Es normal que algunos iframes (about:srcdoc) no sean accesibles por CORS
            // Solo loguear si es un error inesperado diferente a acceso denegado
            if (!e.message.includes('Blocked a frame with origin') && process.env.REACT_APP_DEBUG === 'true') {
              console.warn('[lector] ⚠️ No se pudo acceder al iframe:', e.message);
            }
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
    
    // En modo experimento sin archivo (bloque sin libro), marcar como ready igual
    if (!archivo) {
      if (experimentMode) {
        console.log('[Lector] ✅ Modo experimento sin archivo - marcando como ready');
        setReady(true);
        setIsLoading(false);
        return;
      }
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
        // Si viene como /public/libros/nombre.epub, convertir a /api/epub/nombre.epub
        let bookUrl = archivo;
        
        if (archivo.includes('/libros/')) {
          const filename = archivo.split('/').pop();
          const encodedFilename = encodeURIComponent(filename);
          bookUrl = `http://localhost:3000/api/epub/${encodedFilename}`;
          console.log('[Lector] Usando endpoint CORS:', bookUrl);
        } else if (!archivo.startsWith('http')) {
          bookUrl = `http://localhost:3000${archivo}`;
        }
        
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
          spread: 'none',        // Una sola columna por página
          allowScriptedContent: true,
          snap: true             // Asegurar que cada página está bien alineada
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
                // Si no tiene href, pageNumber queda null (es normal)
              } catch (e) {
                // Error calculando CFI, es silencioso - algunos items no son calculables
                if (process.env.REACT_APP_DEBUG === 'true') {
                  console.warn('[lector] ⚠️ No se pudo calcular página para:', item.label, e.message);
                }
              }
              return { ...item, page: pageNumber };
            })
          );
        }

        // -------- MOSTRAR PRIMERA PÁGINA --------
        console.log('[lector] Mostrando primera página...');
        await rendition.display();
        console.log('[lector] Primera página mostrada');
        
        // -------- HOOK PARA RESOLVER RUTAS DE IMÁGENES --------
        // Interceptar y corregir las rutas de las imágenes dentro del EPUB
        // Usar el hook 'content' que se ejecuta después de que el contenido se carga en el iframe
        if (rendition.hooks && rendition.hooks.content) {
          rendition.hooks.content.register(async (contents) => {
            console.log('[lector] Hook content ejecutado, resolviendo imágenes desde EPUB');
            try {
              // El contenido está en el iframe, acceder a las imágenes
              const images = contents.document.querySelectorAll('img');
              console.log('[lector] Encontradas', images.length, 'imágenes para procesar');
              
              images.forEach((img, idx) => {
                const originalSrc = img.getAttribute('src');
                if (originalSrc) {
                  console.log('[lector] Imagen', idx, ': src =', originalSrc);
                  
                  // Si es un blob URL o data URL, está bien
                  if (originalSrc.startsWith('blob:') || originalSrc.startsWith('data:')) {
                    console.log('[lector] Imagen ya es blob/data URL, OK');
                  } else {
                    // Si es una ruta relativa o URL del servidor, necesita procesamiento
                    // epubjs debería manejar esto automáticamente, pero a veces no lo hace
                    console.warn('[lector] ⚠️ Imagen no es blob URL:', originalSrc);
                  }
                  
                  // Aplicar estilos de optimización para que se vea correctamente
                  img.style.maxWidth = '100%';
                  img.style.height = 'auto';
                  img.style.width = 'auto';
                  img.style.display = 'block';
                  img.style.margin = '0 auto';
                  img.style.objectFit = 'contain';
                  img.style.imageRendering = 'auto';
                  
                  // Agregar listeners para debug
                  img.addEventListener('load', () => {
                    console.log('[lector] ✓ Imagen cargada correctamente:', originalSrc);
                  });
                  img.addEventListener('error', () => {
                    console.error('[lector] ✗ Error cargando imagen:', originalSrc);
                    // Mostrar que hay error en el aspecto de la imagen
                    img.style.border = '1px solid red';
                    img.style.opacity = '0.5';
                  });
                }
              });
            } catch (e) {
              console.error('[lector] Error en hook content:', e);
            }
          });
        }
        
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
            
            // Obtener porcentaje usando el método estándar de epubjs
            let pct = book.locations.percentageFromCfi(cfi);
            console.log('[lector]   → percentageFromCfi():', (pct * 100).toFixed(1) + '%');
            
            // Si percentageFromCfi falló (retorna -1 o NaN), intentar alternativa
            if (pct < 0 || isNaN(pct)) {
              if (book.locations.length() > 0) {
                // Alternativa: buscar posición del spine item actual
                try {
                  const currentSpine = book.spine.get(book.spine.current);
                  if (currentSpine && currentSpine.href) {
                    const spineIndex = book.spine.items.indexOf(currentSpine);
                    const totalSpines = book.spine.items.length;
                    // Estimar porcentaje basado en posición en spine
                    pct = totalSpines > 0 ? spineIndex / totalSpines : 0;
                    console.log('[lector]   → estimado por spine position:', (pct * 100).toFixed(1) + '%');
                  }
                } catch (e) {
                  console.warn('[lector] ⚠️ No se pudo calcular porcentaje:', e.message);
                  return;
                }
              } else {
                console.warn('[lector] ⚠️ No hay locations para calcular porcentaje');
                return;
              }
            }
            
            // Validar que el porcentaje sea razonable
            if (pct < 0 || isNaN(pct)) {
              console.warn('[lector] ⚠️ Porcentaje inválido, no se actualiza');
              return;
            }
            
            // Actualizar progreso
            const newProgress = Math.max(0, Math.min(100, pct * 100));
            setProgress(newProgress);
            
            // Calcular página (asegurar que no exceda totalPages)
            const { totalPages: totalPagesCalc } = pageCalcRef.current;
            let pageNum = Math.max(1, Math.ceil(pct * totalPagesCalc));
            // Validar que no exceda el total
            pageNum = Math.min(pageNum, totalPagesCalc);
            
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
          
          // Optimizar imágenes después de renderizar
          try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
              try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                  const images = iframeDoc.querySelectorAll('img');
                  images.forEach(img => {
                    // Asegurar que las imágenes se rendericen nítidamente
                    img.style.imageRendering = 'crisp-edges';
                    img.style.imageRendering = '-webkit-optimize-contrast';
                    img.style.width = 'auto';
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.margin = '0 auto';
                    // Forzar reflow para que los cambios de estilo se apliquen
                    // eslint-disable-next-line no-unused-expressions
                    img.offsetHeight; // trigger reflow
                  });
                  
                  // Optimizar SVGs también
                  const svgs = iframeDoc.querySelectorAll('svg');
                  svgs.forEach(svg => {
                    svg.style.maxWidth = '100%';
                    svg.style.height = 'auto';
                    svg.style.width = '100%';
                  });
                }
              } catch (e) {
                // CORS error, ignorar
              }
            });
          } catch (e) {
            if (process.env.REACT_APP_DEBUG === 'true') {
              console.warn('[lector] Error optimizando imágenes:', e);
            }
          }
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

  // Callback cuando el Lector está listo (usado para precargar en modo experimento)
  useEffect(() => {
    if (ready && onReady) {
      console.log('[lector] ✅ Libro listo y onReady callback disponible - Llamando...');
      onReady();
    } else {
      console.log('[lector] ⏳ Esperando: ready=' + ready + ', onReady=' + !!onReady);
    }
  }, [ready, onReady]);

  // Cuando initialPage cambia en modo experimento (p.ej. siguiente bloque del mismo libro)
  // Si el libro ya está listo, cargar directamente la nueva página sin recargar el libro
  useEffect(() => {
    if (experimentMode && ready && initialPage && initialPage > 1) {
      console.log('[lector] Cambiando a página inicial:', initialPage);
      loadInitialPage(initialPage);
    }
  }, [initialPage, ready, experimentMode, loadInitialPage]);

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
  const isPausedRef = useRef(false);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { timerStartedRef.current = timerStarted; }, [timerStarted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // ============ ACTIVAR EXPERIMENTO CUANDO SE ABRE EL LECTOR ============
  // Cuando ExperimentRunner indica que el experimento debe comenzar (shouldStart=true)
  // se marca timerStarted=true para que los keyboard handlers funcionen
  useEffect(() => {
    if (experimentMode && shouldStart && ready && !timerStarted) {
      console.log('\n=== 🟢 LECTOR ACTIVADO ===');
      console.log('[lector] ⏱️ shouldStart=true recibido');
      console.log('[lector] ready=true confirmado');
      console.log('[lector] ✅ Marcando timerStarted=true');
      console.log('[lector] 🎹 SPACEBAR, BACKSPACE, ESCAPE ahora activos');
      setTimerStarted(true);
      
      // Iniciar el cronómetro del experimento
      if (blockDuration && blockDuration > 0) {
        console.log(`[lector] ⏱️ Iniciando cronómetro de ${blockDuration}s`);
        setExperimentTimer(blockDuration);
        
        // Interval: actualizar cronómetro cada segundo
        experimentTimerRef.current = setInterval(() => {
          setExperimentTimer(prev => {
            const newVal = prev - 1;
            if (newVal <= 0) {
              clearInterval(experimentTimerRef.current);
              experimentTimerRef.current = null;
              // Llamar callback cuando se acaba el tiempo
              if (onBlockComplete) {
                console.log('[lector] ✅ TIEMPO DE BLOQUE COMPLETADO');
                onBlockComplete();
              }
            }
            return Math.max(0, newVal);
          });
        }, 1000);
      }
    }
  }, [experimentMode, shouldStart, ready, timerStarted, blockDuration, onBlockComplete]);

  // Listener para SPACEBAR en modo experimento - Global sin importar focus
  useEffect(() => {
    if (!experimentMode) return undefined;

    // Manejador para ESPACIO: Página siguiente durante experimento
    const handleSpaceBar = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      
      const started = timerStartedRef.current;
      const isReady = readyRef.current;
      
      console.log('[lector] 🔍 SPACEBAR PRESIONADO: started=' + started + ', isReady=' + isReady);
      
      // Solo avanzar página si el experimento está activo
      if (!started || !isReady) {
        console.log('[lector] ⚠️ SPACEBAR BLOQUEADO: timerStarted=' + started + ', ready=' + isReady);
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[lector] ✅ SPACEBAR OK - Avanzando página');
      goNext();
    };

    // Manejador para BACKSPACE: Página anterior durante experimento
    const handleBackspace = (e) => {
      if (e.code !== 'Backspace') return;
      
      const started = timerStartedRef.current;
      const isReady = readyRef.current;
      
      console.log('[lector] 🔍 BACKSPACE PRESIONADO: started=' + started + ', isReady=' + isReady);
      
      // Solo retroceder página si el experimento está activo
      if (!started || !isReady) {
        console.log('[lector] ⚠️ BACKSPACE ignorada: experimento no activo');
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[lector] ✅ BACKSPACE procesada - Página anterior');
      goPrev();
    };

    // Manejador para ESC: Pausa durante experimento
    const handleEscape = async (e) => {
      if (e.code !== 'Escape') return;
      
      const started = timerStartedRef.current;
      const isReady = readyRef.current;
      
      console.log('[lector] 🔍 ESCAPE EVENT: started=' + started + ', isReady=' + isReady + ', experimentMode=' + experimentMode);
      
      // Solo pausar si experimento está activo
      if (!started || !isReady) {
        console.log('[lector] ⚠️ ESCAPE ignorada: experimento no activo');
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log('[lector] ✅ ESCAPE procesada - Pausando experimento');
      
      // Pausar experimento
      try {
        const token = localStorage.getItem('authToken');
        const runId = currentRunId;
        if (runId && token) {
          const response = await fetch(`/api/experiment-runs/${runId}/pause`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            credentials: 'include'
          });
          if (response.ok) {
            console.log('[lector] ⏸ Experimento pausado por teclado');
            // Actualizar estado local de pausa
            setIsPaused(true);
            // Llamar callback de pausa
            if (onPause) {
              console.log('[lector] Llamando callback onPause');
              onPause();
            }
          }
        }
      } catch (err) {
        console.error('[lector] Error pausing experiment via keyboard:', err);
      }
    };

    const cleanups = [];
    
    // Asegurar que el Lector siempre reciba events de teclado incluso sin focus
    const lectorContainer = document.querySelector('.lector-container');
    if (lectorContainer && experimentMode) {
      lectorContainer.tabIndex = 0;
      lectorContainer.focus();
    }
    
    // Listeners para teclas en captura TRUE
    // Registrar solo en window para evitar duplicados
    window.addEventListener('keydown', handleSpaceBar, true);
    window.addEventListener('keydown', handleBackspace, true);
    window.addEventListener('keydown', handleEscape, true);

    cleanups.push(() => window.removeEventListener('keydown', handleSpaceBar, true));
    cleanups.push(() => window.removeEventListener('keydown', handleBackspace, true));
    cleanups.push(() => window.removeEventListener('keydown', handleEscape, true));

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
    
    // Listener para recuperar focus cuando se pierde (mantiene keyboard working)
    const handleFocusRecovery = () => {
      const lectorContainer = document.querySelector('.lector-container');
      if (lectorContainer && experimentMode) {
        lectorContainer.focus();
      }
    };
    
    if (experimentMode) {
      window.addEventListener('click', handleFocusRecovery, true);
      cleanups.push(() => window.removeEventListener('click', handleFocusRecovery, true));
    }

    return () => {
      cleanups.forEach(fn => { try { fn(); } catch (_) {} });
    };
  }, [experimentMode, blockDuration, onBlockComplete, onDataCapture, bookId, initialPage]);

  // ============ MODO LECTURA NORMAL: CONTROLES DE TECLADO ============
  // En modo normal (no experimento): Flechas izq/der, ESPACIO para avanzar, BACKSPACE para retroceder
  useEffect(() => {
    if (experimentMode) return undefined; // En experimento, usar los otros handlers
    
    const handleKeyPressNormal = (e) => {
      // Solo procesar si el Lector está listo
      if (!ready) return;
      
      // Flechas derecha o ESPACIO: Siguiente página
      if ((e.key === 'ArrowRight' || e.code === 'Space') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[lector] 🔍 FLECHA DERECHA/ESPACIO - Siguiente página');
        goNext();
        return;
      }
      
      // Flecha izquierda o BACKSPACE: Página anterior
      if ((e.key === 'ArrowLeft' || e.code === 'Backspace') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[lector] 🔍 FLECHA IZQUIERDA/BACKSPACE - Página anterior');
        goPrev();
        return;
      }
    };
    
    window.addEventListener('keydown', handleKeyPressNormal, true);
    return () => window.removeEventListener('keydown', handleKeyPressNormal, true);
  }, [experimentMode, ready]);

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

  // ============ HANDLERS PAUSE/RESUME/ABORT ============
  const handlePause = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiment-runs/${currentRunId}/pause`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        setIsPaused(true);
        console.log('[lector] ⏸ Experimento pausado');
        // Notificar al componente padre sobre la pausa
        if (onPause) {
          console.log('[lector] Llamando callback onPause');
          onPause();
        }
      }
    } catch (err) {
      console.error('[lector] Error pausing experiment:', err);
    }
  };

  const handleResume = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/experiment-runs/${currentRunId}/resume`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (response.ok) {
        setIsPaused(false);
        console.log('[lector] ▶ Experimento reanudado');
        // Notificar al componente padre sobre la reanudación
        if (onResume) {
          console.log('[lector] Llamando callback onResume');
          onResume();
        }
      }
    } catch (err) {
      console.error('[lector] Error resuming experiment:', err);
    }
  };

  const handleAbort = async () => {
    const password = window.prompt('¿Estás seguro? Esto abortará el experimento. Ingresa tu contraseña para continuar:');
    if (password === null) return; // Usuario canceló
    
    if (!password.trim()) {
      alert('Debes ingresar tu contraseña para abortar');
      return;
    }
    
    try {
      const token = localStorage.getItem('authToken');
      
      // Verificar contraseña
      const verifyResponse = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });
      
      if (!verifyResponse.ok) {
        alert('Contraseña incorrecta');
        return;
      }
      
      // Abortar experimento
      const response = await fetch(`/api/experiment-runs/${currentRunId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      
      if (response.ok) {
        console.log('[lector] ⛔ Experimento cancelado');
        alert('Experimento cancelado correctamente');
        onClose();
      } else {
        alert('Error al abortar el experimento');
      }
    } catch (err) {
      console.error('[lector] Error aborting experiment:', err);
      alert('Error al abortar el experimento');
    }
  };

  // Manejador para cerrar guardando el progreso
  const handleCloseLector = async () => {
    // NO guardar progreso en modo experimento para evitar interferencia con el otro lector
    if (!experimentMode) {
      console.log('[lector] ═══════════════════════════════════════');
      console.log('[lector] 💾 CERRANDO LECTOR - Guardando progreso...');
      console.log('[lector] ─────────────────────────────────────');
      console.log('[lector] Estado actual en React:');
      console.log('[lector]   currentPage:', currentPage);
      console.log('[lector]   totalPages:', totalPages);
      console.log('[lector]   progress:', progress.toFixed(1) + '%');
      console.log('[lector]   archivo:', archivo);
      console.log('[lector] ─────────────────────────────────────');
      
      try {
        await saveReadingProgress();
        console.log('[lector] ✅ Progreso guardado exitosamente');
      } catch (e) {
        console.error('[lector] ❌ Error guardando progreso final:', e);
      }
      console.log('[lector] ═══════════════════════════════════════');
    } else {
      console.log('[lector] Modo experimento: NO guardando progreso');
    }
    onClose();
  };

  return (
    <div className="lector-container Lector-overlay" onClick={experimentMode ? undefined : handleCloseLector}>
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
                  onClick={handleCloseLector}
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

        {/* Botones de Pause/Resume/Abort en modo experimento */}
        {experimentMode && currentRunId && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            justifyContent: 'center',
            padding: '0.5rem',
            borderTop: '1px solid #ccc',
            backgroundColor: '#f9f9f9',
            zIndex: isPaused ? 1001 : 'auto',
            position: 'relative'
          }}>
            {isPaused && (
              <>
                <button 
                  onClick={handleResume}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    flex: 1
                  }}
                  title="Continuar experimento (Presiona ESC para pausar de nuevo)"
                >
                  ▶ Continuar
                </button>
                <button 
                  onClick={handleAbort}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.75rem',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    flex: 1
                  }}
                  title="Abortar experimento"
                >
                  ⛔ Abortar
                </button>
              </>
            )}
          </div>
        )}

        {/* Opacidad cuando está pausado */}
        {experimentMode && isPaused && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.2rem',
            fontWeight: 'bold'
          }}>
            ⏸ PAUSADO
          </div>
        )}

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

        {/* Cronómetro oculto en modo experimento - funcionalidad intacta, solo visual */}
        {experimentMode && (
          <div className={`experiment-timer-overlay ${experimentTimer <= 30 && timerStarted ? 'warning' : ''}`} style={{ display: 'none' }}>
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
