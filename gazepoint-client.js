/**
 * GAZEPOINT CLIENT - Módulo para captura de datos Gazepoint en JavaScript puro
 * 
 * Reemplaza al servidor Flask/Python original (app.py)
 * Proporciona:
 * - Conexión nativa a dispositivos Gazepoint por puerto USB/COM
 * - Captura de datos de seguimiento ocular en tiempo real
 * - Gestión de sesiones de experimentos
 * - Almacenamiento en BD SQLite o disco
 * 
 * Características:
 * - Compatible con Gazepoint GP3 HD
 * - Conexión TCP directa (127.0.0.1:4242)
 * - Parsing de datos XML en tiempo real
 * - Almacenamiento automático de datos
 * - Health checks y monitoreo
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const CONFIG = {
  // Host y puerto del dispositivo Gazepoint
  GAZEPOINT_HOST: process.env.GAZEPOINT_HOST || '127.0.0.1',
  GAZEPOINT_PORT: parseInt(process.env.GAZEPOINT_PORT || '4242'),
  
  // Configuración de conexión
  CONNECTION_TIMEOUT: 5000, // ms
  RECONNECT_DELAY: 2000, // ms
  RECONNECT_MAX_ATTEMPTS: 5,
  
  // Directorios de almacenamiento
  SESSIONS_DIR: process.env.SESSIONS_DIR || './db/sessions',
  DB_PATH: process.env.DB_PATH || './db/library.db',
  
  // Parámetros por defecto de experimento
  DEFAULT_CONFIG: {
    num_blocks: 5,
    minutes_per_block: 5.22,
    rest_between_blocks_s: 60,
    stim_blocks: [0, 2, 4],
    quotas: {
      V: 2,     // visual
      K: 2,     // kinestésico
      A: 2,     // auditivo
      PST: 3,   // pregunta sobre la tarea
      PFT: 6    // pregunta fuera de la tarea
    },
    intervalo_min: 45,
    intervalo_max: 60,
    duracion_min: 1,
    duracion_max: 3
  }
};

// ============================================================================
// ESTADO GLOBAL
// ============================================================================

let gazepointState = {
  connected: false,
  socket: null,
  reconnectAttempts: 0,
  
  // Sesión actual
  currentSession: {
    session_id: null,
    experiment_id: null,
    start_time: null,
    status: 'idle', // idle, running, paused, stopped
    config: null
  },
  
  // Datos capturados en sesión actual
  currentData: {
    gaze_samples: [],
    events: [],
    metadata: {}
  },
  
  // Callbacks para notificaciones
  callbacks: {
    onConnect: null,
    onDisconnect: null,
    onData: null,
    onError: null
  }
};

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

/**
 * Inicializa directorios requeridos
 */
