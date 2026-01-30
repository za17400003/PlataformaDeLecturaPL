const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar BD:', err.message);
    process.exit(1);
  }
});

function seedExperiments() {
  console.log('🌱 Creando datos de ejemplo para experimentos...\n');

  // Obtener usuario "esau"
  db.get("SELECT id FROM users WHERE username = ? LIMIT 1", ['esau'], (err, user) => {
    if (err || !user) {
      console.error('❌ Usuario esau no encontrado');
      db.close();
      return;
    }

    const userId = user.id;
    console.log(`✅ Usuario esau encontrado (ID: ${userId})`);

    // Crear experimento usando el schema ACTUAL (userId no user_id)
    db.run(
      `INSERT OR IGNORE INTO experiments (userId, name, description, createdAt, updatedAt)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
      [
        userId,
        'Mi Primer Experimento',
        'Experimento de ejemplo con datos simulados'
      ],
      function(err) {
        if (err) {
          console.error('❌ Error al crear experimento:', err.message);
          db.close();
          return;
        }

        const expId = this.lastID || 0;
        if (expId === 0) {
          console.log('ℹ️  El experimento "Mi Primer Experimento" ya existe');
          // Obtener el ID del experimento existente
          db.get(
            "SELECT id FROM experiments WHERE userId = ? AND name = ? LIMIT 1",
            [userId, 'Mi Primer Experimento'],
            (err2, exp) => {
              if (exp) {
                console.log(`✅ Experimento encontrado (ID: ${exp.id})`);
                createBlocks(exp.id, userId);
              } else {
                db.close();
              }
            }
          );
        } else {
          console.log(`✅ Experimento creado (ID: ${expId})`);
          createBlocks(expId, userId);
        }
      }
    );
  });

  function createBlocks(expId, userId) {
    // Crear bloques para el experimento
    const blocks = [
      { blockNumber: 1, name: 'Bloque Estimulo 1', duration: 300 },
      { blockNumber: 2, name: 'Bloque Libre 1', duration: 300 },
      { blockNumber: 3, name: 'Bloque Estimulo 2', duration: 300 },
      { blockNumber: 4, name: 'Bloque Libre 2', duration: 300 },
      { blockNumber: 5, name: 'Bloque Estimulo 3', duration: 300 }
    ];

    let blockCount = 0;
    blocks.forEach(block => {
      db.run(
        `INSERT OR IGNORE INTO experiment_blocks (experimentId, blockNumber, name, duration, createdAt)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [expId, block.blockNumber, block.name, block.duration],
        function(err) {
          if (err) {
            console.error(`⚠️  Error al crear bloque ${block.blockNumber}:`, err.message);
          }
          blockCount++;
          if (blockCount === blocks.length) {
            console.log(`✅ ${blocks.length} bloques creados/verificados`);
            createExperimentRun(userId, expId);
          }
        }
      );
    });
  }

  function createExperimentRun(userId, expId) {
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 1800000); // 30 minutos

    db.run(
      `INSERT OR IGNORE INTO experiment_runs (experimentId, userId, startTime, endTime, status, duration, totalBlocks, completedBlocks, notes)
       VALUES (?, ?, ?, ?, 'completed', ?, 5, 5, ?)`,
      [
        expId,
        userId,
        startTime.toISOString(),
        endTime.toISOString(),
        1800,
        'Ejecución de ejemplo con datos simulados'
      ],
      function(err) {
        if (err) {
          console.error('❌ Error al crear ejecución:', err.message);
          db.close();
          return;
        }

        console.log(`✅ Ejecución creada`);
        console.log('\n✅ Datos de ejemplo insertados exitosamente');
        db.close();
      }
    );
  }
}

seedExperiments();
