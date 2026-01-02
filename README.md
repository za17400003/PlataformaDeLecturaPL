# 📚 BIBLIOTECA DIGITAL CON SISTEMA DE EXPERIMENTOS DE LECTURA

**Plataforma integral web de lectura de libros digitales (EPUB) con autenticación institucional, gestión de experimentos de lectura multibloque y captura de datos biomecánicos (eye-tracking, cámara, temporizador).**

**Estado**: ✅ Production Ready | **Versión**: 2.2 | **Última actualización**: Enero 2026

---

## 🎯 VISIÓN GENERAL

Sistema completo que integra:
- ✅ **Autenticación segura** con validación de email institucional, JWT y bcrypt
- ✅ **Biblioteca digital** de libros EPUB con catálogo paginado y búsqueda
- ✅ **Lector avanzado** con persistencia de progreso, preferencias personalizadas y marcadores
- ✅ **Sistema de experimentos jerárquico** (Experimento → Bloques → Estímulos → Datos)
- ✅ **Modo experimento** con timer automático, SPACEBAR global, transiciones entre bloques
- ✅ **Captura de datos** (eye-tracking Gazepoint desde Python, cámara web, progreso de lectura, timestamps)
- ✅ **Visualización de resultados** fullscreen con detalles de ejecución
- ✅ **Seguridad en capas** (JWT, bcrypt, validaciones, parametrized queries, rate limiting)
- ✅ **Responsivo** (desktop, tablet, mobile)

---

## 🚀 INICIO RÁPIDO

### 1. Instalación (2 minutos)

```bash
git clone <repo>
cd c:\Users\woire\adl
npm install
```

### 2. Configuración (5 minutos)

**Variables de entorno (.env):**
```
PORT=3000
JWT_SECRET=tu-secret-aleatorio-32-caracteres
ADMIN_USERNAME=admin
ADMIN_PASSWORD=123

EMAIL_SERVICE=gmail
EMAIL_USER=tu-email@gmail.com
EMAIL_PASSWORD=contraseña-app-16-caracteres
EMAIL_FROM=noreply@bibliotecadigital.com
VERIFICATION_URL=http://localhost:3000

CORS_ORIGIN=http://localhost:3000
```

### 3. Inicializar BD (primera ejecución)

```bash
npm run init-db    # Crea tablas
npm run seed-admin # Crea usuario admin
```

### 4. Ejecución

```bash
npm start  # Backend + Frontend en puerto 3000
```

### 5. Acceso

- Frontend: http://localhost:3000
- API: http://localhost:3000/api
- Python Gazepoint Service: http://localhost:5000 (próximamente)

**Credenciales de prueba:**
- Usuario: `esau`
- Contraseña: `esau123`

---

## 📁 ESTRUCTURA DEL PROYECTO

```
c:\Users\woire\adl/
├── src/                          # React components
│   ├── App.js                    # Gestor sesión + ruteo
│   ├── index.js                  # Entry point
│   ├── biblioteca.js             # Catálogo de libros (572 líneas)
│   ├── biblioteca.css            # Estilos biblioteca
│   ├── Lector.js                 # Lector EPUB avanzado (1365+ líneas)
│   ├── lector.css                # Estilos lector
│   ├── ExperimentRunner.js       # Ejecutor de experimentos (750+ líneas)
│   ├── ExperimentRunner.css      # Estilos experimentos
│   ├── ConfigurarExperimentos.js # CRUD experimentos (829 líneas)
│   ├── ConfigurarExperimentos.css # Estilos configuración
│   ├── RegistroPopover.js        # Formulario registro
│   └── VerifyEmail.js            # Email verification
├── public/                       # Assets estáticos
│   ├── libros/                   # Archivos EPUB
│   └── index.html
├── db/                           # Scripts base de datos
│   ├── init-db.js                # Crear tablas
│   ├── add-experiment-runs.js    # Agregar tablas experimentos
│   ├── seed-admin.js             # Crear admin
│   └── users.db                  # SQLite (generado)
├── server.js                     # Backend Express (1800+ líneas)
├── start.js                      # Launcher
├── package.json
└── README.md
```

---

## 🔐 AUTENTICACIÓN Y SEGURIDAD

