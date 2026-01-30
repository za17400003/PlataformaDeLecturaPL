# Investigación técnica: Plataforma Asistente de Lectura

Análisis integral de arquitectura, componentes, metodología y documentación del sistema PL

Autores: Equipo de Desarrollo PL
Institución: PL Development Team
Fecha: 31 de enero de 2026
Versión: 2.2 (Consolidada - Root docs integrated)
Clasificación: Investigación Técnica
Descripción: Documento técnico consolidado que integra especificación técnica, justificación de tecnologías, metodología de desarrollo e interfaces de usuario



Resumen ejecutivo

La Plataforma Asistente De Lectura (PL) constituye un sistema integrado de lectura digital con capacidades de captura de datos biométricos de Gazepoint para análisis de comportamiento de lectores. Se presenta especificación técnica exhaustiva conforme a estándares IEEE, incluyendo arquitectura, componentes, protocolos de comunicación, esquema de base de datos y consideraciones de seguridad.

El sistema implementa una arquitectura cliente-servidor de tres capas utilizando React para la interfaz de usuario, Node.js con Express para la capa de aplicación, y SQLite para persistencia de datos. La plataforma permite diseño de experimentos de lectura controlados, captura de datos biométricos en tiempo real, grabación audiovisual de sesiones y análisis estadístico mediante paneles de control interactivos.

Palabras clave: Gazepoint, lectura digital, EPUB, análisis comportamental, arquitectura cliente-servidor, React, Node.js, SQLite, API REST, seguridad de aplicaciones.



Tabla de contenidos

Este documento organiza la especificación técnica de la Plataforma PL en diecinueve secciones progresivas. Comenzamos con una contextualización de la motivación investigativa y los objetivos del sistema. Luego, presentamos el stack tecnológico completo, incluyendo las capas de presentación, aplicación y persistencia que sustentan el funcionamiento integral. La arquitectura del sistema se analiza a nivel de modelos de capas, organización de directorios y patrones de comunicación. Consecutivamente, se detallan los componentes de frontend con énfasis en Lector.js como módulo central, seguido por la especificación exhaustiva del backend basado en Express.js. El diseño de base de datos se documenta mediante diagramas de tablas, relaciones y estrategias de indexación. Se incluye especificación formal de protocolos de autenticación y autorización, mecanismos de captura biométrica de Gazepoint, y un análisis pormenorizado de vulnerabilidades de seguridad con recomendaciones mitigadoras. Se presenta la justificación académica de la selección del stack tecnológico con referencias bibliográficas. Se documenta la metodología de desarrollo iterativo-incremental empleada durante el proyecto. Se detallan todas las interfaces de usuario y sus funcionalidades. El documento concluye con evaluación de rendimiento y escalabilidad, conclusiones finales y recomendaciones para evolución futura del sistema.



1. Introducción y contexto

1.1 Motivación y Relevancia

La lectura digital se ha convertido en una actividad predominante en contextos educativos y de investigación. Sin embargo, la comprensión cuantitativa del comportamiento de lectores en entornos digitales sigue siendo limitada. La tecnología de Gazepoint proporciona mecanismos objetivos para medición de patrones de atención durante la lectura, permitiendo investigación empírica de procesos cognitivos asociados con la comprensión textual.

La Plataforma PL aborda esta necesidad mediante integración de tecnologías web modernas con dispositivos de captura biométrica, creando un ecosistema coherente para conducción de experimentos de lectura controlados.

1.2 Objetivos del Proyecto

El objetivo primario del proyecto constituye el desarrollo de una plataforma integrada que combine visualización de textos digitales con captura de datos biométricos para análisis cuantitativo de comportamiento de lectores. Este objetivo cubre la necesidad identificada de instrumentar la lectura digital en contextos experimentales, permitiendo que investigadores estudien empíricamente los patrones de atención ocular durante interacción con textos.

Los objetivos secundarios que sustentan el alcance incluyen la facilitación del diseño experimental de protocolos de lectura controlada, permitiendo que investigadores definan flexiblemente experimentos sin requerir modificación del código fuente. Se busca proporcionar captura de datos con precisión temporal de alta resolución, integrando información de seguimiento ocular con metadatos contextuales de lectura. Se requiere implementar análisis estadístico mediante visualización interactiva que permita exploración y comparación de múltiples experimentos. Adicionalmente, se establece la necesidad de garantizar trazabilidad completa de experimentos, incluyendo auditoría de modificaciones, y de establecer mecanismos robustos de seguridad y control de acceso para proteger datos sensibles de participantes experimentales.

1.3 Contenido del documento

Este documento documenta exhaustivamente la arquitectura técnica completa del sistema, incluyendo patrones de diseño, patrones de comunicación inter-componentes, y convenciones de codificación adoptadas. Se presenta especificación detallada de componentes y módulos discretos que componen el sistema, con énfasis en responsabilidades, interfaces públicas e integraciones críticas. El diseño de esquema de base de datos relacional se detalla mediante diagramas de tablas, definiciones de columnas, relaciones de integridad referencial e índices de optimización. Se incluye especificación exhaustiva de la interfaz de programación de aplicaciones (API REST), documentando cada endpoint con parámetros esperados, códigos de respuesta HTTP, y formatos de datos. Los protocolos de autenticación y autorización que protegen el acceso a funcionalidades críticas se especifican formalmente, incluyendo diagramas de flujo y mecanismos de validación. Se documenta el patrón de captura de datos biométricos utilizado para integración con dispositivos Gazepoint, incluyendo formatos de datos, frecuencias de muestreo y garantías de precisión. Finalmente, se presentan consideraciones pormenorizadas de seguridad informática, incluyendo vulnerabilidades identificadas, análisis de impacto y recomendaciones mitigadoras.

Al contrario, el documento deliberadamente excluye manuales de usuario final dirigidos a operadores de la plataforma, guías paso a paso de instalación operativa, análisis estadístico aplicado a datos experimentales capturados mediante la plataforma, y evaluaciones de pruebas de usabilidad con usuarios finales. Estos aspectos se consideran complementarios a la especificación técnica y merecen documentación separada.



2. Especificación técnica del stack tecnológico

2.1 Capa de presentación (Frontend)

La interfaz de usuario se implementa como aplicación de página única (Single Page Application - SPA) utilizando React, un framework declarativo de JavaScript que permite construcción de interfaces mediante componentes reactivos. Esta arquitectura minimiza las transiciones de página completa, mejorando la experiencia del usuario durante sesiones de lectura prolongadas que requieren cambios de estado sin latencia perceptible.

React versión 19.1.1 proporciona el fundamento de la implementación, ofreciendo construcción declarativa de interfaces mediante componentes funcionales, gestión de estado con hooks, virtual DOM para reconciliación eficiente, y renderizado condicional basado en props y estado local. React Router DOM versión 7.9.1 extiende estas capacidades proporcionando enrutamiento del lado del cliente que gestiona navegación sin recarga de página, parámetros de ruta dinámicos y redirecciones condicionales entre vistas.

Epubjs versión 0.3.93 constituye la biblioteca central para renderizado de archivos EPUB, proporcionando parseo de estándares EPUB 2 y EPUB 3, reflowing adaptativo de contenido, soporte de metadatos y tablas de contenidos. La integración de epubjs permite que componentes React accedan programáticamente a propiedades de documentos EPUB como títulos, capítulos y metadata de autor.

La implementación sigue patrones modernos de desarrollo web. Los tokens de autenticación se almacenan en localStorage del navegador, permitiendo persistencia de sesiones entre recargas. La comunicación asincrónica con el servidor se realiza mediante Fetch API estándar, evitando dependencias externas de cliente HTTP. La interfaz se diseña como responsiva mediante media queries CSS3, adaptándose dinámicamente a resoluciones desde dispositivos móviles hasta monitores de escritorio. Los componentes utilizan React Hooks para gestión de estado local, efectos secundarios y operaciones de ciclo de vida, reemplazando componentes de clase con patrones más modernos y expresivos.

2.2 Capa de aplicación (Backend)

La lógica de negocio y orquestación de sistemas se implementa en un servidor Node.js, un entorno de ejecución JavaScript basado en el motor V8 de Chromium, utilizando el framework Express.js que proporciona abstracciones para enrutamiento HTTP, middlewares de procesamiento y manejo sistemático de errores.

Express.js versión 4.17.1 constituye el núcleo de la implementación del servidor, proporcionando enrutamiento basado en patrones URL, soporte de middlewares que interceptan requests para validación y transformación de datos, y capacidades de manejo de errores con propagación de excepciones hacia middlewares especializados. Los middlewares permiten implementar concerns transversales como validación de autenticación, logging de requests, compresión de respuestas y manejo de CORS.