function initializeDirectories() {
  if (!fs.existsSync(CONFIG.SESSIONS_DIR)) {
    fs.mkdirSync(CONFIG.SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Inicializa base de datos SQLite si no existe
 */
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONFIG.DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Tabla para datos de gaze (si no existe)
      db.run(`
        CREATE TABLE IF NOT EXISTS gaze_samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          timestamp REAL NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          confidence REAL NOT NULL,
          captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(session_id) REFERENCES experiment_runs(session_id)
        )
      `, (err) => {
        if (err) console.error('Error creando tabla gaze_samples:', err);
      });
      
      // Tabla para eventos (si no existe)
      db.run(`
        CREATE TABLE IF NOT EXISTS run_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_data JSON,
          timestamp REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(session_id) REFERENCES experiment_runs(session_id)
        )
      `, (err) => {
        if (err) console.error('Error creando tabla run_events:', err);
      });
      
      // Tabla para metadatos de sesión
      db.run(`
        CREATE TABLE IF NOT EXISTS session_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT UNIQUE NOT NULL,
          experiment_id INTEGER,
          start_time DATETIME,
          end_time DATETIME,
          config JSON,
          metadata JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(experiment_id) REFERENCES experiments(id)
        )
      `, (err) => {
        if (err) console.error('Error creando tabla session_metadata:', err);
      });
      
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// ============================================================================
// CONEXIÓN A GAZEPOINT
// ============================================================================

/**
 * Conecta con el dispositivo Gazepoint
 * @param {function} onConnect - Callback al conectarse
 * @param {function} onError - Callback en error
 */
function connectToGazepoint(onConnect, onError) {
  if (gazepointState.connected) {
    console.log('✅ Ya conectado a Gazepoint');
    if (onConnect) onConnect();
    return;
  }
  
  console.log(`🔌 Conectando a Gazepoint (${CONFIG.GAZEPOINT_HOST}:${CONFIG.GAZEPOINT_PORT})...`);
  
  const socket = net.createConnection({
    host: CONFIG.GAZEPOINT_HOST,
    port: CONFIG.GAZEPOINT_PORT,
    timeout: CONFIG.CONNECTION_TIMEOUT
  });
  
  socket.on('connect', () => {
    console.log('✅ Conectado a Gazepoint');
    gazepointState.connected = true;
    gazepointState.socket = socket;
    gazepointState.reconnectAttempts = 0;
    
    // Enviar comando de calibración inicial
    socket.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n');
    
    if (onConnect) onConnect();
    if (gazepointState.callbacks.onConnect) gazepointState.callbacks.onConnect();
  });
  
  socket.on('data', (data) => {
    handleGazepointData(data);
  });
  
  socket.on('error', (error) => {
    console.error('❌ Error conexión Gazepoint:', error.message);
    gazepointState.connected = false;
    gazepointState.socket = null;
    
    if (onError) onError(error);
    if (gazepointState.callbacks.onError) gazepointState.callbacks.onError(error);
    
    // Intentar reconectar
    attemptReconnect(onConnect, onError);
  });
  
  socket.on('timeout', () => {
    console.error('⏱️ Timeout conexión Gazepoint');
    socket.destroy();
    gazepointState.connected = false;
    attemptReconnect(onConnect, onError);
  });
  
  socket.on('close', () => {
    console.log('🔌 Desconectado de Gazepoint');
    gazepointState.connected = false;
    gazepointState.socket = null;
    
    if (gazepointState.callbacks.onDisconnect) gazepointState.callbacks.onDisconnect();
  });
}

/**
 * Intenta reconectar a Gazepoint con backoff exponencial
 */
function attemptReconnect(onConnect, onError) {
  if (gazepointState.reconnectAttempts >= CONFIG.RECONNECT_MAX_ATTEMPTS) {
    console.error('❌ Max reconnect attempts reached');
    if (onError) onError(new Error('Max reconnect attempts'));
    return;
  }
  
  gazepointState.reconnectAttempts++;
  const delay = CONFIG.RECONNECT_DELAY * gazepointState.reconnectAttempts;
  
  console.log(`🔄 Reconectando en ${delay}ms... (intento ${gazepointState.reconnectAttempts})`);
  
  setTimeout(() => {
    connectToGazepoint(onConnect, onError);
  }, delay);
}

/**
 * Desconecta de Gazepoint
 */
function disconnectFromGazepoint() {
  if (gazepointState.socket) {
    gazepointState.socket.write('<SET ID="ENABLE_SEND_DATA" STATE="0" />\r\n');
    gazepointState.socket.destroy();
    gazepointState.socket = null;
  }
  gazepointState.connected = false;
  console.log('🔌 Desconectando de Gazepoint');
}

// ============================================================================
// PARSING DE DATOS GAZEPOINT
// ============================================================================

/**
 * Maneja datos recibidos de Gazepoint
 * Parsea XML y extrae información de gaze
 */
function handleGazepointData(data) {
  const dataStr = data.toString('utf-8');
  
  // Parsear múltiples mensajes XML
  const messages = dataStr.split(/\r\n|\n/);
  
  for (const msg of messages) {
    if (!msg.trim()) continue;
    
    try {
      // Extraer atributos del XML
      const gazeSample = parseGazepointXML(msg);
      
      if (gazeSample) {
        // Si hay sesión activa, guardar datos
        if (gazepointState.currentSession.session_id) {
          recordGazeSample(gazeSample);
        }
        
        // Notificar
        if (gazepointState.callbacks.onData) {
          gazepointState.callbacks.onData(gazeSample);
        }
      }
    } catch (error) {
      // Ignorar errores de parsing (pueden ser ACK u otros mensajes)
      // console.error('Error parsing Gazepoint data:', error.message);
    }
  }
}

/**
 * Parsea XML de Gazepoint y extrae datos de gaze
 * Formato: <GD TIME="123456" X="640" Y="480" PD="0.5" ... />
 */
function parseGazepointXML(xmlString) {
  // Regex para extraer atributos
  const timeMatch = xmlString.match(/TIME="([^"]+)"/);
  const xMatch = xmlString.match(/X="([^"]+)"/);
  const yMatch = xmlString.match(/Y="([^"]+)"/);
  const pdMatch = xmlString.match(/PD="([^"]+)"/); // Pupil diameter
  
  if (!timeMatch || !xMatch || !yMatch) {
    return null;
  }
  
  return {
    timestamp: parseFloat(timeMatch[1]),
    x: parseFloat(xMatch[1]),
    y: parseFloat(yMatch[1]),
    confidence: pdMatch ? parseFloat(pdMatch[1]) : 0.5,
    raw: xmlString
  };
}

