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
  const hash = bcrypt.hashSync('123', 10);
  
  db.run(
    'UPDATE users SET password = ? WHERE username = ?',
    [hash, 'admin'],
    function(err) {
      if (err) {
        console.error('❌ Error al actualizar usuario admin:', err.message);
        db.close();
        process.exit(1);
      }
      
      if (this.changes === 0) {
        console.log('⚠️  No se encontró usuario admin para actualizar');
      } else {
        console.log('✅ Contraseña de admin actualizada exitosamente');
        console.log('   Usuario: admin');
        console.log('   Contraseña: 123');
      }
      db.close();
      process.exit(0);
    }
  );
});