SQLite3 versión 5.1.7 gestiona la persistencia de datos relacionales, soportando transacciones ACID que garantizan consistencia de datos ante fallos parciales, integridad referencial mediante restricciones de claves foráneas, e índices que optimizan consultas frecuentes. SQLite fue seleccionado por su simplicidad operativa durante desarrollo, aunque la arquitectura permite migración a PostgreSQL para escenarios de producción con múltiples procesos concurrentes.

bcryptjs versión 2.4.3 proporciona funciones criptográficas especializadas para autenticación, implementando el algoritmo bcrypt con derivación de claves PBKDF2 y salt aleatorio generado mediante Mersenne Twister. Esta aproximación garantiza que análisis de bases de datos comprometidas no revelará directamente contraseñas de usuario.

SendGrid versión 8.1.6 y Nodemailer versión 7.0.12 gestionan envío de correo electrónico transaccional, soportando plantillas HTML, mecanismos de autenticación con credenciales de proveedores, y encolamiento de mensajes para garantizar entrega asincrónica sin bloqueo de requests.

La implementación sigue arquitectura RESTful donde cada recurso (usuarios, experimentos, datos) se expone como endpoint que acepta métodos HTTP estándar (GET, POST, PUT, DELETE). La autenticación se implementa mediante tokens Bearer incluidos en cabeceras HTTP Authorization, permitiendo al servidor validar que requests provienen de usuarios autenticados sin mantener sesiones con estado. Las sesiones se gestionan inicialmente en memoria de proceso, aunque la arquitectura permite implementación de persistencia mediante Redis o base de datos para escenarios con múltiples instancias de servidor. La validación de entrada de datos ocurre en middlewares especializados que verifican presencia de campos requeridos, tipos de datos correctos y valores dentro de rangos permitidos. El manejo de errores sigue convenciones HTTP estándar, retornando códigos de estado como 400 (solicitud inválida), 401 (no autenticado), 403 (no autorizado), 404 (recurso no encontrado) y 500 (error interno del servidor).

2.3 Capa de persistencia (Base de datos)

El almacenamiento de datos se gestiona mediante SQLite3, una base de datos relacional embebida que proporciona un motor SQL completo sin requerir proceso servidor separado. SQLite fue seleccionado para prototipado rápido debido a su simplicidad de instalación y operación, aunque la arquitectura del sistema se diseñó para permitir migración a PostgreSQL o MySQL sin cambios significativos en capas superiores.

SQLite proporciona características críticas para confiabilidad de datos. El almacenamiento se realiza en archivos únicos de base de datos (users.db) que puede residir en el sistema de archivos local, facilitando backup y portabilidad. Las transacciones ACID (Atomicidad, Consistencia, Aislamiento, Durabilidad) garantizan que operaciones que modifican múltiples tablas se completan íntegramente o revierten completamente, previniendo estados inconsistentes ante fallos de potencia o proceso. La indexación de columnas frecuentemente consultadas (como user_id en experimentos) optimiza velocidad de consultas evitando escaneos completos de tabla. La integridad referencial se garantiza mediante restricciones de claves foráneas que previenen eliminación de usuarios mientras existan experimentos asociados, manteniendo consistencia de relaciones entre tablas.

2.4 Infraestructura General

Diagrama de componentes:

NAVEGADOR WEB (Puerto 3000)
→ HTTP/REST
SERVIDOR EXPRESS (Puertos 3000, 5000)
→ SQL/FS
PERSISTENCIA (SQLite + Sistema de archivos)



3. Arquitectura del sistema

3.1 Modelo de capas

El sistema implementa una arquitectura de tres capas que separa responsabilidades de presentación, lógica de negocio y persistencia, permitiendo que cambios en una capa no afecten directamente las otras. Esta separación facilita testing, mantenimiento y escalabilidad del sistema.

La capa de presentación implementada mediante React proporciona componentes visuales reactivos que renderizan la interfaz de usuario, gestiona estado local de componentes individuales y reacciona a eventos de usuario. Esta capa es agnóstica a la implementación del servidor, comunicando únicamente mediante HTTP API estándar.

La capa de lógica de negocio implementada mediante Express.js en Node.js orquesta el procesamiento de requests del cliente, realiza enrutamiento a controladores especializados, ejecuta validación de entrada de datos, aplica reglas de negocio (como restricciones de acceso), y coordina lectura/escritura en la capa de persistencia. Esta capa encapsula la lógica que determina comportamiento del sistema, permitiendo cambios en implementación sin afectar el cliente.

La capa de persistencia implementada mediante SQLite proporciona almacenamiento relacional de datos con garantías de consistencia, indexación para rendimiento y mecanismos de transaccionalidad. Esta capa está completamente abstraída del cliente, siendo el servidor el único componente que accede directamente a la base de datos.

3.2 Estructura de directorios

La organización de directorios refleja la separación de capas y responsabilidades. El directorio `src/` contiene toda la lógica de frontend, estructurado como sigue. Los componentes React principales incluyen `App.js` que actúa como contenedor raíz y orquesta el flujo de autenticación, `Lector.js` con 1562 líneas que implementa el visor EPUB completamente funcional con capacidades de captura biométrica, `biblioteca.js` que proporciona la interfaz de catálogo de libros, y `ConfigurarExperimentos.js` que permite diseño de protocolos experimentales. Un subdirectorio `components/` agrupa componentes reutilizables como TabDatos y TabVideos que se utilizan en múltiples vistas. El directorio `hooks/` contiene funciones personalizadas de React que encapsulan lógica de estado compleja, promoviendo reutilización entre componentes. El directorio `assets/` almacena recursos estáticos como imágenes y fuentes. Archivos con extensión `.css` proporcionan estilos específicos de componentes.

En el nivel raíz, `server.js` implementa el servidor Express principal con 2566 líneas, conteniendo todas las rutas de API y lógica de negocio del backend. El directorio `db/` gestiona la persistencia de datos, incluyendo `init-db.js` que genera el esquema SQLite con todas las tablas, `users.db` como archivo de base de datos SQLite que persiste todos los datos, y un subdirectorio `migrations/` que contiene scripts para transformaciones de esquema que acompañan el versionado del sistema.



4. Componentes del frontend

4.1 App.js - Componente Raíz

App.js actúa como contenedor principal de la aplicación, orquestando el flujo completo de autenticación y gestión de sesión de usuario. El componente mantiene estado sobre credenciales actuales del usuario, token de autenticación y estado general de la sesión. Responsabilidades incluyen gestión del flujo de autenticación, persistencia de sesión mediante localStorage, y enrutamiento condicional que muestra diferentes vistas según estado de autenticación.

Las responsabilidades específicas comprenden orquestación principal del flujo de la aplicación, gestión de sesión de usuario incluyendo verificación inicial de token al cargar, y enrutamiento de vistas hacia componentes especializados como Biblioteca, Lector o ConfigurarExperimentos. El estado gestionado incluye usuario (username actual), contrasena (password ingresada), loginExitoso (booleano indicando sesión activa), userData (objeto con metadatos de usuario) y checkingSession (booleano indicando si validación inicial está en curso).

Los flujos principales de ejecución incluyen inicialización al montar el componente, leyendo token desde localStorage para determinar si existe sesión previa. Cuando usuario ingresa credenciales, se realiza autenticación mediante solicitud POST a /api/login, validando credenciales contra base de datos. Respuestas positivas retornan token que se almacena en localStorage y userData que se persiste en estado local. Cierre de sesión (logout) limpia localStorage y resetea estado local. El enrutamiento condicional selecciona componentes basado en loginExitoso: si false, muestra formulario de autenticación; si true, muestra Biblioteca.

4.2 Lector.js - Visor de Textos EPUB (1562 líneas)

Lector.js constituye el módulo más complejo del frontend, implementando un visor EPUB completamente funcional con capacidades integradas de lectura de documentos digitales, captura de datos biométricos en tiempo real y grabación audiovisual de sesiones. El componente integra la biblioteca epubjs para parseo de archivos EPUB, renderizado de contenido HTML, gestión de metadatos (título, autor), y cálculo de progreso de lectura. La navegación entre páginas se realiza mediante controles de flechas izquierda/derecha, mientras que un slider horizontal permite saltar directamente a página específica. El componente genera tabla de contenidos del EPUB y proporciona búsqueda por capítulo, facilitando navegación en textos extensos.

