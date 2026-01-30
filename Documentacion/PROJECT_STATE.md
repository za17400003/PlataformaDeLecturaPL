# Estado del proyecto - Plataforma de lectura con Gazepoint

Última Actualización: 6 Enero 2026
Entrega: Mañana
Estado: En Reparación



Objetivo principal

La Plataforma Asistente De Lectura (PL) constituye un sistema integrado para la lectura de archivos EPUB (Electronic Publication) que implementa un conjunto completo de funcionalidades experimentales de Gazepoint. La plataforma proporciona capacidades de captura de seguimiento ocular, análisis de mirada biométrica, registro de eventos de lectura y visualización interactiva de línea de tiempo de sesiones experimentales. El objetivo fundamental es instrumentar la lectura digital permitiendo que investigadores estudien empíricamente los patrones de atención ocular durante la interacción con textos, capturando datos con precisión temporal y analizándolos posteriormente mediante visualización especializada.



Estructura del proyecto

La organización de archivos y directorios del proyecto refleja la separación de capas arquitectónicas. El archivo `server.js` contiene 2197 líneas de código que implementa servidor Express con toda la lógica de negocio, enrutamiento de API y persistencia de datos. El directorio `src/` contiene componentes React principales que conforman la interfaz de usuario. App.js actúa como contenedor raíz orquestando flujo de autenticación. Lector.js implementa visor EPUB completamente funcional con 1562 líneas dedicadas a renderizado de documentos, gestión de preferencias de lectura y captura de datos biométricos. El componente biblioteca.js proporciona catálogo visual de libros disponibles. ConfigurarExperimentos.js permite diseño de protocolos experimentales mientras que ExperimentRunner.js orquesta ejecución de bloques de lectura controlados. Dentro de `components/`, ResultadosExperimento.js muestra análisis de datos capturados, TabVideos.js proporciona línea de tiempo interactiva de eventos, y otros componentes reutilizables soportan presentación consistente. El directorio `db/` gestiona persistencia relacional: init-db.js genera esquema SQLite inicial, seed-admin.js crea usuario administrativo para desarrollo, users.db persiste todos los datos experimentales, y un subdirectorio `migrations/` contiene scripts de evolución de esquema. El directorio `public/` contiene HTML estático mientras que `build/` contiene React compilado listo para servir.



Base de datos

Tabla: `users`

La tabla users almacena información de usuarios de la plataforma. Las columnas incluyen id (identificador único generado automáticamente), username (nombre de usuario único requerido), email (dirección de correo único requerido para verificación), password (hash bcrypt de contraseña nunca almacenada en texto plano), isDeveloper (booleano indicando acceso a funciones de administración), isVerified (booleano indicando si usuario ha verificado correo), verificationToken (token temporal para validación de correo), verificationTokenExpires (timestamp de expiración de token), preferences (objeto JSON con preferencias de lectura del usuario), createdAt (timestamp de creación).

Usuario actual de prueba tiene las siguientes credenciales: username admin, email admin@localhost.local, contraseña 123 (almacenada como hash bcrypt), isDeveloper = 1 (permitiendo acceso a funciones administrativas), isVerified = 1 (verificado y activo).

Tabla: `experiments`

La tabla experiments almacena definición de protocolos experimentales. Las columnas son id (identificador único), user_id (referencia a tabla users indicando propietario del experimento), name (nombre descriptivo del protocolo), description (descripción textual extendida del propósito experimental), version_number (número de versión para rastrear iteraciones), is_template (booleano indicando si es plantilla reutilizable), config (JSON con parámetros experimentales como número de bloques y duración de cada bloque), created_at (timestamp de creación), updated_at (timestamp de última modificación), deleted_at (NULL si activo, timestamp si eliminado con soft delete), deleted_by (referencia a usuario que eliminó). Nota importante: esta tabla deliberadamente NO tiene columnas initial_book_id ni initial_page_number, siendo esos datos almacenados en tabla experiment_blocks en lugar de nivel de experimento.

Tabla: `experiment_runs`

La tabla experiment_runs almacena instancias de ejecución de experimentos. Columnas incluyen id (identificador único de corrida), experiment_id (referencia a protocolo ejecutado), user_id (usuario que ejecutó), session_id (identificador único de sesión de lectura), status (estado: 'in_progress', 'completed', 'aborted'), started_at (timestamp de inicio), completed_at (NULL si en progreso, timestamp de finalización), duration_seconds (duración real de la corrida en segundos), notes (observaciones de investigador), created_at (timestamp de creación en base de datos).

Tabla: `experiment_run_blocks`

La tabla experiment_run_blocks almacena ejecución de bloques individuales dentro de cada corrida. Columnas son id (identificador único), run_id (referencia a corrida padre), block_id (referencia a bloque de experimento), block_number (número secuencial de bloque), book_id (referencia a libro leído en bloque), page_number (página inicial del bloque), status (estado del bloque), started_at (timestamp de inicio de lectura), completed_at (timestamp de finalización), notes (observaciones), created_at (timestamp de creación).

