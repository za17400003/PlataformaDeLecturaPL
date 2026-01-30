# Manual de Usuario - Plataforma PL (Platform for Reading with Eye Tracking)

**Versión:** 1.0  
**Última actualización:** 31 de enero de 2026  
**Dirección de la Plataforma:** http://localhost:3000

---

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Requisitos del Sistema](#requisitos-del-sistema)
3. [Inicio de Sesión](#inicio-de-sesión)
4. [Interfaz Principal](#interfaz-principal)
5. [Gestión de Experimentos](#gestión-de-experimentos)
6. [Ejecución de Experimentos](#ejecución-de-experimentos)
7. [Lectura de Libros](#lectura-de-libros)
8. [Análisis de Resultados](#análisis-de-resultados)
9. [Preferencias de Visualización](#preferencias-de-visualización)
10. [Solución de Problemas](#solución-de-problemas)

---

## Introducción

La Plataforma PL es un sistema integrado de lectura digital que captura datos biométricos mediante eye-tracking de Gazepoint. Está diseñada para investigadores que necesitan ejecutar experimentos controlados de lectura mientras capturan simultáneamente seguimiento ocular, eventos de comportamiento y grabación audiovisual de sesiones.

### Características Principales

- **Lectura de EPUB:** Visor de textos EPUB completamente funcional con navegación avanzada y búsqueda de capítulos
- **Experimentos Controlados:** Diseña protocolos experimentales con múltiples bloques de lectura
- **Captura de Eventos de Lectura:** Registro automático de cambios de página y duración de bloques
- **Grabación Audiovisual:** Captura de video durante sesiones experimentales
- **Análisis de Resultados:** Visualización de datos de eventos en tablas y línea de tiempo
- **Personalización:** Ajustes de visualización (fuente, tamaño, tema, brillo) persistentes

**Nota sobre Gazepoint:** La integración con eye-tracker Gazepoint está planificada para versiones futuras. Actualmente la plataforma captura eventos de lectura (cambios de página) pero no datos de seguimiento ocular en tiempo real.

---

## Requisitos del Sistema

### Hardware Mínimo

- Procesador: Intel Core i5 o equivalente
- RAM: 8 GB mínimo, 16 GB recomendado
- Almacenamiento: 500 MB libres para sistema, 1-2 GB por experimento registrado
- Pantalla: Resolución mínima 1024x768
- Cámara web: Requerida para grabación de video durante sesiones
- Micrófono: Requerido para captura de audio

### Software Requerido

- Navegador moderno: Chrome 90+, Firefox 88+, Edge 90+ o Safari 14+
- Node.js 16+: Para ejecutar servidor
- Python 3.8+: Para comunicación con dispositivo Gazepoint (servidor Flask)
- SQLite3: Incluido en sistema operativo

### Dispositivos Externos

- **Cámara Web:** Requerida para grabación de video durante sesiones experimentales
- **Micrófono:** Requerido para captura de audio ambiental

**Nota:** El dispositivo Gazepoint GP3 (eye-tracker) será soportado en futuras versiones. En la versión actual, la captura de seguimiento ocular no está disponible.

### Recomendaciones de Red

- Conexión WiFi o Ethernet estable
- Ancho de banda mínimo: 10 Mbps
- Latencia máxima: < 100 ms en red local

---

## Inicio de Sesión

### Crear una Cuenta

1. **Accede a la plataforma:** Abre navegador y ve a http://localhost:3000
2. **Busca el formulario de registro:** En pantalla de login, haz clic en "Crear Cuenta"
3. **Completa los campos:**
   - **Nombre de Usuario:** Mínimo 3 caracteres, sin espacios
   - **Correo Electrónico:** Dirección válida para verificación
   - **Contraseña:** Mínimo 6 caracteres, se recomienda mezclar mayúsculas, números, símbolos
4. **Haz clic en "Registrarse"**
5. **Verifica tu correo:** Revisa bandeja de entrada (y spam) para enlace de verificación
6. **Haz clic en el enlace:** Confirma dirección de correo para activar cuenta

### Iniciar Sesión

1. **Ingresa Credenciales:**
   - Nombre de usuario o correo electrónico registrado
   - Contraseña asociada
2. **Haz clic en "Inicia Sesión"**
3. **Mantén sesión activa:** La plataforma mantiene sesión activa mientras navegues

### Recuperar Contraseña

1. En pantalla de login, haz clic en "¿Olvidaste tu contraseña?"
2. Ingresa el correo asociado a tu cuenta
3. Revisa correo para enlace de recuperación
4. Haz clic en el enlace y establece nueva contraseña
5. Inicia sesión con nueva contraseña

### Cerrar Sesión

Haz clic en botón "Cerrar Sesión" en esquina superior derecha de la interfaz.

---

## Interfaz Principal

Después de iniciar sesión, ves la vista principal con tres opciones principales:

### Componentes de la Interfaz

#### Navegación Superior
- **Logo/Título:** Muestra nombre de plataforma
- **Usuario:** Identificador del usuario conectado
- **Menú Principal:** Acceso a secciones principales

#### Panel Central

La interfaz principal presenta dos vistas alternas:

1. **Vista Biblioteca:** Catálogo de libros disponibles
2. **Vista Experimentos:** Gestión de protocolos experimentales

#### Galería de Libros

En vista Biblioteca se despliega galería de libros EPUB:

- **Portadas Visuales:** Imagen de portada de cada libro
- **Paginación:** Navega entre páginas con flechas o números
- **Búsqueda:** Filtra libros por título o autor (si disponible)
- **Seleccionar Libro:** Haz clic en portada para iniciar lectura

#### Configuración de Experimentos

Accede a través del botón "Experimentos" en interfaz:

- **Crear Nuevo:** Botón para iniciar nuevo protocolo experimental
- **Listar Existentes:** Tabla de experimentos ya creados
- **Acciones Disponibles:** Editar, ejecutar, ver resultados, eliminar

---

## Gestión de Experimentos

### Crear un Nuevo Experimento

#### Paso 1: Acceder a Configuración

1. Desde vista Biblioteca, haz clic en botón "Experimentos"
2. En vista Experimentos, haz clic en "Nuevo Experimento"

#### Paso 2: Información Básica

Se abre formulario con campos:

- **Nombre del Experimento:** Identificador único para protocolo (ej: "Exp Coraline - Feb 2026")
- **Descripción:** Detalle de objetivos, hipótesis, métodos (campo opcional)

#### Paso 3: Configuración de Bloques

Define parámetros para el experimento:

- **Número de Bloques:** Cantidad de períodos de lectura (recomendado: 3-5)
- **Duración por Bloque:** Minutos de lectura por bloque (recomendado: 5-10 minutos)
- **Seleccionar Libro:** Elige EPUB de catálogo disponible
- **Página Inicial:** Número de página donde comienza lectura (por defecto: 1)

#### Paso 4: Configuración de Estímulos (Opcional)

Define estímulos a presentar durante lectura:

- **Vibración Física:** Habilita/deshabilita feedback háptico (requiere dispositivo compatible)
- **Estímulos Auditivos:** Sonidos durante lectura (tonos puros, notificaciones)
- **Estímulos Visuales:** Overlays visuales sin interferir lectura
- **Frecuencia:** Distribución de estímulos (uniforme, aleatoria, fija)
- **Cruzamiento de Frecuencias:** Experimenta con múltiples estímulos simultáneos

#### Paso 5: Guardar Experimento

Haz clic en "Guardar" o "Crear Experimento". La plataforma asigna ID único (automático).

### Editar un Experimento Existente

1. En lista de experimentos, selecciona experimento objetivo
2. Haz clic en botón "Configurar" o "Editar"
3. Modifica parámetros según necesidad
4. Haz clic en "Guardar Cambios"

### Eliminar un Experimento

1. En lista de experimentos, selecciona experimento
2. Haz clic en botón "Eliminar"
3. Confirma eliminación en diálogo de confirmación
4. El experimento se mueve a papelera (eliminación suave)

### Recuperar Experimento Eliminado

1. En vista Experimentos, busca botón "Ver Papelera"
2. Aparece lista de experimentos eliminados
3. Selecciona experimento y haz clic "Recuperar"
4. El experimento vuelve a estado activo

### Eliminar Permanentemente

1. En papelera, selecciona experimento a eliminar permanentemente
2. Haz clic en "Eliminar Permanentemente"
3. Confirma en diálogo (operación no reversible)

---

## Ejecución de Experimentos

### Iniciar Experimento

#### Paso 1: Seleccionar Experimento

1. En vista Experimentos, identifica protocolo a ejecutar
2. Haz clic en botón "Iniciar" (triángulo de reproducción)

#### Paso 2: Pantalla de Confirmación

Aparece pantalla con:

- **Resumen de Experimento:** Nombre, descripción, número de bloques
- **Duración Total Estimada:** Cálculo automático en minutos
- **Dispositivos Conectados:** Estado de Gazepoint, cámara, micrófono
- **Botones:** "Cancelar" para abortar, "Continuar" para proceder

#### Paso 3: Pantalla de Introducción del Bloque

Para cada bloque se muestra:

- **Número de Bloque:** "Bloque 1 de 5"
- **Libro Actual:** Título del EPUB a leer
- **Duración del Bloque:** Tiempo de lectura en minutos
- **Instrucciones:** "Presiona ESPACIO para comenzar"

Presiona ESPACIO para iniciar lectura del bloque.

#### Paso 4: Lectura Experimental

Durante lectura, la plataforma captura:

- **Seguimiento Ocular:** Coordenadas X/Y a 60-250 Hz desde Gazepoint
- **Eventos de Lectura:** Cambios de página, duración de fijaciones
- **Video:** Stream desde cámara web (resolución configurable)
- **Audio:** Captura de sonidos ambientales o narraciones

**Controles durante lectura:**

- **Flechas Izquierda/Derecha:** Navega entre páginas
- **Slider Horizontal:** Salta a página específica
- **BARRA ESPACIADORA:** Pausa/reanuda lectura en modo experimental
- **ESC:** Abandona experimento (solicita confirmación)

#### Paso 5: Transición entre Bloques

Cuando expira duración del bloque:

1. Lectura se pausa automáticamente
2. Se muestra pantalla de transición
3. Se muestran estadísticas del bloque anterior
4. Presiona ESPACIO para continuar al siguiente bloque

#### Paso 6: Pantalla de Finalización

Después de completar todos los bloques:

- Resumen de sesión completa
- Datos capturados (total de muestras de gaze, eventos, duración)
- Opciones: "Ver Resultados", "Repetir Experimento", "Volver a Inicio"

### Pausar o Abandonar Experimento

En cualquier momento durante lectura:

- **Pausar:** Presiona ESPACIO para pausar (solo si está habilitado)
- **Abandonar:** Presiona ESC, confirma en diálogo
- Si abandona: Datos capturados hasta pausa se guardan, pero marcado como "abortado"

---

## Lectura de Libros

### Modo de Lectura Libre

Accede a través de galería de Biblioteca sin pasar por experimento:

1. En vista Biblioteca, selecciona libro de catálogo
2. Se abre visor Lector en modo lectura libre (no experimental)
3. Lectura no captura datos biométricos ni realiza grabación

### Modo de Lectura Experimental

Accede desde ejecución de experimento:

1. Después de presionar ESPACIO en pantalla de introducción del bloque
2. Se abre visor Lector en modo experimental
3. Se captura automáticamente: cambios de página, duración del bloque, video
4. En versiones futuras, se capturará también seguimiento ocular desde Gazepoint

### Navegación en el Visor

#### Controles Básicos

- **Flecha Izquierda/Derecha:** Página anterior/siguiente
- **Slider Horizontal (página):** Salta a página específica del rango
- **Slider Vertical (brillo):** Ajusta luminosidad de documento

#### Tabla de Contenidos

1. Haz clic en botón "Tabla de Contenidos" (símbolo de menú)
2. Aparece lista de capítulos y secciones
3. Haz clic en capítulo para saltar a esa sección
4. Usa campo "Buscar capítulo" para filtrar capítulos por nombre

Nota: La búsqueda dentro del contenido del texto será una característica en versiones futuras.

1. Haz clic en "Info" o "Detalles"
2. Se muestran metadatos: Título, Autor, Editorial, Idioma
3. Cierra haciendo clic fuera panel


### Monitoreo de Progreso

La plataforma rastrea progreso de lectura:

- **Automático:** Se guarda posición cuando cambias de página
- **Recuperación:** Próxima vez que abras mismo libro, regresa a última posición
- **Indicador:** Barra de progreso muestra porcentaje de libro completado

---

## Preferencias de Visualización

### Acceder a Preferencias

1. Durante lectura (modo libre o experimental), haz clic en ícono de "Preferencias" o "Configuración"
2. Se abre panel de opciones visuales

### Tamaño de Fuente

- **Rango:** 50% a 150% del tamaño base
- **Ajuste:** Usa slider o ingresa porcentaje
- **Aplicación:** Cambio es inmediato
- **Persistencia:** Se guarda para próximas sesiones

### Tipo de Fuente

- **Opciones:** "Fuente Original" (del EPUB) o "Sans-Serif" (sistemática)
- **Cambio:** Haz clic en opción deseada
- **Recomendación:** Sans-Serif para mejor legibilidad en pantalla

### Espaciado de Líneas

- **Rango:** 1.0x a 2.0x
- **Incrementos:** 0.05x o 0.1x según control
- **Uso:** Beneficia especialmente a usuarios con dislexia
- **Guardado:** Persistente entre sesiones

### Tema de Color

- **Modo Claro:** Fondo blanco, texto negro (defecto)
- **Modo Sepia:** Fondo crema, texto marrón (reduce fatiga)
- **Modo Oscuro:** Fondo negro, texto claro (para ambientes oscuros)
- **Cambio:** Haz clic en ícono de tema

### Brillo

- **Rango:** 0.5x a 1.5x
- **Ajuste:** Usa slider
- **Efecto:** Multiplica luminosidad del documento
- **Utilidad:** Reduce fatiga ocular en diferentes iluminaciones

### Guardar y Aplicar

Todos los cambios se guardan automáticamente en localStorage del navegador:

- No requiere confirmación explícita
- Se sincronizan entre todas las sesiones del usuario
- Si cambias navegador, preferencias no se transfieren (usar sincronización de perfil)

---

## Análisis de Resultados

### Acceder a Resultados

1. En vista Experimentos, localiza experimento completado
2. Haz clic en botón "Ver Resultados" o "Resultados"
3. Se abre vista de análisis

### Estructura de Resultados

#### Panel Izquierdo: Información de Sesión

- **Nombre de Sesión:** S1, S2, etc. (identificador único)
- **Experimento:** Nombre del protocolo ejecutado
- **Bloques Completados:** Número de bloques ejecutados
- **Duración Total:** Tiempo total de sesión en minutos
- **Estado:** Completado, Abortado, En Progreso
- **Fecha:** Cuándo se ejecutó la sesión

#### Panel Derecho: Datos Capturados

**Sección 1: Información de Sesión**

- **Nombre de Sesión:** Identificador único de la sesión
- **Experimento:** Nombre del protocolo ejecutado
- **Bloques Completados:** Número de bloques ejecutados
- **Duración Total:** Tiempo total de sesión en minutos
- **Estado:** Completado, Abortado, En Progreso
- **Fecha:** Cuándo se ejecutó la sesión
- **Total de Eventos Registrados:** Cantidad de cambios de página y otros eventos
- **Total de Muestras de Gaze:** Cantidad de datos capturados (futuro)

**Sección 2: Videos Capturados**

Para cada bloque:

- Identificador del bloque
- Duración del bloque en minutos
- Tamaño del archivo de video
- Botones: "Reproducir", "Descargar"

**Sección 3: Tabla de Eventos de Lectura**

Tabla detallada mostrando:

- **Timestamp:** Cuándo ocurrió el evento
- **Tipo de Evento:** Tipo de acción registrada (ej: page_change)
- **Detalles:** Información adicional del evento
- **Filtrado:** Por tipo de evento

**Nota:** Los datos de seguimiento ocular (gaze) serán capturados en versiones futuras cuando se integre Gazepoint.

### Filtrado de Datos

En vista de resultados, puedes:

- **Filtrar por Tipo de Evento:** Muestra/oculta tipos específicos de eventos
- **Paginación de Datos:** Navega entre páginas de datos de gaze/eventos

### Exportación de Datos

Para análisis externo:

1. En vista de datos de sesión, busca botones de "Exportar"
2. Los datos se descargan en formato CSV (Comma-Separated Values)
3. Puedes abrirlo en Excel, Google Sheets, o procesarlo con Python/R

**Datos exportables:**

- Eventos de lectura (cambios de página, timestamps)
- Metadatos de sesión

**Nota:** Exportación a JSON y datos de gaze estarán disponibles cuando se integre Gazepoint en versiones futuras.

### Recuperación Histórica

Puedes ver múltiples sesiones de un mismo experimento seleccionando diferentes runs en el selector de experimentos. Para ver datos de diferentes sesiones, abre cada una por separado.

La comparación simultánea de múltiples sesiones será una característica en versiones futuras.

---

## Solución de Problemas

### Problemas de Conexión

**Problema:** "Error de conexión - No se puede acceder a servidor"

**Soluciones:**

1. Verifica que servidor Node.js está ejecutándose:
   - Terminal: Ejecuta `npm start` en directorio raíz
   - Espera mensaje: "Server running on port 3000"

2. Verifica URL correcta: http://localhost:3000 (no confundir puertos)

3. Reinicia navegador y limpia caché:
   - Chrome: Ctrl+Shift+Delete
   - Firefox: Ctrl+Shift+Delete
   - Safari: Cmd+Shift+Delete

4. Verifica puerto 3000 no esté en uso:
   - Windows Terminal: `netstat -ano | findstr :3000`
   - Linux/Mac: `lsof -i :3000`

### Problemas de Autenticación

**Problema:** "Credenciales inválidas" al iniciar sesión

**Soluciones:**

1. Verifica nombre de usuario correctamente escrito (case-sensitive en algunos casos)
2. Verifica correo si usas correo como login
3. Usa "Recuperar Contraseña" si no recuerdas
4. Verifica que correo esté verificado (revisa spam)

**Problema:** "Sesión expirada" después de inactividad

**Soluciones:**

1. Inicia sesión nuevamente
2. Si es problema recurrente, verifica tiempo de expiración en servidor
3. Evita cerrar navegador durante experimentos largos

### Problemas de Captura de Datos

**Problema:** "Video no se captura durante lectura"

**Soluciones:**

1. Verifica permisos de cámara en navegador:
   - Chrome: Configuración > Privacidad > Permisos > Cámara
   - Firefox: Preferencias > Privacidad > Permisos > Cámara
2. Asegúrate que otra aplicación no está usando cámara
3. Reinicia navegador después de permitir permisos
4. Verifica que dispositivo cámara no está deshabilitado en Administrador de Dispositivos
5. Libera espacio en disco (requiere mínimo 500 MB por experimento)

**Gazepoint no disponible en esta versión:** El soporte para eye-tracker Gazepoint será agregado en futuras versiones.

### Problemas durante Ejecución de Experimentos

**Problema:** "El bloque no comienza después de presionar ESPACIO"

**Soluciones:**

1. Verifica que contador de ESPACIO no está en conflicto con navegador
2. Haz clic en área del visor antes de presionar ESPACIO
3. Intenta presionar ESPACIO nuevamente (puede requerir dos pulsaciones)

**Problema:** "El video/audio no se captura durante lectura"

**Soluciones:**

1. Verifica permisos de cámara/micrófono (ver arriba)
2. Verifica que códecs de navegador soportan VP8/H264 y WAV
3. Libera espacio en disco (requiere 1-2 GB por experimento)
4. Intenta con navegador diferente para descartar problemas de compatibilidad

**Problema:** "Los datos de video se ven a baja calidad"

**Soluciones:**

1. Verifica iluminación del área (mejora luz ambiental)
2. Limpia lente de cámara web
3. Asegúrate que cámara tiene resolución HD (1280x720 mínimo)
4. Intenta con diferente navegador para descartar problemas de codec

### Problemas de Interfaz y Usabilidad

**Problema:** "Botones no responden" o "Interfaz congelada"

**Soluciones:**

1. Espera 5-10 segundos (puede estar procesando)
2. Abre Consola de Desarrollador (F12) y revisa errores
3. Limpia caché del navegador
4. Recarga página (F5 o Ctrl+R)
5. Si persiste, reporta error con screenshot de consola

**Problema:** "Texto muy pequeño/grande en libro"

**Soluciones:**

1. Usa preferencia de Tamaño de Fuente (ver sección Preferencias)
2. Si controles no aparecen, verifica que panel de preferencias está visible
3. Zoom del navegador (Ctrl+Plus/Minus) es secundario a configuración de app

**Problema:** "Fuentes no se ven correctamente"

**Soluciones:**

1. Intenta cambiar a "Sans-Serif" en Tipo de Fuente
2. Verifica que navegador no bloquea fuentes externas (Configuración > Privacidad)
3. Asegúrate que archivo EPUB no tiene fuentes personalizadas inusuales
4. Actualiza navegador a versión más reciente

### Problemas de Base de Datos

**Problema:** "Error al guardar experimento" / "Error al crear sesión"

**Soluciones:**

1. Verifica que base de datos SQLite no está corrupta:
   - Ejecuta: `node db/check-schema.js`
   - Debe mostrar todas las tablas correctamente
2. Si está corrupta, reinicializa BD (ADVERTENCIA: borra datos):
   - Ejecuta: `node db/reset-admin.js`
3. Verifica espacio en disco (requiere mínimo 50 MB libre)

### Reportar Problemas

Si problemas persisten después de intentar soluciones:

1. Abre Consola de Desarrollador (F12)
2. Copia el contenido de la pestaña "Consola" (errores completos)
3. Anota pasos exactos para reproducir problema
4. Contacta equipo de soporte con información anterior

---

## Consideraciones de Seguridad

### Protección de Contraseña

- Plataforma utiliza bcrypt para hashear contraseñas
- Contraseñas NO se almacenan en texto plano
- Si alguien obtiene acceso a BD, contraseñas siguen siendo protegidas

### Tokens de Sesión

- Al iniciar sesión, recibes token Bearer que identifica tu sesión
- Token se almacena en localStorage del navegador
- Cierra sesión (Cerrar Sesión) para invalidar token

### Datos de Experimentos

- Solo tú (propietario) puedes ver/modificar tus experimentos
- Servidor verifica autorización en cada solicitud
- Datos eliminados se marcan como eliminados (soft delete) antes de purgar permanentemente

### Privacidad de Datos Biométricos

- Datos de gaze, eventos, video y audio se asocian con tu sesión
- No se comparten con otros usuarios
- Puedes exportar datos para análisis personal

### Certificados HTTPS

En producción, asegúrate de usar conexión HTTPS (no HTTP):

- Protege tu token de sesión de intercepción
- Cifra datos biométricos en tránsito
- Valida autenticidad del servidor

---

## Preguntas Frecuentes (FAQ)

**P: ¿Puedo hacer experimentos sin Gazepoint?**

R: Sí, en la versión actual solo se capturan eventos de lectura y video. La integración con Gazepoint (eye-tracker) está planificada para futuras versiones.

**P: ¿Cuánto espacio de almacenamiento necesito por experimento?**

R: Aproximadamente 50-100 MB por minuto de video. Un experimento de 5 bloques de 5 minutos requiere ~250-500 MB. Esto depende de la resolución del video.

**P: ¿Puedo compartir experimentos con colegas?**

R: Actualmente, cada usuario crea sus propios experimentos. Para colaboración, contacta administrador para activar acceso compartido en futuras versiones.

**P: ¿Qué pasa si se desconecta durante un experimento?**

R: La sesión se marca como "abortada". El video capturado hasta ese momento se guarda. Puedes intentar reiniciar el mismo experimento y se creará una nueva sesión.

**P: ¿Puedo editar un experimento después de ejecutarlo?**

R: Sí, puedes editar la configuración. Los cambios afectan futuras ejecuciones. Resultados anteriores permanecen sin cambios.

**P: ¿Cómo recupero una contraseña olvidada?**

R: En pantalla de login, haz clic "¿Olvidaste tu contraseña?" e ingresa correo. Recibirás enlace de recuperación en tu bandeja de entrada.

**P: ¿Cuál es la mejor configuración para experimentos con participantes?**

R: Recomendado 3-5 bloques de 5-10 minutos cada uno. Duración total ideal: 30-45 minutos. Esto minimiza fatiga mientras mantiene datos significativos.

**P: ¿Puedo usar la plataforma en tablet o móvil?**

R: La interfaz está optimizada para desktop. Tablets grandes (iPad) pueden funcionar parcialmente, pero no son recomendadas. Móviles no son soportados.

**P: ¿Se guardan mis preferencias de visualización?**

R: Sí, en localStorage del navegador. Se aplicarán automáticamente la próxima vez que abras un libro en el mismo navegador y dispositivo.

**P: ¿Puedo descargar mis datos en formato de investigación?**

R: Sí, exporta como CSV desde vista de resultados. Es compatible con Excel, SPSS, Python, R para análisis estadístico.

**P: ¿Cuándo estará disponible la integración con Gazepoint?**

R: Está planificado para versiones futuras. Por ahora la plataforma captura eventos de lectura y video.

**P: ¿Cómo se organizan las sesiones en el sistema?**

R: Cada experimento ejecutado crea una "run" (ejecución). Cada run se organiza en bloques. Los videos y eventos se asocian con cada run.

---

## Información de Contacto y Soporte

- **Correo de Soporte:** [equipo.desarrollo@plataforma.local]
- **Documentación Técnica:** Ver INVESTIGACION_IEEE_CONSOLIDADA.md en carpeta Documentacion/
- **Guía Rápida:** Ver QUICK_START.md para instalación y arranque

---

## Versionado y Cambios

Historial de versiones del manual:

- **v1.0 (31/01/2026):** Versión inicial del manual de usuario

Consulta CHANGELOG.md para historial de cambios de la plataforma completa.

---

**Documento preparado por:** Equipo de Desarrollo PL  
**Última actualización:** 31 de enero de 2026  
**Estado:** Completo y listo para distribución
