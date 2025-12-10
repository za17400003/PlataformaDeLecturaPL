# 📚 ASISTENTE DE LECTURA ADL - DOCUMENTACIÓN OFICIAL

**Versión:** v2.1  
**Última actualización:** Diciembre 10, 2025  
**Estado:** ✅ Funcional y desplegable en local

---

## 🎬 INTRODUCCIÓN 
1. Plataforma web para leer libros EPUB con interfaz accesible en React 19.1.1.  
2. Backend Express + SQLite con JWT, progreso, preferencias y WebSocket Gazepoint.  
3. Lector completo con temas (light/sepia/dark), bloques de lectura y grabación de cámara.  
4. Eye-tracking en tiempo real gracias a hooks (`useGazepoint`, `useGazeHighlight`) y servidor Gazepoint.

---

## 🚀 INICIO RÁPIDO
1. `npm install` — instala dependencias del frontend/backend unificado.  
2. `npm start` — levanta servidor en `http://localhost:3000` (puerto configurable via `config.PORT`).  
3. Si cambias archivos estáticos: `npm run build` y vuelve a `npm start`.  
4. Mantén `build/` actualizado si deseas servir assets precompilados.

**Variables de entorno útiles:**  
`PORT` (3000 por defecto), `JWT_SECRET`, `DB_PATH`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `CORS_ORIGIN`.

---

## 🏗️ ARQUITECTURA GENERAL

### Frontend (`src/`)
- `App.js` + `App.css`: login, persistencia de sesión (`authToken`), logout y manejo de errores.  
- `biblioteca.js` + `biblioteca.css`: muestra 6 libros por página, genera portadas desde EPUB, agrega papalotes aleatorios en la última fila, incluye panel dev (CRUD usuarios) y navegación circular.  
- `Lector.js` + `lector.css`: lector EPUB con EPUB.js, navegación, guardado de progreso, preferencia de temas/fuentes, bloques de lectura, grabación cámara, integración Gazepoint.  
- `api-config.js`: base de URL/API, mensajes de error y claves de almacenamiento local (`authToken`, `userData`, `userPreferences`).  
- Hooks personalizados: `useGazepoint` (WS a `ws://localhost:3000`) y `useGazeHighlight` (WS a `ws://localhost:3001`).  

### Backend (`server.js`, `config.js`, `db/`)
- Express unificado que sirve API + frontend estático.  
- Endpoints protegidos con JWT y sesiones en memoria que expiran a medianoche.  
- SQLite (`db/library.db`) con tablas `users`, `reading_progress`, `user_preferences` y 3 índices de rendimiento.  
- `config.js` contiene valores por defecto (puerto 3000, credenciales admin, rutas estáticas, reglas de validación, cookies, CORS).  