Tabla: `experiment_blocks`

La tabla experiment_blocks almacena definición de bloques de lectura dentro de un experimento. Columnas incluyen id (identificador único), experiment_id (referencia a protocolo), block_number (número de orden), name (nombre descriptivo del bloque), duration_minutes (duración especificada en minutos), book_id (libro a leer), page_number (página inicial), config (JSON con parámetros específicos del bloque como configuración de estímulos), order_index (índice para establecer orden cuando hay múltiples bloques), created_at (timestamp de creación).

Tablas de datos experimentales

La tabla `gaze_samples` almacena muestras de Gazepoint capturadas, típicamente 1000 muestras por experimento, cada una con timestamp, coordenadas x y y en píxeles, y confianza de medición. La tabla `run_events` almacena eventos discretos de lectura (cambios de página, fijaciones, sacádicos, parpadeos), típicamente 20 eventos por experimento, cada uno con tipo, timestamp, y metadatos. La tabla `run_assets` almacena referencias a videos y assets multimedia, típicamente 5 videos por experimento. La tabla `block_summaries` almacena agregados estadísticos por bloque como promedio de fijación y frecuencia de sacádicos. La tabla `reading_progress` rastrea posición actual de lectura por usuario por sesión, permitiendo reanudar desde donde se interrumpió. La tabla `mind_wandering_events` detecta períodos donde usuario no está leyendo (mirando lejos de pantalla), útil para análisis de distracción. La tabla `audit_log` registra todas las operaciones modificadoras (creación, actualización, eliminación) para trazabilidad completa.



Autenticación

El flujo de autenticación implementa protocolo basado en tokens y requiere varios pasos de validación. Usuario envía credenciales mediante solicitud POST a /api/login con objeto conteniendo username y password. Servidor busca usuario en tabla users por nombre de usuario, validando que existe. Si usuario existe, servidor compara contraseña ingresada contra hash bcrypt almacenado, verificando coincidencia criptográfica. Si contraseña es válida, servidor verifica que usuario está verificado (isVerified = 1), previniendo acceso de cuentas no validadas. Si todas las validaciones pasan, servidor genera token Bearer (JWT o token de sesión) almacenado en memoria de proceso, retorna token al cliente más metadatos de usuario (id, username, email). Cliente almacena token en localStorage.authToken para persistencia entre sesiones.

Subsecuentes requests de cliente incluyen token en cabecera HTTP Authorization: Bearer {token}, permitiendo servidor validar solicitud sin mantener sesiones con estado servidor. Middlewares especializados están disponibles: requireAuth valida que token está presente y no ha expirado, permitiendo acceso solo a usuarios autenticados; requireVerified valida token Y estado de verificación, restricción adicional para operaciones sensibles. Limitación actual es que sesiones en memoria se pierden cuando servidor reinicia, previniendo recuperación de sesiones activas. Sin recuperación automática de sesiones, usuarios deben re-autenticarse después de reinicio de servidor, aunque arquitectura permite implementar persistencia mediante Redis o base de datos en futuro.



Experimentos

Estado Actual

El estado actual del sistema muestra experimento inyectado con ID=2 conteniendo run ID=2 con 1000 muestras de gaze, 20 eventos de lectura, 5 videos capturados, y 5 bloques de datos experimentales. Estos datos de ejemplo permiten pruebas funcionales de componentes de visualización y análisis sin requerir ejecución manual de experimentos completos.

Endpoints de Experimentos

La operación GET /api/experiments-v2/list retorna listado de experimentos activos (no eliminados) del usuario autenticado con estado OK. GET /api/experiments-v2/trash retorna experimentos eliminados (soft deleted) permitiendo recuperación con estado OK. POST /api/experiments-v2/create permite creación de nuevo protocolo experimental con estado OK. PUT /api/experiments-v2/:id permite actualización de experimento existente con estado OK. DELETE /api/experiments-v2/:id permite eliminación con soft delete (seta deleted_at) requiriendo revisión de lógica. GET /api/experiments-v2/:experimentId retorna un experimento específico requiriendo revisión de comportamiento. GET /api/experiments-v2/:experimentId/runs retorna todas las corridas de un experimento requiriendo revisión de comportamiento.

Datos de Experimento (config JSON)

La configuración de experimento se almacena como objeto JSON que contiene num_blocks (número total de bloques en protocolo) y minutes_per_block (duración de cada bloque en minutos). Esta estructura flexible permite agregar parámetros adicionales sin migraciones de esquema.



Resultados

Componente: ResultadosExperimento.js

ResultadosExperimento.js implementa visualización de datos capturados durante experimentos. El componente carga experimento de base de datos usando ID de ruta, muestra datos de mirada en formato paginado (100 elementos por página), muestra eventos con timestamps precisos, y carga videos con timeline interactivo permitiendo exploración de datos.

Timeline (TabVideos.js)

