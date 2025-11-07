const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const WebSocket = require('ws');
const net = require('net');
const http = require('http');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Configuración de directorios
const recordingsDir = path.join(__dirname, 'camera-recorder-app', 'server', 'recordings');
const librosPath = path.join(__dirname, 'public', 'libros');

// Crear directorios si no existen
try { 
    fs.mkdirSync(recordingsDir, { recursive: true }); 
    fs.mkdirSync(librosPath, { recursive: true });
} catch (e) {
    console.error('Error creando directorios:', e);
}

// ============ GAZEPOINT CONFIG ============
const GP_HOST = process.env.GAZEPOINT_HOST || '192.168.56.1';
const GP_PORT = parseInt(process.env.GAZEPOINT_PORT || '4242', 10);

let gazepointClient = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
let currentRecordingPath = null;
let currentRecordingFolder = null;
let currentSessionId = null; // Agregar sessionId
let txtStream = null;
let gazepointStream = null;
let headerWritten = false;

function writeCsvHeaderIfNeeded() {
  if (txtStream && !headerWritten) {
    txtStream.write('LFPOGX,LFPOGY,RFPOGX,RFPOGY,timestamp\n');
    headerWritten = true;
  }
}

function connectToGazepoint() {
  if (gazepointClient) {
    try { gazepointClient.destroy(); } catch (_) {}
    gazepointClient = null;
  }

  const socket = new net.Socket();
  gazepointClient = socket;

  socket.connect(GP_PORT, GP_HOST, () => {
    reconnectAttempts = 0;
    console.log(`[gazepoint] Conectado a ${GP_HOST}:${GP_PORT}`);
    socket.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_TIME" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_PUPILDATA" STATE="1" />\r\n');
  });

  socket.on('data', (data) => {
    const xmlData = data.toString();
    const eyeData = parseGazepointData(xmlData);

    if (eyeData) {
      const payload = JSON.stringify({ type: 'GAZEPOINT_DATA', ...eyeData, ts: Date.now() });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try { client.send(payload); } catch (_) {}
        }
      });
    }

    if (currentRecordingPath && txtStream && gazepointStream && eyeData) {
      writeCsvHeaderIfNeeded();
      const { leftEye, rightEye } = eyeData;
      txtStream.write(`${Number(leftEye.x)},${Number(leftEye.y)},${Number(rightEye.x)},${Number(rightEye.y)},${new Date().toISOString()}\n`);
      gazepointStream.write(xmlData);
    }
  });

  function scheduleReconnect(reason) {
    if (reconnectTimer) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts++));
    console.warn(`[gazepoint] desconectado (${reason}). Reintentando en ${Math.round(delay/1000)}s...`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectToGazepoint();
    }, delay);
  }

  socket.on('error', (err) => {
    console.error('[gazepoint] error de socket:', err.message);
    scheduleReconnect('error');
  });

  socket.on('close', () => {
    scheduleReconnect('close');
  });
}

