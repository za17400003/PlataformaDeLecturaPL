/**
 * Script para listar usuarios en la base de datos
 * Ejecutar: node db/list-users.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos\n');
});

// Listar todos los usuarios
db.all(
  'SELECT id, username, email, isDeveloper, isVerified, createdAt FROM users',
  (err, rows) => {
    if (err) {
      console.error('❌ Error consultando usuarios:', err.message);
      db.close();
      process.exit(1);
      return;
    }
    
    if (rows.length === 0) {
      console.log('📭 No hay usuarios registrados en la base de datos');
    } else {
      console.log('👥 USUARIOS REGISTRADOS:\n');
      console.log('─'.repeat(100));
      
      rows.forEach((user, index) => {
        console.log(`\n${index + 1}. Usuario: ${user.username}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Desarrollador: ${user.isDeveloper === 1 ? 'Sí' : 'No'}`);
        console.log(`   Verificado: ${user.isVerified === 1 ? '✅ Sí' : '❌ No'}`);
        console.log(`   Creado: ${user.createdAt}`);
      });
      
      console.log('\n' + '─'.repeat(100));
      console.log(`\n📊 Total: ${rows.length} usuario(s)\n`);
      console.log('⚠️  NOTA: Las contraseñas están hasheadas con bcrypt y NO pueden recuperarse.');
      console.log('💡 Si olvidaste la contraseña, usa "Recuperar contraseña" en el login.\n');
    }
    
    db.close();
    process.exit(0);
  }
);
