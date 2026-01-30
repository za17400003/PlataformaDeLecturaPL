const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db/users.db');

console.log('📋 Actualizando referencias de videos a rutas reales...\n');

// Mapeo de bloques a videos reales
const videoMap = [
  { block: 0, oldPath: 'Sesiones/S1/block_0_recording.mp4', newPath: 'src/Sesiones/S1/S1_B1_stim.mp4' },
  { block: 1, oldPath: 'Sesiones/S1/block_1_recording.mp4', newPath: 'src/Sesiones/S1/S1_B2_free.mp4' },
  { block: 2, oldPath: 'Sesiones/S1/block_2_recording.mp4', newPath: 'src/Sesiones/S1/S1_B3_stim.mp4' },
  { block: 3, oldPath: 'Sesiones/S1/block_3_recording.mp4', newPath: 'src/Sesiones/S1/S1_B1_stim.mp4' },  // Reutilizar
  { block: 4, oldPath: 'Sesiones/S1/block_4_recording.mp4', newPath: 'src/Sesiones/S1/S1_B2_free.mp4' }   // Reutilizar
];

let updated = 0;

videoMap.forEach(video => {
  db.run(
    `UPDATE run_assets 
     SET asset_path = ? 
     WHERE asset_path = ? AND asset_type = 'video'`,
    [video.newPath, video.oldPath],
    function(err) {
      if (err) {
        console.error(`❌ Error actualizando bloque ${video.block}:`, err.message);
      } else if (this.changes > 0) {
        updated += this.changes;
        console.log(`✅ Bloque ${video.block}: ${video.oldPath}`);
        console.log(`   → ${video.newPath}`);
      }
    }
  );
});

setTimeout(() => {
  console.log(`\n✅ ${updated} referencias de video actualizadas`);
  db.close();
}, 500);
