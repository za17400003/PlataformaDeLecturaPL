const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir base de datos:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Base de datos conectada');
  }
});

function seedExampleData() {
  console.log('🌱 Sembrando datos de ejemplo...\n');

  // 1. Obtener el usuario "esau"
  db.get("SELECT id FROM users WHERE username = ?", ['esau'], (err, user) => {
    if (err) {
      console.error('❌ Error al obtener usuario esau:', err.message);
      db.close();
      return;
    }

    if (!user) {
      console.error('❌ Usuario "esau" no encontrado. Crea la cuenta primero.');
      db.close();
      return;
    }

    const userId = user.id;
    console.log(`✅ Usuario esau encontrado (ID: ${userId})\n`);

    // 2. Obtener o crear un experimento para esau
    db.get(
      "SELECT id FROM experiments WHERE userId = ? AND name = ? LIMIT 1",
      [userId, 'Mi Primer Experimento'],
      (err, exp) => {
        if (err) {
          console.error('❌ Error al obtener experimento:', err.message);
          db.close();
          return;
        }

        let experimentId;
        if (!exp) {
          // Crear experimento
          db.run(
            `INSERT INTO experiments (userId, name, description, createdAt, updatedAt)
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
              experimentId = this.lastID;
              console.log(`✅ Experimento creado (ID: ${experimentId})`);
              seedRunsAndData(userId, experimentId);
            }
          );
        } else {
          experimentId = exp.id;
          console.log(`✅ Experimento encontrado (ID: ${experimentId})`);
          seedRunsAndData(userId, experimentId);
        }
      }
    );
  });

  function seedRunsAndData(userId, experimentId) {
    console.log('\n📊 Insertando datos de ejecución...\n');

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 300000);

    db.run(
      `INSERT INTO experiment_runs (experimentId, userId, startTime, endTime, status, duration, totalBlocks, completedBlocks, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        experimentId,
        userId,
        startTime.toISOString(),
        endTime.toISOString(),
        'completed',
        300,
        3,
        3,
        'Ejecución de ejemplo con datos simulados'
      ],
      function(err) {
        if (err) {
          console.error('❌ Error al crear run:', err.message);
          db.close();
          return;
        }

        const runId = this.lastID;
        console.log(`✅ Ejecución creada (ID: ${runId})`);

        // Insertar datos de gaze
        insertGazeData(runId);
      }
    );
  }

  function insertGazeData(runId) {
    console.log('👁️  Insertando muestras de gaze...');

    let inserted = 0;
    const totalSamples = 100; // Reducido para prueba

    for (let i = 0; i < totalSamples; i++) {
      const timestamp = Date.now() + (i * 3000); // 3 segundos entre muestras
      const x = Math.random() * 1920;
      const y = Math.random() * 1080;
      const confidence = (0.7 + Math.random() * 0.3).toFixed(2);
      const blockNumber = Math.floor(i / 33) + 1;
      const isDivagatating = Math.random() > 0.85 ? 1 : 0;

      db.run(
        `INSERT INTO gaze_samples (run_id, timestamp_ms, x_px, y_px, confidence, is_valid, block_number, ai_divagation_predicted, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [runId, timestamp, Math.round(x), Math.round(y), confidence, 1, blockNumber, isDivagatating],
        (err) => {
          inserted++;
          if (inserted === totalSamples) {
            console.log(`✅ ${inserted} muestras de gaze insertadas`);
            insertMindWanderingEvents(runId);
          }
        }
      );
    }
  }

  function insertMindWanderingEvents(runId) {
    console.log('🌀 Insertando eventos de divagación mental...');

    const events = [
      { blockNumber: 1, startTime: 5000, duration: 3000, confidence: 0.89, reason: 'Low gaze confidence' },
      { blockNumber: 1, startTime: 45000, duration: 2500, confidence: 0.82, reason: 'Eye fixation outside' },
      { blockNumber: 2, startTime: 120000, duration: 4200, confidence: 0.91, reason: 'Saccade pattern' },
      { blockNumber: 3, startTime: 220000, duration: 1800, confidence: 0.75, reason: 'Fixation anomaly' }
    ];

    let inserted = 0;
    events.forEach((event) => {
      db.run(
        `INSERT INTO mind_wandering_events (run_id, start_timestamp_ms, end_timestamp_ms, duration_ms, confidence, ai_model_version, detection_method, block_number, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          runId,
          event.startTime,
          event.startTime + event.duration,
          event.duration,
          event.confidence,
          'v1.0.0',
          'gaze_based',
          event.blockNumber,
          event.reason
        ],
        (err) => {
          inserted++;
          if (inserted === events.length) {
            console.log(`✅ ${inserted} eventos de divagación insertados`);
            insertBlockSummaries(runId);
          }
        }
      );
    });
  }

  function insertBlockSummaries(runId) {
    console.log('📈 Insertando resúmenes de bloques...');

    const summaries = [
      { blockNumber: 1, duration: 100, wanderingMs: 5500, events: 2, confidence: 0.865 },
      { blockNumber: 2, duration: 100, wanderingMs: 4200, events: 1, confidence: 0.91 },
      { blockNumber: 3, duration: 100, wanderingMs: 4900, events: 1, confidence: 0.815 }
    ];

    let inserted = 0;
    summaries.forEach((summary) => {
      db.run(
        `INSERT INTO block_summaries (run_id, block_number, total_duration_seconds, total_mind_wandering_ms, total_mind_wandering_events, avg_gaze_confidence, gaze_samples_count, calculated_at, ai_processed)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
        [
          runId,
          summary.blockNumber,
          summary.duration,
          summary.wanderingMs,
          summary.events,
          summary.confidence,
          33,
          1
        ],
        (err) => {
          inserted++;
          if (inserted === summaries.length) {
            console.log(`✅ ${inserted} resúmenes de bloques insertados`);
            insertRunEvents(runId);
          }
        }
      );
    });
  }

  function insertRunEvents(runId) {
    console.log('🎯 Insertando eventos de ejecución...');

    const events = [
      { blockNumber: 1, timestamp: 1000, type: 'block_start', data: 'Bloque 1 iniciado' },
      { blockNumber: 1, timestamp: 15000, type: 'stimulus', data: 'Visual stimulus' },
      { blockNumber: 1, timestamp: 45000, type: 'stimulus', data: 'Audio stimulus' },
      { blockNumber: 1, timestamp: 95000, type: 'block_end', data: 'Bloque 1 finalizado' },
      { blockNumber: 2, timestamp: 110000, type: 'block_start', data: 'Bloque 2 iniciado' },
      { blockNumber: 2, timestamp: 120000, type: 'stimulus', data: 'Kinesthetic stimulus' },
      { blockNumber: 2, timestamp: 195000, type: 'block_end', data: 'Bloque 2 finalizado' },
      { blockNumber: 3, timestamp: 210000, type: 'block_start', data: 'Bloque 3 iniciado' },
      { blockNumber: 3, timestamp: 230000, type: 'stimulus', data: 'Visual + Audio stimulus' },
      { blockNumber: 3, timestamp: 300000, type: 'block_end', data: 'Bloque 3 finalizado' }
    ];

    let inserted = 0;
    events.forEach((event) => {
      db.run(
        `INSERT INTO run_events (run_id, block_number, event_type, timestamp_ms, data, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [runId, event.blockNumber, event.type, event.timestamp, event.data],
        (err) => {
          inserted++;
          if (inserted === events.length) {
            console.log(`✅ ${inserted} eventos de ejecución insertados`);
            console.log('\n🎉 ¡Datos de ejemplo insertados exitosamente!\n');
            db.close(() => {
              console.log('✅ Conexión cerrada');
              process.exit(0);
            });
          }
        }
      );
    });
  }
}

// Ejecutar
seedExampleData();
