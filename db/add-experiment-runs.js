const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creando tablas para corridas de experimentos...');

db.serialize(() => {
  // Tabla de corridas de experimentos
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experimentId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
      endTime DATETIME,
      status TEXT DEFAULT 'in_progress', -- in_progress, completed, cancelled
      duration INTEGER, -- duración total en segundos
      totalBlocks INTEGER,
      completedBlocks INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (experimentId) REFERENCES experiments(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla experiment_runs:', err);
    } else {
      console.log('✅ Tabla experiment_runs creada');
    }
  });

  // Tabla de datos de bloques dentro de una corrida
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_run_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      runId INTEGER NOT NULL,
      blockId INTEGER NOT NULL,
      blockNumber INTEGER NOT NULL,
      startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
      endTime DATETIME,
      duration INTEGER, -- duración real del bloque en segundos
      bookId INTEGER,
      pageNumber INTEGER,
      FOREIGN KEY (runId) REFERENCES experiment_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (blockId) REFERENCES reading_blocks(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla experiment_run_blocks:', err);
    } else {
      console.log('✅ Tabla experiment_run_blocks creada');
    }
  });

  // Tabla de datos capturados durante el experimento
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      runId INTEGER NOT NULL,
      runBlockId INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      dataType TEXT NOT NULL, -- 'eye_tracking', 'reading_progress', 'stimulus_response', 'fixation', 'saccade', etc.
      data TEXT, -- JSON con los datos específicos
      FOREIGN KEY (runId) REFERENCES experiment_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (runBlockId) REFERENCES experiment_run_blocks(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creando tabla experiment_data:', err);
    } else {
      console.log('✅ Tabla experiment_data creada');
    }
  });

  // Índices para mejorar el rendimiento
  db.run(`CREATE INDEX IF NOT EXISTS idx_experiment_runs_experimentId 
          ON experiment_runs(experimentId)`, (err) => {
    if (err) console.error('❌ Error creando índice idx_experiment_runs_experimentId:', err);
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_experiment_runs_userId 
          ON experiment_runs(userId)`, (err) => {
    if (err) console.error('❌ Error creando índice idx_experiment_runs_userId:', err);
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_experiment_run_blocks_runId 
          ON experiment_run_blocks(runId)`, (err) => {
    if (err) console.error('❌ Error creando índice idx_experiment_run_blocks_runId:', err);
  });

  db.run(`CREATE INDEX IF NOT EXISTS idx_experiment_data_runId 
          ON experiment_data(runId)`, (err) => {
    if (err) console.error('❌ Error creando índice idx_experiment_data_runId:', err);
  });

  console.log('✅ Índices creados');
});

db.close((err) => {
  if (err) {
    console.error('❌ Error cerrando base de datos:', err);
  } else {
    console.log('✅ Base de datos actualizada correctamente');
  }
});
