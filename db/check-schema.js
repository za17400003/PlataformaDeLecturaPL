const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'db', 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir base de datos:', err.message);
    process.exit(1);
  }
});

// Listar todas las tablas
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
  if (err) {
    console.error('❌ Error:', err.message);
    db.close();
    process.exit(1);
  }

  console.log('📋 Tablas en la base de datos:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });

  console.log('\n📐 Schema de experiments:');
  db.all("PRAGMA table_info(experiments)", (err, columns) => {
    if (err) {
      console.error('  ❌ Tabla no existe');
    } else {
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
      });
    }

    console.log('\n📐 Schema de experiment_runs:');
    db.all("PRAGMA table_info(experiment_runs)", (err, columns) => {
      if (err) {
        console.error('  ❌ Tabla no existe');
      } else {
        columns.forEach(col => {
          console.log(`  - ${col.name} (${col.type})`);
        });
      }

      db.close();
    });
  });
});