### Flujo de Registro
1. Usuario completa formulario (usuario, email institucional, contraseña)
2. **Validación cliente**: email debe ser `@zapopan.tecmm.edu.mx` o `@cicese.mx`
3. **Validación servidor**: dominio whitelist
4. Contraseña hash con **bcrypt** (10 salt rounds)
5. Email verificación con token de 32 bytes (one-time use)
6. Usuario verifica email (link válido 24h)
7. Sesión JWT creada (expira medianoche)

### Seguridad Implementada
- ✅ **Parametrized queries** (prevenir SQL injection)
- ✅ **bcrypt hashing** (contraseñas nunca en plaintext)
- ✅ **JWT tokens** con secret rotatorio
- ✅ **Email verification** (prevenir spam)
- ✅ **Rate limiting** (login: 5 intentos/15min)
- ✅ **HTTPS ready** (sin keys hardcodeadas)
- ✅ **CORS configurado** (origin whitelist)
- ✅ **Validación input** (cliente + servidor)

**Endpoints de Autenticación:**
```
POST   /api/register              Registro nuevo usuario
POST   /api/verify-email/:token   Verificar email
POST   /api/login                 Login
POST   /api/logout                Logout
GET    /api/me                    Perfil usuario
PUT    /api/user/preferences      Guardar preferencias
```

---

## 📚 BIBLIOTECA DIGITAL

### Componente `biblioteca.js` (572 líneas)