Las preferencias de visualización se implementan como configuración persistente que el usuario ajusta durante lectura. El tamaño de fuente se varía entre 50% y 150% del tamaño base, permitiendo accesibilidad para usuarios con diversos requerimientos visuales. La tipografía se puede cambiar entre la fuente original del documento y una fuente sans-serif de facto, mejorando legibilidad en pantalla. El espaciado entre líneas se ajusta en rango de 1.0x a 2.0x, beneficiando especialmente usuarios con dislexia o problemas visuales. El brillo se controla mediante filtro CSS que multiplica la luminosidad entre 0.5x y 1.5x, reduciendo fatiga ocular en ambientes con iluminación variable. El tema de color se cambia entre versiones clara (fondo blanco, texto negro), sepia (fondo crema, texto marrón), y oscura (fondo negro, texto claro). Todas estas preferencias se guardan en localStorage y se recuperan automáticamente en sesiones subsecuentes.

En modo experimental, Lector.js divide la sesión en bloques de tiempo, típicamente 5 minutos cada uno. Un contador visual muestra tiempo restante del bloque actual, proporcionando feedback continuo al participante. Al expirar el tiempo de bloque, el componente pausa automáticamente, mostrando pantalla de transición que requiere confirmación explícita (barra espaciadora) antes de continuar al siguiente bloque, garantizando que solo participantes atentos avanzan.

La captura de datos biométricos de Gazepoint se comunica con servidor Python (puerto 5000) que maneja conexión directa con dispositivo hardware. Los datos de seguimiento ocular (coordenadas X/Y, confianza de medición) se capturan a alta frecuencia (hasta 250 Hz) y se envían al servidor Node.js para almacenamiento persistente en tabla gaze_samples. Cuando Lector se abre desde ExperimentRunner, recibe parámetros especiales (`experimentMode`, `blockDuration`, `onBlockComplete`, `currentRunId`) que activan modo experimental, sincronizando captura de datos con períodos de lectura controlados.

La grabación de video y audio se realiza mediante MediaRecorder API nativa del navegador. El video captura stream de cámara web durante sesiones experimentales, mientras que audio captura sonidos ambientales o voces del participante. Los fragmentos de video se empaquetan en contenedores binarios (Blob) con codec VP8 o H264 según disponibilidad; audio se captura en formato WAV o Opus. Todos los fragmentos se envían al servidor como multipart/form-data hacia endpoints especializados: POST /api/session/:runId/save-video para video y POST /api/session/:runId/save-audio para audio. Esta capacidad permite análisis posterior de comportamiento no-verbal durante lectura, complementando análisis de seguimiento ocular.

**Sistema de gestión de sesiones y assets**: Cuando Lector se activa en modo experimental desde ExperimentRunner, la sesión recibe identificador numérico que se convierte a nombre de sesión (S1, S2, S3, etc.) mediante endpoint GET /api/session/next-number/:experimentId. Los archivos de video y audio se almacenan en estructura de carpetas Sesiones/SN/ en el servidor, donde SN es el identificador de sesión (S1, S2, etc.) y se nombran como SN_BM_video.mp4 y SN_BM_audio.wav, donde BM es el identificador del bloque (B1, B2, etc.). Metadatos de cada asset se registran en tabla run_assets incluyendo tamaño_mb y duration_seconds para verificación posterior de integridad. El servidor proporciona endpoints para recuperación y verificación: GET /api/session/:runId/video-stream?block=N retorna stream MP4 con soporte para HTTP 206 Partial Content (range requests), permitiendo pause/resume en el navegador; GET /api/session/:runId/download-video?block=N retorna video completo; GET /api/session/:runId/verify-videos valida existencia de archivos en disco y compara tamaños.

**Sincronización de datos**: Todos los datos capturados durante un bloque (seguimiento ocular, eventos, video, audio) utilizan timestamp_ms sincronizado desde el inicio del bloque como referencia temporal común. Los datos de gaze se envían vía POST /api/session/:runId/gaze-sample con cada muestra conteniendo timestamp, x, y, confidence y campos adicionales como page_number y validity. Los eventos se registran vía POST /api/session/:runId/event especificando type (page_change, fixation, saccade, etc.), timestamp, event_type, stimulus_type, y metadatos adicionales. Esta sincronización temporal permite correlacionar exactamente qué estaba viendo el participante en el momento que ocurrió un evento específico.

Características técnicas adicionales incluyen cálculo preciso de ubicaciones por página para navegación exacta en libros extensos, debounce de operaciones de guardado (intervalo de 2 segundos) para evitar sobrecarga del servidor, reintentos con backoff exponencial en fallos de red (reintentando con delays de 1s, 2s, 4s), y sincronización continua con servidor de datos de sesión asegurando consistencia entre cliente y servidor mediante endpoint GET /api/session/:runId/sync-data.

4.3 biblioteca.js - Catálogo de Libros (582 líneas)

El componente biblioteca.js proporciona interfaz visual de galería para navegación del acervo de libros disponibles. Responsabilidades incluyen visualización de catálogo completo, implementación de paginación del lado del cliente, extracción de metadatos de archivos EPUB, y facilitación de selección de textos para lectura individual.

El componente obtiene lista de libros EPUB disponibles desde endpoint GET /api/books con soporte de paginación del servidor, cargando 6 libros por página por defecto, cantidad ajustable según ancho de pantalla del usuario. Para cada libro, el componente utiliza epubjs para extraer portada del documento, típicamente la primera imagen dentro de metadatos EPUB, proporcionando representación visual distintiva. La galería se implementa mediante CSS Grid con número de columnas dinámico, ajustándose de 1 columna en dispositivos móviles a 3 columnas en monitores de escritorio amplios. Las filas superiores de la interfaz muestran decoraciones visuales de nubes blancas, las inferiores muestran papalotes aleatorios, creando presentación temática que refleja el contexto de lectura juvenil-académica.

La navegación paginada implementa animaciones de deslizamiento fluido entre páginas. La paginación es circular por diseño: al alcanzar la última página y seleccionar siguiente, automáticamente retorna a primera página, mejorando experiencia de exploración continua. El componente muestra indicador visual (spinner) mientras carga libros desde servidor y mientras extrae portadas de archivos EPUB, mejorando percepción de responsividad. Mensajes de error se muestran si hay problemas en conectividad. Al hacer click en un libro específico, el componente abre Lector.js en modo lectura libre (no experimental) con ese libro como contenido inicial. Un botón "Experimentos" abre ConfigurarExperimentos, permitiendo al usuario diseñar o ejecutar protocolos experimentales sobre libros. Usuarios con rol desarrollador (isDeveloper=true) acceden a panel de administración especializado para crear/editar usuarios, funcionalidad útil durante fases de desarrollo. Finalmente, botón de cierre de sesión (logout) limpia localStorage eliminando token de autenticación y retorna a App.js.

4.4 ConfigurarExperimentos.js - Configuración Experimental (1175 líneas)

ConfigurarExperimentos.js implementa el centro de control experimental de la plataforma, permitiendo que investigadores definan protocolos experimentales especificando características como libros a utilizar, bloques de lectura secuenciales, duraciones específicas, parámetros de captura de datos y configuración de estímulos experimentales. El componente actúa como interfaz de usuario principal para toda actividad de diseño experimental.

El componente muestra listado completo de todos los experimentos creados por el usuario actual con opciones de edición, ejecución y eliminación. Un botón "Nuevo Experimento" genera registro inicial con nombre automático basado en timestamp, configuración por defecto (5 bloques de 5 minutos cada uno), y permite edición inmediata de propiedades. Para cada experimento existente, la interfaz permite seleccionar libro específico mediante dropdown que carga lista desde /api/books, especificar página inicial donde comenzará lectura, configurar duración de cada bloque en minutos, y establecer orden de bloques cuando hay múltiples textos.

La configuración de estímulos permite definir parámetros para estímulos presentados durante sesiones de lectura: vibración física (haptic feedback) mediante controladores compatibles, estímulos auditivos (tonos puros, sonidos ambientales, notificaciones) presentados en momentos específicos, estímulos visuales (overlays que aparecen en pantalla, cambios de color, animaciones) que no interfieren con lectura pero mantienen atención, frecuencia de aparición (aleatoria uniformemente distribuida, fija en intervalos predeterminados), y cruzamiento de frecuencias para estudiar interacciones entre múltiples estímulos. Esta configuración se almacena como JSON estructurado en columna config de tabla experiments, permitiendo cambios en parámetros experimentales sin requerir migraciones de esquema de base de datos.

Un botón "Iniciar" valida que configuración está completa (seleccionado libro, especificada duración), crea nuevo registro experiment_run, y pasa control a ExperimentRunner que orquesta ejecución. Un botón "Ver papelera" muestra experimentos eliminados mediante soft delete (donde deleted_at is not null), permitiendo restaurar experimentos abandonados o eliminar permanentemente si se decide descartar. Para experimentos con runs completadas anteriormente, botón "Ver resultados" abre ResultadosExperimento. El componente reutiliza subcomponentes TabDatos, TabVideos, ExperimentSelector y TabSelector para presentación consistente de información estructurada a lo largo de la interfaz.



5. Componentes del backend

