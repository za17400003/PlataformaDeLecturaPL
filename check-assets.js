const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

db.all(
  `SELECT run_id, asset_type, COUNT(*) as count FROM run_assets 
   WHERE run_id IN (1, 7) 
   GROUP BY run_id, asset_type 
   ORDER BY run_id, asset_type`,
  (err, rows) => {
    if (err) console.error(err);
    else {
      console.log('\n📊 Assets por corrida y tipo:');
      rows.forEach(row => {
        console.log(`  Run ${row.run_id}: ${row.asset_type} = ${row.count}`);
      });
    }
    db.close();
  }
);
