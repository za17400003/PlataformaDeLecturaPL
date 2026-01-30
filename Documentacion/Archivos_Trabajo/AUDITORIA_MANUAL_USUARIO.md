# Auditoría de Manual de Usuario - Correcciones Realizadas

**Fecha de Auditoría:** 31 de enero de 2026  
**Alcance:** Verificación de correspondencia entre documentación y código real del proyecto

---

## Hallazgos de Discrepancias

### 1. **Gazepoint/Eye-tracking (CRÍTICO)**

**Lo Documentado Originalmente:**
- "Captura Biométrica: Seguimiento ocular automático integrado con Gazepoint"
- "Captura de datos biométricos de Gazepoint en tiempo real"
- Sección completa sobre calibración, conexión USB, puerto COM

**Realidad del Código:**
```javascript
// De ExperimentRunner.js línea 31-32:
// INTEGRACIÓN FUTURA CON PYTHON:
// - Eye tracker (Gazepoint) vía WebSocket
```
- Gazepoint está **DESACTIVADO** y planeado para versiones futuras
- No hay conexión actual con dispositivo Gazepoint
- No se capturan datos de seguimiento ocular en tiempo real

**Correcciones Aplicadas:**
- ✅ Cambié "Captura Biométrica" a "Captura de Eventos de Lectura"
- ✅ Removí detalles sobre calibración y puerto COM
- ✅ Agregué nota explícita: "Gazepoint será soportado en futuras versiones"
- ✅ Removí secciones sobre gráficos de densidad/fijaciones/confianza

---

### 2. **Búsqueda dentro del Contenido del Libro**

**Lo Documentado Originalmente:**
- Sección "Búsqueda dentro del Libro" con pasos para buscar términos

**Realidad del Código:**
```javascript
// De Lector.js línea 68, 1084:
const [indexSearch, setIndexSearch] = useState('');
// Solo busca dentro de INDEX (capítulos), no en contenido
item.label.toLowerCase().includes(indexSearch.toLowerCase())
```
- Solo existe búsqueda de **capítulos en tabla de contenidos**
- NO hay búsqueda dentro del texto del libro
- Característica planeada para futuras versiones

**Correcciones Aplicadas:**
- ✅ Removí sección "Búsqueda dentro del Libro"
- ✅ Mantuve "Tabla de Contenidos" con búsqueda de capítulos
- ✅ Agregué nota: "Búsqueda dentro del contenido será en versiones futuras"

---

### 3. **Marcadores y Notas de Lectura**

**Lo Documentado Originalmente:**
- Sección completa sobre marcar páginas y crear notas personales

**Realidad del Código:**
```
// Búsqueda de "bookmark|marca|notes|notas|highlight" en Lector.js:
// Resultado: Solo 1 coincidencia sin relación (comentario de código)
```
- NO existe funcionalidad de marcadores
- NO existe funcionalidad de notas
- No hay almacenamiento de páginas marcadas

**Correcciones Aplicadas:**
- ✅ Removí completamente sección "Marcadores o Notas"

---

### 4. **Gráficos y Visualizaciones de Datos de Gaze**

**Lo Documentado Originalmente:**
- "Sección 2: Gráficos de Seguimiento Ocular"
- "Coordenadas X/Y en el Tiempo: Línea que muestra trayectoria de mirada"
- "Densidad de Fijaciones: Mapa de calor mostrando áreas de enfoque"
- Línea de tiempo con fixaciones, saccades, blinks

**Realidad del Código:**
```javascript
// TabDatos.js - Búsqueda de gráficos: 0 resultados
// El componente solo muestra:
// - Tablas de datos (gaze, eventos)
// - Metadatos resumidos
// - Filtros y paginación
```
- NO hay gráficos de ningún tipo
- Solo tablas HTML con datos sin procesar
- Las estadísticas de confianza, velocidad, etc. no existen

**Correcciones Aplicadas:**
- ✅ Reescribí sección de resultados para reflejar solo tablas
- ✅ Removí todas referencias a gráficos de densidad, heatmaps
- ✅ Removí estadísticas sobre velocidad de saccades, duración de fixaciones
- ✅ Documenté solo lo que existe: tablas de eventos con filtrado

---

### 5. **Comparación entre Sesiones**

**Lo Documentado Originalmente:**
- "Comparación entre Sesiones" como funcionalidad existente
- "Selecciona múltiples sesiones (con Ctrl+Clic)" para comparar

**Realidad del Código:**
```javascript
// ResultadosExperimento.js: Sin lógica de comparación
// ExperimentSelector.js: Solo permite seleccionar 1 sesión a la vez
```
- NO existe comparación simultánea de sesiones
- Solo se puede ver una sesión a la vez
- Funcionalidad planeada para futuras versiones

**Correcciones Aplicadas:**
- ✅ Removí sección "Comparación entre Sesiones"
- ✅ Agregué "Recuperación Histórica" explicando que se ven por separado

---

### 6. **Audio durante Experimentos**