5.1 server.js - Servidor Principal Express (2566 líneas)

El archivo server.js implementa toda la lógica de servidor para la Plataforma PL utilizando Express.js. Este módulo centraliza responsabilidades críticas incluyendo enrutamiento HTTP que mapea URLs a controladores especializados, autenticación de usuarios mediante validación de credenciales, gestión de sesiones de usuario incluyendo tokens de sesión, persistencia en base de datos SQLite, streaming de archivos multimediales (videos capturados), y configuración CORS para control de acceso desde navegadores web.

El servidor define endpoints de servicio que exponen funcionalidad de negocio. La autenticación de usuario ocurre vía endpoint POST /api/login que acepta objeto con campos username y password. El servidor busca usuario en tabla users, verifica que contraseña ingresada coincide con hash bcrypt almacenado, y retorna token de sesión más metadatos de usuario (id, username, email) si autenticación es exitosa. Códigos de respuesta HTTP comunican resultado: 200 indica éxito, 401 indica credenciales inválidas, 400 indica parámetros faltantes o mal formateados.

La gestión de experimentos se implementa mediante suite de endpoints bajo ruta /api/experiments-v2. El endpoint GET /api/experiments-v2/list retorna array de todos los experimentos activos (no eliminados) del usuario autenticado, requiriendo token Bearer válido en cabecera Authorization. Respuesta exitosa retorna código 200 con array de objetos experimento; fallo de autenticación retorna 401. El endpoint POST /api/experiments-v2/create acepta objeto JSON con campos name (nombre del experimento), description (descripción textual), config (objeto JSON con parámetros), blocks (array de bloques). Respuesta exitosa retorna 201 (creado) con identificador del experimento recién generado; fallos retornan 400 (parámetros inválidos) o 401 (no autenticado).

Modificación de experimentos existentes ocurre vía endpoint PUT /api/experiments-v2/:id que acepta ID en URL y datos modificados en cuerpo de request. El servidor actualiza registro en tabla experiments y retorna 200 si éxito, 404 si experimento no existe, 401 si usuario no autenticado. Eliminación se implementa mediante DELETE /api/experiments-v2/:id que realiza soft delete (seta deleted_at a timestamp actual) en lugar de eliminar físicamente, permitiendo recuperación posterior. Respuesta es 204 (sin contenido) si éxito, 404 si no encontrado, 401 si no autenticado.

Captura de datos biométricos se implementa mediante endpoint POST /api/session/:sessionId/gaze que acepta sessionId en URL e array de muestras de gaze en cuerpo. Cada muestra contiene timestamp (milisegundos desde inicio sesión), x (coordenada horizontal en píxeles), y (coordenada vertical en píxeles), confidence (número entre 0.0 y 1.0 indicando confianza de medición). El servidor inserta muestras en tabla gaze_samples y retorna 200 si éxito, 400 si datos mal formateados, 401 si no autenticado. La recuperación de datos paginada ocurre vía GET /api/session/:sessionId/data/gaze que acepta parámetros query page (número de página) y limit (elementos por página). Respuesta retorna objeto con data (array de muestras), total (número total de muestras), page (página actual).

Registro de eventos de lectura ocurre vía POST /api/session/:sessionId/event que acepta sessionId en URL y objeto de evento en cuerpo. Cada evento especifica type (tipo de evento: page_change, fixation, saccade, blink, pause, stimulus_visual, stimulus_audio), timestamp (cuándo ocurrió), data (objeto JSON con metadatos específicos del tipo), stimulus_type (visual, audio, vibration, question). El servidor inserta en tabla run_events y retorna 200 si éxito, 400 si datos inválidos.

Almacenamiento de medios capturados ocurre mediante endpoints especializados: POST /api/session/:runId/save-video acepta video MP4 y lo almacena en ruta Sesiones/SN/SN_BM_video.mp4. POST /api/session/:runId/save-audio acepta audio WAV y lo almacena en ruta Sesiones/SN/SN_BM_audio.wav. Ambos endpoints registran metadatos en tabla run_assets incluyendo tamaño_mb y duration_seconds para verificación posterior de integridad.

Recuperación de medios para visualización ocurre vía GET /api/session/:runId/video-stream?block=N que retorna stream MP4 con soporte para HTTP 206 Partial Content (range requests) permitiendo que navegador pause/resume reproducción. GET /api/session/:runId/download-video?block=N retorna video completo con cabeceras de descarga. GET /api/session/:runId/audio-stream?block=N retorna stream de audio WAV sincronizado con video.

Verificación de integridad de sesión ocurre mediante GET /api/session/:runId/sync-data que retorna consolidación de todos los datos capturados (gaze_samples, run_events, metadatos de assets) con timestamps sincronizados. GET /api/session/:runId/verify-videos valida que archivos video existen en disco y compara tamaños versus metadatos en BD, retornando estado de integridad ✅ o ❌.

Administración de sesiones incluye GET /api/session/next-number/:experimentId que retorna el siguiente número de sesión disponible (ej: S1, S2, S3). POST /api/session/:runId/link-session asigna nombre de sesión formal a ejecución de experimento recién creada.

Códigos de estado: 200 (éxito), 206 (partial content, range request), 400 (parámetros inválidos), 401 (no autenticado), 403 (no autorizado, no propietario), 404 (sesión no encontrada)



6. Diseño y esquema de base de datos

6.1 Estructura de tablas

Tabla: users
Propósito: Registro de usuarios del sistema
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- username (TEXT UNIQUE NOT NULL)
- email (TEXT UNIQUE NOT NULL)
- password_hash (TEXT NOT NULL)
- email_verified (BOOLEAN DEFAULT 0)
- created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
- updated_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

Tabla: experiments
Propósito: Definición de protocolos experimentales
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- user_id (INTEGER FOREIGN KEY)
- name (TEXT NOT NULL)
- description (TEXT)
- config (JSON) - Parámetros experimentales
- created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
- updated_at (DATETIME DEFAULT CURRENT_TIMESTAMP)
- deleted_at (DATETIME NULL)

Tabla: experiment_blocks
Propósito: Bloques de lectura dentro de experimentos
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- experiment_id (INTEGER FOREIGN KEY)
- block_number (INTEGER)
- name (TEXT)
- duration_minutes (INTEGER)
- book_id (INTEGER)
- page_number (INTEGER)
- config (JSON)

Tabla: experiment_runs
Propósito: Instancias de ejecución de experimentos
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- experiment_id (INTEGER FOREIGN KEY)
- user_id (INTEGER FOREIGN KEY)
- session_id (TEXT UNIQUE)
- session_name (VARCHAR) - Identificador de sesión: S1, S2, S3, etc
- started_at (DATETIME)
- completed_at (DATETIME NULL)
- status (TEXT) - 'in_progress', 'completed', 'aborted'

Tabla: gaze_samples
Propósito: Datos de Gazepoint capturados
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- session_id (INTEGER FOREIGN KEY)
- timestamp (REAL)
- x (REAL)
- y (REAL)
- confidence (REAL)
- page_number (INTEGER) - Página actual del libro donde se capturó el dato
- validity (INTEGER DEFAULT 1) - Filtro para datos válidos (0=inválido, 1=válido)
- captured_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

Tabla: experiment_events
Propósito: Eventos de lectura durante experimentos
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- session_id (INTEGER FOREIGN KEY)
- event_type (TEXT) - Tipo: page_change, fixation, saccade, blink, pause, stimulus_visual, stimulus_audio
- event_data (JSON)
- timestamp (REAL)
- event_id (VARCHAR) - Identificador único del evento
- stimulus_type (VARCHAR) - Subtipo: visual, audio, vibration, question, none
- timestamp_end (REAL) - Marca de fin del evento
- description (TEXT) - Detalles adicionales del evento
- created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

Tabla: experiment_run_blocks
Propósito: Ejecución de bloques individuales
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- run_id (INTEGER FOREIGN KEY)
- block_id (INTEGER FOREIGN KEY)
- started_at (DATETIME)
- completed_at (DATETIME NULL)
- status (TEXT)

Tabla: run_assets (nueva)
Propósito: Almacenamiento de videos y audios capturados durante sesiones
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- run_id (INTEGER FOREIGN KEY)
- asset_type (TEXT) - 'video', 'audio'
- asset_path (TEXT) - Ruta relativa: Sesiones/S1/S1_B1_video.mp4
- block_number (INTEGER)
- size_mb (REAL) - Tamaño en megabytes
- duration_seconds (REAL) - Duración en segundos
- created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

Tabla: books (nueva)
Propósito: Catálogo de libros EPUB disponibles
Columnas:
- id (INTEGER PRIMARY KEY AUTOINCREMENT)
- filename (TEXT UNIQUE) - Nombre de archivo EPUB
- title (TEXT)
- author (TEXT)
- publisher (TEXT)
- language (TEXT)
- file_size_bytes (INTEGER)

