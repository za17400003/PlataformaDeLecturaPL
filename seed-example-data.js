/**
 * Script para inyectar datos de ejemplo en un experimento
 * para testing de la visualización de resultados
 */

const sqlite3 = require('sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'db', 'users.db');
const db = new sqlite3.Database(dbPath);

// Datos de ejemplo
const EXPERIMENT_ID = 6; // Será buscado automáticamente

let RUN_ID = null; // Será asignado después

console.log('🌱 Inyectando datos de ejemplo...\n');

// Función para insertar gaze data
function seedGazeData() {
  return new Promise((resolve, reject) => {
    console.log('📊 Insertando datos de gaze...');
    
    const gazeData = [];
    const now = new Date();
    
    // Generar 1000 puntos de gaze simulados
    for (let i = 0; i < 1000; i++) {
      const timestamp = now.getTime() + (i * 30); // 30ms entre puntos
      const x = Math.floor(Math.random() * 1920); // Resolución típica
      const y = Math.floor(Math.random() * 1080);
      const confidence = Math.random() * 100;
      const blockNumber = Math.floor(i / 200) + 1; // 200 puntos por bloque
      
      gazeData.push({
        run_id: RUN_ID,
        timestamp_ms: timestamp,
        x_px: x,
        y_px: y,
        confidence: confidence.toFixed(2),
        block_number: blockNumber
      });
    }
    
    // Insertar en lotes
    const stmt = db.prepare(`
      INSERT INTO gaze_samples 
      (run_id, timestamp_ms, x_px, y_px, confidence, block_number)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      gazeData.forEach(row => {
        stmt.run([
          row.run_id,
          row.timestamp_ms,
          row.x_px,
          row.y_px,
          row.confidence,
          row.block_number
        ]);
      });
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Insertados ${gazeData.length} registros de gaze`);
          resolve();
        }
      });
    });
  });
}

// Función para insertar eventos
function seedEventData() {
  return new Promise((resolve, reject) => {
    console.log('📝 Insertando datos de eventos...');
    
    const events = [];
    const now = new Date();
    
    // Eventos de ejemplo
    const eventTypes = ['pause', 'resume', 'block_start', 'block_end', 'distraction'];
    
    for (let i = 0; i < 20; i++) {
      events.push({
        run_id: RUN_ID,
        event_type: eventTypes[i % eventTypes.length],
        timestamp_ms: now.getTime() + (i * 15000),
        block_number: Math.floor(i / 4) + 1,
        event_data: JSON.stringify({
          duration: Math.floor(Math.random() * 5000),
          reason: ['off-task', 'technical', 'user-pause', 'natural'][Math.floor(Math.random() * 4)],
          severity: Math.random() > 0.5 ? 'high' : 'low'
        })
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO run_events 
      (run_id, event_type, timestamp_ms, block_number, event_data)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      events.forEach(row => {
        stmt.run([
          row.run_id,
          row.event_type,
          row.timestamp_ms,
          row.block_number,
          row.event_data
        ]);
      });
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Insertados ${events.length} eventos`);
          resolve();
        }
      });
    });
  });
}

// Función para crear un video de ejemplo (simplemente registrarlo en run_assets)
function seedVideoData() {
  return new Promise((resolve, reject) => {
    console.log('🎬 Registrando videos de ejemplo...');
    
    const videos = [];
    
    // Registrar 5 bloques de video
    for (let i = 1; i <= 5; i++) {
      videos.push({
        run_id: RUN_ID,
        asset_type: 'video',
        asset_path: `/sessions/session_${RUN_ID}/block_${i}_recording.mp4`,
        block_number: i
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO run_assets 
      (run_id, asset_type, asset_path, block_number)
      VALUES (?, ?, ?, ?)
    `);
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      videos.forEach(row => {
        stmt.run([
          row.run_id,
          row.asset_type,
          row.asset_path,
          row.block_number
        ]);
      });
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else {
          console.log(`✅ Registrados ${videos.length} videos`);
          resolve();
        }
      });
    });
  });
}

// Verificar que el run existe y obtener su ID
function verifyRun() {
  return new Promise((resolve, reject) => {
    // Si RUN_ID aún no está asignado, buscar el run más reciente
    if (!RUN_ID) {
      db.get(
        'SELECT id FROM experiment_runs ORDER BY id DESC LIMIT 1',
        (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            console.error(`❌ No hay runs en la base de datos`);
            process.exit(1);
          } else {
            RUN_ID = row.id;
            console.log(`✅ Run más reciente encontrado: ID=${RUN_ID}\n`);
            resolve();
          }
        }
      );
    } else {
      resolve();
    }
  });
}

// Limpiar datos previos
function cleanExistingData() {
  return new Promise((resolve, reject) => {
    console.log('🧹 Limpiando datos previos...');
    
    db.serialize(() => {
      db.run('DELETE FROM gaze_samples WHERE run_id = ?', [RUN_ID]);
      db.run('DELETE FROM run_events WHERE run_id = ?', [RUN_ID]);
      db.run('DELETE FROM run_assets WHERE run_id = ? AND asset_type = "video"', [RUN_ID], (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Datos limpios\n');
          resolve();
        }
      });
    });
  });
}

// Ejecutar todo
async function main() {
  try {
    await verifyRun();
    await cleanExistingData();
    await seedGazeData();
    await seedEventData();
    await seedVideoData();
    
    console.log('\n✨ ¡Datos de ejemplo inyectados exitosamente!');
    console.log(`\nPara ver los resultados:`);
    console.log(`1. Abre http://localhost:3000`);
    console.log(`2. Ve a "Experimento 6-1-2026 09:36" (o similar)`);
    console.log(`3. Presiona el botón "📊 Resultados"`);
    console.log(`4. Selecciona "Corrida 7" y explora los tabs "Datos" y "Videos"`);
    
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err);
    process.exit(1);
  }
}

main();