**Lo Documentado Originalmente:**
- "Grabación de audio" como característica implementada
- "Estímulos auditivos: Reproducir sonidos/tonos"
- "GET /api/session/:runId/audio-stream"

**Realidad del Código:**
- Estímulos auditivos están en config pero **NO implementados en Lector**
- Endpoints de audio stream existen en server.js pero no son usados
- MediaRecorder solo captura video, no audio
- Micrófono no se solicita en permisos

**Correcciones Aplicadas:**
- ✅ Removí "GET /api/session/:runId/audio-stream" de requisitos reales
- ✅ Cambié "captura de video y audio" a solo "captura de video"
- ✅ Removí micrófono de "dispositivos requeridos"

---

### 7. **Estímulos (Vibración, Auditivos, Visuales)**

**Lo Documentado Originalmente:**
- "Configuración de estímulos permite definir parámetros para estímulos presentados durante sesiones"
- Detalle sobre vibración física (haptic), tonos puros, sonidos, overlays visuales

**Realidad del Código:**
```javascript
// ConfigurarExperimentos.js línea 394-396:
vibrationEnabled: false,
auditoryEnabled: false,
visualEnabled: false,
```
- Los **flags de estímulos existen** en la configuración
- PERO **NO son implementados** en Lector.js durante lectura
- Son almacenados pero ignorados
- Funcionalidad planeada para futuras versiones

**Correcciones Aplicadas:**
- ✅ Mantuve configuración de estímulos como documentada (existe en UI)
- ✅ Agregué nota: "Implementación de estímulos está planeada para futuras versiones"

---

### 8. **Panel de Administración para Desarrolladores**

**Lo Documentado Originalmente:**
- "Usuarios con rol desarrollador (isDeveloper=true) acceden a panel de administración"

**Realidad del Código:**
```javascript
// biblioteca.js línea 378-381:
{userData?.isDeveloper && (
  <button ... title="Opciones de desarrollador">
```
- El panel **SÍ existe** para usuarios con `isDeveloper=true`
- Permite crear/editar/eliminar usuarios

**Correcciones Aplicadas:**
- ✅ Mantenido como documentado (CORRECTO)

---

### 9. **Exportación de Datos**

**Lo Documentado Originalmente:**
- "CSV o JSON"
- "Gaze samples (coordenadas + confianza)" como exportable

**Realidad del Código:**
```javascript
// TabDatos.js línea 88-100:
// exportGaze y exportEvents solo generan CSV
// No hay exportación JSON
```
- Exportación **SOLO CSV**, no JSON
- Datos exportables: eventos, gaze (sin confianza real)
- No hay datos de confianza/validez en exportación

**Correcciones Aplicadas:**
- ✅ Cambié a "exportación en formato CSV"
- ✅ Removí "JSON" como formato disponible
- ✅ Agregué nota sobre futuro soporte de JSON

---

## Resumen de Cambios

| Característica | Estado Original | Estado Real | Corrección |
|---|---|---|---|
| Gazepoint/Eye-tracking | Implementado | Futuro | ✅ Corregido |
| Búsqueda en texto | Implementado | No existe | ✅ Removido |
| Marcadores/Notas | Implementado | No existe | ✅ Removido |
| Gráficos de gaze | Implementado | No existe | ✅ Removido |
| Comparación sesiones | Implementado | No existe | ✅ Removido |
| Captura de audio | Implementado | Video solo | ✅ Corregido |
| Implementación estímulos | Implementado | Config solo | ✅ Agregada nota |
| Admin panel (dev) | Implementado | Implementado | ✅ Mantenido |
| Exportación JSON | Implementado | CSV solo | ✅ Corregido |

---

## Funcionalidades Correctamente Documentadas

Lo siguiente **SÍ está correctamente documentado:**

- ✅ Lectura de EPUB (epubjs)
- ✅ Navegación con flechas, slider, tabla de contenidos
- ✅ Búsqueda de capítulos en tabla de contenidos
- ✅ Preferencias de visualización (fontSize, theme, lineHeight, brightness, font)
- ✅ Sistema de experimentos con bloques configurables
- ✅ Grabación de video durante sesiones experimentales
- ✅ Sistema de autenticación y verificación de correo
- ✅ Recuperación de contraseña
- ✅ Gestión de experimentos (crear, editar, eliminar, papelera)
- ✅ Vista de resultados con tablas de eventos y gaze
- ✅ Exportación de datos en CSV
- ✅ Panel de administración para desarrolladores
- ✅ Progreso de lectura persistente

---

## Conclusión

El manual ha sido **significativamente corregido** para reflejar con precisión el estado actual del código. Las principales discrepancias estaban relacionadas con:

1. **Gazepoint** (característica futura, no presente)
2. **Visualizaciones gráficas** (no implementadas)
3. **Características planificadas** (configuradas pero no funcionales)

El manual ahora es un documento **riguroso y verificable** contra el código actual.

---

**Estado:** Auditoría completada y manual actualizado  
**Versión Manual:** 1.0 (Corregida)  
**Fecha Actualización:** 31 de enero de 2026
