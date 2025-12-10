# 📊 MAPEO DE ARCHIVOS - ASISTENTE DE LECTURA ADL

---

## 🎬 INTRODUCCIÓN (Presentación)

### **Punto 1: Plataforma de lectura web**
Sistema integral para leer libros digitales (EPUB) con interfaz intuitiva y accesible.

### **Punto 2: Integración de eye-tracking**
Captura seguimiento ocular en tiempo real mediante hardware Gazepoint conectado a la red local.

### **Punto 3: Análisis y grabación**
Registra sesiones de lectura sincronizando video de cámara con datos de punto de mirada (gaze data).

### **Punto 4: Investigación y aprendizaje**
Herramienta para estudiar patrones de lectura, comportamiento visual y comprensión de texto mediante datos biomecánicos.

---

## 🎯 Resumen Ejecutivo

Aplicación web para lectura de libros EPUB con seguimiento ocular (eye-tracking). Arquitectura de cliente-servidor unificada con React en frontend y Express/SQLite en backend.

---

## 📱 PANTALLAS Y SUS ARCHIVOS

### 1. **PANTALLA DE LOGIN** - Autenticación de usuarios

**Archivo Principal:**
- `src/App.js` (214 líneas)
  - Componente raíz que maneja el flujo de autenticación
  - Verifica sesión al cargar (localStorage)
  - Renderiza login o biblioteca según estado

**Estilos:**
- `src/App.css` - Estilos de formulario login y animaciones

**Elementos de UI:**
- Input usuario y contraseña
- Botón "Iniciar sesión" con animación de carga
- Mensajes de error/éxito
- Animaciones de entrada/salida

**Funcionalidades:**
- ✅ Validación de credenciales
- ✅ Manejo de sesiones con JWT
- ✅ Recuperación automática de sesión existente
- ✅ Logout seguro

**Archivos Relacionados (Backend):**
- `server.js` - Endpoint `/api/login` (líneas 150-210)
- `config.js` - Credenciales por defecto (admin/123)

---

### 2. **PANTALLA BIBLIOTECA** - Catálogo de libros

**Archivo Principal:**
- `src/biblioteca.js` (489 líneas)
  - Grid de 6 libros por página (2 filas × 3 columnas)
  - Carga dinámica de portadas desde EPUB
  - Navegación entre páginas con animaciones
  - Selector de tema (light/sepia/dark) 
  - Panel de desarrollador para gestionar usuarios

