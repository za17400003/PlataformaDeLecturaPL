const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'users.db');
const db = new sqlite3.Database(dbPath);

// Listar todos los usuarios
db.all('SELECT id, username, email, isVerified FROM users', (err, rows) => {
  if (err) {
    console.error('Error:', err);
    db.close();
    return;
  }
  
  console.log('\n=== USUARIOS EN LA BASE DE DATOS ===');
  if (rows.length === 0) {
    console.log('No hay usuarios registrados');
  } else {
    rows.forEach(row => {
      console.log(`ID: ${row.id}, Usuario: ${row.username}, Email: ${row.email}, Verificado: ${row.isVerified === 1 ? 'SÍ' : 'NO'}`);
    });
  }
  
  // Buscar específicamente a esau
  console.log('\n=== BÚSQUEDA ESPECÍFICA: esau ===');
  db.get(
    'SELECT id, username, email, isVerified, password FROM users WHERE username = ?',
    ['esau'],
    (err, user) => {
      if (err) {
        console.error('Error:', err);
      } else if (!user) {
        console.log('No se encontró usuario "esau"');
      } else {
        console.log(`\nEncontrado:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Usuario: ${user.username}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Verificado: ${user.isVerified === 1 ? 'SÍ' : 'NO'}`);
        console.log(`  Contraseña hash: ${user.password ? user.password.substring(0, 20) + '...' : 'NULA'}`);
      }
      
      db.close();
    }
  );
});