function parseGazepointData(xmlData) {
  try {
    const lfx = (() => { const m = xmlData.match(/LFPOGX="([^"]+)"/); return m ? parseFloat(m[1]) : NaN; })();
    const lfy = (() => { const m = xmlData.match(/LFPOGY="([^"]+)"/); return m ? parseFloat(m[1]) : NaN; })();
    const rfx = (() => { const m = xmlData.match(/RFPOGX="([^"]+)"/); return m ? parseFloat(m[1]) : NaN; })();
    const rfy = (() => { const m = xmlData.match(/RFPOGY="([^"]+)"/); return m ? parseFloat(m[1]) : NaN; })();
    if ([lfx, lfy, rfx, rfy].some((v) => Number.isNaN(v))) return null;
    return { leftEye: { x: lfx, y: lfy }, rightEye: { x: rfx, y: rfy } };
  } catch (_) {
    return null;
  }
}

// ============ CREAR SERVIDOR HTTP ============
const server = http.createServer(app);

// ============ WEBSOCKET ============
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Cliente web conectado al WS');
  if (!gazepointClient) connectToGazepoint();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'START_RECORDING') {
        // Usar el sessionId proporcionado o generar uno nuevo
        const sessionId = data.sessionId || new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
        const recordingFolderName = sessionId.replace('Z', ''); // Limpiar si viene con Z
        const recordingFolder = path.join(recordingsDir, recordingFolderName);
        
        try {
          fs.mkdirSync(recordingFolder, { recursive: true });
        } catch (e) {
          console.error('Error creando carpeta de grabación:', e);
        }
        
        currentRecordingPath = path.join(recordingFolder, 'data');
        currentRecordingFolder = recordingFolder;
        currentSessionId = sessionId; // Guardar el sessionId
        headerWritten = false;
        txtStream = fs.createWriteStream(`${currentRecordingPath}.rtf`);
        gazepointStream = fs.createWriteStream(`${currentRecordingPath}.gp3`);

        const isoTimestamp = new Date().toISOString();
        txtStream.write(`# Eye tracking recording\n# started_at=${isoTimestamp}\n# host=${GP_HOST}\n# port=${GP_PORT}\n`);
        gazepointStream.write(`Recording started at: ${isoTimestamp}\n`);
        console.log(`[gazepoint] Grabación iniciada en: ${recordingFolder} para sesión: ${sessionId}`);
      } else if (data.type === 'STOP_RECORDING') {
        if (txtStream) { try { txtStream.end(); } catch(_) {} txtStream = null; }
        if (gazepointStream) { try { gazepointStream.end(); } catch(_) {} gazepointStream = null; }
        console.log(`[gazepoint] Grabación finalizada para sesión:`, currentSessionId);
        currentRecordingPath = null;
        currentRecordingFolder = null;
        currentSessionId = null; // Limpiar también el sessionId
        headerWritten = false;
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Cliente web desconectado');
  });
});

console.log(`[gazepoint] WS en puerto integrado. Objetivo: ${GP_HOST}:${GP_PORT}`);

// ============ CORS ============
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

// ============ ARCHIVOS ESTÁTICOS ============
app.use('/public', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET');
        if (path.endsWith('.epub')) {
            res.set('Content-Type', 'application/epub+zip');
        }
    }
}));

app.use(express.static(path.join(__dirname, 'build')));

// ============ API: LIBROS ============
app.get('/api/libros', (req, res) => {
  console.log('Solicitud recibida para /api/libros');
  
  // Parámetros de paginación
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 6;
  const startIndex = page * limit;
  const endIndex = startIndex + limit;
  
  fs.readdir(librosPath, (err, files) => {
    if (err) {
      console.error('Error al leer la carpeta de libros:', err);
      return res.status(500).json({ error: 'Error al leer la carpeta de libros', details: err.message });
    }
    
    const allEpubs = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => {
        const absolutePath = path.join(librosPath, file);
        const stats = fs.statSync(absolutePath);
        
        return {
          titulo: file.replace(/\.epub$/i, ''),
          archivo: `/public/libros/${file}`,
          size: stats.size,
          lastModified: stats.mtime
        };
      });
    
    // Calcular metadatos de paginación
    const totalBooks = allEpubs.length;
    const totalPages = Math.ceil(totalBooks / limit);
    const paginatedBooks = allEpubs.slice(startIndex, endIndex);
    
    console.log(`Página ${page}, libros ${startIndex + 1}-${Math.min(endIndex, totalBooks)} de ${totalBooks} total`);
    
    res.json({
      books: paginatedBooks,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalBooks: totalBooks,
        booksPerPage: limit,
        hasNextPage: page < totalPages - 1,
        hasPrevPage: page > 0
      }
    });
  });
});

// ============ FUNCIONES AUXILIARES ============
function findSessionFolder(sessionId) {
  const sessionFolderName = sessionId.replace('Z', '');
  const sessionFolder = path.join(recordingsDir, sessionFolderName);
  if (fs.existsSync(sessionFolder)) {
    return sessionFolder;
  }
  return null;
}