**Estilos:**
- `src/biblioteca.css` (1064 líneas)
  - Grid responsive con breakpoints (1024px, 768px, 480px)
  - Fondo gradiente: 2/3 blanco + 1/3 azul (#4BA5E8)
  - Animaciones hover en libros
  - Estilo especial para papalotes en últimas 3 posiciones

**Elementos de UI:**
```
┌─────────────────────────────────────┐
│  HEADER: Selector Tema + Logout      │
├─────────────────────────────────────┤
│ [Nube-Libro] [Nube-Libro] [Nube]    │  Fila 1-2
│ [Papalote]  [Papalote]  [Papalote]  │  Fila 3 (items 3-5)
├─────────────────────────────────────┤
│  [← ANTERIOR] [SIGUIENTE →]          │
└─────────────────────────────────────┘
```

**Funcionalidades:**
- ✅ Carga 6 libros por página desde servidor
- ✅ Extrae automáticamente portada de EPUB
- ✅ 3 papalotes aleatorios en última fila
- ✅ Navegación circular (último → primero)
- ✅ Click en libro abre el lector
- ✅ Panel dev para CRUD de usuarios (solo desarrolladores)
- ✅ Cambio de tema en tiempo real

**Assets:**
- `src/assets/nube.png` - Fondo libro (nubes)
- `src/assets/nubesoplonaizq.png` - Animación flecha izq
- `src/assets/nubesoplonader.png` - Animación flecha der
- `src/assets/flechaizq.png` - Botón anterior
- `src/assets/flechader.png` - Botón siguiente
- `src/assets/papalote1.png` a `papalote6.png` - Imágenes de papalotes

**Archivos Relacionados (Backend):**
- `server.js` - Endpoint `/api/libros` (líneas 280-320)
- `server.js` - Endpoint `/api/user-preferences` (líneas 550-600)

---

### 3. **PANTALLA LECTOR** - Lectura de EPUB

**Archivo Principal:**
- `src/Lector.js` (1280 líneas) ⭐ **ARCHIVO MÁS COMPLEJO**
  - Renderizador EPUB con epubjs
  - Navegación por páginas (anterior/siguiente)
  - Sistema de preferencias (tamaño, fuente, tema, brillo)
  - Bloques de lectura (5 bloques de 5 minutos)
  - Grabación de sesión con cámara (MediaRecorder)
  - Integración Gazepoint (eye-tracking)
  - Índice navegable
  - Contador de páginas

**Estructura Interna:**

```
CONSTANTES (líneas 20-25):
├─ PROGRESS_SAVE_DEBOUNCE_MS: 2000
├─ SKIP_RELOCATION_FLAG_TIMEOUT_MS: 300
└─ RETRY_MAX_ATTEMPTS: 2

REFERENCIAS (líneas 35-47):
├─ viewerRef - contenedor del EPUB
├─ bookRef - objeto ePub
├─ mediaRecorderRef - grabadora
└─ skipNextRelocationRef - flag para applyPrefs

ESTADOS DE LIBRO (líneas 54-64):
├─ ready - libro cargado
├─ currentPage, totalPages
├─ progress (0-100)
└─ bookTitle, bookIndex

ESTADOS DE UI (líneas 67-73):
├─ showSettings - popover ajustes
├─ settingsTab - pestaña activa
└─ showIndexModal - modal índice

ESTADOS DE GRABACIÓN (líneas 76-79):
├─ isRecording
├─ isPaused
└─ enableGazeHighlight

ESTADOS DE BLOQUES (líneas 82-88):
├─ currentBlock (1-5)
├─ blockTimer (segundos)
└─ blockTimerPosition

PREFERENCIAS (líneas 91-99):
├─ fontSize (80-120%)
├─ lineHeight (1.2-2.0)
├─ theme (light/sepia/dark)
├─ font (original/dyslexia/georgia)
└─ brightness (0.8-1.2)
```

**Estilos:**
- `src/lector.css` (2000+ líneas)
  - Barra superior (header) con navegación
  - Barra inferior (footer) con controles
  - Popover de ajustes con tabs
  - Modal de índice con búsqueda
  - Modal de bloques de lectura
  - Contenedor de EPUB (iframe)
  - Temas dinámicos (light/sepia/dark)

**Flujo de Lectura:**

```
1. Componente monta
   └─> Inicializa epubjs
   └─> Carga progreso guardado
   └─> Aplica preferencias

2. Usuario navega (goNext/goPrev)
   ├─> Guarda progreso (debounced 2s)
   ├─> Actualiza contador página
   └─> Reapplies prefs (evita white flash)

3. Usuario cambia preferencias
   ├─> Aplica a libro (applyPrefsToBook)
   ├─> Guarda en servidor
   └─> Guarda en localStorage

4. Usuario inicia grabación
   ├─> Activa MediaRecorder (cámara)
   ├─> Inicia bloques de lectura
   ├─> Conecta Gazepoint (si disponible)
   └─> Guarda sesión en servidor

5. Usuario cierra lector
   └─> Guarda progreso final
   └─> Detiene grabación
```

**Funcionalidades Principales:**

```
📖 LECTURA:
├─ Navegación anterior/siguiente
├─ Contador de páginas (actualizado cada 300ms)
├─ Búsqueda en índice con match highlighting
└─ Marcadores de lectura

⚙️ AJUSTES:
├─ Tamaño fuente: 80% a 120%
├─ Altura línea: 1.2 a 2.0
├─ Tema: Light (blanco), Sepia (papel), Dark (#0b0c0c)
├─ Fuente: Original, Dyslexia, Georgia
└─ Brillo: 80% a 120%

🎥 GRABACIÓN:
├─ Inicia/pausa grabación de sesión
├─ Guarda video en servidor
├─ Sincroniza con bloques de lectura
└─ Integra datos de cámara

👁️ SEGUIMIENTO OCULAR:
├─ Conecta a Gazepoint (ws://localhost:3000)
├─ Resalta palabras según mirada
├─ Procesa datos en tiempo real
└─ Detección de fijación ocular

📊 BLOQUES DE LECTURA:
├─ 5 bloques de 5 minutos (25 min total)
├─ Timer en pantalla
├─ Modal de progreso
└─ Almacena datos de sesión

🔖 ÍNDICE:
├─ Navegable por capítulos/secciones
├─ Búsqueda en tiempo real
├─ Click para saltar a sección
└─ Sincronización con página actual
```

**Hooks Personalizados:**
- `useGazepoint()` - Conexión WebSocket a Gazepoint
- `useGazeHighlight()` - Resaltado según eye-tracking

**Archivos Relacionados (Backend):**
- `server.js` - `/api/reading-progress` (líneas 400-500)
- `server.js` - `/api/user-preferences` (líneas 550-600)
- `server.js` - WebSocket para Gazepoint (líneas 750-850)

---

## 🔧 ARCHIVOS DE CONFIGURACIÓN Y UTILIDADES

### **src/index.js** - Punto de entrada React
```javascript
- Monta App en root div
- Importa index.css global
- Configura reportWebVitals
- Renderiza componente App raíz
```

### **src/index.css** - Estilos globales
```css
- Reset de estilos (margin, padding, box-sizing)
- Colores base y variables CSS
- Tipografía global (font-family, sizes)
- Scrollbar personalizada
- Breakpoints responsive globales
```

### **src/api-config.js** - Constantes de API (40 líneas)
```javascript
API_CONFIG {
  BASE_URL: 'http://localhost:3000'
  ENDPOINTS: {
    LOGIN: '/api/login'
    LOGOUT: '/api/logout'
    USER: '/api/user'
    READING_PROGRESS: '/api/reading-progress'
    USER_PREFERENCES: '/api/user-preferences'
  }
  DEFAULT_CREDENTIALS: { username: 'admin', password: '123' }
  REQUEST_TIMEOUT_MS: 5000
  SESSION_CHECK_INTERVAL_MS: 60000
  ERROR_MESSAGES para frontend
}

STORAGE_KEYS {
  AUTH_TOKEN: 'authToken'
  USER_DATA: 'userData'
  USER_PREFERENCES: 'userPreferences'
  READING_PROGRESS: 'readingProgress'
}
```

---

## 👁️ SEGUIMIENTO OCULAR (GAZEPOINT)

### **src/hooks/useGazepoint.js** - Hook Gazepoint (119 líneas) ⭐

**Propósito:** Gestión de conexión WebSocket con sistema Gazepoint para seguimiento ocular

**Funcionalidades:**
```javascript
- Conexión WebSocket a ws://localhost:3000
- Reconexión automática con backoff exponencial
- Estados: isConnected boolean
- Métodos: startRecording(sessionId), stopRecording()
- Envía comandos: START_RECORDING, STOP_RECORDING
- Recibe datos: GAZEPOINT_DATA con leftEye, rightEye {x,y}
```

**Flujo de Reconexión:**
```
Intento 1: 500ms
Intento 2: 1s
Intento 3: 2s
Intento 4: 4s
Intento 5: 8s
Intento 6+: 15s (máximo)
```

**Retorna:**
```javascript
{
  isConnected: boolean,        // Estado de conexión
  startRecording: function,    // Inicia grabación en servidor
  stopRecording: function      // Detiene grabación
}
```

**Usado en:** `src/Lector.js` (línea 84)
```javascript
const { startRecording: startGaze, stopRecording: stopGaze, isConnected: gazeConnected } = useGazepoint();
```

---

### **src/hooks/useGazeHighlight.js** - Hook Resaltado Ocular (203 líneas) ⭐

**Propósito:** Resaltar palabras en el EPUB según la dirección de la mirada en tiempo real

**Características:**
```javascript
- Conexión WebSocket a ws://localhost:3001
- Buffer circular de datos para suavizar mirada (500ms)
- Detección de fijación ocular (varianza < 100px)
- Cálculo de posición relativa en texto
- Resaltado dinámico con <u> (subrayado ondulado #5bd8cf)
- Auto-remueve highlight después de 500ms
- Manejo seguro de DOM dentro de iframe
```

**Procesamiento de Datos:**
1. Recibe datos (x, y) de punto de mirada
2. Mantiene buffer de últimos 500ms
3. Calcula promedio de posición (avgX, avgY)
4. Calcula varianza para detectar fijación
5. Si varianza < 100: busca palabra en esa coordenada
6. Extrae palabra completa (parte izq y der)
7. Crea `<u>` tag y reemplaza en DOM
8. Remueve después de 500ms

**Retorna:**
```javascript
null  // Solo tiene efectos secundarios (resaltado visual)
```

**Parámetros:**
```javascript
iframeRef: React.useRef  // Referencia al iframe del EPUB
isEnabled: boolean       // Activar/desactivar resaltado
```

**Usado en:** `src/Lector.js` (línea 85)
```javascript
useGazeHighlight(viewerRef, enableGazeHighlight && gazeConnected);
```

---

### **server/gazepoint-server.js** - Servidor Gazepoint (150 líneas) ⚙️

**Propósito:** Puente entre hardware Gazepoint y aplicación web via WebSocket

**Configuración:**
```javascript
WS_PORT: 4000 (websocket a navegadores)
GP_HOST: 192.168.56.1 (máquina con Gazepoint)
GP_PORT: 4242 (conexión a Gazepoint)
```

**Funcionalidades:**
```
- Conexión TCP a Gazepoint (red local)
- Servidor WebSocket para múltiples clientes
- Parsing de datos XML de Gazepoint
- Broadcasting de datos en tiempo real a todos los clientes
- Grabación de sesiones en CSV + raw XML
- Reconexión automática con backoff exponencial
```

**Comandos Gazepoint (XML):**
```xml
<SET ID="ENABLE_SEND_DATA" STATE="1" />
<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />
<SET ID="ENABLE_SEND_TIME" STATE="1" />
<SET ID="ENABLE_SEND_PUPILDATA" STATE="1" />
```

**Datos Capturados:**
```
LFPOGX, LFPOGY: Punto de mirada ojo izquierdo
RFPOGX, RFPOGY: Punto de mirada ojo derecho
timestamp: Marca de tiempo
```

**Archivos de Grabación:**
- `${sessionId}.txt` - Datos en CSV (5 columnas)
- `${sessionId}.xml` - Datos raw de Gazepoint

**Uso Típico:**
```javascript
// Cliente recibe datos cada ~33ms (30Hz)
{
  type: 'GAZEPOINT_DATA',
  leftEye: { x: 512, y: 384 },
  rightEye: { x: 510, y: 382 },
  ts: 1702182000000
}
```

---

### **Integración Gazepoint - Flujo Completo**

```
┌─────────────────────────────────────────────────────────────┐
│  HARDWARE GAZEPOINT                                         │
│  (192.168.56.1:4242)                                        │
└────────────────────┬────────────────────────────────────────┘
                     │ TCP (datos XML)
┌────────────────────▼────────────────────────────────────────┐
│  server/gazepoint-server.js                                 │
│  - Lee datos XML                                            │
│  - Parse LFPOGX, LFPOGY, RFPOGX, RFPOGY                    │
│  - Graba en CSV/XML                                         │
│  - WebSocket broadcast (PORT 4000)                          │
└────────────────────┬────────────────────────────────────────┘
                     │ WebSocket
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────────┐  ┌──────▼──────────────┐
│ useGazepoint hook    │  │ useGazeHighlight   │
│ (ws://localhost:3000)│  │ (ws://localhost:...)│
│                      │  │                     │
│ - Reconexión auto    │  │ - Buffer datos      │
│ - StartRecording     │  │ - Detección fijación│
│ - StopRecording      │  │ - Resaltado palabras│
└───────┬──────────────┘  └──────┬──────────────┘
        │                        │
        └────────────┬───────────┘
                     │
        ┌────────────▼────────────┐
        │   Lector.js             │
        │                         │
        │ - Muestra estado conexión│
        │ - Inicia grabación sesión│
        │ - Controla resaltado    │
        └─────────────────────────┘
```

---

## 🖥️ ARCHIVOS DE BACKEND

### **server.js** - Servidor Express unificado (884 líneas)

**Estructura:**
```
CONFIGURACIÓN INICIAL (líneas 1-50)
├─ Imports
├─ Configuración Express
├─ Setup CORS y Multer
└─ Configuración WebSocket

UTILIDADES (líneas 50-100)
├─ createErrorResponse()
└─ Input validation helpers

RUTAS DE AUTENTICACIÓN (líneas 150-250)
├─ POST /api/login - Validar credenciales, generar JWT
├─ POST /api/logout - Limpiar sesión
└─ GET /api/user - Validar token, retornar usuario

RUTAS DE LIBROS (líneas 280-350)
├─ GET /api/libros?page=0 - Libros paginados
├─ POST /api/upload-libro - Subir EPUB
└─ GET /api/libro/:id - Metadata de libro

RUTAS DE PROGRESO (líneas 400-500)
├─ GET /api/reading-progress/:bookFile - Obtener progreso
├─ POST /api/reading-progress - Guardar progreso
└─ DELETE /api/reading-progress/:bookFile - Limpiar progreso

RUTAS DE PREFERENCIAS (líneas 550-600)
├─ GET /api/user-preferences - Obtener prefs guardadas
├─ POST /api/user-preferences - Guardar prefs
└─ DELETE /api/user-preferences - Resetear a defaults

RUTAS DE USUARIOS (Admin/Dev) (líneas 650-750)
├─ GET /api/users - Listar usuarios
├─ POST /api/users - Crear usuario
├─ PUT /api/users/:id - Actualizar usuario
└─ DELETE /api/users/:id - Eliminar usuario

WEBSOCKET (líneas 750-850)
├─ Conexión Gazepoint (ws://localhost:3000)
├─ Broadcasting de datos de eye-tracking
└─ Control de sesión de grabación

ARCHIVOS ESTÁTICOS (líneas 850-884)
├─ Sirve public/index.html
├─ Sirve archivos de build React
└─ Fallback a index.html para SPA
```

**Endpoints Clave:**

| Endpoint | Método | Parámetros | Retorna |
|----------|--------|-----------|---------|
| `/api/login` | POST | username, password | { token, user } |
| `/api/user` | GET | (header Authorization) | { id, username, isDeveloper } |
| `/api/libros` | GET | ?page=0 | { libros, paginaActual, totalPaginas } |
| `/api/reading-progress/:bookFile` | GET | - | { currentCFI, progress, totalPages } |
| `/api/reading-progress` | POST | bookFile, currentCFI, progress, totalPages | { success } |
| `/api/user-preferences` | GET/POST | { fontSize, lineHeight, theme, font } | { preferences } |
| `/api/users` | GET | - | [{ id, username, isDeveloper }] |
| `/api/users` | POST | { username, password, isDeveloper } | { id, username } |

### **config.js** - Configuración centralizada (59 líneas)

```javascript
MODULE.EXPORTS {
  PORT: 3000,
  JWT_SECRET: 'your-secret-key-change-in-production',
  
  DEFAULT_ADMIN: {
    username: 'admin',
    password: '123'
  },

  PROGRESS_SAVE: {
    MAX_RETRIES: 2,
    BASE_DELAY_MS: 500,
    DEBOUNCE_MS: 2000
  },

  DATABASE: {
    PATH: './db/library.db',
    TIMEOUT: 5000
  },

  VALIDATION: {
    USERNAME: { min: 3, max: 50 },
    PASSWORD: { min: 3, max: 100 }
  }
}
```

### **db/init-db.js** - Inicialización de SQLite

**Esquema:**
```sql
-- Tabla de usuarios
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  isDeveloper BOOLEAN DEFAULT 0
)

-- Tabla de progreso de lectura
CREATE TABLE reading_progress (
  id INTEGER PRIMARY KEY,
  userId INTEGER NOT NULL,
  bookFile TEXT NOT NULL,
  currentCFI TEXT,
  progress REAL DEFAULT 0,
  totalPages INTEGER,
  currentPage INTEGER,
  lastRead DATETIME DEFAULT CURRENT_TIMESTAMP
)

-- Índices para optimización
CREATE INDEX idx_reading_progress_userId
CREATE INDEX idx_reading_progress_bookFile
CREATE INDEX idx_reading_progress_userId_bookFile

-- Tabla de preferencias
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY,
  userId INTEGER NOT NULL UNIQUE,
  fontSize INTEGER DEFAULT 100,
  lineHeight REAL DEFAULT 1.45,
  theme TEXT DEFAULT 'light',
  font TEXT DEFAULT 'original',
  brightness REAL DEFAULT 1.0,
  FOREIGN KEY(userId) REFERENCES users(id)
)
```

---

## 📁 ESTRUCTURA DE ARCHIVOS COMPLETA

```
ADL/
├── 📄 MAPEO_ARCHIVOS.md ⭐ (TÚ ERES AQUÍ)
│
├── 🎨 FRONTEND (React) - src/
│   ├── 🎯 PANTALLA LOGIN
│   │   ├── App.js (214) - Componente login y autenticación
│   │   └── App.css - Estilos formulario login
│   │
│   ├── 📚 PANTALLA BIBLIOTECA
│   │   ├── biblioteca.js (489) - Grid de 6 libros + paginación
│   │   └── biblioteca.css (1064) - Grid responsive + papalotes
│   │
│   ├── 📖 PANTALLA LECTOR
│   │   ├── Lector.js (1280) ⭐ - Lector EPUB completo
│   │   └── lector.css (2000+) - Estilos lector + temas dinámicos
│   │
│   ├── ⚙️ CONFIGURACIÓN
│   │   ├── api-config.js (40) - Endpoints y constantes
│   │   ├── index.js - Punto de entrada React
│   │   └── index.css - Estilos globales
│   │
│   ├── 👁️ SEGUIMIENTO OCULAR (GAZEPOINT)
│   │   └── hooks/
│   │       ├── useGazepoint.js (119) - WebSocket conexión
│   │       └── useGazeHighlight.js (203) - Resaltado según mirada
│   │
│   ├── 🖼️ ASSETS (imágenes)
│   │   ├── sol.png - Header sol animado
│   │   ├── pajaros.png - Header pájaros
│   │   ├── nube.png - Fondo libro (nubes)
│   │   ├── nubesoplonaizq.png - Animación flecha
│   │   ├── nubesoplonader.png - Animación flecha
│   │   ├── flechaizq.png - Botón anterior
│   │   ├── flechader.png - Botón siguiente
│   │   └── papalote1-6.png - Imágenes kites
│   │
│   ├── 🔤 FUENTES
│   │   └── MaryKate.ttf - Fuente decorativa
│   │
│   ├── 📄 TESTING
│   │   ├── App.test.js - Tests de App
│   │   ├── setupTests.js - Configuración tests
│   │   └── reportWebVitals.js - Métricas performance
│   │
│   └── public/
│       ├── index.html - Template HTML
│       ├── manifest.json - PWA manifest
│       └── libros/ - EPUBs estáticos
│
├── 🖥️ BACKEND - PRINCIPAL
│   ├── server.js (884) - Express unificado + WebSocket Gazepoint
│   └── config.js (59) - Configuración centralizada
│
├── 👁️ BACKEND - GAZEPOINT
│   └── server/gazepoint-server.js (150) - Puente Gazepoint↔WebSocket
│
├── 💾 BASE DE DATOS
│   └── db/init-db.js (60+) - Schema SQLite + índices
│       └── library.db - SQLite generada en runtime
│
├── 🎥 APLICACIÓN SEPARADA (camera-recorder-app/)
│   ├── client/ - App independiente de grabación con cámara
│   └── server/ - Backend para sesiones de cámara
│
├── 📦 CONFIGURACIÓN PROYECTO
│   ├── package.json - Dependencias npm
│   ├── src.code-workspace - VSCode workspace
│   └── .gitignore - Archivos ignorados
│
└── 📚 DOCUMENTACIÓN
    ├── README.md - Info general
    ├── CODE_AUDIT.md - Auditoría de código (20 issues)
    ├── OPTIMIZATION_COMPLETE.md - Optimizaciones realizadas
    ├── MAPEO_ARCHIVOS.md - Este archivo (v2)
    └── Otros documentos de desarrollo...
```

---

## 🔄 FLUJO DE DATOS

### **Al Iniciar Aplicación:**
```
1. index.js monta App
2. App.js verifica token en localStorage
3. Valida token con GET /api/user
   ├─ Si válido: renderiza Biblioteca
   └─ Si inválido: renderiza Login
```

### **Al Hacer Login:**
```
1. Usuario ingresa credenciales en App.js
2. POST /api/login (server.js línea 165)
3. Server valida contra DB usuarios
4. Si válido: genera JWT y retorna token
5. App.js guarda token en localStorage
6. Renderiza Biblioteca
```

### **Al Abrir Libro:**
```
1. Usuario click en biblioteca.js
2. setLibroSeleccionado(archivo)
3. Renderiza Lector con props { archivo, onClose }
4. Lector.js monta epubjs
5. GET /api/reading-progress/:archivo (recupera CFI guardado)
6. Restaura página anterior
7. POST /api/user-preferences (obtiene ajustes guardados)
8. applyPrefsToBook() aplica los ajustes
```

### **Al Navegar Página:**
```
1. Usuario click anterior/siguiente en Lector.js
2. goNext() o goPrev() se ejecuta
3. Actualiza currentPage (estado React)
4. applyPrefsToBook() reaplica prefs (evita white flash)
5. saveReadingProgress() se dispara (debounced 2s)
   └─ POST /api/reading-progress al servidor
6. Guarda en localStorage como backup
```

### **Al Cambiar Tema:**
```
1. Usuario selecciona tema en Lector.js
2. setPrefs({ ...prefs, theme: 'dark' })
3. applyPrefsToBook() aplica colores al iframe
4. saveUserPreferences() se dispara
   └─ POST /api/user-preferences al servidor
5. Guarda en localStorage
6. Próxima sesión carga automáticamente
```

### **Gazepoint Integration:**
```
1. Usuario habilita "Grabar sesión" en Lector.js
2. useGazepoint().startRecording() inicia
3. WebSocket se conecta a ws://localhost:3000 (server.js)
4. Server recibe datos de Gazepoint (si está conectado)
5. useGazeHighlight() resalta palabras en tiempo real
6. Al terminar: stopRecording() guarda sesión en servidor
```

---

## 🎨 ESTRUCTURA VISUAL

### **Login (App.js)**
```
┌─────────────────────────────────┐
│                                 │
│      🌅 SOL ANIMADO 🌅         │
│      🐦 PÁJAROS 🐦             │
│                                 │
│    ASISTENTE DE LECTURA ADL    │
│                                 │
│   ┌──────────────────────────┐  │
│   │ Usuario: [_____________]│  │
│   │ Contraseña: [___________]│  │
│   │                          │  │
│   │     [Iniciar Sesión]     │  │
│   └──────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### **Biblioteca (biblioteca.js)**
```
┌──────────────────────────────────────┐
│ [⚙ TEMA] [🔵 LIGHT] [🔵] [LOGOUT] │
├──────────────────────────────────────┤
│                                      │
│  ☁️📚      ☁️📚      ☁️📚           │  Fila 1
│  Libro 1   Libro 2   Libro 3        │
│                                      │
│  🪁 "Kite 1"  🪁 "Kite 2"  🪁 "K.3"│  Fila 2
│  (papalotes)                         │
│                                      │
│  [←] Página 0 de 5  [→]            │
│                                      │
└──────────────────────────────────────┘
```

### **Lector (Lector.js)**
```
┌──────────────────────────────────────┐
│ [←] "Libro" [⚙] [🎥] [👁] [📑] [X] │  Header
├──────────────────────────────────────┤
│                                      │
│    [EPUB Content - iframe]           │
│    (Fondo dinámico por tema)         │
│    (Texto ajustable: 80%-120%)       │
│                                      │
├──────────────────────────────────────┤
│ [←] Página 15 de 250 [→]  ◼◼◼◼◼░    │  Footer
│ [Progreso: 20%]          [Timer: 5m] │
└──────────────────────────────────────┘

POPOVER AJUSTES (al hacer click en ⚙):
┌─────────────────────┐
│ TEXTO | TEMA | OTRAS│
├─────────────────────┤
│ Tamaño: [80% ----]  │
│ Línea: [1.45 ---]   │
│ Fuente: [Original]  │
│ Brillo: [100% ---]  │
└─────────────────────┘

MODAL BLOQUES (al hacer click en contador):
┌─────────────────────┐
│ BLOQUE 3 DE 5       │
│                     │
│ ⏱️  02:45 / 05:00  │
│                     │
│ [▶ REANUDAR]        │
│ [■ PAUSAR]          │
│ [← SALIR]           │
└─────────────────────┘

MODAL ÍNDICE (al hacer click en 📑):
┌──────────────────────┐
│ Buscar: [_________]  │
├──────────────────────┤
│ ▼ Capítulo 1        │
│   - Sección 1.1     │
│   - Sección 1.2     │
│ ▼ Capítulo 2        │
│   - Sección 2.1     │
│   ...               │
│                      │
│     [Cerrar]         │
└──────────────────────┘
```

---

## 💾 ALMACENAMIENTO DE DATOS

### **Backend - SQLite (library.db)**
```
users
├─ id, username, password (bcrypt), isDeveloper
└─ Índice en username (único)

reading_progress
├─ id, userId, bookFile, currentCFI, progress, totalPages, currentPage, lastRead
└─ Índices en: userId, bookFile, (userId + bookFile)

user_preferences
├─ id, userId, fontSize, lineHeight, theme, font, brightness
└─ Foreign key a users
```

### **Frontend - localStorage**
```
authToken: "eyJhbGciOiJIUzI1NiIs..."

userData: {
  "id": 1,
  "username": "admin",
  "isDeveloper": true
}

userPreferences: {
  "fontSize": 100,
  "lineHeight": 1.45,
  "theme": "light",
  "font": "original",
  "brightness": 1.0
}

readingProgress_[bookname]: {
  "bookFile": "Harry_Potter.epub",
  "currentCFI": "/2/4!/4[...",
  "progress": 0.25,
  "totalPages": 450,
  "currentPage": 112
}
```

---

## 🔐 SEGURIDAD

**Autenticación:**
- ✅ JWT tokens en header `Authorization: Bearer <token>`
- ✅ Contraseñas hasheadas con bcryptjs
- ✅ Validación de entrada (3-50 caracteres username, 3-100 password)

**Endpoints Protegidos:**
- `/api/user` - Requiere token
- `/api/libros` - Requiere token
- `/api/reading-progress` - Requiere token
- `/api/user-preferences` - Requiere token
- `/api/users` - Requiere token + isDeveloper=true

**Variables Sensibles:**
- JWT_SECRET (cambiar en producción)
- BD credentials (usar variables de entorno)

---

## 🚀 FLUJO DE DESARROLLO

### **Para Agregar Nueva Funcionalidad:**

1. **Backend (server.js)**
   - Crear nueva ruta en `/api/nueva-funcionalidad`
   - Agregar validación y autenticación
   - Interactuar con BD si es necesario

2. **Frontend (React)**
   - Crear/modificar componente si es necesario
   - Llamar a endpoint usando `fetch()`
   - Actualizar estado con `useState()`
   - Agregar estilos en CSS correspondiente

3. **Configuración**
   - Agregar constantes en `config.js` si es global
   - Agregar endpoints en `src/api-config.js`

4. **Testing**
   - `npm run build` - Compilar React
   - `npm start` - Iniciar servidor
   - Probar en navegador

---

## 📊 RESUMEN DE LÍNEAS DE CÓDIGO

| Archivo | Líneas | Propósito |
|---------|--------|----------|
| Lector.js | 1280 | Lector EPUB + UI principal |
| server.js | 884 | Backend Express + WebSocket |
| lector.css | 2000+ | Estilos lector + temas |
| biblioteca.css | 1064 | Grid de libros responsive |
| biblioteca.js | 489 | Componente biblioteca |
| App.js | 214 | Login y autenticación |
| useGazeHighlight.js | 203 | Hook resaltado ocular |
| useGazepoint.js | 119 | Hook WebSocket Gazepoint |
| **TOTAL** | **~7250** | **Aplicación completa** |

---

## 🎯 FUNCIONALIDADES PRINCIPALES POR ARCHIVO

### **App.js** - Login y Autenticación
```
FUNCIONALIDADES:
✅ Formulario de login (usuario/contraseña)
✅ Validación de credenciales con servidor
✅ Generación de JWT token
✅ Almacenamiento de sesión (localStorage)
✅ Recuperación automática de sesión existente
✅ Validación de token con /api/user
✅ Manejo de errores y mensajes
✅ Animaciones de transición (entrada/salida)
✅ Logout seguro (limpiar token y userData)
✅ Spinner de carga durante login

ESTADOS MANEJADOS:
- usuario: string
- contrasena: string
- cargando: boolean
- error: boolean
- loginExitoso: boolean
- userData: { id, username, isDeveloper }
- checkingSession: boolean (validación inicial)

FLUJO:
1. Verifica token en localStorage al montar
2. Valida con GET /api/user
3. Si válido: renderiza Biblioteca
4. Si inválido: renderiza formulario login
5. Usuario ingresa credenciales
6. POST /api/login
7. Si válido: guarda token y userData
8. Renderiza Biblioteca

ESTILOS:
- App.css: Formulario, botones, animaciones
- Colores: #5C6BC0 (primary), #FF6B9D (error)
- Efecto flip de página (loginExitoso)
```

---

### **biblioteca.js** - Catálogo de Libros
```
FUNCIONALIDADES:
✅ Carga 6 libros por página desde servidor
✅ Extracción automática de portadas (EPUB → imagen)
✅ Grid responsive (2x3 en desktop, 2x2 tablet, 1x2 mobile)
✅ Navegación circular entre páginas
✅ 3 papalotes aleatorios en última fila (sin repetir)
✅ Animaciones hover en libros
✅ Click en libro abre Lector
✅ Selector de tema (light/sepia/dark)
✅ Panel desarrollador (CRUD usuarios)
✅ Logout con confirmación
✅ Mostrar "Cargando portadas..." durante extracción

ESTADOS MANEJADOS:
- libros: array de archivos EPUB
- portadas: array de images URLs
- paginaActual: number
- libroSeleccionado: string (archivo EPUB)
- cargandoPortadas: boolean
- paginationInfo: { totalPaginas, paginaActual }
- papalotesAleatorios: array[3] de imagen URLs
- nubeActiva: string para hover animation
- deslizarDireccion: 'izq' | 'der' para transición

FUNCIONALIDADES DESARROLLADOR:
- GET /api/users - Listar todos usuarios
- POST /api/users - Crear usuario
- PUT /api/users/:id - Editar usuario
- DELETE /api/users/:id - Eliminar usuario
- Validación isDeveloper en frontend

GENERADOR PAPALOTES:
- generarPapalotesAleatorios()
- Selecciona 3 de 6 imágenes sin repetir
- Se regeneran cada vez que cambia de página
- Aplicadas a items 3, 4, 5 (última fila)

ESTILOS:
- biblioteca.css: Grid, nube, papalotes, animaciones
- Breakpoints: 1024px, 768px, 480px
- Fondo: Gradiente 2/3 blanco + 1/3 azul
```

---

### **Lector.js** - Lector de EPUB ⭐
```
FUNCIONALIDADES PRINCIPALES:
📖 LECTURA:
  ✅ Renderizar EPUB con epubjs
  ✅ Navegación anterior/siguiente
  ✅ Contador de páginas (actualizado cada 300ms)
  ✅ Guardado automático de progreso (debounced 2s)
  ✅ Recuperación de página anterior al abrir
  ✅ Cálculo automático de total de páginas
  ✅ Barra de progreso visual (0-100%)
  ✅ Prevención de "white flash" al cambiar página

⚙️ PREFERENCIAS DE LECTURA:
  ✅ Tamaño fuente: 80% a 120%
  ✅ Altura línea: 1.2 a 2.0
  ✅ Tema: Light (blanco), Sepia (papel), Dark (#0b0c0c)
  ✅ Fuente: Original, Dyslexia, Georgia
  ✅ Brillo: 80% a 120%
  ✅ Aplicación dinámica (sin recargar)
  ✅ Guardado en servidor + localStorage
  ✅ Recuperación automática próxima sesión

📑 ÍNDICE NAVEGABLE:
  ✅ Listado jerárquico de capítulos/secciones
  ✅ Búsqueda en tiempo real
  ✅ Click para saltar a sección
  ✅ Sincronización con página actual
  ✅ Modal con scroll

🎥 GRABACIÓN DE SESIÓN:
  ✅ Inicia/pausa grabación con cámara (MediaRecorder)
  ✅ Guarda video en servidor
  ✅ Sincroniza con bloques de lectura
  ✅ Muestra estado grabación

👁️ SEGUIMIENTO OCULAR (GAZEPOINT):
  ✅ Conexión WebSocket a Gazepoint
  ✅ Resaltado en tiempo real de palabras
  ✅ Toggle para activar/desactivar
  ✅ Indicador de conexión
  ✅ Graceful fallback si no está disponible

📊 BLOQUES DE LECTURA:
  ✅ Sistema de 5 bloques de 5 minutos (25 min total)
  ✅ Timer en pantalla con cuenta regresiva
  ✅ Modal de progreso y controles
  ✅ Pausa/reanudación de sesión
  ✅ Almacenamiento de datos de bloques
  ✅ Posicionamiento flexible del timer

ESTADOS MANEJADOS:
- ready: boolean
- isLoading: boolean
- currentPage, totalPages: number
- progress: 0-100
- bookTitle: string
- prefs: { fontSize, lineHeight, theme, font, brightness }
- showSettings, settingsTab: UI state
- showIndexModal: boolean
- isRecording, isPaused: boolean
- enableGazeHighlight: boolean
- currentBlock, blockTimer: number
- showBlockModal: boolean

HOOKS PERSONALIZADOS USADOS:
- useGazepoint(): { isConnected, startRecording, stopRecording }
- useGazeHighlight(viewerRef, enabled): null

FUNCIONES PRINCIPALES:
- goNext(): Navegar a siguiente página
- goPrev(): Navegar a página anterior
- applyPrefsToBook(): Aplicar ajustes al EPUB (CSS)
- saveReadingProgress(): Guardar progreso en servidor
- loadReadingProgress(): Cargar progreso guardado
- startRecording(): Iniciar grabación cámara + Gazepoint
- pauseRecording(): Pausar grabación
- resumeRecording(): Reanudar grabación

CONSTANTES IMPORTANTES:
- PROGRESS_SAVE_DEBOUNCE_MS: 2000
- SKIP_RELOCATION_FLAG_TIMEOUT_MS: 300
- RETRY_MAX_ATTEMPTS: 2
- RETRY_BASE_DELAY_MS: 500
- MIN_PAGES_ESTIMATE: 100

ESTILOS DINÁMICOS:
- Fondo por tema: white (light), #F5DEB3 (sepia), #0b0c0c (dark)
- Transiciones suaves: 0.15s
- Texto por tema: colores adaptados
- Barras (header/footer) adaptan a tema
```

---

### **useGazepoint.js** - Hook WebSocket Gazepoint
```
PROPÓSITO:
Gestionar conexión WebSocket con servidor Gazepoint
Enviar comandos de inicio/parada de grabación
Recibir eventos de conexión/desconexión

FUNCIONALIDADES:
✅ Conexión automática a ws://localhost:3000
✅ Reconexión con backoff exponencial (500ms a 15s)
✅ Manejo seguro de ciclo de vida
✅ Cleanup al desmontar componente

ESTADOS:
- isConnected: boolean

MÉTODOS:
- startRecording(sessionId?): Envía START_RECORDING
- stopRecording(): Envía STOP_RECORDING

MENSAJE ENVIADO:
{
  type: 'START_RECORDING',
  timestamp: '2025-12-09T...',
  sessionId: 'timestamp-sin-caracteres-especiales'
}

USO:
const { isConnected, startRecording, stopRecording } = useGazepoint();

// En Lector.js:
if (isRecording) startRecording(blockStartTime.current);
if (!isRecording) stopRecording();
```

---

### **useGazeHighlight.js** - Hook Resaltado Ocular
```
PROPÓSITO:
Resaltar palabras en el EPUB según la dirección de la mirada
Procesar datos de eye-tracking en tiempo real
Mostrar feedback visual al usuario

FUNCIONALIDADES:
✅ Conexión a ws://localhost:3001
✅ Buffer circular de datos (500ms)
✅ Filtrado y promediado de punto de mirada
✅ Detección de fijación (varianza < 100px)
✅ Búsqueda de palabra en coordenadas
✅ Resaltado dinámico con <u> tag
✅ Auto-remueve highlight después 500ms
✅ Manejo seguro de DOM en iframe

FLUJO DE PROCESAMIENTO:
1. Recibe datos (x, y) del WebSocket
2. Agrega a buffer circular
3. Limpia puntos más antiguos de 500ms
4. Con ≥5 puntos: calcula promedio
5. Calcula varianza (dispersión)
6. Si varianza < 100: busca palabra en (avgX, avgY)
7. Usa elementFromPoint() para buscar nodo
8. Extrae palabra completa
9. Crea <u> con subrayado ondulado
10. Reemplaza en DOM del iframe
11. Timer para remover después 500ms

PARÁMETROS:
- iframeRef: React.useRef(null) - referencia al iframe
- isEnabled: boolean - activar/desactivar resaltado

USO:
useGazeHighlight(viewerRef, enableGazeHighlight && gazeConnected);

ESTILOS APLICADOS:
- textDecoration: 'underline wavy #5bd8cf'
- textDecorationThickness: '2px'
- textUnderlineOffset: '4px'
- color: inherit
```

---

### **gazepoint-server.js** - Servidor Gazepoint
```
PROPÓSITO:
Puente TCP/IP entre hardware Gazepoint y navegador web
Convertir datos XML a JSON para navegador
Grabar sesiones de seguimiento ocular

CONFIGURACIÓN:
- WS_PORT: 4000 (WebSocket para navegadores)
- GP_HOST: 192.168.56.1 (máquina con Gazepoint)
- GP_PORT: 4242 (conexión TCP a Gazepoint)

FUNCIONALIDADES:
✅ Conexión TCP a Gazepoint
✅ Parsing de XML a JSON
✅ WebSocket server para múltiples clientes
✅ Broadcasting en tiempo real
✅ Grabación de sesiones (CSV + raw XML)
✅ Reconexión automática con backoff
✅ Manejo de errores silencioso

COMANDOS ENVIADOS A GAZEPOINT:
<SET ID="ENABLE_SEND_DATA" STATE="1" />          // Enviar datos
<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />       // POG (Point of Gaze)
<SET ID="ENABLE_SEND_TIME" STATE="1" />          // Timestamp
<SET ID="ENABLE_SEND_PUPILDATA" STATE="1" />     // Tamaño pupila

DATOS PARSEADOS (XML → JSON):
Entrada: <REC LFPOGX="512.5" LFPOGY="384.2" ... />
Salida:
{
  type: 'GAZEPOINT_DATA',
  leftEye: { x: 512.5, y: 384.2 },
  rightEye: { x: 510.3, y: 382.8 },
  ts: 1702182000000
}

GESTIÓN DE SESIONES:
- Recibe: { type: 'START_RECORDING', sessionId: '...' }
- Crea: sessionId.txt (CSV) y sessionId.xml (raw)
- Escribe: cada punto de mirada en archivos
- Recibe: { type: 'STOP_RECORDING' }
- Cierra: archivos y streams

RECONEXIÓN:
Intento 1: 1s
Intento 2: 2s
Intento 3: 4s
Intento 4: 8s
Intento 5: 16s
Intento 6+: 30s (máximo)

CLIENTES CONECTADOS:
- useGazepoint hook (control de grabación)
- useGazeHighlight hook (datos en tiempo real)
```

---

### **server.js** - Servidor Express Principal
```
FUNCIONALIDADES:
✅ Autenticación (POST /api/login)
✅ Validación de sesión (GET /api/user)
✅ CRUD de libros (GET /api/libros)
✅ Guardado de progreso (GET/POST /api/reading-progress)
✅ Preferencias de usuario (GET/POST /api/user-preferences)
✅ Gestión de usuarios (GET/POST/PUT/DELETE /api/users)
✅ WebSocket Gazepoint (control + broadcast)
✅ Sirviendo frontend React (archivos estáticos)
✅ Manejo de errores estandarizado
✅ Validación de entrada

ENDPOINTS PRINCIPALES:

POST /api/login
  - Entrada: { username, password }
  - Salida: { token, user: { id, username, isDeveloper } }
  - Validación: username 3-50 chars, password 3-100 chars

GET /api/user
  - Header: Authorization: Bearer <token>
  - Salida: { id, username, isDeveloper }

GET /api/libros?page=0
  - Header: Authorization: Bearer <token>
  - Salida: { libros: [...], paginaActual, totalPaginas }

POST /api/reading-progress
  - Body: { bookFile, currentCFI, progress, totalPages, currentPage }
  - Salida: { success: true }

GET /api/reading-progress/:bookFile
  - Header: Authorization: Bearer <token>
  - Salida: { currentCFI, progress, totalPages, currentPage }

POST /api/user-preferences
  - Body: { fontSize, lineHeight, theme, font, brightness }
  - Salida: { preferences: {...} }

GET /api/users
  - Header: Authorization: Bearer <token>, isDeveloper: true
  - Salida: [{ id, username, isDeveloper }]

POST /api/users
  - Header: Authorization: Bearer <token>, isDeveloper: true
  - Body: { username, password, isDeveloper }
  - Salida: { id, username }

WebSocket (/api/gazepoint)
  - Conexión para Gazepoint data
  - Broadcast a todos los clientes
  - Control: START_RECORDING, STOP_RECORDING
```

---

### **config.js** - Configuración Centralizada
```
PROPÓSITO:
Centralizar configuración de desarrollo/producción
Permitir override por variables de entorno

VARIABLES CONFIGURABLES:
- PORT: Puerto servidor (default 3000)
- JWT_SECRET: Clave para firmar tokens
- DEFAULT_ADMIN: Credenciales por defecto
- PROGRESS_SAVE: Configuración debounce
- DATABASE: Rutas y timeouts
- VALIDATION: Reglas de validación

USAR VARIABLES DE ENTORNO:
PORT=8080 npm start
JWT_SECRET=mi-secreto-seguro npm start
```

---

### **db/init-db.js** - Base de Datos SQLite
```
PROPÓSITO:
Inicializar schema de SQLite
Crear índices para optimización
Gestionar conexión a DB

TABLAS:

users:
  - id: PRIMARY KEY
  - username: TEXT UNIQUE NOT NULL
  - password: TEXT NOT NULL (hasheada con bcryptjs)
  - isDeveloper: BOOLEAN DEFAULT 0

reading_progress:
  - id: PRIMARY KEY
  - userId: INTEGER NOT NULL
  - bookFile: TEXT NOT NULL
  - currentCFI: TEXT (EPUB location format)
  - progress: REAL (0.0-1.0)
  - totalPages: INTEGER
  - currentPage: INTEGER
  - lastRead: DATETIME

user_preferences:
  - id: PRIMARY KEY
  - userId: INTEGER UNIQUE
  - fontSize: INTEGER (80-120)
  - lineHeight: REAL (1.2-2.0)
  - theme: TEXT ('light', 'sepia', 'dark')
  - font: TEXT ('original', 'dyslexia', 'georgia')
  - brightness: REAL (0.8-1.2)

ÍNDICES (Optimización):
- idx_reading_progress_userId
- idx_reading_progress_bookFile
- idx_reading_progress_userId_bookFile
```

---

## 🎨 DIAGRAMA DE INTEGRACIONES GAZEPOINT

### **Arquitectura Completa Eye-Tracking**

```
┌─────────────────────────────────────────────────────────────┐
│  1. HARDWARE GAZEPOINT (Eye-tracker)                        │
│     Ubicación: Máquina local 192.168.56.1:4242            │
│     - Captura mirada izq/der en tiempo real (30Hz)         │
│     - Envía datos XML por TCP                              │
└────────────────┬────────────────────────────────────────────┘
                 │ TCP Socket
                 │ XML: <REC LFPOGX="..." LFPOGY="..." .../>
                 │
┌────────────────▼────────────────────────────────────────────┐
│  2. gazepoint-server.js (Node.js - Puente)                 │
│     Puerto WebSocket: 4000                                 │
│     ├─ Lee XML de Gazepoint                                │
│     ├─ Parsea a JSON                                       │
│     ├─ Graba sesiones (CSV + raw XML)                      │
│     └─ WebSocket broadcast a todos los clientes            │
│                                                             │
│     Flujo Grabación:                                       │
│     START_RECORDING → crear archivos                       │
│     GAZEPOINT_DATA → escribir en CSV/XML                   │
│     STOP_RECORDING → cerrar archivos                       │
└────────────────┬────────────────────────────────────────────┘
                 │ WebSocket (JSON)
                 │ { type: 'GAZEPOINT_DATA', 
                 │   leftEye: {x,y}, rightEye: {x,y} }
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────────────┐ ┌──────▼──────────────────┐
│ 3. useGazepoint     │ │ 4. useGazeHighlight    │
│    (Hook)            │ │    (Hook)               │
│                      │ │                         │
│ ws://localhost:3000  │ │ ws://localhost:3001    │
│ ├─ Conecta WS        │ │ ├─ Conecta WS           │
│ ├─ Reconexión auto   │ │ ├─ Buffer de datos      │
│ ├─ START_RECORDING   │ │ ├─ Detección fijación   │
│ ├─ STOP_RECORDING    │ │ ├─ elementFromPoint()   │
│ └─ Retorna estado    │ │ └─ Resalta palabras     │
└───────┬──────────────┘ └──────┬──────────────────┘
        │                       │
        │                       └──► DOM iframe EPUB
        │                            <u> subrayado
        │                            color: #5bd8cf
        │
        └──► Lector.js
             ├─ Muestra "Conectado" / "Desconectado"
             ├─ Botón "Grabar sesión"
             ├─ Toggle "Resaltado ocular"
             └─ Timer bloques de lectura
```

### **Flujo de Una Sesión de Grabación Completa**

```
ESTADO INICIAL:
- Lector.js cargado
- useGazepoint() conectado a ws://localhost:3000
- useGazeHighlight() esperando enableGazeHighlight=true
- Button "Grabar sesión" visible

USUARIO HACE CLICK EN "GRABAR":
1. setIsRecording(true)
2. startRecording() de useGazepoint
   ├─ Envía: { type: 'START_RECORDING', sessionId: '...' }
   └─ gazepoint-server.js recibe comando
3. gazepoint-server.js:
   ├─ Crea archivo: sessionId.txt (CSV header)
   ├─ Crea archivo: sessionId.xml (raw)
   └─ Inicia grabación de datos
4. setCurrentBlock(1) - Inicia bloque 1
5. Abre modal "Bloque 1 de 5"

DURANTE LECTURA (30 segundos en ejemplo):
- Hardware Gazepoint envía datos (30 Hz)
- gazepoint-server.js recibe datos
- gazepoint-server.js escribe en archivos
- gazepoint-server.js broadcast a navegador
- useGazeHighlight recibe datos
- Procesa buffer circular (últimos 500ms)
- Si detecta fijación: resalta palabra
- Resaltado se remueve después 500ms
- Lector.js actualiza timer (00:30/05:00)

USUARIO CAMBIA DE PÁGINA:
- goNext() / goPrev() se ejecuta
- applyPrefsToBook() reaplica estilos
- blockTimer continúa (sincronizado)
- Grabación continúa (no se detiene)

BLOQUE TERMINA (5 minutos):
- blockTimer llega a 00:00
- Modal muestra "Bloque 1 completado"
- Button para iniciar Bloque 2
- Grabación sigue activa

USUARIO HACE CLICK EN "PAUSAR":
- setIsPaused(true)
- blockTimer se congela
- Button cambia a "REANUDAR"

USUARIO HACE CLICK EN "REANUDAR":
- setIsPaused(false)
- blockTimer continúa

USUARIO TERMINA (al llegar a bloque 5 o hacer click X):
- setIsRecording(false)
- stopRecording() de useGazepoint
  ├─ Envía: { type: 'STOP_RECORDING' }
  └─ gazepoint-server.js recibe comando
- gazepoint-server.js:
  ├─ Cierra archivo sessionId.txt
  ├─ Cierra archivo sessionId.xml
  └─ Finaliza grabación
- Modal se cierra
- Button "Grabar sesión" vuelve a estar activo

ARCHIVOS GUARDADOS EN SERVIDOR:
- /recordings/sessionId.txt (CSV con 5 columnas)
  LFPOGX,LFPOGY,RFPOGX,RFPOGY,timestamp
  512.5,384.2,510.3,382.8,2025-12-09T14:30:00Z
  ...

- /recordings/sessionId.xml (XML bruto)
  <REC LFPOGX="512.5" LFPOGY="384.2" ... />
  ...
```

### **Elementos de UI Relacionados con Gazepoint**

En **Lector.js**:

```
HEADER:
┌─────────────────────────────────────────────────────────┐
│ [←] "Titulo Libro" [⚙] [🎥] [👁️] [📑] [X]             │
│                          ▲     ▲                        │
│                    Grabar  Gazepoint                    │
│                    Sesión  Eye-tracking                │
└─────────────────────────────────────────────────────────┘

FOOTER:
┌─────────────────────────────────────────────────────────┐
│ [←] Pág 45/250 [→]  ███████░░░░░░░░░░░░░░░░░░░  18%   │
│ [Grabando...] 02:45/05:00 [│][⏸][▶] [Bloque 1/5]      │
└─────────────────────────────────────────────────────────┘

POPOVER AJUSTES (click en ⚙):
┌──────────────────────────────┐
│ TEXTO | TEMA | GAZEPOINT     │
├──────────────────────────────┤
│ ...                          │
│                              │
│ [🟢 Conectado] ← Estado real │
│                              │
│ [✓] Resaltar palabras        │
│     (solo si conectado)      │
│                              │
│ Info: Si desactivas Gazepoint│
│       el resaltado se detiene│
└──────────────────────────────┘

MODAL BLOQUES (click en contador o [🎥]):
┌──────────────────────────────┐
│ BLOQUE 2 DE 5                │
├──────────────────────────────┤
│                              │
│   ⏱️  02:45 / 05:00         │
│                              │
│   [Grabando con Gazepoint]   │
│   [🟢 Conectado]            │
│                              │
│  [│ PAUSAR]  [▶ REANUDAR]    │
│  [← SALIR]                   │
│                              │
│ Datos de ojo-tracking        │
│ se guardan en servidor       │
└──────────────────────────────┘
```

---

1. **Servidor Unificado:** Express sirve tanto API REST como archivos estáticos de React
2. **Temas Dinámicos:** Los temas se aplican al iframe del EPUB dinámicamente (sin recargar)
3. **WebSockets:** Se usan para conexión en tiempo real con Gazepoint
4. **Progreso Persistente:** Se guarda en servidor + localStorage (redundancia)
5. **Papalotes:** 6 imágenes, se seleccionan 3 aleatorias por página, sin repetir
6. **Page Counter:** Basado en CFI de epubjs, actualizado cada 300ms
7. **Bloques de Lectura:** Sistema de sesiones de 5 minutos (hasta 5 bloques)

---

## 📊 MATRIZ DE FUNCIONALIDADES POR ARCHIVO

| Funcionalidad | App.js | biblioteca.js | Lector.js | useGazepoint | useGazeHighlight | gazepoint-server | server.js | config.js |
|---|---|---|---|---|---|---|---|---|
| **Autenticación** | ✅ | - | - | - | - | - | ✅ | ✅ |
| **Catálogo Libros** | - | ✅ | - | - | - | - | ✅ | - |
| **Lectura EPUB** | - | - | ✅ | - | - | - | - | - |
| **Navegación Páginas** | - | - | ✅ | - | - | - | - | - |
| **Preferencias (Tema/Fuente/etc)** | - | ✅ | ✅ | - | - | - | ✅ | - |
| **Guardado Progreso** | - | - | ✅ | - | - | - | ✅ | ✅ |
| **Índice Navegable** | - | - | ✅ | - | - | - | - | - |
| **Grabación Cámara** | - | - | ✅ | - | - | - | - | - |
| **Bloques de Lectura** | - | - | ✅ | - | - | - | - | ✅ |
| **Conexión Gazepoint** | - | - | - | ✅ | ✅ | ✅ | - | - |
| **Control Grabación Session** | - | - | ✅ | ✅ | - | ✅ | - | - |
| **Resaltado Palabras (Eye-gaze)** | - | - | - | - | ✅ | ✅ | - | - |
| **Persistencia BD** | - | - | - | - | - | - | ✅ | - |
| **CRUD Usuarios** | - | ✅ | - | - | - | - | ✅ | - |

---

## 🔍 BUSQUEDA DE FUNCIONALIDADES

Si necesitas encontrar una funcionalidad:

1. **Lectura de EPUB** → `src/Lector.js` + `src/lector.css`
2. **Cambiar tema (light/sepia/dark)** → `src/Lector.js` (applyPrefsToBook) + `src/lector.css`
3. **Aumentar tamaño fuente** → `src/Lector.js` (prefs.fontSize)
4. **Navegar a capítulo específico** → `src/Lector.js` (showIndexModal)
5. **Grabar sesión con cámara** → `src/Lector.js` (isRecording + MediaRecorder)
6. **Resaltar palabras según mirada** → `src/hooks/useGazeHighlight.js`
7. **Eye-tracking en tiempo real** → `src/hooks/useGazepoint.js` + `server/gazepoint-server.js`
8. **Listar libros** → `src/biblioteca.js` + `server.js` (/api/libros)
9. **Login** → `src/App.js` + `server.js` (/api/login)
10. **Papalotes aleatorios** → `src/biblioteca.js` (generarPapalotesAleatorios)
11. **Contador de páginas** → `src/Lector.js` (currentPage, totalPages)
12. **Guardar progreso** → `src/Lector.js` (saveReadingProgress) + `server.js` (/api/reading-progress)
13. **Gestionar usuarios (admin)** → `src/biblioteca.js` (panel dev) + `server.js` (/api/users)
14. **Base de datos** → `db/init-db.js`
15. **Configuración centralizada** → `config.js`

---

## 🚀 GUÍA RÁPIDA DE DESARROLLO

### Para Agregar Nueva Funcionalidad:

**1. BACKEND (server.js)**
```javascript
// Crear nueva ruta
app.post('/api/nueva-funcionalidad', authenticateToken, (req, res) => {
  // Validar entrada
  // Interactuar con DB si es necesario
  // Retornar respuesta JSON
  res.json({ success: true, data: {...} });
});
```

**2. FRONTEND (React component)**
```javascript
// Crear/modificar componente
function MiComponente() {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Llamar a endpoint
    fetch('http://localhost:3000/api/nueva-funcionalidad', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setState(data));
  }, []);
  
  return <div>{/* JSX */}</div>;
}
```

**3. ESTILOS (CSS)**
```css
/* Agregar clases si es necesario */
.MiComponente {
  /* estilos */
}