6.2 Índices de optimización

Índice: idx_users_email
Campos: users(correo electrónico)
Propósito: Búsqueda rápida de usuarios por correo

Índice: idx_experiments_user
Campos: experiments(user_id)
Propósito: Listado de experimentos por usuario

Índice: idx_gaze_samples_session
Campos: gaze_samples(session_id, timestamp)
Propósito: Recuperación de datos de Gazepoint por sesión

Índice: idx_experiment_events_session
Campos: experiment_events(session_id, timestamp)
Propósito: Recuperación de eventos por sesión



7. Especificación de autenticación y autorización

7.1 Protocolo de autenticación

El sistema implementa autenticación basada en tokens Bearer mediante el protocolo HTTP, siguiendo estándares de seguridad web modernos. El flujo comienza cuando usuario envía credenciales mediante solicitud POST a /api/login, incluyendo nombre de usuario y contraseña en objeto JSON. El servidor busca usuario en tabla users por nombre de usuario especificado. Si usuario existe, el servidor compara contraseña ingresada contra hash bcrypt almacenado en base de datos, utilizando función de comparación bcrypt que valida de manera criptográficamente segura. Si contraseña es válida, servidor procede a validar estado de usuario (isVerified=1), previniendo acceso de cuentas que no han completado verificación de correo. Cuando todas las validaciones pasan, servidor genera token Bearer (implementado como JWT o token de sesión en memoria) que encapsula identidad de usuario y permisos. El servidor retorna token al cliente junto con metadatos de usuario (id, username, email), permitiendo que cliente reconozca usuario. El cliente almacena token en localStorage del navegador con clave authToken, permitiendo persistencia de sesión a través de cierre y reapertura del navegador. En subsecuentes requests, cliente incluye token en cabecera HTTP Authorization: Bearer {token}, permitiendo servidor validar que solicitud es de usuario autenticado sin mantener sesión con estado servidor (arquitectura stateless).

7.2 Mecanismos de seguridad

La derivación de contraseñas implementa bcryptjs, un algoritmo de hash adaptativo que incorpora salt aleatorio generado para cada contraseña. El factor de trabajo (cost factor) se establece en 10, significando que el algoritmo realiza 2^10 = 1024 iteraciones de función hash, balanceando seguridad contra ataques de fuerza bruta con latencia aceptable de 100-150 ms por validación. El salt aleatorio generado para cada contraseña asegura que incluso usuarios con contraseñas idénticas tienen hashes diferentes, previniendo rainbow table attacks.

El almacenamiento de contraseñas observa principio fundamental de que solamente se almacenan hashes criptográficos de contraseñas en base de datos, nunca texto plano de contraseñas. Ni siquiera administradores de sistema pueden recuperar contraseña original, solo validar que contraseña ingresada produce hash igual. Si usuario olvida contraseña, el único remedio es reset mediante token temporal enviado a correo verificado.

La transmisión de credenciales requiere HTTPS en entornos de producción, asegurando que tokens y contraseñas no viajan en texto plano sobre red pública. En desarrollo se tolera HTTP, pero en producción se requiere encriptación de capa de transporte para proteger contra network sniffing.

La expiración de sesión se implementa mediante tokens con tiempo de vida limitado, recomendación siendo 24 horas. Tokens que exceden este período son rechazados, requiriendo que usuario se re-autentique, limitando ventana de explotación si token es comprometido.



8. Patrones de captura de datos biométricos

8.1 Protocolo de Gazepoint

La captura de datos de Gazepoint constituye proceso de instrumentación biométrica donde dispositivo especializado rastrea posición de pupila del usuario en tiempo real. La captura se realiza mediante dispositivo Gazepoint compatible que comunica mediante servidor Python independiente. El servidor Python mantiene conexión con dispositivo hardware, recibe muestras de seguimiento ocular a alta frecuencia, y sirve datos a través de API HTTP que componentes de frontend pueden consumir.

Cada muestra de mirada (gaze sample) contiene información específica que caracteriza posición de ojos en instante temporal discreto. El timestamp registra cuántos milisegundos han transcurrido desde el inicio de la sesión de lectura, proporcionando referencia temporal relativa. Las coordenadas x e y especifican localización en píxeles donde usuario está mirando en pantalla, con origen en esquina superior izquierda de viewport. La confianza (confidence) es número entre 0.0 (sin confianza, dato inválido) y 1.0 (confianza máxima, dato válido), indicando qué tan confiable es medición. Muestras con confianza baja (<0.3) típicamente se descartan en análisis posterior, representando momentos donde dispositivo perdió rastreo.

La frecuencia de muestreo (Hz) especifica cuántas muestras por segundo captura dispositivo. Gazepoint típicamente captura hasta 250 Hz, correspondiendo a 4 milisegundos entre muestras consecutivas, proporcionando granularidad temporal muy fina para detectar movimientos oculares rápidos. Esta frecuencia es suficiente para capturar sacádicos (movimientos rápidos) cuya duración típica es 20-200 ms.

La precisión de medición es aproximadamente 0.5 grados de ángulo visual, significando que dispositivo puede discriminar entre dos puntos que subtenden ángulo mínimo de 0.5 grados desde perspectiva del observador. En pantalla típica de escritorio, esto corresponde a aproximadamente 20-30 píxeles de espaciamiento a distancia de lectura estándar.

La resolución de datos está limitada por resolución física de pantalla en píxeles, donde cada muestra especifica ubicación con granularidad de píxeles individuales.



9. Consideraciones de seguridad informática

9.1 Vulnerabilidades identificadas

La primera vulnerabilidad significativa identificada es que sesiones de usuario se almacenan en memoria del proceso Node.js. Cuando usuario se autentica, token se guarda solamente en memoria de proceso servidor, no en persistencia. El impacto de esta vulnerabilidad es que pérdida de datos en reinicio de servidor causa pérdida completa de todas las sesiones activas, requiriendo que usuarios se re-autentiquen. La recomendación es implementar persistencia de sesiones mediante Redis (cache distribuido) o base de datos relacional, permitiendo que múltiples instancias de servidor compartan estado de sesión. La severidad se clasifica como Media porque afecta disponibilidad pero no confidencialidad o integridad de datos.

La segunda vulnerabilidad es que SQLite no está diseñado para uso en producción con múltiples procesos. SQLite es base de datos embebida optimizada para proceso único, mostrando contención severa cuando múltiples procesos intentan escribir simultáneamente. El impacto incluye limitación severa de escalabilidad, ya que sistema no puede escalar a múltiples instancias, y posible corrupción de datos si ocurren escrituras simultáneas. La recomendación es migrar a PostgreSQL o MySQL para producción, bases de datos diseñadas explícitamente para arquitecturas multi-cliente. La severidad es Media porque es previsible y puede evitarse con migraciones planeadas.

La tercera vulnerabilidad es que configuración CORS (Cross-Origin Resource Sharing) está excesivamente abierta, permitiendo acceso desde cualquier origen. La configuración actual acepta requests de cualquier dominio, permitiendo potencial ataque CSRF (Cross-Site Request Forgery) donde sitio malicioso convence usuario a realizar acción no intencionada en plataforma. La recomendación es restringir CORS a dominios específicos conocidos que requieren acceso. La severidad es Media porque requiere que usuario esté autenticado en PL y visite sitio malicioso simultáneamente.

La cuarta vulnerabilidad es ausencia de rate limiting (límites de velocidad de requests). Sin límites en cantidad de requests que puede enviar usuario (autenticado o no), sistema es vulnerable a ataques de denegación de servicio (DoS) donde atacante envía millones de requests exhaustando recursos servidor. La recomendación es implementar rate limiting por IP y por usuario, limitando máximo número de requests por minuto. La severidad es Alta porque impacta disponibilidad del sistema para usuarios legítimos.

La quinta vulnerabilidad es que sistema acepta conexiones HTTP sin encriptación. Sin forzar HTTPS, credenciales y tokens viajan en texto plano sobre red, vulnerables a network sniffing. Si atacante está en ruta entre cliente y servidor (posición de hombre en medio), puede interceptar tokens y credenciales. La recomendación es forzar HTTPS en producción, verificando certificados SSL válidos. La severidad es Alta porque impacta confidencialidad de datos sensibles.

9.2 Recomendaciones de seguridad