// ============================================================================
// GRABACIÓN DE DATOS
// ============================================================================

/**
 * Registra una muestra de gaze en BD
 */
function recordGazeSample(gazeSample) {
  const { session_id, experiment_id } = gazepointState.currentSession;
  
  if (!session_id) return;
  
  // Guardar en memoria primero
  gazepointState.currentData.gaze_samples.push({
    ...gazeSample,
    session_id,
    captured_at: new Date().toISOString()
  });
  
  // Guardar en BD de forma asincrónica
  const db = new sqlite3.Database(CONFIG.DB_PATH);
  
  db.run(
    `INSERT INTO gaze_samples (session_id, timestamp, x, y, confidence)
     VALUES (?, ?, ?, ?, ?)`,
    [session_id, gazeSample.timestamp, gazeSample.x, gazeSample.y, gazeSample.confidence],
    function(err) {
      if (err) {
        console.error('Error guardando gaze sample:', err.message);
      }
    }
  );
  
  db.close();
}

/**
 * Registra un evento en BD (cambio de página, fijación, etc)
 */
function recordEvent(eventType, eventData) {
  const { session_id } = gazepointState.currentSession;
  
  if (!session_id) return;
  
  const timestamp = eventData.timestamp || Date.now();
  
  gazepointState.currentData.events.push({
    event_type: eventType,
    event_data: eventData,
    timestamp,
    session_id,
    created_at: new Date().toISOString()
  });
  
  const db = new sqlite3.Database(CONFIG.DB_PATH);
  
  db.run(
    `INSERT INTO run_events (session_id, event_type, event_data, timestamp)
     VALUES (?, ?, ?, ?)`,
    [session_id, eventType, JSON.stringify(eventData), timestamp],
    function(err) {
      if (err) {
        console.error('Error guardando evento:', err.message);
      }
    }
  );
  
  db.close();
}

// ============================================================================
// GESTIÓN DE SESIONES
// ============================================================================

/**
 * Inicia una nueva sesión de experimento
 */