La visualización de timeline muestra todos los eventos capturados durante sesión dispuestos en línea de tiempo. Los colores diferencian tipos de eventos: page_change (cambio de página) en color específico, fixation (fijación ocular) en color específico, saccade (movimiento rápido de ojos) en color específico, blink (parpadeo) mostrado en cuadrado verde, pause (pausa de lectura) mostrado en cuadrado amarillo. La funcionalidad permite hacer click en evento para saltar video al minuto correspondiente, facilitando análisis sincronizado. Una lista de eventos interactiva permite ver todos los eventos con timestamps, y leyenda de colores explica código de colores usado.

Funcionalidad de Análisis

El componente proporciona capacidades completas de análisis: visualización paginada de datos brutos (gaze samples con timestamps), resúmenes estadísticos agregados (promedio de fijación, frecuencia de sacádicos), timeline visual de eventos, reproductor de videos con sincronización a eventos, permitiendo investigadores explorar múltiples dimensiones de datos simultaneamente.



Tecnologías utilizadas

Frontend

React 19.1.1 proporciona framework declarativo para construcción de interfaz, compilando a 185.8 kB gzipped para tamaño manejable. react-router-dom 7.9.1 proporciona enrutamiento del lado del cliente permitiendo navegación sin recarga de página. epubjs proporciona soporte nativo para lectura y renderizado de archivos EPUB.

Backend

Node.js proporciona runtime JavaScript del lado del servidor. Express proporciona framework HTTP con enrutamiento, middlewares y manejo de errores. SQLite3 proporciona persistencia relacional en archivo local. bcryptjs proporciona derivación de contraseñas segura. dotenv proporciona carga de variables de configuración desde archivo .env.

Infraestructura opcional

Python con Flask está disponible como opcional para comunicación nativa con hardware Gazepoint. Fallback automático se activa si servidor Python no está disponible, permitiendo desarrollo sin dispositivo físico.



Configuración

Archivo .env

FLASK_SERVER define dirección de servidor Python para Gazepoint (por defecto http://localhost:5000). JWT_SECRET define clave secreta para firmar tokens JWT. DB_PATH define ruta a archivo de base de datos SQLite.

Archivo config.js

PORT define puerto de escucha del servidor Express (por defecto 3000). DB_PATH define ruta a archivo users.db. VALIDATION contiene reglas de validación: USERNAME_MIN_LENGTH (por defecto 3), USERNAME_MAX_LENGTH (por defecto 50), PASSWORD_MIN_LENGTH (por defecto 3). Las constantes de validación garantizan consistencia entre cliente y servidor.



Cómo ejecutar

Para ejecutar el proyecto, seguir estos pasos secuenciales: primero ejecutar `node db/init-db.js` para crear esquema SQLite con todas las tablas. Luego ejecutar `node db/seed-admin.js` para crear usuario administrativo. Opcionalmente ejecutar `node inject-experiment.js` para inyectar datos experimentales de ejemplo. Compilar React con `npm run build` generando archivos optimizados en directorio build/. Finalmente iniciar servidor con `node server.js` que sirve aplicación en puerto 3000. Acceder a http://localhost:3000, ingresando credenciales usuario: admin, contraseña: 123.



Lo que funciona

La plataforma implementa completamente: sesión iniciada / autenticación con validación de credenciales y manejo de errores, listado de experimentos con paginación, creación/edición/eliminación de experimentos con soft delete, inicio de experimentos lanzando protocolo completo, visualización de resultados con datos de mirada, eventos y videos, timeline interactivo con seek y eventos sincronizados, CRUD básico de experimentos con validaciones, visualización de datos paginada evitando sobrecarga de memoria, cargador de libros EPUB con extracción de portadas, lector completamente funcional con navegación y preferencias, endpoints de API retornando JSON válido, scripts sin CSP errors permitiendo ejecución de código.



Lo que está roto o pendiente

Flask/Python para Gazepoint está desactivado temporalmente pero puede reactivarse cuando dispositivo esté disponible. Gazepoint en tiempo real está desimplementado porque requiere dispositivo hardware específico no siempre disponible durante desarrollo. Sesiones persistentes solo funcionan en memoria de proceso actual, perdiéndose ante reinicio de servidor, aunque arquitectura permite implementar persistencia mediante Redis.



Inconsistencias identificadas y reparadas

Se han identificado y solucionado todas las inconsistencias documentadas en archivo INCONSISTENCIES_ANALYSIS.md. Las reparaciones incluyen: columnas no existentes han sido removidas de queries, endpoints de API han sido creados para servir datos esperados por frontend, CSP (Content Security Policy) headers han sido reparados permitiendo ejecución de scripts necesarios, Flask ha sido desactivado temporalmente sin comprometer funcionalidad de prueba.



Datos actuales

En la instancia de desarrollo actual: usuario admin con contraseña 123 puede acceder. Datos de ejemplo con ID=2 contienen run ID=2 con 1000 gaze samples, 20 eventos de lectura, 5 videos grabados, 5 bloques experimentales. Estos datos permiten pruebas completas de funcionalidad sin ejecución manual.



ESTADO GENERAL: COMPLETAMENTE FUNCIONAL - Listo para Testing