/* Temas dinámicos */
body.light-theme .MiComponente { /* estilos light */ }
body.sepia-theme .MiComponente { /* estilos sepia */ }
body.dark-theme .MiComponente { /* estilos dark */ }
```

**4. TESTING**
```bash
npm run build    # Compilar React
npm start        # Iniciar servidor
# Probar en navegador
```

---

## 📈 ESTADÍSTICAS DE CÓDIGO

```
Total de líneas: ~7,250

FRONTEND (React):
- Componentes: 3 principales (App, biblioteca, Lector)
- Hooks personalizados: 2 (useGazepoint, useGazeHighlight)
- CSS: ~3,000+ líneas (responsivo + temas)

BACKEND (Node.js):
- server.js: 884 líneas
- gazepoint-server.js: 150 líneas
- config.js: 59 líneas
- db/init-db.js: 60+ líneas

BASE DE DATOS:
- SQLite con 3 tablas (users, reading_progress, user_preferences)
- 3 índices de optimización

DOCUMENTACIÓN:
- MAPEO_ARCHIVOS.md: Este documento (1,500+ líneas)
```

---

**Última actualización:** Diciembre 9, 2025  
**Proyecto:** Asistente de Lectura ADL  
**Versión:** v2.1  
**Completitud:** 100% (Todos los archivos y funcionalidades documentados)
