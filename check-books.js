const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const db = new sqlite3.Database('./db/users.db');

console.log('📚 Verificando estado de libros:\n');

// Contar libros en BD
db.get('SELECT COUNT(*) as count FROM books', (err, row) => {
  console.log(`BD - Libros en tabla books: ${row.count}`);
});

// Contar archivos en /public/libros
const librosPath = path.join(__dirname, 'public', 'libros');
if (fs.existsSync(librosPath)) {
  const files = fs.readdirSync(librosPath).filter(f => f.toLowerCase().endsWith('.epub'));
  console.log(`Disco - EPUB en /public/libros: ${files.length}`);
  if (files.length > 0) {
    console.log('   Primeros 3:');
    files.slice(0, 3).forEach(f => console.log(`   - ${f}`));
  }
} else {
  console.log('❌ Carpeta /public/libros no existe!');
}

// Ver qué endpoint se está usando
setTimeout(() => {
  console.log('\n📍 Endpoint /api/libros usa: filesystem (/public/libros)');
  console.log('📍 Endpoint /api/books usa: tabla books (para selectores)');
  db.close();
}, 100);
