const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error al abrir base de datos:', err.message);
    process.exit(1);
  }
});

db.serialize(() => {
  // Verificar si el usuario admin ya existe
  db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
    if (err) {
      console.error('❌ Error al consultar usuario admin:', err.message);
      db.close();
      process.exit(1);
    }

    if (row) {
      console.log('✅ Usuario admin ya existe');
      db.close();
      process.exit(0);
    }

    // Crear usuario admin con contraseña "123"
    const hash = bcrypt.hashSync('123', 10);
    db.run(
      'INSERT INTO users (username, email, password, isDeveloper, isVerified) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@localhost.local', hash, 1, 1],
      (err) => {
        if (err) {
          console.error('❌ Error al crear usuario admin:', err.message);
          db.close();
          process.exit(1);
        }
        console.log('✅ Usuario admin creado exitosamente');
        console.log('   Usuario: admin');
        console.log('   Contraseña: 123');
        console.log('   Modo desarrollador: Sí');
        db.close();
        process.exit(0);
      }
    );
  });
});
