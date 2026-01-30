#!/usr/bin/env node

/**
 * Migración: Agregar tabla books y campos faltantes
 * - Crear tabla books
 * - Agregar page_number a gaze_samples
 * - Agregar event_id, event_type, timestamp_end_ms, description a mind_wandering_events
 * - Estandarizar a snake_case (si aplica)
 * - Asegurar indices para segregación por usuario
 * 
 * Ejecutar: node db/migrate-add-books-and-fields.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir BD:', err.message);
    process.exit(1);
  } else {
    console.log('✅ BD conectada:', dbPath);
  }
});

let migrationsCompleted = 0;
let migrationsFailed = 0;

// Helper para ejecutar queries
const runAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error(`❌ Error en query: ${sql.substring(0, 50)}...`);
        console.error(`   ${err.message}`);
        migrationsFailed++;
        reject(err);
      } else {
        migrationsCompleted++;
        resolve(this);
      }
    });
  });
};

const allAsync = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function migrate() {
  console.log('\n📋 INICIANDO MIGRACIONES...\n');

  try {
    // ============ MIGRACIÓN 1: Crear tabla books ============
    console.log('1️⃣  Creando tabla books...');
    await runAsync(`
      CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(500),
        author VARCHAR(255),
        publisher VARCHAR(255),
        language VARCHAR(10) DEFAULT 'es',
        file_size_bytes INTEGER,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabla books creada/existe');

    // Crear índices para books
    await runAsync('CREATE INDEX IF NOT EXISTS idx_books_filename ON books(filename)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)');
    console.log('   ✅ Índices para books creados');

    // ============ MIGRACIÓN 2: Verificar gaze_samples ============
    console.log('\n2️⃣  Verificando campos en gaze_samples...');
    
    const gazeColumns = await allAsync(`
      PRAGMA table_info(gaze_samples)
    `);
    const gazeColumnNames = gazeColumns.map(col => col.name);
    
    if (!gazeColumnNames.includes('page_number')) {
      console.log('   ⚠️  Agregando page_number a gaze_samples...');
      await runAsync('ALTER TABLE gaze_samples ADD COLUMN page_number INTEGER');
      console.log('   ✅ page_number agregado');
    } else {
      console.log('   ℹ️  page_number ya existe');
    }

    if (!gazeColumnNames.includes('validity')) {
      console.log('   ⚠️  Agregando validity a gaze_samples...');
      await runAsync('ALTER TABLE gaze_samples ADD COLUMN validity INTEGER DEFAULT 1');
      console.log('   ✅ validity agregado');
    } else {
      console.log('   ℹ️  validity ya existe');
    }

    // ============ MIGRACIÓN 3: Verificar mind_wandering_events ============
    console.log('\n3️⃣  Verificando campos en mind_wandering_events...');
    
    const eventsColumns = await allAsync(`
      PRAGMA table_info(mind_wandering_events)
    `);
    const eventsColumnNames = eventsColumns.map(col => col.name);

    if (!eventsColumnNames.includes('event_id')) {
      console.log('   ⚠️  Agregando event_id a mind_wandering_events...');
      await runAsync('ALTER TABLE mind_wandering_events ADD COLUMN event_id VARCHAR(100)');
      console.log('   ✅ event_id agregado');
    } else {
      console.log('   ℹ️  event_id ya existe');
    }

    if (!eventsColumnNames.includes('event_type')) {
      console.log('   ⚠️  Agregando event_type a mind_wandering_events...');
      await runAsync('ALTER TABLE mind_wandering_events ADD COLUMN event_type VARCHAR(100)');
      console.log('   ✅ event_type agregado');
    } else {
      console.log('   ℹ️  event_type ya existe');
    }

    if (!eventsColumnNames.includes('timestamp_end_ms')) {
      console.log('   ⚠️  Agregando timestamp_end_ms a mind_wandering_events...');
      await runAsync('ALTER TABLE mind_wandering_events ADD COLUMN timestamp_end_ms INTEGER');
      console.log('   ✅ timestamp_end_ms agregado');
    } else {
      console.log('   ℹ️  timestamp_end_ms ya existe');
    }

    if (!eventsColumnNames.includes('description')) {
      console.log('   ⚠️  Agregando description a mind_wandering_events...');
      await runAsync('ALTER TABLE mind_wandering_events ADD COLUMN description TEXT');
      console.log('   ✅ description agregado');
    } else {
      console.log('   ℹ️  description ya existe');
    }

    // ============ MIGRACIÓN 4: Agregar resetToken fields a users ============
    console.log('\n4️⃣  Verificando campos en users para password recovery...');
    
    const userColumns = await allAsync(`
      PRAGMA table_info(users)
    `);
    const userColumnNames = userColumns.map(col => col.name);

    if (!userColumnNames.includes('resetToken')) {
      console.log('   ⚠️  Agregando resetToken a users...');
      await runAsync('ALTER TABLE users ADD COLUMN resetToken TEXT');
      console.log('   ✅ resetToken agregado');
    } else {
      console.log('   ℹ️  resetToken ya existe');
    }

    if (!userColumnNames.includes('resetTokenExpires')) {
      console.log('   ⚠️  Agregando resetTokenExpires a users...');
      await runAsync('ALTER TABLE users ADD COLUMN resetTokenExpires DATETIME');
      console.log('   ✅ resetTokenExpires agregado');
    } else {
      console.log('   ℹ️  resetTokenExpires ya existe');
    }

    // ============ MIGRACIÓN 5: Crear índices para segregación por usuario ============
    console.log('\n5️⃣  Creando índices para segregación por usuario...');
    
    // Los índices de segregación se manejarán en las queries del server.js
    // usando JOINs, no con partial indexes (SQLite no soporta subqueries en WHERE)
    
    // Índices simples para performance
    await runAsync('CREATE INDEX IF NOT EXISTS idx_experiment_runs_user_id ON experiment_runs(user_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_gaze_samples_run_id ON gaze_samples(run_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_mind_wandering_events_run_id ON mind_wandering_events(run_id)');

    console.log('   ✅ Índices de performance creados');

    // ============ MIGRACIÓN 6: Poblar tabla books desde archivos EPUB ============
    console.log('\n6️⃣  Detectando libros desde carpeta /public/libros...');
    
    const librosPath = path.join(__dirname, '..', 'public', 'libros');
    let booksLoaded = 0;

    if (fs.existsSync(librosPath)) {
      const files = fs.readdirSync(librosPath).filter(f => f.toLowerCase().endsWith('.epub'));
      
      for (const file of files) {
        const filePath = path.join(librosPath, file);
        const stats = fs.statSync(filePath);
        const title = file.replace(/\.epub$/i, '').trim();

        // Insertaré sin reemplazar si ya existe
        try {
          await new Promise((resolve, reject) => {
            db.run(
              `INSERT OR IGNORE INTO books(filename, title, file_size_bytes) VALUES(?, ?, ?)`,
              [file, title, stats.size],
              (err) => {
                if (err) {
                  if (err.message.includes('UNIQUE')) {
                    // Ya existe, ok
                    resolve();
                  } else {
                    reject(err);
                  }
                } else {
                  booksLoaded++;
                  resolve();
                }
              }
            );
          });
        } catch (err) {
          console.error(`   ⚠️  Error agregando libro ${file}: ${err.message}`);
        }
      }
      
      console.log(`   ✅ ${booksLoaded} libro(s) agregado(s) a tabla books`);
      console.log(`   📚 Total libros disponibles: ${files.length}`);
    } else {
      console.log('   ⚠️  Carpeta /public/libros no encontrada');
    }

    // ============ RESUMEN ============
    console.log('\n✅ TODAS LAS MIGRACIONES COMPLETADAS\n');
    console.log(`📊 Resumen:`);
    console.log(`   ✅ Queries exitosas: ${migrationsCompleted}`);
    if (migrationsFailed > 0) {
      console.log(`   ⚠️  Queries fallidas: ${migrationsFailed}`);
    }
    console.log(`   📚 Libros cargados: ${booksLoaded}`);
    console.log('\n✨ BD lista para usar con datos de ejemplo\n');

    db.close();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ ERROR EN MIGRACIÓN:', err.message);
    console.error('\n💡 Si el error es de UNIQUE constraint, probablemente la tabla ya existe');
    console.error('   y está bien. Intenta insertar datos de ejemplo nuevamente.\n');
    db.close();
    process.exit(1);
  }
}

// Ejecutar migraciones
migrate();
