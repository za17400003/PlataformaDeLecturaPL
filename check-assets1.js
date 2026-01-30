const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

db.all(
  `SELECT id, asset_type, asset_path, block_number FROM run_assets 
   WHERE run_id = 1 
   ORDER BY block_number`,
  (err, rows) => {
    if (err) console.error(err);
    else {
      console.log('\n📹 Assets de corrida 1:');
      rows.forEach(row => {
        console.log(`  Block ${row.block_number}: ${row.asset_type} -> ${row.asset_path}`);
      });
    }
    db.close();
  }
);