// ============ MULTER: UPLOAD ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Si hay sessionId en el request, buscar o crear la carpeta correspondiente
    const sessionId = req.body?.sessionId;
    if (sessionId) {
      const sessionFolderName = sessionId.replace('Z', '');
      const sessionFolder = path.join(recordingsDir, sessionFolderName);
      
      // Crear la carpeta si no existe
      try {
        fs.mkdirSync(sessionFolder, { recursive: true });
        console.log('Guardando video en carpeta de sesión:', sessionFolder);
        cb(null, sessionFolder);
      } catch (e) {
        console.error('Error creando carpeta de sesión:', e);
        cb(null, recordingsDir);
      }
    } else if (currentRecordingFolder) {
      console.log('Guardando video en carpeta de grabación activa:', currentRecordingFolder);
      cb(null, currentRecordingFolder);
    } else {
      console.log('No hay sesión específica, guardando en carpeta general');
      cb(null, recordingsDir);
    }
  },
  filename: (req, file, cb) => {
    let name = file.originalname || `recording-${Date.now()}.webm`;
    name = path.basename(name);
    cb(null, name);
  }
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No se recibió ningún archivo');
  }
  
  try {
    console.log('Archivo recibido (formato original):', req.file.path);
    
    // Mantener formato original (WebM)
    res.status(200).json({ 
      ok: true, 
      filename: path.basename(req.file.path),
      path: req.file.path,
      format: 'webm'
    });
  } catch (e) {
    console.error('Error en upload:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============ RUTA CATCH-ALL (SPA) ============
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ============ INICIAR SERVIDOR ============
server.listen(PORT, () => {
  console.log(`Servidor integrado corriendo en http://localhost:${PORT}`);
  console.log(`  - API en http://localhost:${PORT}/api`);
  console.log(`  - Frontend en http://localhost:${PORT}`);
  console.log(`  - WebSocket en ws://localhost:${PORT}`);
});

// ============ SISTEMA DE LIMPIEZA Y GARBAGE COLLECTION ============
function gracefulShutdown(signal) {
  console.log(`\n🛑 Recibida señal ${signal}. Iniciando cierre ordenado...`);
  
  // 1. Detener el servidor HTTP
  console.log('⏹️  Cerrando servidor HTTP...');
  server.close((err) => {
    if (err) {
      console.error('❌ Error cerrando servidor HTTP:', err);
    } else {
      console.log('✅ Servidor HTTP cerrado correctamente');
    }
  });

  // 2. Cerrar todas las conexiones WebSocket
  console.log('🔌 Cerrando conexiones WebSocket...');
  if (wss) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.terminate();
        } catch (e) {
          console.error('Error cerrando cliente WS:', e.message);
        }
      }
    });
    
    wss.close(() => {
      console.log('✅ WebSocket Server cerrado correctamente');
    });
  }

  // 3. Cerrar conexión de Gazepoint
  console.log('👁️  Cerrando conexión Gazepoint...');
  if (gazepointClient) {
    try {
      gazepointClient.destroy();
      gazepointClient = null;
      console.log('✅ Conexión Gazepoint cerrada');
    } catch (e) {
      console.error('Error cerrando Gazepoint:', e.message);
    }
  }

  // 4. Limpiar timers de reconexión
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    console.log('✅ Timer de reconexión limpiado');
  }

  // 5. Cerrar streams de archivos si están abiertos
  console.log('📁 Cerrando streams de archivos...');
  if (txtStream) {
    try {
      txtStream.end();
      txtStream = null;
      console.log('✅ Stream TXT cerrado');
    } catch (e) {
      console.error('Error cerrando txtStream:', e.message);
    }
  }
  
  if (gazepointStream) {
    try {
      gazepointStream.end();
      gazepointStream = null;
      console.log('✅ Stream Gazepoint cerrado');
    } catch (e) {
      console.error('Error cerrando gazepointStream:', e.message);
    }
  }

  // 6. Limpiar variables globales
  console.log('🧹 Limpiando variables globales...');
  currentRecordingPath = null;
  currentRecordingFolder = null;
  currentSessionId = null;
  headerWritten = false;
  
  // 7. Forzar garbage collection si está disponible
  console.log('🗑️  Ejecutando garbage collection...');
  if (global.gc) {
    try {
      global.gc();
      console.log('✅ Garbage collection ejecutado');
    } catch (e) {
      console.error('Error en garbage collection:', e.message);
    }
  } else {
    console.log('⚠️  Garbage collection no disponible (usar --expose-gc para habilitarlo)');
  }

  // 8. Salir del proceso después de un pequeño delay
  console.log('👋 Finalizando proceso...');
  setTimeout(() => {
    console.log('✅ Proceso finalizado correctamente');
    process.exit(0);
  }, 1000);
}

// Capturar señales de cierre
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Terminación normal
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT')); // Quit

// Capturar errores no manejados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada sin manejar:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Manejar el evento beforeExit
process.on('beforeExit', (code) => {
  console.log('🔄 Proceso a punto de salir con código:', code);
});

console.log('🛡️  Sistema de limpieza configurado correctamente');