/**
 * Seed script para crear datos de ejemplo
 * Usa el schema normalizado con snake_case
 */

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar BD:', err.message);
    process.exit(1);
  }
});

async function seed() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Crear usuario esau si no existe
      const userEmail = 'esau@example.com';
      const userPassword = bcrypt.hashSync('esau123', 10);
      
      db.get(`SELECT id FROM users WHERE username = ?`, ['esau'], (err, user) => {
        if (err) {
          console.error('❌ Error consultando usuario:', err.message);
          reject(err);
          return;
        }

        if (user) {
          console.log('⏭️  Usuario "esau" ya existe (id:', user.id + ')');
          createExperiment(user.id);
        } else {
          // Insertar nuevo usuario
          db.run(
            `INSERT INTO users (username, email, password, isDeveloper, isVerified)
             VALUES (?, ?, ?, ?, ?)`,
            ['esau', userEmail, userPassword, 0, 1],
            function(err) {
              if (err) {
                console.error('❌ Error creando usuario:', err.message);
                reject(err);
              } else {
                console.log('✅ Usuario "esau" creado (id:', this.lastID + ')');
                createExperiment(this.lastID);
              }
            }
          );
        }
      });

      // 2. Crear experimento si no existe
      function createExperiment(userId) {
        const experimentName = 'Mi Primer Experimento';
        const config = JSON.stringify({
          blocks: [
            {
              blockNumber: 1,
              name: 'Lectura - Parte 1',
              duration_minutes: 10,
              stimuli: {
                vibrationEnabled: false,
                auditoryEnabled: false,
                visualEnabled: false
              }
            },
            {
              blockNumber: 2,
              name: 'Descanso',
              duration_minutes: 5,
              stimuli: {
                vibrationEnabled: false,
                auditoryEnabled: false,
                visualEnabled: false
              }
            },
            {
              blockNumber: 3,
              name: 'Lectura - Parte 2',
              duration_minutes: 10,
              stimuli: {
                vibrationEnabled: false,
                auditoryEnabled: false,
                visualEnabled: false
              }
            }
          ],
          description: 'Primer experimento de ejemplo'
        });

        db.get(
          `SELECT id FROM experiments WHERE user_id = ? AND name = ?`,
          [userId, experimentName],
          (err, experiment) => {
            if (err) {
              console.error('❌ Error consultando experimento:', err.message);
              reject(err);
              return;
            }

            if (experiment) {
              console.log('⏭️  Experimento "' + experimentName + '" ya existe (id:', experiment.id + ')');
              finalize();
            } else {
              db.run(
                `INSERT INTO experiments (user_id, name, description, config, version_number, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [userId, experimentName, 'Mi primer experimento de lectura con seguimiento ocular', config, 1],
                function(err) {
                  if (err) {
                    console.error('❌ Error creando experimento:', err.message);
                    reject(err);
                  } else {
                    console.log('✅ Experimento "' + experimentName + '" creado (id:', this.lastID + ')');
                    
                    // Crear bloques de lectura
                    createExperimentBlocks(this.lastID, userId);
                  }
                }
              );
            }
          }
        );
      }

      // 3. Crear bloques del experimento
      function createExperimentBlocks(experimentId, userId) {
        const blocks = [
          {
            block_number: 1,
            name: 'Lectura - Parte 1',
            duration_minutes: 10
          },
          {
            block_number: 2,
            name: 'Descanso',
            duration_minutes: 5
          },
          {
            block_number: 3,
            name: 'Lectura - Parte 2',
            duration_minutes: 10
          }
        ];

        let blockCreated = 0;

        blocks.forEach((block) => {
          db.run(
            `INSERT OR IGNORE INTO experiment_blocks (experiment_id, block_number, name, duration_minutes, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [experimentId, block.block_number, block.name, block.duration_minutes],
            (err) => {
              if (err) {
                console.error('❌ Error creando bloque:', err.message);
              } else {
                blockCreated++;
                console.log(`  ✅ Bloque ${block.block_number} creado: "${block.name}"`);
                
                if (blockCreated === blocks.length) {
                  finalize();
                }
              }
            }
          );
        });
      }

      // Finalizar
      function finalize() {
        console.log('\n✅ Datos de ejemplo listos!');
        console.log('📋 Para probar:');
        console.log('   URL: http://localhost:3000');
        console.log('   Usuario: esau');
        console.log('   Contraseña: esau123');
        console.log('');
        db.close();
        resolve();
      }
    });
  });
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  });