function startSession(sessionId, experimentId, config = {}) {
  const mergedConfig = { ...CONFIG.DEFAULT_CONFIG, ...config };
  
  gazepointState.currentSession = {
    session_id: sessionId,
    experiment_id: experimentId,
    start_time: new Date().toISOString(),
    status: 'running',
    config: mergedConfig
  };
  
  gazepointState.currentData = {
    gaze_samples: [],
    events: [],
    metadata: {
      config: mergedConfig,
      started_at: new Date().toISOString()
    }
  };
  
  // Guardar metadatos en BD
  const db = new sqlite3.Database(CONFIG.DB_PATH);
  
  db.run(
    `INSERT OR REPLACE INTO session_metadata 
     (session_id, experiment_id, start_time, config, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [
      sessionId,
      experimentId,
      new Date().toISOString(),
      JSON.stringify(mergedConfig),
      JSON.stringify(gazepointState.currentData.metadata)
    ],
    function(err) {
      if (err) {
        console.error('Error guardando metadatos de sesión:', err.message);
      }
    }
  );
  
  db.close();
  
  console.log(`📊 Sesión iniciada: ${sessionId} (Experimento: ${experimentId})`);
  
  return gazepointState.currentSession;
}

/**
 * Finaliza sesión actual
 */
function stopSession() {
  if (!gazepointState.currentSession.session_id) {
    console.warn('No hay sesión activa');
    return;
  }
  
  const { session_id } = gazepointState.currentSession;
  gazepointState.currentSession.status = 'stopped';
  gazepointState.currentSession.end_time = new Date().toISOString();
  
  // Guardar en disco como respaldo
  saveSessionToDisk(session_id);
  
  console.log(`📊 Sesión finalizada: ${session_id}`);
  console.log(`   - Muestras de gaze: ${gazepointState.currentData.gaze_samples.length}`);
  console.log(`   - Eventos: ${gazepointState.currentData.events.length}`);
}

/**
 * Guarda los datos de sesión en disco como respaldo
 */
function saveSessionToDisk(sessionId) {
  const sessionPath = path.join(CONFIG.SESSIONS_DIR, sessionId);
  
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }
  
  // Guardar datos de gaze como JSON
  const gazePath = path.join(sessionPath, 'gaze_samples.json');
  fs.writeFileSync(gazePath, JSON.stringify(gazepointState.currentData.gaze_samples, null, 2));
  
  // Guardar eventos como JSON
  const eventsPath = path.join(sessionPath, 'events.json');
  fs.writeFileSync(eventsPath, JSON.stringify(gazepointState.currentData.events, null, 2));
  
  // Guardar metadatos
  const metaPath = path.join(sessionPath, 'metadata.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    ...gazepointState.currentSession,
    summary: {
      total_gaze_samples: gazepointState.currentData.gaze_samples.length,
      total_events: gazepointState.currentData.events.length
    }
  }, null, 2));
  
  console.log(`💾 Sesión guardada en disco: ${sessionPath}`);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Obtiene estado de conexión
 */
function getConnectionStatus() {
  return {
    connected: gazepointState.connected,
    host: CONFIG.GAZEPOINT_HOST,
    port: CONFIG.GAZEPOINT_PORT,
    reconnectAttempts: gazepointState.reconnectAttempts
  };
}

/**
 * Obtiene estado de sesión actual
 */
function getSessionStatus() {
  return gazepointState.currentSession;
}

/**
 * Obtiene datos de sesión actual
 */
function getSessionData() {
  return gazepointState.currentData;
}

/**
 * Obtiene lista de sesiones guardadas
 */
function listSessions() {
  const sessions = [];
  
  if (fs.existsSync(CONFIG.SESSIONS_DIR)) {
    const items = fs.readdirSync(CONFIG.SESSIONS_DIR);
    
    for (const item of items) {
      const itemPath = path.join(CONFIG.SESSIONS_DIR, item);
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        const metaPath = path.join(itemPath, 'metadata.json');
        let metadata = {};
        
        if (fs.existsSync(metaPath)) {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        }
        
        sessions.push({
          session_id: item,
          created_at: stat.birthtime.toISOString(),
          metadata
        });
      }
    }
  }
  
  return sessions;
}

/**
 * Obtiene datos de sesión específica
 */
function getSessionDataFromDisk(sessionId) {
  const sessionPath = path.join(CONFIG.SESSIONS_DIR, sessionId);
  
  if (!fs.existsSync(sessionPath)) {
    throw new Error(`Sesión no encontrada: ${sessionId}`);
  }
  
  const data = {
    session_id: sessionId,
    path: sessionPath,
    gaze_samples: null,
    events: null,
    metadata: null
  };
  
  const gazePath = path.join(sessionPath, 'gaze_samples.json');
  const eventsPath = path.join(sessionPath, 'events.json');
  const metaPath = path.join(sessionPath, 'metadata.json');
  
  if (fs.existsSync(gazePath)) {
    data.gaze_samples = JSON.parse(fs.readFileSync(gazePath, 'utf-8'));
  }
  
  if (fs.existsSync(eventsPath)) {
    data.events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
  }
  
  if (fs.existsSync(metaPath)) {
    data.metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  }
  
  return data;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Verifica el estado del sistema
 */
async function healthCheck() {
  return {
    status: 'ok',
    service: 'PL Gazepoint Client',
    gazepoint_connected: gazepointState.connected,
    session_active: gazepointState.currentSession.session_id !== null,
    directories_ok: fs.existsSync(CONFIG.SESSIONS_DIR),
    database_ok: fs.existsSync(CONFIG.DB_PATH),
    timestamp: new Date().toISOString()
  };
}

// ============================================================================
// EXPORTAR MÓDULO
// ============================================================================

module.exports = {
  // Configuración
  CONFIG,
  
  // Inicialización
  initializeDirectories,
  initializeDatabase,
  
  // Conexión
  connectToGazepoint,
  disconnectFromGazepoint,
  getConnectionStatus,
  
  // Sesiones
  startSession,
  stopSession,
  getSessionStatus,
  getSessionData,
  listSessions,
  getSessionDataFromDisk,
  
  // Eventos
  recordEvent,
  
  // Utilidades
  healthCheck,
  
  // Estado
  gazepointState,
  
  // Callbacks
  setOnConnect: (cb) => { gazepointState.callbacks.onConnect = cb; },
  setOnDisconnect: (cb) => { gazepointState.callbacks.onDisconnect = cb; },
  setOnData: (cb) => { gazepointState.callbacks.onData = cb; },
  setOnError: (cb) => { gazepointState.callbacks.onError = cb; }
};
