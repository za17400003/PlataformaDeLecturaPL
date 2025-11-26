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
      password TEXT NOT NULL,
      isDeveloper INTEGER DEFAULT 0,
      preferences TEXT DEFAULT '{"fontSize": 100, "theme": "light", "font": "original", "lineHeight": "1.6"}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error al crear tabla users:', err.message);
    }
    // Silenciar mensaje de verificación exitoso y quitar creación automática de admin
  });
});

module.exports = db;
