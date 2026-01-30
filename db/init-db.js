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

// PASO 1: Crear tablas base (users, reading_progress, etc)
db.serialize(() => {
  // Tabla de usuarios
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
  `);

  // Tabla de progreso de lectura
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
  `);

  // Crear índices
  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_userId ON reading_progress(userId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_bookFile ON reading_progress(bookFile)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reading_progress_userId_bookFile ON reading_progress(userId, bookFile)');

  // PASO 2: Crear tablas de experimentos (en orden correcto de dependencias)
  
  // experiments depende de users
  db.run(`
    CREATE TABLE IF NOT EXISTS experiments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      version_number INTEGER DEFAULT 1,
      is_template BOOLEAN DEFAULT 0,
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_experiments_user_active ON experiments(user_id, deleted_at, created_at DESC)');
  db.run('CREATE INDEX IF NOT EXISTS idx_experiments_name ON experiments(name, deleted_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_experiments_deleted ON experiments(deleted_at)');

  // experiment_blocks depende de experiments
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      name VARCHAR(255),
      duration_minutes DECIMAL(5,2),
      book_id INTEGER,
      page_number INTEGER,
      config TEXT,
      order_index INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_blocks_exp_block ON experiment_blocks(experiment_id, block_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_blocks_exp_order ON experiment_blocks(experiment_id, order_index)');

  // experiment_runs depende de experiments
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experiment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      session_id VARCHAR(100) NOT NULL UNIQUE,
      status VARCHAR(50) DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      duration_seconds INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // experiment_run_blocks depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS experiment_run_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      block_id VARCHAR(100),
      block_number INTEGER,
      book_id VARCHAR(255),
      page_number INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_run_blocks_run ON experiment_run_blocks(run_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_run_blocks_block ON experiment_run_blocks(run_id, block_number)');

  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_runs_exp_user ON experiment_runs(experiment_id, user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_experiment_runs_session ON experiment_runs(session_id)');

  // run_assets depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS run_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      asset_type VARCHAR(50),
      asset_path VARCHAR(500),
      block_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_run_assets_run ON run_assets(run_id)');

  // run_events depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS run_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      block_number INTEGER,
      event_type VARCHAR(100),
      event_data TEXT,
      timestamp_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_run_events_run ON run_events(run_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_run_events_block ON run_events(block_number)');

  // gaze_samples depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS gaze_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      timestamp_ms INTEGER,
      x_px INTEGER,
      y_px INTEGER,
      confidence REAL,
      block_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_gaze_samples_run ON gaze_samples(run_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_gaze_samples_timestamp ON gaze_samples(run_id, timestamp_ms)');

  // mind_wandering_events depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS mind_wandering_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      block_number INTEGER,
      event_timestamp_ms INTEGER,
      duration_ms INTEGER,
      confidence REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_mind_wandering_run ON mind_wandering_events(run_id)');

  // block_summaries depende de experiment_runs
  db.run(`
    CREATE TABLE IF NOT EXISTS block_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      block_number INTEGER,
      total_samples INTEGER,
      avg_x REAL,
      avg_y REAL,
      avg_confidence REAL,
      mind_wandering_count INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_block_summaries_run ON block_summaries(run_id)');

  // audit_log para seguimiento de cambios
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      table_name VARCHAR(100),
      action VARCHAR(50),
      record_id INTEGER,
      changes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name)');

  // Escribir lock file después de que todo se ejecute
  setTimeout(() => {
    const lockFile = path.join(__dirname, '.migrations_completed');
    if (!fs.existsSync(lockFile)) {
      fs.writeFileSync(lockFile, 'completed', 'utf-8');
      console.log('✅ Schema completamente inicializado y lock file creado');
    }
  }, 500);
});

module.exports = db;
