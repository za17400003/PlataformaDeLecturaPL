const db = require('./db/init-db');

// Obtener experimento del admin como referencia
db.get('SELECT * FROM experiments WHERE user_id = 1 LIMIT 1', [], (err, adminExp) => {
  if (err || !adminExp) {
    console.error('Error getting admin experiment:', err);
    process.exit(1);
  }

  console.log(`📋 Usando experimento de admin como base: "${adminExp.name}"`);

  // Crear nuevo experimento para esau (user_id = 3)
  const newExpName = `Experimento Esau ${new Date().toLocaleDateString('es-ES')} ${new Date().toLocaleTimeString('es-ES')}`;
  const config = adminExp.config || JSON.stringify({
    num_blocks: 3,
    block_duration: 300,
    rest_duration: 60,
    recordVideo: true,
    fps: 30
  });
  
  db.run(
    'INSERT INTO experiments (user_id, name, description, config, created_at, initial_book_id, initial_page_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [3, newExpName, 'Experimento relacionado para esau', config, new Date().toISOString(), adminExp.initial_book_id || null, 1],
    function(err) {
      if (err) {
        console.error('Error creating experiment:', err);
        process.exit(1);
      }

      const newExpId = this.lastID;
      console.log(`✅ Experimento creado con ID ${newExpId} para usuario esau`);

      // Crear 3 bloques de ejemplo
      const blocksToCreate = [
        { block_number: 1, book_id: adminExp.initial_book_id },
        { block_number: 2, book_id: adminExp.initial_book_id },
        { block_number: 3, book_id: adminExp.initial_book_id }
      ];

      let blocksInserted = 0;
      blocksToCreate.forEach((block) => {
        db.run(
          'INSERT INTO experiment_blocks (experiment_id, block_number, book_id) VALUES (?, ?, ?)',
          [newExpId, block.block_number, block.book_id],
          function(err) {
            if (err) {
              console.error(`Error creating block ${block.block_number}:`, err);
            } else {
              blocksInserted++;
              console.log(`  ✓ Bloque ${block.block_number} creado`);
            }

            if (blocksInserted === blocksToCreate.length) {
              console.log(`\n✅ Experimento "${newExpName}" creado exitosamente para esau`);
              console.log(`   ID: ${newExpId}`);
              console.log(`   Bloques: ${blocksInserted}`);
              process.exit(0);
            }
          }
        );
      });
    }
  );
});