**Características:**
- 📖 Catálogo de 30+ libros EPUB
- 🔄 Paginación circular (6 libros por página en grid 3×2)
- 📊 Extracción automática de portadas desde metadatos EPUB
- ☁️ Fondo degradado (blanco → azul #4BA5E8)
- 🎨 Selector de tema (Light/Sepia/Dark) persistente
- 🌓 Papalotes decorativos animados (aleatorios)
- 👨‍💻 Panel desarrollador (CRUD usuarios, solo admin)
- ⚙️ Botón "Configurar Experimentos" (solo propietario)
- 📱 Responsive (3 columnas desktop, 2 tablet, 1 mobile)

**Eventos:**
- Click en libro → abre Lector
- Flechas de navegación → página anterior/siguiente
- Logout → limpia sesión + localStorage
- Botón experimentos → abre ConfigurarExperimentos

**Endpoints:**
```
GET    /api/libros?page=N         Lista paginada (6 libros)
GET    /api/libros/search?q=X     Búsqueda por título
GET    /api/user-preferences      Cargar preferencias
```

---

## 📖 LECTOR EPUB AVANZADO

### Componente `Lector.js` (1365+ líneas)

#### Lectura Normal

**Funcionalidades:**
- 📖 Renderización EPUB con **epubjs** (compatible con todas las versiones)
- ⬅️➡️ Navegación flecha derecha/izquierda (página anterior/siguiente)
- 📍 Índice de capítulos modal con navegación rápida
- 🔢 Contador página actual / total con barra de progreso
- ⌛ Guardado automático de progreso (debounced 2 segundos)
- 🎯 Slider para saltar a página
- 📌 Último progreso persiste en SQLite + localStorage

**Ajustes en vivo** (sin parpadeo white flash):
- 🔤 Tamaño fuente: 80-120% (default 100%)
- 📏 Altura línea: 1.2-2.0 (default 1.45)
- 🎨 Tema: Light/Sepia/Dark (default Light)
- 🔤 Fuente: Original/Dyslexia/Georgia (default Original)
- ☀️ Brillo: 0.8-1.2 (default 1.0)

**Interfaz:**
- ⚙️ Botón settings (Aa) abre modal de ajustes
- ✖️ Botón cerrar (X) vuelve a biblioteca
- Flechas de navegación en bordes laterales (hidden en experimentos)

#### Modo Experimento

**Características únicas:**
- ⏱️ Timer configurable por bloque (cuenta atrás)
- ⌨️ **SPACEBAR global** (funciona sin importar dónde esté el focus)
- 🎮 Detector dual: `e.code === 'Space'` + `e.key === ' '`
- 📄 Pantalla de introducción del bloque (muestra libro + página inicial + duración)
- 🚫 Navegación flechas oculta (no se puede saltar)
- 📍 Carga página inicial configurada automáticamente
- 💾 Guarda automáticamente progreso durante bloque
- 🎥 Captura de cámara web (si está habilitada)
- 👁️ **Eye-tracking con Gazepoint** (manejado desde servicio Python separado)
- 🔴 Indicador visual de estado eye-tracker
- 📊 Al terminar: llama `onBlockComplete()` y muestra pantalla de confirmación

**Datos capturados:**
- Timestamp inicio/fin bloque
- Página inicial y final
- Duración real vs configurada
- Eventos de tecla (SPACEBAR)
- Datos de eye-tracking (enviados desde servicio Python vía API REST)
- Video captura (si habilitada)

**Endpoints:**
```
POST   /api/reading-progress      Guardar progreso
GET    /api/reading-progress/:bookFile  Recuperar progreso
PUT    /api/user/preferences      Actualizar preferencias
GET    /api/libros/portada/:id    Extraer portada EPUB
```

---

## 👁️ INTEGRACIÓN EYE-TRACKING (GAZEPOINT)

### Arquitectura
El sistema de eye-tracking se maneja desde un **servicio Python separado** que:
1. Se conecta directamente al dispositivo Gazepoint (puerto TCP 4242)
2. Captura datos de seguimiento ocular en tiempo real
3. Envía datos al backend Node.js vía API REST (`POST /api/experiment-data`)
4. El frontend muestra indicador visual de estado de conexión

### Ventajas de este enfoque
- ✅ Desacoplamiento: Node.js no depende de conexión Gazepoint
- ✅ Escalabilidad: Múltiples instancias del lector sin conflictos
- ✅ Robustez: Fallos de eye-tracker no afectan la aplicación principal
- ✅ Flexibilidad: Fácil integración con otros eye-trackers

### Configuración Python (próximamente)
```bash
cd gazepoint-service/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python gazepoint_service.py
```

### Variables de entorno (Python)
```
GAZEPOINT_HOST=192.168.56.1
GAZEPOINT_PORT=4242
API_ENDPOINT=http://localhost:3000/api
API_TOKEN=jwt-token
```

---

### Componente `ConfigurarExperimentos.js` (829 líneas)

**Estructura jerárquica:**
```
Experimento
├─ Nombre: "Estudio de Comprensión Lectora"
├─ Descripción: "Experimento de 2 bloques..."
└─ Bloques
   ├─ Bloque 1
   │  ├─ Nombre: "Pre-test"
   │  ├─ Duración: 300 segundos
   │  ├─ Libro: Coraline
   │  ├─ Página inicial: 50
   │  └─ Estímulos
   │     ├─ Vibración: OFF
   │     ├─ Auditorio: ON
   │     ├─ Visual: ON
   │     ├─ Frecuencia: 0.5 Hz
   │     └─ Cruzada: OFF
   │
   └─ Bloque 2
      ├─ Nombre: "Post-test"
      ├─ Duración: 300 segundos
      ├─ Libro: Coraline (mismo o diferente)
      ├─ Página inicial: 100
      └─ Estímulos...
```

**Operaciones CRUD:**
- ➕ Crear experimento nuevo
- ✏️ Editar nombre/descripción
- 🗑️ Eliminar (CASCADE en bloques/estímulos)
- ➕ Agregar bloque (auto-numerado)
- 📋 Clonar bloque (copia estímulos)
- ✏️ Editar bloque (nombre, duración, libro, página)
- 🗑️ Eliminar bloque
- ⚡ Configurar estímulos (7 opciones)
- 📊 Ver resultados históricos
- ▶️ Ejecutar (lanza ExperimentRunner)

**Endpoints (20+):**
```
POST   /api/experiments                   Crear
GET    /api/experiments                   Listar
GET    /api/experiments/:id               Obtener
PUT    /api/experiments/:id               Actualizar
DELETE /api/experiments/:id               Eliminar

POST   /api/experiments/:id/blocks        Crear bloque
PUT    /api/experiments/:id/blocks/:bid   Actualizar bloque
DELETE /api/experiments/:id/blocks/:bid   Eliminar bloque

POST   /api/block-stimuli/:id             Crear estímulos
PUT    /api/block-stimuli/:id             Actualizar estímulos
```

---

## 🎮 EJECUTOR DE EXPERIMENTOS

### Componente `ExperimentRunner.js` (750+ líneas)

**Flujo de ejecución:**
1. **Inicio**: Usuario presiona ▶️ desde ConfigurarExperimentos
2. **Carga**: Se cargan bloques y archivos de libros
3. **Bloque 1**: Pantalla intro (3 segundos) con animación fade-in
   - Muestra: "Iniciando BLOQUE 1 de 2"
   - Nombre del libro: "Coraline - Neil Gaiman"
   - Página inicial: "Página 50 de 112"
   - Duración: "5 minutos"
4. **Lector abierto**: Se carga el libro en la página configurada
5. **SPACEBAR detectado**: Inicia cronómetro
   - Muestra: "00:05:00" → "00:04:59" ... "00:00:00"
   - Se capturan datos iniciales (timestamp, configuración)
6. **Lectura**: Usuario lee durante el tiempo configurado
   - Se guardan posiciones de página automáticamente
   - Si está configurado: captura cámara + eye-tracking
7. **Fin**: Al expirar el tiempo:
   - Se llama `onBlockComplete()`
   - Se guardan datos de cierre
   - Se muestra pantalla de confirmación
8. **Transición**: El sistema detecta automáticamente:
   - ¿Siguiente bloque usa otro libro? → Cierra lector, muestra intro nuevo bloque
   - ¿Mismo libro? → Mantiene lector abierto, salta a página configurada
9. **Siguiente bloque**: Repite del paso 3-8
10. **Fin experimento**: Cuando no hay más bloques:
    - Muestra pantalla final con opciones:
      - ✅ Repetir experimento
      - 📊 Ver resultados
      - ❌ Cerrar

**Estados gestionados:**
- `showBlockIntro` - Pantalla de inicio (3s)
- `showLector` - Lector abierto
- `showConfirmation` - Pantalla entre bloques
- `showFinalScreen` - Pantalla final (repetir/resultados/cerrar)
- `showCancelConfirm` - Modal cancelación con password
- `isRunning` - Experimento activo
- `currentBlockIndex` - Bloque actual (0-indexed)
- `timerStarted` - Cronómetro iniciado
- `experimentTimer` - Tiempo restante en segundos

**Funcionalidades:**
- ⏸️ Pausar/Reanudar (mantiene tiempo)
- ❌ Cancelar (requiere contraseña, no guarda datos)
- 🔄 Auto-continuar entre bloques (1.2s después de fin)
- 🔄 Detección inteligente de cambio de libro
- 📊 Captura automática de datos
- 🎥 Integración con cámara web
- 👁️ Integración con eye-tracking
- 📱 Responsivo

**Endpoints:**
```
POST   /api/experiment-runs                    Crear corrida
GET    /api/experiments/:id/blocks             Listar bloques
POST   /api/experiment-runs/blocks             Iniciar bloque
PUT    /api/experiment-runs/blocks/:id/complete  Completar bloque
PUT    /api/experiment-runs/:id/complete       Completar experimento
GET    /api/experiment-runs/:id                Obtener detalles
GET    /api/experiments/:id/runs               Listar corridas
```

---

## 📊 VISUALIZACIÓN DE RESULTADOS

### Interfaz de Resultados

**Ubicación:** Acceso desde:
- ConfigurarExperimentos → botón "📊 Ver Resultados" en experimento
- ExperimentRunner → pantalla final → "📊 Ver Resultados"

**Pantalla:**
- 📋 Panel izquierdo: Lista de ejecuciones (histórico)
  - Número ejecución
  - Estado (Completado/En curso)
  - Fecha y hora
- 📊 Panel derecho: Detalles de ejecución seleccionada
  - Bloques completados
  - Duración total
  - Timestamps
  - Datos capturados por bloque

**Z-Index:** 999999 (flota sobre biblioteca y botones)

**Características:**
- ✅ Fullscreen modal
- ✅ Scroll independiente en paneles
- ✅ Botón "← Volver" (cierra modal)
- ✅ Carga dinámica de detalles
- ✅ Formato fecha/hora amigable
- ✅ Indicador progreso carga

---

## 🗄️ BASE DE DATOS

### Schema SQLite

**Tabla `users`**
```sql
id INTEGER PRIMARY KEY
username TEXT UNIQUE
email TEXT UNIQUE
password TEXT (bcrypt hash)
isDeveloper INTEGER (0|1)
isVerified INTEGER (0|1)
verificationToken TEXT
verificationTokenExpires DATETIME
preferences TEXT (JSON)
createdAt DATETIME
```

**Tabla `reading_progress`**
```sql
id INTEGER PRIMARY KEY
userId INTEGER FK
bookFile TEXT
currentPage INTEGER
totalPages INTEGER
progress REAL (0-100)
lastReadAt DATETIME
UNIQUE(userId, bookFile)
```

**Tabla `experiments`**
```sql
id INTEGER PRIMARY KEY
userId INTEGER FK
name TEXT
description TEXT
createdAt DATETIME
updatedAt DATETIME
UNIQUE(userId, name)
```

**Tabla `reading_blocks`**
```sql
id INTEGER PRIMARY KEY
experimentId INTEGER FK
blockNumber INTEGER
name TEXT
duration INTEGER (segundos)
createdAt DATETIME
UNIQUE(experimentId, blockNumber)
```

**Tabla `block_stimuli_config`**
```sql
id INTEGER PRIMARY KEY
blockId INTEGER FK UNIQUE
vibrationEnabled BOOLEAN
auditoryEnabled BOOLEAN
visualEnabled BOOLEAN
extraStimuli TEXT (JSON)
randomFrequency REAL
frequencyCross INTEGER
createdAt DATETIME
```

**Tabla `experiment_runs`**
```sql
id INTEGER PRIMARY KEY
experimentId INTEGER FK
userId INTEGER FK
startTime DATETIME (CURRENT_TIMESTAMP)
endTime DATETIME
duration INTEGER (segundos)
status TEXT ('in_progress'|'completed'|'cancelled')
totalBlocks INTEGER
completedBlocks INTEGER
notes TEXT
```

**Tabla `experiment_run_blocks`**
```sql
id INTEGER PRIMARY KEY
runId INTEGER FK
blockId INTEGER FK
blockNumber INTEGER
startTime DATETIME
endTime DATETIME
duration INTEGER (segundos)
bookId INTEGER
pageNumber INTEGER
```

**Tabla `experiment_data`**
```sql
id INTEGER PRIMARY KEY
runId INTEGER FK
runBlockId INTEGER FK
timestamp DATETIME
dataType TEXT ('eye_tracking'|'camera'|'progress'|'stimulus')
data TEXT (JSON)
```

**Índices:**
- `idx_reading_progress_userId`
- `idx_reading_progress_bookFile`
- `idx_reading_progress_userId_bookFile`
- `idx_experiments_userId`
- `idx_reading_blocks_experimentId`
- `idx_experiment_runs_experimentId`
- `idx_experiment_runs_userId`
- `idx_experiment_run_blocks_runId`
- `idx_experiment_data_runId`

---

## 🔌 API REST COMPLETA

### Autenticación
```
POST   /api/register                    Registrar usuario
POST   /api/verify-email/:token         Verificar email
POST   /api/login                       Login
POST   /api/logout                      Logout
GET    /api/me                          Perfil actual
```

### Libros
```
GET    /api/libros?page=N               Catálogo paginado
GET    /api/libros/search?q=X           Búsqueda
GET    /api/libros/portada/:id          Extraer portada
```

### Lectura
```
POST   /api/reading-progress            Guardar progreso
GET    /api/reading-progress/:file      Obtener progreso
PUT    /api/user/preferences            Actualizar preferencias
GET    /api/user/preferences            Obtener preferencias
```

### Experimentos
```
POST   /api/experiments                 Crear
GET    /api/experiments                 Listar propios
GET    /api/experiments/:id             Obtener
PUT    /api/experiments/:id             Actualizar
DELETE /api/experiments/:id             Eliminar
POST   /api/experiments/:id/blocks      Crear bloque
PUT    /api/experiments/:id/blocks/:bid Actualizar bloque
DELETE /api/experiments/:id/blocks/:bid Eliminar bloque
POST   /api/block-stimuli/:id           Crear estímulos
PUT    /api/block-stimuli/:id           Actualizar estímulos
GET    /api/experiments/:id/runs        Listar corridas
```

### Ejecución
```
POST   /api/experiment-runs             Crear corrida
POST   /api/experiment-runs/blocks      Iniciar bloque
PUT    /api/experiment-runs/blocks/:id/complete  Completar bloque
PUT    /api/experiment-runs/:id/complete         Completar experimento
GET    /api/experiment-runs/:id         Obtener detalles
GET    /api/experiment-runs             Listar corridas usuario
```

### Admin
```
GET    /api/admin/users                 Listar usuarios (admin)
DELETE /api/admin/users/:id             Eliminar usuario (admin)
```

**Headers requeridos:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

---

## 🎨 RESPONSIVIDAD

### Breakpoints

**Desktop (≥1200px)**
- Grid biblioteca: 3 columnas
- Sidebar resultados: 320px
- Font sizes: 1.6rem (h2), 1.2rem (h3)

**Tablet (768px-1199px)**
- Grid biblioteca: 2 columnas
- Sidebar resultados: adapta
- Font sizes: 1.4rem (h2), 1.1rem (h3)

**Mobile (<768px)**
- Grid biblioteca: 1-2 columnas (compacto)
- Resultados: modal responsivo
- Font sizes: 1.2rem (h2), 1rem (h3)
- Padding/margin reducidos

### Espaciado Biblioteca
- **Desktop**: gap 1.8rem vertical, padding-bottom 6rem
- **Tablet**: gap 1.5rem vertical
- **Mobile**: gap 1.2rem vertical

---

## 🧪 TESTING

### Flujo de prueba completo:

**1. Registro e Inicio**
```
1. Ir a http://localhost:3000
2. Registrarse con email institucional
3. Verificar email (click link)
4. Login con credenciales
```

**2. Lectura Normal**
```
1. Desde biblioteca, click en un libro
2. Navegar con flechas
3. Abrir índice (click "Contenidos")
4. Ajustar fuente/tema/brillo
5. Volver a biblioteca (botón X)
```

**3. Crear Experimento**
```
1. Click "Configurar Experimentos"
2. ➕ Nuevo experimento
3. Ingresar nombre y descripción
4. ➕ Agregar Bloque 1 (5 minutos, Coraline, página 50)
5. ➕ Agregar Bloque 2 (5 minutos, Coraline, página 100)
6. Configurar estímulos para cada bloque
7. Guardar
```

**4. Ejecutar Experimento**
```
1. Click ▶️ en experimento
2. Se abre pantalla intro (3s)
3. Se carga Lector en página 50
4. Presionar SPACEBAR para iniciar
5. Cronómetro cuenta atrás
6. Leer durante el tiempo (navegación bloqueada)
7. Al terminar: ¿Repetir / Ver resultados / Cerrar?
```

**5. Ver Resultados**
```
1. Click "Ver Resultados"
2. Seleccionar ejecución de lista
3. Ver detalles en panel derecho
4. Click "← Volver"
```

---

## 🐛 TROUBLESHOOTING

| Problema | Solución |
|----------|----------|
| Email no llega | Verificar SMTP credentials en .env, usar app password de Gmail |
| SPACEBAR no funciona | Verificar que experimentMode=true, intentar click primero |
| Página no carga | Verificar formato EPUB, revisar console.log |
| BD corrupta | `rm db/users.db && npm run init-db` |
| Puerto 3000 ocupado | `netstat -ano \| grep 3000` → `taskkill /PID xxx /F` |
| JWT expirado | Limpiar localStorage (F12 → Storage) y reiniciar sesión |

---

## 📝 ROADMAP FUTURO

- [ ] Exportar datos a CSV/Excel
- [ ] Análisis estadístico integrado (gráficos)
- [ ] Sincronización con Google Drive
- [ ] App móvil nativa (React Native)
- [ ] Integración con más eye-trackers
- [ ] Machine learning para análisis lector
- [ ] Gamificación (badges, leaderboards)
- [ ] Soporte multiidioma

---

## 📄 LICENCIA

MIT © 2025

---

## 👨‍💻 AUTOR

Desarrollado para TECMM Zapopan | 2024-2026