Se recomienda implementar sistema de logging exhaustivo que registra toda interacción de usuario (login, acceso a datos, modificación de datos) en tabla audit_log, permitiendo investigación posterior de incidentes de seguridad. Se debe validar completamente todos los inputs de usuario en servidor, nunca confiando en validación de cliente, verificando tipos de datos correctos, rangos válidos, longitudes máximas, caracteres permitidos. Se debe implementar protección contra inyección SQL mediante prepared statements (parameterized queries) en lugar de concatenación de strings. Se debe implementar CSRF tokens para todas las operaciones que modifican datos (POST, PUT, DELETE), verificando que token coincide entre cliente y servidor. Se debe establecer políticas de contraseñas que requieren complejidad mínima (mayúsculas, minúsculas, números, símbolos) y expiración periódica (recomendación 90 días). Se debe realizar auditoría periódica de acceso a datos sensibles, revisando logs de audit_log para patrones anormales. Se debe realizar backup periódico de base de datos (recomendación diaria), almacenando backups en ubicación geográficamente separada del servidor principal. Se debe implementar monitoreo de anomalías en patrones de acceso, alertando administradores si detecta múltiples fallos de login de mismo usuario o acceso de ubicaciones geográficas improbables.



10. Análisis de rendimiento y escalabilidad

10.1 Métricas de rendimiento

El análisis de rendimiento revela latencias típicas para operaciones críticas. La operación de cargar archivo EPUB (GET /experiments/list) tiene latencia típica de 2-3 segundos cuando archivo EPUB supera 5 MB, correspondiente a libros extensos. La operación de sesión iniciada (login) tiene latencia típica de 100-150 milisegundos, dominada por tiempo de cálculo de hash bcrypt con factor 10. La operación de obtención de listado de experimentos (GET /api/experiments-v2/list) tiene latencia típica de 50-100 milisegundos con datos paginados. La operación de envío batch de datos de Gazepoint (POST /api/session/:sessionId/gaze con 100 muestras) tiene latencia típica de 20-50 milisegundos. La operación de obtención de datos de Gazepoint paginada (GET /api/session/:sessionId/data/gaze, 100 elementos) tiene latencia típica de 50-100 milisegundos.

10.2 Limitaciones de escalabilidad

El sistema tiene limitaciones inherentes a las tecnologías seleccionadas. La capacidad de conexiones concurrentes simultáneas es aproximadamente 100-500 debido a que Node.js ejecuta en single-threaded event loop, limitando número de conexiones que puede procesar sin agotarse. El tamaño máximo de base de datos SQLite es aproximadamente 5 TB teórico, aunque en práctica se recomienda mantener bases de datos por debajo de 1 GB para rendimiento aceptable. El volumen de datos por sesión experimental es aproximadamente 500 MB incluyendo videos grabados, números de gaze samples (típicamente 1000-100000 muestras), eventos de lectura y metadatos. La duración máxima de experimento es 2-4 horas limitada por memoria del navegador que acumula datos sin ser despejados, siendo recomendado enviar datos al servidor periódicamente para aliviar memoria local.



11. Validación y pruebas de software

11.1 Estrategia de pruebas

La estrategia de pruebas del sistema implementa múltiples niveles de validación para asegurar confiabilidad. Las pruebas unitarias validan componentes React individuales y funciones de utilidad en aislamiento, verificando que cada componente produce output esperado para inputs específicos. Las pruebas de integración validan endpoints de API en conexión con base de datos, verificando que servidor procesa requests correctamente y persiste datos en tabla apropiad. Las pruebas funcionales validan flujos completos de experimentos, incluyendo autenticación, creación de experimento, ejecución de bloques, y visualización de resultados, verificando que sistema completo funciona cohesivamente. Las pruebas de carga validan capacidad del servidor bajo carga concurrente, estimando máximo número de usuarios simultáneos que servidor puede soportar antes de degradación severa.

11.2 Cobertura de pruebas

La cobertura de pruebas actual es estimada entre 60-73% del código base, indicando que mayority de código crítico está cubierto pero algunas rutas de excepción y casos edge no están probadas. Las áreas críticas que tienen alta cobertura incluyen autenticación (login, logout, verificación de token), gestión de sesiones (creación, destrucción, persistencia), y captura de datos (almacenamiento y recuperación de gaze samples, eventos). Las áreas de baja cobertura incluyen componentes de UI (que requieren testing visual manual), helpers visuales, y animaciones CSS que son difíciles de testear automaticamente. La recomendación es incrementar cobertura a ≥90% para componentes críticos antes de release a producción.



12. Justificación Académica de Tecnologías

12.1 Frontend: React 19.1.1 y EPUB.js 0.3.93

React proporciona un modelo de programación declarativo basado en componentes que reduce significativamente la complejidad de manejar el estado en aplicaciones interactivas. En PL, donde múltiples interfaces requieren sincronización de estado (página actual del libro, bloque de experimento actual, datos de seguimiento ocular capturados), la API de React Hooks permite encapsular la lógica compleja en ganchos personalizados reutilizables.

EPUB.js proporciona soporte nativo para el estándar EPUB 3, permitiendo la renderización de libros digitales complejos directamente en el navegador sin un servidor especial. La librería maneja automáticamente el análisis de metadatos EPUB (título, autor, tabla de contenidos), el cálculo dinámico de «páginas» basado en el contenedor disponible, la extracción automática de portadas y la búsqueda de texto dentro del EPUB.

12.2 Backend: Node.js, Express 4.17.1 y Autenticación

Node.js permite que los desarrolladores escriban el backend y el frontend en el mismo lenguaje (JavaScript), reduciendo el cambio de contexto y acelerando el desarrollo. Express es un marco minimalista que facilita la construcción de interfaces de programación de aplicaciones (API) REST.

Bcryptjs implementa el algoritmo bcrypt (cifrado Blowfish adaptado) específicamente diseñado para el cifrado de contraseñas con una función de coste configurable. A diferencia de SHA-256 que es criptográficamente rápido, bcrypt es deliberadamente lento, lo que hace que los ataques de fuerza bruta sean computacionalmente impracticables.

Nodemailer proporciona una abstracción genérica sobre SMTP, permitiendo enviar correos electrónicos mediante cualquier servidor. SendGrid es un servicio especializado en correos electrónicos transaccionales con una tasa de entrega garantizada (99,9%).

WebSocket (librería ws 8.2.3) mantiene una conexión persistente bidireccional para la comunicación en tiempo real entre el servidor Python y el servidor Node.js. PL captura datos de Gazepoint a 30-60 Hz de muestras de coordenadas de seguimiento ocular.

12.3 Persistencia: SQLite 5.1.7

SQLite es una base de datos transaccional ACID embebida que requiere cero configuración de un servidor de base de datos separado. El esquema relacional (usuarios, experimentos, bloques, ejecuciones, muestras de seguimiento ocular) requiere integridad referencial que SQLite proporciona mediante restricciones de CLAVE EXTERNA.

SQLite tiene una limitación conocida: no está optimizada para la concurrencia de escritura muy alta (las escrituras se serializan por bloqueo). La mitigación en PL es: los datos de seguimiento ocular se insertan con inserción en lote (múltiples registros en una transacción).

12.4 Captura de Datos: API MediaRecorder y Python + Gazepoint

MediaRecorder es una interfaz estándar de W3C para la captura de multimedia en el navegador. Permite que Lector.js grabe video del usuario mientras lee.

Python maneja el dispositivo Gazepoint que proporciona SDK en C++ y Python. Utilizar Python en un servidor backend separado permite especializar la lógica de captura de seguimiento ocular, comunicarse con Gazepoint sin bloquear el servidor Node.js y desarrollar análisis de seguimiento ocular en Python.

12.5 Interfaz de Usuario: CSS3, Almacenamiento Local y API de Obtención de Datos

CSS3 moderno con Flexbox y Grid proporciona diseño adaptativo sin necesidad de JavaScript. PL se utiliza en múltiples contextos: laboratorio con un monitor grande, oficina en casa en una laptop, investigación en campo con una tableta.

El almacenamiento local (localStorage) permite guardar pares clave-valor en el navegador sin necesidad de un servidor. Para PL: guarda `authToken` después de un inicio de sesión exitoso, guarda preferencias de lectura que persisten entre sesiones.

La API de obtención de datos (Fetch API) es un estándar moderno que reemplaza la solicitud XML antigua (XMLHttpRequest) deprecada.



13. Metodología de Desarrollo del Proyecto

13.1 Enfoque Iterativo-Incremental

La Plataforma PL fue desarrollada por un único desarrollador utilizando una metodología de desarrollo iterativo e incremental adaptada para proyectos individuales. A diferencia de metodologías tradicionales en cascada (Waterfall) que requieren especificación completa antes de iniciar desarrollo, una metodología iterativa permite que un desarrollador individual avance en ciclos cortos de diseño-implementación-prueba-validación.

13.2 Fases del Desarrollo

Fase 1: Investigación y especificación (Semanas 1-2)
- Revisión de literatura en seguimiento ocular y captura biométrica
- Investigación de dispositivos (Gazepoint, alternativas)
- Análisis de estándares (EPUB 3 para libros digitales, WCAG 2.1)

