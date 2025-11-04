const WebSocket = require('ws');
const net = require('net');
const fs = require('fs');

// Configuración del servidor WebSocket
const wss = new WebSocket.Server({ port: 4000 });

// Conexión con Gazepoint
let gazepointClient = null;
let currentRecordingPath = null;
let txtStream = null;
let gazepointStream = null;

// Conectar a Gazepoint
function connectToGazepoint() {
  gazepointClient = new net.Socket();
  
  gazepointClient.connect(4242, 'localhost', () => {
    console.log('Conectado a Gazepoint');
    
    // Configurar streaming de datos
    gazepointClient.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n');
    gazepointClient.write('<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />\r\n');
    gazepointClient.write('<SET ID="ENABLE_SEND_TIME" STATE="1" />\r\n');
    gazepointClient.write('<SET ID="ENABLE_SEND_PUPILDATA" STATE="1" />\r\n');
  });

  gazepointClient.on('data', (data) => {
    if (currentRecordingPath && txtStream && gazepointStream) {
      const timestamp = new Date().toLocaleTimeString();
      const xmlData = data.toString();
      
      // Parsear y guardar datos
      const eyeData = parseGazepointData(xmlData);
      if (eyeData) {
        const { leftEye, rightEye } = eyeData;
        txtStream.write(`${leftEye.x},${leftEye.y},${rightEye.x},${rightEye.y},[${timestamp}]\n`);
        gazepointStream.write(xmlData);
      }
    }
  });
}

// Parsear datos de Gazepoint
function parseGazepointData(xmlData) {
  try {
    const leftEye = {
      x: xmlData.match(/LFPOGX="([^"]+)"/) ? parseFloat(RegExp.$1) : 0,
      y: xmlData.match(/LFPOGY="([^"]+)"/) ? parseFloat(RegExp.$1) : 0
    };
    
    const rightEye = {
      x: xmlData.match(/RFPOGX="([^"]+)"/) ? parseFloat(RegExp.$1) : 0,
      y: xmlData.match(/RFPOGY="([^"]+)"/) ? parseFloat(RegExp.$1) : 0
    };
    
    return { leftEye, rightEye };
  } catch (e) {
    return null;
  }
}

// Manejar conexiones WebSocket
wss.on('connection', (ws) => {
  console.log('Cliente web conectado');

  if (!gazepointClient) {
    connectToGazepoint();
  }

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'START_RECORDING') {
        currentRecordingPath = data.path;
        txtStream = fs.createWriteStream(`${currentRecordingPath}.txt`);
        gazepointStream = fs.createWriteStream(`${currentRecordingPath}.gp3`);
        
        const timestamp = new Date().toISOString();
        txtStream.write(`Recording started at: ${timestamp}\n`);
        gazepointStream.write(`Recording started at: ${timestamp}\n`);
      }
      else if (data.type === 'STOP_RECORDING') {
        if (txtStream) {
          txtStream.end();
          txtStream = null;
        }
        if (gazepointStream) {
          gazepointStream.end();
          gazepointStream = null;
        }
        currentRecordingPath = null;
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Cliente web desconectado');
  });
});

console.log('Servidor de eye tracking iniciado en puerto 4000');