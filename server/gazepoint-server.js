const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');
const path = require('path');

// Configuración mediante variables de entorno
const WS_PORT = parseInt(process.env.GAZEPOINT_WS_PORT || '4000', 10);
const GP_HOST = process.env.GAZEPOINT_HOST || '192.168.56.1';
const GP_PORT = parseInt(process.env.GAZEPOINT_PORT || '4242', 10);

// Configuración del servidor WebSocket
const wss = new WebSocket.Server({ port: WS_PORT });

// Conexión con Gazepoint
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

// Conectar a Gazepoint con reconexión exponencial
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

    // Configurar streaming de datos
    socket.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_TIME" STATE="1" />\r\n');
    socket.write('<SET ID="ENABLE_SEND_PUPILDATA" STATE="1" />\r\n');
  });

  socket.on('data', (data) => {
    const xmlData = data.toString();
    const eyeData = parseGazepointData(xmlData);

    // Broadcast en tiempo real a todos los clientes WS
    if (eyeData) {
      const payload = JSON.stringify({ type: 'GAZEPOINT_DATA', ...eyeData, ts: Date.now() });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try { client.send(payload); } catch (_) {}
        }
      });
    }

    // Guardado en disco si hay grabación activa
    if (currentRecordingPath && txtStream && gazepointStream && eyeData) {
      writeCsvHeaderIfNeeded();
      const { leftEye, rightEye } = eyeData;
      txtStream.write(`${Number(leftEye.x)},${Number(leftEye.y)},${Number(rightEye.x)},${Number(rightEye.y)},${new Date().toISOString()}\n`);
      gazepointStream.write(xmlData);
    }
  });

  function scheduleReconnect(reason) {
    if (reconnectTimer) return; // ya programado
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

// Parsear datos de Gazepoint (XML en una sola línea)
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

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
  console.log('Cliente web conectado');

  // Conectar a Gazepoint si aún no lo está
  if (!gazepointClient) connectToGazepoint();

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'START_RECORDING') {
        // Carpeta de grabaciones dentro del proyecto
        const recordingsDir = path.join(__dirname, '..', 'camera-recorder-app', 'server', 'recordings');
        try { fs.mkdirSync(recordingsDir, { recursive: true }); } catch (e) {}

        // Solo basename para evitar traversal
        const baseName = path.basename(data.path || ('recording-' + Date.now()));
        currentRecordingPath = path.join(recordingsDir, baseName);
        headerWritten = false;
        txtStream = fs.createWriteStream(`${currentRecordingPath}.txt`);
        gazepointStream = fs.createWriteStream(`${currentRecordingPath}.gp3`);

        const timestamp = new Date().toISOString();
        txtStream.write(`# Eye tracking recording\n# started_at=${timestamp}\n# host=${GP_HOST}\n# port=${GP_PORT}\n`);
        gazepointStream.write(`Recording started at: ${timestamp}\n`);
      } else if (data.type === 'STOP_RECORDING') {
        if (txtStream) { try { txtStream.end(); } catch(_) {} txtStream = null; }
        if (gazepointStream) { try { gazepointStream.end(); } catch(_) {} gazepointStream = null; }
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

console.log(`Servidor de eye tracking (WS) en puerto ${WS_PORT}. Objetivo Gazepoint ${GP_HOST}:${GP_PORT}`);