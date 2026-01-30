const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

console.log('📋 Copiando assets de corrida 1 a corrida 7...\n');

// Primero, leer todos los assets de corrida 1
db.all(
  `SELECT asset_type, asset_path, block_number FROM run_assets WHERE run_id = 1`,
  (err, rows) => {
    if (err) {
      console.error('Error leyendo run_assets:', err);
      db.close();
      process.exit(1);
    }

    let inserted = 0;
    let total = rows.length;

    // Insertar cada asset en corrida 7
    rows.forEach((row, idx) => {
      db.run(
        `INSERT INTO run_assets (run_id, asset_type, asset_path, block_number, created_at)
         VALUES (7, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [row.asset_type, row.asset_path, row.block_number],
        function(err) {
          if (err) {
            console.error(`❌ Error insertando bloque ${row.block_number}:`, err.message);
          } else {
            inserted++;
            console.log(`✅ Bloque ${row.block_number}: ${row.asset_type} -> ${row.asset_path}`);
          }

          // Cuando termine de insertar todo
          if (idx === total - 1) {
            setTimeout(() => {
              console.log(`\n✅ ${inserted}/${total} assets copiados a corrida 7`);
              db.close();
            }, 100);
          }
        }
      );
    });
  }
);
