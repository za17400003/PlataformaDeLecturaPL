#!/usr/bin/env node

/**
 * Script para crear tablas faltantes en la BD
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'db', 'users.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error conectando a BD:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Crear tabla books si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      author TEXT,
      filename TEXT,
      filepath TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creando tabla books:', err);
    else console.log('✅ Tabla books creada o ya existe');
  });

  // Crear tabla gaze_samples si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS gaze_samples (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      timestamp_ms INTEGER,
      x_px INTEGER,
      y_px INTEGER,
      confidence REAL,
      block_number INTEGER,
      page_number INTEGER,
      validity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creando tabla gaze_samples:', err);
    else console.log('✅ Tabla gaze_samples creada o ya existe');
  });

  // Crear tabla mind_wandering_events si no existe (corregida)
  db.run(`
    CREATE TABLE IF NOT EXISTS mind_wandering_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      timestamp_ms INTEGER,
      duration_ms INTEGER,
      confidence REAL,
      block_number INTEGER,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES experiment_runs(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creando tabla mind_wandering_events:', err);
    else console.log('✅ Tabla mind_wandering_events creada o ya existe');
  });

  // Insertar libros de ejemplo
  const books = [
    { title: "Charlie y la fabrica de chocolate Ilus por Quentin Blake - Roald Dahl", author: "Roald Dahl", filename: "Charlie y la fabrica de chocolate Ilus por Quentin Blake - Roald Dahl.epub" },
    { title: "Coraline - Neil Gaiman", author: "Neil Gaiman", filename: "Coraline - Neil Gaiman.epub" },
    { title: "El amuleto perdido - Juan GomezJurado", author: "Juan Gómez Jurado", filename: "El amuleto perdido - Juan GomezJurado.epub" },
    { title: "Cuentos en verso para ninos perversos - Roald Dahl", author: "Roald Dahl", filename: "Cuentos en verso para ninos perversos - Roald Dahl.epub" },
    { title: "Sueñan los androides con ovejas eléctricas - Philip K. Dick", author: "Philip K. Dick", filename: "_Suenan los androides con ovejas electri - Philip K. Dick.epub" }
  ];

  books.forEach((book, idx) => {
    db.run(
      `INSERT OR IGNORE INTO books (title, author, filename) VALUES (?, ?, ?)`,
      [book.title, book.author, book.filename],
      (err) => {
        if (err) console.error('Error insertando libro:', err);
        else if (idx === books.length - 1) {
          console.log(`✅ ${books.length} libros insertados`);
          db.close();
          process.exit(0);
        }
      }
    );
  });
});
