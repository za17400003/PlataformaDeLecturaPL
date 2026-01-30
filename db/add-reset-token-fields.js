/**
 * Script para agregar los campos resetToken y resetTokenExpires a la tabla users
 * Ejecutar: node db/add-reset-token-fields.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos');
});

// Función para verificar si una columna existe
function columnExists(tableName, columnName, callback) {
  db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
    if (err) {
      console.error('Error verificando columna:', err);
      callback(false);
      return;
    }
    const exists = rows.some(row => row.name === columnName);
    callback(exists);
  });
}

// Agregar campos si no existen
columnExists('users', 'resetToken', (exists) => {
  if (!exists) {
    console.log('📝 Agregando columna resetToken...');
    db.run('ALTER TABLE users ADD COLUMN resetToken TEXT', (err) => {
      if (err) {
        console.error('❌ Error agregando resetToken:', err.message);
      } else {
        console.log('✅ Columna resetToken agregada');
      }
    });
  } else {
    console.log('ℹ️  resetToken ya existe');
  }
});

columnExists('users', 'resetTokenExpires', (exists) => {
  if (!exists) {
    console.log('📝 Agregando columna resetTokenExpires...');
    db.run('ALTER TABLE users ADD COLUMN resetTokenExpires DATETIME', (err) => {
      if (err) {
        console.error('❌ Error agregando resetTokenExpires:', err.message);
      } else {
        console.log('✅ Columna resetTokenExpires agregada');
      }
    });
  } else {
    console.log('ℹ️  resetTokenExpires ya existe');
  }
});

// Verificar que las columnas se agregaron correctamente
setTimeout(() => {
  db.all('PRAGMA table_info(users)', (err, rows) => {
    if (err) {
      console.error('Error verificando tabla:', err);
      db.close();
      process.exit(1);
      return;
    }
    
    console.log('\n📊 Estructura de la tabla users:');
    const resetFields = rows.filter(row => row.name.includes('reset'));
    if (resetFields.length > 0) {
      resetFields.forEach(field => {
        console.log(`  ✅ ${field.name} (${field.type})`);
      });
    }
    
    console.log('\n✅ Proceso completado');
    db.close();
    process.exit(0);
  });
}, 1000);
