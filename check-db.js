const db = require('./db/init-db');

// Ver todas las tablas
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
  console.log('\n=== TABLAS DISPONIBLES ===');
  if (err) console.error(err);
  else {
    tables.forEach(t => console.log('- ' + t.name));
  }

  // Ver usuarios
  db.all('SELECT id, username, email FROM users LIMIT 10', [], (err, users) => {
    console.log('\n=== USUARIOS ===');
    if (err) console.error(err);
    else console.table(users);

    // Ver experimentos
    db.all('SELECT id, user_id, name FROM experiments LIMIT 20', [], (err, exps) => {
      console.log('\n=== EXPERIMENTOS ===');
      if (err) console.error(err);
      else console.table(exps);

      // Contar experimentos por usuario
      db.all('SELECT user_id, COUNT(*) as count FROM experiments GROUP BY user_id ORDER BY count DESC', [], (err, counts) => {
        console.log('\n=== EXPERIMENTOS POR USUARIO ===');
        if (err) console.error(err);
        else console.table(counts);
        process.exit(0);
      });
    });
  });
});