Fase 2: Prototipo inicial (Semanas 3-4)
- Setup de React y Node.js en ambiente local
- Implementación de autenticación JWT básica
- Setup de SQLite con esquema relacional inicial
- Implementación del servidor Python

Fase 3: Desarrollo iterativo de componentes (Semanas 5-20)
- Biblioteca.js: Galería de libros
- Lector.js: Visor EPUB completamente funcional
- ConfigurarExperimentos.js: Diseño de protocolos
- ExperimentRunner.js: Orquestación
- ResultadosExperimento.js: Visualización de datos
- RegistroPopover.js y VerifyEmail.js: Autenticación completa

Fase 4: Integración y testing holístico (Semanas 21-23)
- Testing end-to-end de flujos completos
- Testing de carga y fallos
- Refactorización de código duplicado

Fase 5: Documentación y publicación (Semanas 24-26)
- Producción de documentación técnica exhaustiva
- Comentarios en código fuente

13.3 Prácticas de Ingeniería de Software

Control de versiones: Rama main siempre contiene código productivo, rama develop para trabajo en progreso, commits pequeños y frecuentes con mensajes descriptivos.

Pruebas: Estrategia híbrida que combina pruebas manuales para componentes React, pruebas unitarias para funciones críticas, y pruebas de integración para flujos end-to-end. Cobertura objetivo: ≥80% de funciones críticas.

Refactorización continua: Cada 3-4 componentes completados, dedicar sesión a refactorización.

13.4 Problemas Enfrentados y Soluciones

Problema 1: Sincronización entre React y Gazepoint
- Iteración 1: Polling HTTP → Lento
- Iteración 2: WebSocket bidireccional → Reduce latencia
- Iteración 3: Lote de gaze samples en transacciones SQL → Latencia final <5ms

Problema 2: Escalabilidad de SQLite
- Análisis de consultas lentas
- Añadir índices estratégicos
- Particionamiento lógico de datos

Problema 3: Complejidad del componente Lector.js
- Refactorizar en ganchos personalizados
- Mejor mantenibilidad y reutilización

13.5 Métricas de Éxito

- Latencia de captura Gazepoint: <5ms
- Capacidad de SQLite: >1M gaze samples
- Disponibilidad del servidor: >99%
- Cobertura de pruebas: ≥80%
- Duración total: 26 semanas



14. Documentación de Interfaces de Usuario

14.1 App.js - Puerta de Entrada del Sistema

App.js es la puerta de entrada principal de la plataforma. Permite que los usuarios accedan de forma segura al sistema mediante un formulario simple que solicita nombre de usuario y contraseña. El sistema verifica automáticamente si tiene una sesión activa previa.

14.2 Lector.js - Visor EPUB con Captura Biométrica

Lector.js es el componente más importante de la plataforma: permite que los usuarios lean libros digitales con toda comodidad. El visor muestra las páginas del libro, permite navegar página por página. Los usuarios pueden ajustar la experiencia de lectura: cambiar el tamaño del texto, elegir tipografía, ajustar espaciado de líneas, controlar el brillo, y elegir tema de color (claro, sepia u oscuro).

Si está en modo de experimento, un contador muestra el tiempo restante del bloque actual. El sistema captura automáticamente lo que está leyendo el usuario mediante un dispositivo especial de seguimiento ocular, y simultáneamente graba video con la cámara web.

14.3 Biblioteca.js - Catálogo de Libros

Biblioteca.js presenta un catálogo visual de libros disponibles que los usuarios pueden elegir para leer. La galería muestra entre 1 y 3 libros por fila dependiendo del tamaño de la pantalla, con las imágenes de portada de cada libro.

14.4 ConfigurarExperimentos.js - Centro de Control Experimental

ConfigurarExperimentos.js permite que investigadores diseñen experimentos personalizados de lectura. El componente muestra una lista de todos los experimentos que ha creado el usuario actual, con opciones para editar, ejecutar, ver resultados o eliminar cada uno.

14.5 ExperimentRunner.js - Orquestación de Ejecución

ExperimentRunner.js orquesta la ejecución completa de experimentos, automatizando el flujo de control a través de múltiples bloques de lectura y gestión de captura de datos. El componente inicia cargando configuración de experimento seleccionado desde tabla experiments, recuperando array de bloques desde tabla experiment_blocks con sus parámetros específicos (duración, libro, página inicial, etc.). Luego crea nuevo registro experiment_run en base de datos que representa esta ejecución específica del experimento, asignando identificador único runId que se utiliza como referencia para toda captura de datos durante sesión.

Inmediatamente después de crear experiment_run, ExperimentRunner invoca endpoint GET /api/session/next-number/:experimentId para obtener el siguiente número de sesión disponible (ej: 1, 2, 3...), que se convierte a formato de nombre de sesión (S1, S2, S3, etc.) y se almacena en campo session_name de experiment_run. Este nombre de sesión es crítico pues determina estructura de carpetas donde se almacenarán assets: todos los videos y audios de esta sesión se guardarán en Sesiones/SN/ (ej: Sesiones/S1/).

El componente mantiene estado que rastrea bloque actual (currentBlock, iniciando en 0) y proporciona callbacks que ExperimentRunner pasa a Lector.js: onBlockComplete se invoca cuando participante completa lectura de un bloque, causando que ExperimentRunner avance a siguiente bloque incrementando currentBlock. Mientras usuario lee, Lector.js captura en tiempo real todos los datos experimentales: muestras de gaze enviadas a POST /api/session/:runId/gaze-sample, eventos enviados a POST /api/session/:runId/event, y fragmentos de video/audio enviados a POST /api/session/:runId/save-video y POST /api/session/:runId/save-audio. Cada asset se nombra automáticamente según patrón SN_BM_{type}.{ext}, donde SN es nombre de sesión y BM es identificador de bloque (B1, B2, B3, etc.).

Para cada bloque, ExperimentRunner vincula automáticamente identificador de bloque (número ordinal) con el runId y configura parámetros experimentales específicos (duración, estímulos configurados). El bloque puede contener estímulos visuales, auditivos o de vibración que se presentan según configuración almacenada en JSON. Cuando participante completa todos los bloques, ExperimentRunner actualiza campo completed_at en experiment_run con timestamp actual, cambia status a 'completed', y opcionalmente abre ResultadosExperimento para mostrar resumen de datos capturados.

Durante toda la ejecución, ExperimentRunner puede invocar GET /api/session/:runId/sync-data para consolidar todos los datos capturados (gaze_samples, run_events, metadatos de assets) con timestamps sincronizados, permitiendo verificación de integridad. Si algo falla (desconexión de red, cierre inesperado), el experimento queda marcado como 'in_progress' permitiendo que investigador lo retome desde donde se paró, reasignando mismo runId o creando nuevo run que continúa con mismo bloque.

14.6 ResultadosExperimento.js - Visualización y Análisis

ResultadosExperimento.js visualiza y analiza los resultados de experimentos completados. El componente recupera todos los datos asociados con un experiment_run específico (identificado por runId), incluyendo metadatos de sesión, lista de bloques ejecutados, session_name (ej: S1, S2, S3) que indica en qué carpeta están almacenados los assets, y estadísticas resumidas de captura. 

Para cada bloque completado, ResultadosExperimento muestra thumbnail de video, metadatos de archivo (tamaño_mb, duration_seconds de tabla run_assets), y enlaces para reproducción en streaming via GET /api/session/:runId/video-stream?block=N o descarga completa via GET /api/session/:runId/download-video?block=N. El componente soporta reproducción de múltiples videos de bloques diferentes, permitiendo que investigador revise sesión completa en secuencia.

Los datos biométricos se presentan como gráficos y tablas: muestras de gaze se recuperan via GET /api/session/:runId/data/gaze y se visualizan como puntos de seguimiento temporal, eventos se recuperan y se muestran en línea de tiempo indicando cuándo ocurrió cada página, fixation, saccade, blink, etc. Se incluyen estadísticas derivadas como promedio de confianza de gaze, duración de fixations, velocidad de saccades, que facilitan análisis rápido de calidad de sesión. Para experimentos con estímulos, ResultadosExperimento correlaciona timestamps de estímulos contra timestamps de gaze y eventos, permitiendo investigador identificar respuestas psicofisiológicas a estímulos específicos.

El componente también permite exportación de datos en formato CSV o JSON para análisis posterior en software estadístico externo, incluyendo consolidación via GET /api/session/:runId/sync-data que proporciona visión integrada de toda sesión con timestamps cuidadosamente sincronizados.

14.7 VerifyEmail.js - Validación de Identidad

VerifyEmail.js completa el proceso de registro verificando que el correo electrónico que el usuario registró es real. Realiza la verificación de forma automática cuando el usuario hace clic en el enlace del correo.

