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
const PORT = 3001;

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
        // Generar timestamp del servidor (sistema local)
        const serverTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
        const recordingFolderName = serverTimestamp;
        const recordingFolder = path.join(recordingsDir, recordingFolderName);
        
        try {
          fs.mkdirSync(recordingFolder, { recursive: true });
        } catch (e) {
          console.error('Error creando carpeta de grabación:', e);
        }
        
        currentRecordingPath = path.join(recordingFolder, 'data');
        headerWritten = false;
        txtStream = fs.createWriteStream(`${currentRecordingPath}.rtf`);
        gazepointStream = fs.createWriteStream(`${currentRecordingPath}.gp3`);

        const isoTimestamp = new Date().toISOString();
        txtStream.write(`# Eye tracking recording\n# started_at=${isoTimestamp}\n# host=${GP_HOST}\n# port=${GP_PORT}\n`);
        gazepointStream.write(`Recording started at: ${isoTimestamp}\n`);
        console.log(`[gazepoint] Grabación iniciada en: ${recordingFolder}`);
      } else if (data.type === 'STOP_RECORDING') {
        if (txtStream) { try { txtStream.end(); } catch(_) {} txtStream = null; }
        if (gazepointStream) { try { gazepointStream.end(); } catch(_) {} gazepointStream = null; }
        console.log(`[gazepoint] Grabación finalizada`);
        currentRecordingPath = null;
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
  
  fs.readdir(librosPath, (err, files) => {
    if (err) {
      console.error('Error al leer la carpeta de libros:', err);
      return res.status(500).json({ error: 'Error al leer la carpeta de libros', details: err.message });
    }
    
    const epubs = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map(file => {
        const absolutePath = path.join(librosPath, file);
        const stats = fs.statSync(absolutePath);
        
        return {
          titulo: file.replace(/\.epub$/i, ''),
          archivo: `http://localhost:3001/public/libros/${file}`,
          size: stats.size,
          lastModified: stats.mtime
        };
      });
    
    console.log('Libros encontrados:', epubs.length);
    res.json(epubs);
  });
});

// ============ FUNCIONES AUXILIARES ============
function convertWebmToAvi(webmPath) {
  return new Promise((resolve, reject) => {
    // Cambiar a WMV que es el formato nativo de Gazepoint
    const wmvPath = webmPath.replace(/\.webm$/, '.wmv');
    const command = `ffmpeg -i "${webmPath}" -c:v wmv2 -q:v 5 -c:a wmav2 -b:a 192k "${wmvPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error converting webm to wmv:', error);
        reject(error);
      } else {
        // Eliminar el webm original
        try {
          fs.unlinkSync(webmPath);
          console.log('Conversión a WMV completada:', wmvPath);
          resolve(wmvPath);
        } catch (e) {
          console.error('Error eliminando webm:', e);
          resolve(wmvPath);
        }
      }
    });
  });
}

// ============ MULTER: UPLOAD ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Si hay grabación activa, guardar en esa carpeta
    if (currentRecordingPath) {
      const folder = path.dirname(currentRecordingPath);
      cb(null, folder);
    } else {
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
    console.log('Archivo recibido:', req.file.path);
    
    // Si es webm, convertir a wmv (formato nativo de Gazepoint)
    if (req.file.path.endsWith('.webm')) {
      const wmvPath = await convertWebmToAvi(req.file.path);
      console.log('Conversión a WMV completada:', wmvPath);
      res.status(200).json({ 
        ok: true, 
        filename: path.basename(wmvPath),
        path: wmvPath,
        format: 'wmv'
      });
    } else {
      res.status(200).json({ 
        ok: true, 
        filename: path.basename(req.file.path),
        path: req.file.path
      });
    }
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