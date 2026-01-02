const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
const dbPath = path.join(dbDir, 'users.db');

// Crear directorio si no existe
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir base de datos:', err.message);
  } else {
    console.log('✅ Base de datos conectada:', dbPath);
  }
});

// Crear tabla de usuarios
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isDeveloper INTEGER DEFAULT 0,
      isVerified INTEGER DEFAULT 0,
      verificationToken TEXT,
      verificationTokenExpires DATETIME,
      preferences TEXT DEFAULT '{"fontSize": 100, "theme": "light", "font": "original", "lineHeight": 1.45, "brightness": 1.0}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla users:', err.message);
    }
  });

  // Crear tabla de progreso de lectura
  db.run(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      bookFile TEXT NOT NULL,
      currentPage INTEGER DEFAULT 1,
      totalPages INTEGER DEFAULT 1,
      progress REAL DEFAULT 0,
      lastReadAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, bookFile)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla reading_progress:', err.message);
    }
  });

  // Crear índices para optimizar queries
  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_userId ON reading_progress(userId)', (err) => {
    if (err) {
      console.error('⚠️ Error al crear índice userId:', err.message);
    } else {
      console.log('✅ Índice idx_reading_progress_userId creado');
    }
  });

  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_bookFile ON reading_progress(bookFile)', (err) => {
    if (err) {
      console.error('⚠️ Error al crear índice bookFile:', err.message);
    } else {
      console.log('✅ Índice idx_reading_progress_bookFile creado');
    }
  });

  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_userId_bookFile ON reading_progress(userId, bookFile)', (err) => {
    if (err) {
      console.error('⚠️ Error al crear índice userId_bookFile:', err.message);
    } else {
      console.log('✅ Índice idx_reading_progress_userId_bookFile creado');
    }
  });

  // Tabla de experimentos
  db.run(`
    CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, name)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla experiments:', err.message);
    }
  });

  // Tabla de bloques de lectura
  db.run(`
    CREATE TABLE IF NOT EXISTS reading_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experimentId INTEGER NOT NULL,
      blockNumber INTEGER NOT NULL,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experimentId) REFERENCES experiments(id) ON DELETE CASCADE,
      UNIQUE(experimentId, blockNumber)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla reading_blocks:', err.message);
    }
  });

  // Tabla de configuración de bloques
  db.run(`
    CREATE TABLE IF NOT EXISTS block_stimuli_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockId INTEGER NOT NULL UNIQUE,
      vibrationEnabled INTEGER DEFAULT 0,
      auditoryEnabled INTEGER DEFAULT 0,
      visualEnabled INTEGER DEFAULT 0,
      extraStimuli TEXT,
      randomFrequency REAL NOT NULL DEFAULT 1.0,
      frequencyCross INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blockId) REFERENCES reading_blocks(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla block_stimuli_config:', err.message);
    }
  });

  // Crear índices para experimentos (no mostrar logs innecesarios)
  db.run('CREATE INDEX IF NOT EXISTS idx_experiments_userId ON experiments(userId)');

  db.run('CREATE INDEX IF NOT EXISTS idx_reading_blocks_experimentId ON reading_blocks(experimentId)');
});

module.exports = db;