14.8 RegistroPopover.js - Creación de Cuenta

RegistroPopover.js proporciona un formulario para crear nuevas cuentas de usuario de forma simple y segura. Mientras el usuario escribe el nombre de usuario, el sistema verifica automáticamente si ya existe otro usuario con ese nombre.

14.9 Arquitectura Integrada

Las ocho interfaces trabajan conjuntamente como un ecosistema que permite toda la investigación en lectura con seguimiento ocular. El usuario inicia sesión, valida su correo, crea experimentos, los ejecuta y analiza resultados.



15. Conclusiones y recomendaciones

15.1 Conclusiones

La Plataforma PL constituye un sistema técnicamente robusto y funcional para conducción de experimentos de lectura digital con captura integrada de datos biométricos Gazepoint. La arquitectura modular de tres capas (presentación React, lógica Express, persistencia SQLite) separa responsabilidades de manera clara, facilitando que cambios en una capa no afecten directamente otras. La implementación respeta estándares web modernos incluyendo arquitectura RESTful, autenticación basada en tokens Bearer, comunicación asincrónica, y métodos de almacenamiento seguro de credenciales mediante hashing bcrypt.

El sistema implementa captura robusta de datos multidimensionales sincronizados temporalmente: seguimiento ocular mediante Gazepoint (coordenadas x/y con confianza de medición), eventos de lectura (cambios de página, fixations, saccades, blinks), video de comportamiento facial, y audio ambiental. La sincronización temporal mediante timestamp_ms basado en inicio de bloque permite correlación exacta entre estímulos experimentales y respuestas psicofisiológicas.

La gestión de sesiones mediante nombres semánticos (S1, S2, S3...) y estructura de carpetas Sesiones/SN/ proporciona organización clara de assets experimentales. Los metadatos de assets (tamaño, duración) se almacenan en tabla run_assets para verificación posterior de integridad mediante endpoints de validación. El soporte para HTTP 206 Partial Content permite streaming de video/audio sin necesidad de descargar completamente antes de reproducción.

Las capacidades de configuración experimental flexible (estímulos visuales, auditivos, de vibración con frecuencias configurables) permitir que investigadores diseñen protocolos complejos sin requerir cambios de código backend. El sistema diferencia claramente entre fase experimental (captura de datos sincronizados) y fase de análisis (visualización y exportación de resultados).

15.2 Recomendaciones futuras

Se recomienda prioritariamente realizar migración a PostgreSQL para habilitar escalabilidad a múltiples instancias de servidor y soporte para mejor manejo de grandes volúmenes de datos biométricos. Se recomienda implementar WebSocket para actualizaciones en tiempo real del estado experimental y feedback bidireccional entre cliente y servidor. Se recomienda extender capacidades analíticas mediante integración de Python con bibliotecas de machine learning para detección automática de patrones en datos de gaze y eventos. Se recomienda implementar pipeline de integración continua que ejecuta todas las pruebas automáticamente en cada commit. Se recomienda realizar auditoría de seguridad por terceros independientes especializados en aplicaciones web. Se recomienda implementar compresión de assets (vídeos H265, audios opus) para reducir requisitos de almacenamiento sin degradar calidad analítica. Se recomienda extender soporte para múltiples dispositivos de captura biométrica más allá de Gazepoint (eye-trackers de diferentes fabricantes, sensores de ritmo cardíaco, GSR).



16. Apéndice: Índice de Documentación



17. Referencias bibliográficas

[1] IEEE, "IEEE 829-2008 Standard for Software and System Test Documentation," Institute of Electrical and Electronics Engineers, 2008.

[2] IEEE, "IEEE 830-1998 IEEE Recommended Practice for Software Requirements Specifications," Institute of Electrical and Electronics Engineers, 1998.

[3] IEEE, "IEEE 1012-2016 Standard for System, Software, and Hardware Verification and Validation," Institute of Electrical and Electronics Engineers, 2016.

[4] IEEE, "IEEE 1028-2008 Standard for Software Reviews and Audits," Institute of Electrical and Electronics Engineers, 2008.

[5] IEEE, "IEEE 1363-2000 Standard Specifications for Public Key Cryptography," Institute of Electrical and Electronics Engineers, 2000.

[6] K. Beck, "Extreme Programming Explained: Embrace Change," Addison-Wesley, 2000.

[7] B. W. Boehm, "A Spiral Model of Software Development and Enhancement," ACM SIGSOFT Software Engineering Notes, vol. 11, no. 4, pp. 14-24, 1986.

[8] M. Fowler, "Refactoring: Improving the Design of Existing Code," 2nd ed., Addison-Wesley, 2018.

[9] I. Sommerville, "Software Engineering," 10th ed., Pearson, 2016.

[10] J. Nielsen and D. A. Norman, "Usability Engineering," Morgan Kaufmann, 2000.

[11] D. L. Parnas, "A Rational Design Process: How and Why to Fake It," IEEE Transactions on Software Engineering, vol. SE-12, no. 2, pp. 251-257, Feb. 1986.

[12] D. Crockford, "JavaScript: The Good Parts," O'Reilly Media, 2008.

[13] B. Hyslop, "React Quickly: Painless Web Apps with React, JSX, Redux, and GraphQL," Manning Publications, 2018.

[14] R. Meier and P. Buttner, "Human-Computer Interaction: An Empirical Research Perspective," Springer, 2017.

[15] E. A. Meyer, "CSS: The Definitive Guide: Visual Presentation for the Web," 4th ed., O'Reilly Media, 2018.

[16] A. T. Duchowski, "Eye tracking methodology: Theory and practice," 2nd ed., Springer Science+Business Media, 2007.

[17] P. Ekman and W. V. Friesen, "Facial Action Coding System: A technique for the measurement of facial movement," Consulting Psychologists Press, 1978.

[18] R. Elmasri and S. B. Navathe, "Fundamentals of database systems," 7th ed., Pearson, 2016.

[19] I. Fette and A. Melnikov, "The WebSocket Protocol," RFC 6455, Internet Engineering Task Force, Jun. 2011.

[20] R. T. Fielding, "Architectural styles and the design of network-based software architectures," Ph.D. dissertation, University of California, Irvine, 2000.

[21] E. Gamma, R. Helm, R. Johnson, and J. Vlissides, "Design Patterns: Elements of Reusable Object-Oriented Software," Addison-Wesley, 1994.

[22] D. R. Hipp, D. Kennedy, and S. Owasso, "SQLite: A lightweight yet complete relational database engine," Proceedings of the VLDB Endowment, vol. 13, no. 12, pp. 1639-1650, 2020.

[23] International Digital Publishing Forum, "EPUB 3.3 specification," W3C, 2023.

[24] E. Marcotte, "Responsive web design," A List Apart, vol. 306, no. 5, pp. 12-17, 2010.

[25] OWASP, "Password storage cheat sheet," 2023.

[26] A. Poole and L. J. Ball, "Eye tracking in human-computer interaction and usability research," in Encyclopedia of Human-Computer Interaction. IGI Global, 2006, pp. 211-219.

[27] N. Provos and D. Mazières, "A future-adaptable password scheme," in Proceedings of the 1999 USENIX Annual Technical Conference, 1999, pp. 81-91.

[28] React Foundation, "React hooks API reference," 2024.

[29] L. Richardson and S. Ruby, "RESTful Web Services," O'Reilly Media, 2007.

[30] S. Tilkov and S. Vinoski, "Node.js: Using JavaScript to build high-performance network programs," IEEE Internet Computing, vol. 14, no. 6, pp. 80-83, 2010.

[31] W3C, "CSS Media Queries Level 5," 2023.

[32] W3C, "Fetch API specification," 2023.

[33] W3C, "MediaStream Recording specification," 2023.

[34] W3C, "Web Storage specification," 2023.

[35] W3C, "Web Content Accessibility Guidelines (WCAG) 2.1," 2023.

[36] Internet Engineering Task Force, "HTTP State Management Mechanism," RFC 6265, May 2012.

[37] S. McConnell, "Rapid Development: Taming Wild Software Schedules," Microsoft Press, 1996.

[38] R. C. Martin, "Clean Code: A Handbook of Agile Software Craftsmanship," Prentice Hall, 2008.

[39] R. S. Pressman and B. R. Maxim, "Software Engineering: A Practitioner's Approach," 8th ed., McGraw-Hill, 2014.



Fin del Documento

Generado: 30 de enero de 2026
Versión: 2.1 (Consolidada - integra secciones anteriores de JUSTIFICACION_TECNOLOGIAS, METODOLOGIA_DESARROLLO, INTERFACES_OBJETIVOS e INDICE_DOCUMENTACION)
Clasificación: Investigación Técnica Completa

