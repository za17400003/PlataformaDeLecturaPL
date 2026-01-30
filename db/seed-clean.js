/**
 * Seed de datos de ejemplo para experimentos
 * Usa el schema actual (camelCase)
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al conectar BD:', err.message);
    process.exit(1);
  }
});

function seedData() {
  console.log('🌱 Creando datos de ejemplo...\n');

  // Obtener usuario "esau"
  db.get("SELECT id FROM users WHERE username = 'esau' LIMIT 1", (err, user) => {
    if (err || !user) {
      console.error('❌ Usuario esau no encontrado');
      console.log('Crea una cuenta primero con username=esau');
      db.close();
      return;
    }

    const userId = user.id;
    console.log(`✅ Usuario esau encontrado (ID: ${userId})`);

    // Crear experimento
    const config = {
      num_blocks: 5,
      minutes_per_block: 5.22,
      quotas: { V: 2, K: 2, A: 2, PST: 3, PFT: 6 },
      stim_blocks: [0, 2, 4]
    };

    db.run(
      `INSERT OR IGNORE INTO experiments (userId, name, description, config)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        'Mi Primer Experimento',
        'Experimento de ejemplo con datos simulados',
        JSON.stringify(config)
      ],
      function(err) {
        if (err) {
          console.error('❌ Error al crear experimento:', err.message);
          db.close();
          return;
        }

        // Si no es insert (ya existe), obtener el ID
        let expId = this.lastID;
        if (expId === 0) {
          db.get(
            "SELECT id FROM experiments WHERE userId = ? AND name = ? LIMIT 1",
            [userId, 'Mi Primer Experimento'],
            (err, exp) => {
              if (exp) {
                console.log(`ℹ️  Experimento ya existe (ID: ${exp.id})`);
                expId = exp.id;
                complete();
              } else {
                db.close();
              }
            }
          );
        } else {
          console.log(`✅ Experimento creado (ID: ${expId})`);
          complete();
        }

        function complete() {
          console.log('\n✅ Datos de ejemplo listos');
          console.log('   - Usuario: esau');
          console.log(`   - Experimento: "Mi Primer Experimento" (ID: ${expId})`);
          db.close();
        }
      }
    );
  });
}

seedData();