### Gazepoint y grabación
- `gazepoint-server.js` abre puerto 4000, conecta al hardware Gazepoint (192.168.56.1:4242), parsea XML, retransmite JSON a los hooks y guarda CSV/XML.  
- `useGazepoint` controla START/STOP y muestra estado de conexión en el lector.  
- `useGazeHighlight` resalta palabras en el iframe con subrayado ondulado (#5bd8cf) tras detectar fijaciones.  

### Proyecto auxiliar
- `camera-recorder-app/`: UI/Backend independientes (login y lector con cámara). La pantalla de login ahora sólo requiere campos completados y permiso de cámara, sin credenciales estáticas, lo que mantiene el flujo congruente con el resto del sistema y facilita pruebas.

---

## 🔍 FUNCIONALIDADES CENTRALES
1. **Autenticación real:** POST `/api/login`, JWT en `Authorization`, sesiones expirables, logout y validación `/api/user`.  
2. **Biblioteca inteligente:** libros paginados desde `/api/libros`, portadas extraídas, papalotes aleatorios, transiciones con nubes y panel dev (GET/POST/PUT/DELETE `/api/users`).  
3. **Lector avanzado:** epubjs con `currentPage`, `totalPages`, guardado `saveReadingProgress` (debounced 2000ms, reintentos), modales de índice, ajustes de texto, temas, fuentes y brillo.  
4. **Bloques de lectura:** 5 bloques de 5 minutos, timers, modal, pausa/reanudar, integrados con grabación.  
5. **Grabación + Eye-tracking:** MediaRecorder cámara, hooks Gazepoint, resaltado ocular.  
6. **Persistencia:** progreso y preferencias guardadas en SQLite y en `localStorage` como backup.  

---

## 🗂️ PERSISTENCIA DE DATOS
### SQLite (`db/library.db`)
- `users`: `id`, `username`, `password` (bcryptjs), `isDeveloper`, `preferences` (JSON).  
- `reading_progress`: `userId`, `bookFile`, `currentPage`, `totalPages`, `progress`, `lastReadAt`, índices (`userId`, `bookFile`, `userId+bookFile`).  
- `user_preferences`: `userId`, `fontSize`, `lineHeight`, `theme`, `font`, `brightness`.

### LocalStorage (`api-config.js`)  
- `authToken`, `userData`, `userPreferences`, `readingProgress_<bookFile>`.

---

## 🔌 ENDPOINTS PRINCIPALES
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/login` | Autentica al usuario y retorna JWT + preferencias. |
| GET | `/api/user` | Valida token y retorna información del usuario. |
| POST | `/api/logout` | Cierra sesión y elimina token. |
| GET | `/api/libros?page=N` | Lista libros paginados (6 por página), incluyendo metadatos y portadas. |
| POST | `/api/reading-progress` | Guarda progreso (con reintentos). |
| GET | `/api/reading-progress/:bookFile` | Recupera progreso específico. |
| GET | `/api/reading-progress` | Lista todos los progresos del usuario. |
| PUT | `/api/user/preferences` | Actualiza preferencias del usuario. |
| GET/POST/PUT/DELETE | `/api/users` | CRUD completo de usuarios (require `isDeveloper`). |

---

## 📡 GAZEPOINT & WEB SOCKETS
- `gazepoint-server.js` escucha en `PORT=4000`, transforma XML a JSON con claves `leftEye`, `rightEye`, `ts`.  
- `useGazepoint` (ws://localhost:3000) se conecta al flujo general, inicia/detiene grabaciones (`START_RECORDING`, `STOP_RECORDING`) y expone `isConnected`.  
- `useGazeHighlight` (ws://localhost:3001) procesa fijaciones en los últimos 500ms, calcula varianza <100 y subraya la palabra apuntada en el iframe.  
- El lector muestra indicadores de estado (🟢 conectado, [Grabando...], resaltado activado) y guarda CSV/XML en `recordings/`.

---

## 📦 FLUJO COMPLETO DE LECTURA
1. Usuario inicia sesión → `App.js` solicita `/api/login`.  
2. Bibliotecas se cargan → `biblioteca.js` obtiene `/api/libros` y muestra mosaico de libros (paginado).  
3. Click en libro abre `Lector.js` que carga EPUB, aplica `applyPrefsToBook` y resalta el progreso.  
4. Navegación: `goNext`/`goPrev` actualizan `currentPage`, `progress` y disparan `saveReadingProgress`.  
5. Preferencias: cambios se guardan y reflejan en el iframe sin white flash.  
6. Eye-tracking: `useGazeHighlight` resalta palabras y `useGazepoint` mantiene la conexión de grabación.  
7. Bloques de lectura: modal controla 5 intervalos de 5 min, actualiza timers y muestra componentes de grabación.

---

## ⚠️ TROUBLESHOOTING
- **Puerto ocupado:** Cambia `PORT` en `config.js` o exporta `PORT=4001` antes de `npm start`.  
- **Libros no cargan:** Coloca `.epub` en `build/libros` (producción) o `public/libros` (dev) y reinicia.  
- **Gazepoint no conecta:** Verifica `gazepoint-server.js` (4000) y hardware Gazepoint (192.168.56.1:4242).  
- **Resaltado no aparece:** Activa `enableGazeHighlight` y confirma que haya fijaciones (varianza <100).  
- **Progreso no guarda:** Asegura token válido y que SQLite (`db/library.db`) esté accesible.

---

## 📚 ARCHIVOS DE REFERENCIA
- `MAPEO_ARCHIVOS.md`: guía detallada de cada pantalla y servicio.   
- `config.js`: configuración general (puerto, JWT, rutas, validación).  
- `api-config.js`: constantes del cliente (endpoints, mensajes, storage keys).

---

## 🧭 SIGUIENTES PASOS RECOMENDADOS
1. Documentar el flujo de grabación en `camera-recorder-app/` si se integra.  
2. Añadir pruebas e2e para login + lector.  
3. Automatizar generación de `db/library.db` en entornos nuevos.  
4. Mantener el panel de admin sincronizado con la configuración de usuarios y roles.

