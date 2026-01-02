/**
 * Script para agregar campos bookId y pageNumber a la tabla reading_blocks
 * Ejecutar: node db/add-book-fields.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir base de datos:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Conectado a base de datos');
  }
});

db.serialize(() => {
  // Agregar columna bookId
  db.run(`
    ALTER TABLE reading_blocks 
    ADD COLUMN bookId TEXT
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⚠️  Columna bookId ya existe');
      } else {
        console.error('❌ Error al agregar bookId:', err.message);
      }
    } else {
      console.log('✅ Columna bookId agregada');
    }
  });

  // Agregar columna pageNumber
  db.run(`
    ALTER TABLE reading_blocks 
    ADD COLUMN pageNumber INTEGER DEFAULT 1
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('⚠️  Columna pageNumber ya existe');
      } else {
        console.error('❌ Error al agregar pageNumber:', err.message);
      }
    } else {
      console.log('✅ Columna pageNumber agregada');
    }
  });

  // Cerrar la conexión después de un pequeño delay
  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('❌ Error al cerrar DB:', err);
      } else {
        console.log('✅ Base de datos cerrada');
      }
      process.exit(0);
    });
  }, 500);
});
