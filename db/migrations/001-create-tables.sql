-- ============================================================
-- MIGRACIÓN 001: CREAR SCHEMA PARA EXPERIMENTOS CON BD
-- Fecha: 4 enero 2026
-- Nota: Ejecutar en SQLite (se adapta automáticamente)
-- ============================================================

-- Tabla: experiments
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
);

CREATE INDEX IF NOT EXISTS idx_experiments_user_active ON experiments(user_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiments_name ON experiments(name, deleted_at);
CREATE INDEX IF NOT EXISTS idx_experiments_deleted ON experiments(deleted_at);

-- Tabla: experiment_blocks
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
);

CREATE INDEX IF NOT EXISTS idx_experiment_blocks_exp_block ON experiment_blocks(experiment_id, block_number);
CREATE INDEX IF NOT EXISTS idx_experiment_blocks_exp_order ON experiment_blocks(experiment_id, order_index);

-- Tabla: experiment_runs (ejecuciones)
CREATE TABLE IF NOT EXISTS experiment_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  session_id VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'running',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  duration_seconds INTEGER,
  notes TEXT,
  ai_processing_status VARCHAR(20) DEFAULT 'pending',
  ai_processing_version VARCHAR(50),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_user_date ON experiment_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_experiment_runs_exp_date ON experiment_runs(experiment_id, started_at);
CREATE INDEX IF NOT EXISTS idx_experiment_runs_status ON experiment_runs(status);
CREATE INDEX IF NOT EXISTS idx_experiment_runs_session ON experiment_runs(session_id);

-- Tabla: run_assets (videos, audios, CSVs)
CREATE TABLE IF NOT EXISTS run_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  block_number INTEGER,
  asset_type VARCHAR(50) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255),
  file_size_bytes BIGINT,
  duration_seconds INTEGER,
  mime_type VARCHAR(100),
  checksum VARCHAR(256),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME,
  notes TEXT,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_assets_run_block ON run_assets(run_id, block_number);
CREATE INDEX IF NOT EXISTS idx_run_assets_type_run ON run_assets(asset_type, run_id);

-- Tabla: run_events (todos los eventos durante ejecución)
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  block_number INTEGER,
  event_type VARCHAR(50) NOT NULL, -- stimulus, response, gaze_sample, marker
  timestamp_ms BIGINT NOT NULL, -- milisegundos desde inicio
  data TEXT, -- JSON con detalles del evento
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_time ON run_events(run_id, timestamp_ms ASC);
CREATE INDEX IF NOT EXISTS idx_run_events_run_block_type ON run_events(run_id, block_number, event_type);
CREATE INDEX IF NOT EXISTS idx_run_events_type ON run_events(event_type);

-- Tabla: gaze_samples (eye-tracking detallado)
CREATE TABLE IF NOT EXISTS gaze_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  timestamp_ms BIGINT NOT NULL,
  x_px INTEGER,
  y_px INTEGER,
  confidence DECIMAL(3,2),
  is_valid BOOLEAN DEFAULT 1,
  block_number INTEGER,
  is_in_text_area BOOLEAN,
  ai_divagation_predicted BOOLEAN,
  ai_confidence DECIMAL(3,2),
  raw_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_gaze_samples_run_time ON gaze_samples(run_id, timestamp_ms ASC);
CREATE INDEX IF NOT EXISTS idx_gaze_samples_run_block ON gaze_samples(run_id, block_number, is_valid);
CREATE INDEX IF NOT EXISTS idx_gaze_samples_ai ON gaze_samples(run_id, ai_divagation_predicted);

-- Tabla: mind_wandering_events
CREATE TABLE IF NOT EXISTS mind_wandering_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  start_timestamp_ms BIGINT NOT NULL,
  end_timestamp_ms BIGINT,
  duration_ms INTEGER,
  confidence DECIMAL(3,2),
  ai_model_version VARCHAR(50),
  ai_model_name VARCHAR(100),
  detection_method VARCHAR(50),
  gaze_samples_involved TEXT,
  block_number INTEGER,
  reason VARCHAR(100),
  human_verified BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mind_wandering_run_time ON mind_wandering_events(run_id, start_timestamp_ms ASC);
CREATE INDEX IF NOT EXISTS idx_mind_wandering_confidence ON mind_wandering_events(run_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_mind_wandering_model ON mind_wandering_events(ai_model_version);

-- Tabla: block_summaries
CREATE TABLE IF NOT EXISTS block_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL UNIQUE,
  block_number INTEGER,
  total_duration_seconds INTEGER,
  total_mind_wandering_ms BIGINT,
  total_mind_wandering_events INTEGER,
  avg_mind_wandering_duration_ms DECIMAL(10,2),
  avg_gaze_confidence DECIMAL(3,2),
  stimulus_count TEXT,
  gaze_samples_count INTEGER,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ai_processed BOOLEAN DEFAULT 0,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_block_summaries_run_block ON block_summaries(run_id, block_number);

-- Tabla: audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name VARCHAR(100) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL,
  old_values TEXT,
  new_values TEXT,
  user_id INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(50),
  changes_summary TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log(user_id, timestamp DESC);

-- ============================================================
-- TRIGGERS para actualizar updated_at (SQLite)
-- ============================================================

CREATE TRIGGER IF NOT EXISTS experiments_update_timestamp
AFTER UPDATE ON experiments
FOR EACH ROW
BEGIN
  UPDATE experiments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;


