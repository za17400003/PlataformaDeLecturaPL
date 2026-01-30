#!/usr/bin/env node

/**
 * Script para cargar datos de ejemplo en la BD y configurar experimento
 * Uso: node load-example-data.js
 * 
 * Este script:
 * 1. Busca el experimento "Test_Experiment_1767733548563" o lo crea si no existe
 * 2. Carga los datos de ejemplo del CSV (gaze_samples.csv y mind_wandering_events.csv)
 * 3. Crea una corrida de experimento con los datos
 * 4. Configura el experimento con libro "Charlie y la fábrica" y página 5
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'users.db');
const EXAMPLE_SESSION_PATH = path.join(__dirname, 'Sesiones', 'resultados', 'ejemplo_sesion_S1');

let db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error conectando a BD:', err.message);
    process.exit(1);
  }
});

// Funciones auxiliares
function getAdminUser() {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM users WHERE username = "admin" LIMIT 1', (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.id : 1);
    });
  });
}

function getBook(title) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT id, title FROM books WHERE title LIKE ?';
    db.get(query, [`%${title}%`], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getOrCreateExperiment() {
  return new Promise(async (resolve, reject) => {
    try {
      const adminId = await getAdminUser();
      const expName = 'Test_Experiment_1767733548563';
      
      // Buscar experimento existente
      db.get(
        'SELECT id, config FROM experiments WHERE name = ? AND user_id = ?',
        [expName, adminId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (row) {
            console.log('✅ Experimento encontrado:', row.id);
            resolve({ id: row.id, isNew: false });
            return;
          }
          
          // Crear experimento nuevo
          const config = JSON.stringify({
            num_blocks: 5,
            minutes_per_block: 5.22,
            quotas: { V: 2, K: 2, A: 2, PST: 3, PFT: 6 },
            stim_blocks: [0, 2, 4],
            book_title: "Charlie y la fabrica de chocolate",
            initial_page: 5
          });
          
          db.run(
            `INSERT INTO experiments (user_id, name, description, config, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [adminId, expName, 'Experimento de prueba con datos de ejemplo', config],
            function(err) {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Experimento creado:', this.lastID);
                resolve({ id: this.lastID, isNew: true });
              }
            }
          );
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

function createExperimentRun(experimentId) {
  return new Promise(async (resolve, reject) => {
    try {
      const adminId = await getAdminUser();
      const sessionId = `session_${experimentId}_${Date.now()}`;
      
      db.run(
        `INSERT INTO experiment_runs (experiment_id, user_id, session_id, status, started_at)
         VALUES (?, ?, ?, 'in_progress', CURRENT_TIMESTAMP)`,
        [experimentId, adminId, sessionId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log('✅ Corrida creada:', this.lastID, 'SessionID:', sessionId);
            resolve({ runId: this.lastID, sessionId });
          }
        }
      );
    } catch (err) {
      reject(err);
    }
  });
}

function loadCSVData(runId) {
  return new Promise((resolve, reject) => {
    try {
      // Leer archivos CSV
      const gazePath = path.join(EXAMPLE_SESSION_PATH, 'gaze_samples.csv');
      const eventsPath = path.join(EXAMPLE_SESSION_PATH, 'mind_wandering_events.csv');
      
      if (!fs.existsSync(gazePath) || !fs.existsSync(eventsPath)) {
        console.log('⚠️  Archivos de ejemplo no encontrados, continuando sin datos...');
        resolve({ gazeCount: 0, eventCount: 0 });
        return;
      }
      
      const gazeContent = fs.readFileSync(gazePath, 'utf8').split('\n').filter(l => l.trim());
      const eventContent = fs.readFileSync(eventsPath, 'utf8').split('\n').filter(l => l.trim());
      
      console.log(`\n📊 Leyendo archivos CSV...`);
      console.log(`   Gaze samples: ${gazeContent.length - 1} filas`);
      console.log(`   Mind wandering events: ${eventContent.length - 1} filas`);
      
      let gazeInserted = 0;
      let eventInserted = 0;
      
      // Insertar gaze samples (saltear header)
      gazeContent.slice(1).forEach((line, idx) => {
        if (!line.trim()) return;
        
        const parts = line.split(',');
        if (parts.length < 6) return;
        
        const [timestamp_ms, x_px, y_px, confidence, block_number, page_number] = parts;
        
        db.run(
          `INSERT INTO gaze_samples 
           (run_id, timestamp_ms, x_px, y_px, confidence, block_number, page_number)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [runId, parseInt(timestamp_ms), parseInt(x_px), parseInt(y_px), 
           parseFloat(confidence), parseInt(block_number), parseInt(page_number)],
          (err) => {
            if (!err) gazeInserted++;
            if (idx === gazeContent.length - 2 && eventContent.length > 1) {
              insertEvents();
            }
          }
        );
      });
      
      function insertEvents() {
        eventContent.slice(1).forEach((line, idx) => {
          if (!line.trim()) return;
          
          const parts = line.split(',');
          if (parts.length < 7) return;
          
          const [event_id, timestamp_start_ms, timestamp_end_ms, duration_ms, 
                 confidence_percent, block_number, description] = parts;
          
          db.run(
            `INSERT INTO mind_wandering_events 
             (run_id, event_timestamp_ms, timestamp_end_ms, duration_ms, confidence, 
              block_number, event_id, event_type, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [runId, parseInt(timestamp_start_ms), parseInt(timestamp_end_ms), 
             parseInt(duration_ms), parseFloat(confidence_percent), 
             parseInt(block_number), event_id.trim(), 'mind_wandering', description.trim()],
            (err) => {
              if (!err) eventInserted++;
              if (idx === eventContent.length - 2) {
                console.log(`✅ Datos CSV cargados:`);
                console.log(`   ${gazeInserted} gaze samples`);
                console.log(`   ${eventInserted} mind wandering events`);
                resolve({ gazeCount: gazeInserted, eventCount: eventInserted });
              }
            }
          );
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function run() {
  try {
    console.log('🚀 Iniciando carga de datos de ejemplo...\n');
    
    // 1. Obtener o crear experimento
    const exp = await getOrCreateExperiment();
    
    // 2. Crear corrida
    const run = await createExperimentRun(exp.id);
    
    // 3. Cargar datos CSV
    const csvData = await loadCSVData(run.runId);
    
    // 4. Obtener info del libro
    const book = await getBook('Charlie y la fabrica');
    console.log(`\n📕 Libro configurado:`, book?.title || 'No encontrado');
    console.log(`   Página: 5\n`);
    
    console.log('✅ ================================');
    console.log('✅ EXPERIMENTO CONFIGURADO');
    console.log('✅ ================================');
    console.log(`Experimento: Test_Experiment_1767733548563 (ID: ${exp.id})`);
    console.log(`Corrida: ${run.runId} (SessionID: ${run.sessionId})`);
    console.log(`Datos cargados: ${csvData.gazeCount} gaze + ${csvData.eventCount} eventos`);
    console.log(`Libro: ${book?.title || 'Sin asignar'}`);
    console.log(`Página: 5`);
    console.log(`URL para ver resultados: http://localhost:3000/resultados?runId=${run.runId}`);
    console.log('\n✅ Puedes iniciar el experimento desde la interfaz de administrador\n');
    
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    db.close();
    process.exit(1);
  }
}

run();
