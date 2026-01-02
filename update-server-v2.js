#!/usr/bin/env node
/**
 * Script para actualizar server.js con soporte para bookId y pageNumber - V2
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');
let changesMade = 0;

console.log('🔄 Actualizando server.js...\n');

// ============ CAMBIO 1: POST - Desestructuración ============
if (content.includes(`const { blockNumber, name, duration } = req.body;`) &&
    !content.includes(`const { blockNumber, name, duration, bookId, pageNumber } = req.body;`)) {
  content = content.replace(
    `const { blockNumber, name, duration } = req.body;`,
    `const { blockNumber, name, duration, bookId, pageNumber } = req.body;`
  );
  console.log('✅ Cambio 1: Desestructuración de parámetros POST');
  changesMade++;
}

// ============ CAMBIO 2: POST - INSERT ============
if (content.includes(`'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration) VALUES (?, ?, ?, ?)',`) &&
    !content.includes(`'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration, bookId, pageNumber) VALUES (?, ?, ?, ?, ?, ?)',`)) {
  content = content.replace(
    `'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration) VALUES (?, ?, ?, ?)',\n        [experimentId, blockNumber, name, duration],`,
    `'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration, bookId, pageNumber) VALUES (?, ?, ?, ?, ?, ?)',\n        [experimentId, blockNumber, name, duration, bookId || null, pageNumber || 1],`
  );
  console.log('✅ Cambio 2: INSERT con bookId y pageNumber');
  changesMade++;
}

// ============ CAMBIO 3: POST - Response ============
if (content.includes(`res.status(201).json({ \n            id: this.lastID, \n            experimentId, \n            blockNumber, \n            name, \n            duration \n          });`) &&
    !content.includes(`bookId: bookId || null,`)) {
  content = content.replace(
    `res.status(201).json({ \n            id: this.lastID, \n            experimentId, \n            blockNumber, \n            name, \n            duration \n          });`,
    `res.status(201).json({ \n            id: this.lastID, \n            experimentId, \n            blockNumber, \n            name, \n            duration,\n            bookId: bookId || null,\n            pageNumber: pageNumber || 1\n          });`
  );
  console.log('✅ Cambio 3: Response POST con bookId y pageNumber');
  changesMade++;
}

// ============ CAMBIO 4: PUT - Desestructuración ============
if (content.includes(`const { name, duration } = req.body;\n  const { experimentId, blockId } = req.params;`) &&
    !content.includes(`const { name, duration, bookId, pageNumber } = req.body;`)) {
  content = content.replace(
    `const { name, duration } = req.body;\n  const { experimentId, blockId } = req.params;`,
    `const { name, duration, bookId, pageNumber } = req.body;\n  const { experimentId, blockId } = req.params;`
  );
  console.log('✅ Cambio 4: Desestructuración de parámetros PUT');
  changesMade++;
}

// ============ CAMBIO 5: PUT - UPDATE ============
if (content.includes(`'UPDATE reading_blocks SET name = ?, duration = ? WHERE id = ? AND experimentId = ?',`) &&
    !content.includes(`'UPDATE reading_blocks SET name = ?, duration = ?, bookId = ?, pageNumber = ? WHERE id = ? AND experimentId = ?',`)) {
  content = content.replace(
    `'UPDATE reading_blocks SET name = ?, duration = ? WHERE id = ? AND experimentId = ?',\n        [name, duration, blockId, experimentId],`,
    `'UPDATE reading_blocks SET name = ?, duration = ?, bookId = ?, pageNumber = ? WHERE id = ? AND experimentId = ?',\n        [name, duration, bookId || null, pageNumber || 1, blockId, experimentId],`
  );
  console.log('✅ Cambio 5: UPDATE con bookId y pageNumber');
  changesMade++;
}

// ============ CAMBIO 6: Agregar GET /api/books ============
if (!content.includes(`app.get('/api/books',`)) {
  // Buscar el punto donde insertar (después de /api/libros)
  const insertPoint = `  });
});

// ============ FUNCIONES AUXILIARES ============`;
  
  const newEndpoint = `  });
});

// Ruta para obtener lista simple de libros (para selectores)
app.get('/api/books', (req, res) => {
  fs.readdir(librosPath, (err, files) => {
    if (err) {
      console.error('Error al leer libros:', err);
      return res.status(500).json({ error: 'Error al leer libros' });
    }
    
    const books = files
      .filter(file => file.toLowerCase().endsWith('.epub'))
      .map((file, index) => ({
        id: file.replace(/\\.epub$/i, ''),
        name: file.replace(/\\.epub$/i, ''),
        title: file.replace(/\\.epub$/i, ''),
        path: \`/public/libros/\${file}\`
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    res.json(books);
  });
});

// ============ FUNCIONES AUXILIARES ============`;

  if (content.includes(insertPoint)) {
    content = content.replace(insertPoint, newEndpoint);
    console.log('✅ Cambio 6: Agregado endpoint GET /api/books');
    changesMade++;
  }
}

// ============ Guardar cambios ============
if (changesMade > 0) {
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log(`\n✅ Se realizaron ${changesMade} cambios en server.js`);
  console.log('📝 Archivo guardado exitosamente');
  process.exit(0);
} else {
  console.log('\n⚠️  No se realizaron cambios');
  console.log('Los cambios podrían ya estar aplicados');
  process.exit(0);
}
