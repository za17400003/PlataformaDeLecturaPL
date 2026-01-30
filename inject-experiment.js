const db = require('./db/init-db');

// Esperar a que la BD esté lista
setTimeout(() => {
  db.serialize(() => {
    // Buscar el usuario admin (id=1)
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, user) => {
      if (err) {
        console.error('❌ Error buscando admin:', err.message);
        db.close();
        process.exit(1);
      }

      if (!user) {
        console.error('❌ Usuario admin no encontrado');
        db.close();
        process.exit(1);
      }

      const userId = user.id;
      console.log(`✅ Usuario admin encontrado: ID=${userId}`);

      // Crear experimento con config válida
      const config = {
        num_blocks: 5,
        minutes_per_block: 5
      };

      db.run(
        `INSERT INTO experiments (user_id, name, description, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, 'Experimento de Prueba', 'Experimento inyectado para testing', JSON.stringify(config)],
        function(err) {
          if (err) {
            console.error('❌ Error creando experimento:', err.message);
            db.close();
            process.exit(1);
          }

          const experimentId = this.lastID;
          console.log(`✅ Experimento creado: ID=${experimentId}`);

          // Crear run para el experimento
          db.run(
            `INSERT INTO experiment_runs (experiment_id, user_id, session_id, status, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [experimentId, userId, `session_${experimentId}_${Date.now()}`, 'in_progress'],
            function(err) {
              if (err) {
                console.error('❌ Error creando run:', err.message);
                db.close();
                process.exit(1);
              }

              const runId = this.lastID;
              console.log(`✅ Run creada: ID=${runId}`);

              // Crear bloques para el experimento
              let blockCount = 0;
              for (let i = 1; i <= 5; i++) {
                db.run(
                  `INSERT INTO experiment_blocks (experiment_id, block_number, name, order_index, created_at)
                   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                  [experimentId, i, `Bloque ${i}`, i],
                  function(err) {
                    if (err) {
                      console.error('❌ Error creando bloque:', err.message);
                    } else {
                      blockCount++;
                      console.log(`  ✅ Bloque ${i} creado`);
                      
                      if (blockCount === 5) {
                        console.log(`✅ ${blockCount} bloques creados`);
                        insertSampleData(runId);
                      }
                    }
                  }
                );
              }
            }
          );
        }
      );
    });
  });
}, 1000);

function insertSampleData(runId) {
  console.log(`\n📥 Inyectando datos de ejemplo para run ID=${runId}...`);

  // Insertar 1000 muestras de gaze
  let gazeCount = 0;
  for (let i = 0; i < 1000; i++) {
    const timestamp = i * 100; // 100ms entre muestras
    const x = Math.floor(Math.random() * 1920);
    const y = Math.floor(Math.random() * 1080);
    const confidence = 0.8 + Math.random() * 0.2;
    const blockNumber = Math.floor(i / 200) + 1;

    db.run(
      `INSERT INTO gaze_samples (run_id, timestamp_ms, x_px, y_px, confidence, block_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [runId, timestamp, x, y, confidence, blockNumber],
      (err) => {
        if (!err) gazeCount++;
        if (gazeCount === 1000) {
          console.log(`  ✅ 1000 muestras de gaze insertadas`);
          insertEvents(runId);
        }
      }
    );
  }
}

function insertEvents(runId) {
  console.log(`\n📥 Inyectando eventos...`);

  const eventTypes = ['page_change', 'fixation', 'saccade', 'blink', 'pause'];
  const events = [];

  for (let i = 0; i < 20; i++) {
    events.push({
      type: eventTypes[i % eventTypes.length],
      timestamp: i * 500,
      blockNumber: Math.floor(i / 4) + 1
    });
  }

  let eventCount = 0;
  events.forEach((evt) => {
    db.run(
      `INSERT INTO run_events (run_id, block_number, event_type, timestamp_ms, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [runId, evt.blockNumber, evt.type, evt.timestamp],
      (err) => {
        if (!err) eventCount++;
        if (eventCount === events.length) {
          console.log(`  ✅ ${events.length} eventos insertados`);
          insertVideos(runId);
        }
      }
    );
  });
}

function insertVideos(runId) {
  console.log(`\n📥 Inyectando assets de video...`);

  const videos = [
    { block: 1, path: '/videos/block1.mp4' },
    { block: 2, path: '/videos/block2.mp4' },
    { block: 3, path: '/videos/block3.mp4' },
    { block: 4, path: '/videos/block4.mp4' },
    { block: 5, path: '/videos/block5.mp4' }
  ];

  let videoCount = 0;
  videos.forEach((video) => {
    db.run(
      `INSERT INTO run_assets (run_id, asset_type, asset_path, block_number, created_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [runId, 'video', video.path, video.block],
      (err) => {
        if (!err) videoCount++;
        if (videoCount === videos.length) {
          console.log(`  ✅ ${videos.length} videos insertados`);
          
          console.log(`\n✅ EXPERIMENTO INYECTADO EXITOSAMENTE`);
          console.log(`\n📊 RESUMEN:`);
          console.log(`   Gaze Samples: 1000`);
          console.log(`   Events: 20`);
          console.log(`   Video Assets: 5`);
          console.log(`   Bloques: 5`);
          
          db.close();
          process.exit(0);
        }
      }
    );
  });
}
