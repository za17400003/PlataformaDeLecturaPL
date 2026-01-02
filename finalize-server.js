#!/usr/bin/env node
/**
 * Script para finalizar los cambios en server.js
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');
let changesMade = 0;

console.log('🔄 Finalizando cambios en server.js...\n');

// ============ CAMBIO 2 (Reintento): POST - INSERT con parámetros ============
if (content.includes(`'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration) VALUES (?, ?, ?, ?)',`)) {
  const oldInsert = `        'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration) VALUES (?, ?, ?, ?)',
        [experimentId, blockNumber, name, duration],`;
  
  const newInsert = `        'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration, bookId, pageNumber) VALUES (?, ?, ?, ?, ?, ?)',
        [experimentId, blockNumber, name, duration, bookId || null, pageNumber || 1],`;
  
  if (content.includes(oldInsert)) {
    content = content.replace(oldInsert, newInsert);
    console.log('✅ Cambio 2: INSERT actualizado completamente');
    changesMade++;
  }
}

// ============ CAMBIO 3: POST - Response ============
const responsePattern = `          res.status(201).json({ 
            id: this.lastID, 
            experimentId, 
            blockNumber, 
            name, 
            duration 
          });`;

const newResponse = `          res.status(201).json({ 
            id: this.lastID, 
            experimentId, 
            blockNumber, 
            name, 
            duration,
            bookId: bookId || null,
            pageNumber: pageNumber || 1
          });`;

if (content.includes(responsePattern) && !content.includes('bookId: bookId || null,')) {
  content = content.replace(responsePattern, newResponse);
  console.log('✅ Cambio 3: Response POST actualizado');
  changesMade++;
}

// ============ CAMBIO 4: PUT - Desestructuración ============
const putDestructure = `app.put('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { name, duration } = req.body;`;

const putDestructureNew = `app.put('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { name, duration, bookId, pageNumber } = req.body;`;

if (content.includes(putDestructure) && !content.includes('const { name, duration, bookId, pageNumber }')) {
  content = content.replace(putDestructure, putDestructureNew);
  console.log('✅ Cambio 4: Desestructuración PUT actualizada');
  changesMade++;
}

// ============ CAMBIO 6: Agregar GET /api/books ============
if (!content.includes(`app.get('/api/books'`)) {
  // Buscar el final de /api/libros
  const librosEnd = `    });
  });
});

// ============ FUNCIONES AUXILIARES ============`;
  
  const newBooksEndpoint = `    });
  });
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

  if (content.includes(librosEnd)) {
    content = content.replace(librosEnd, newBooksEndpoint);
    console.log('✅ Cambio 6: Endpoint GET /api/books agregado');
    changesMade++;
  }
}

// ============ Guardar ============
if (changesMade > 0) {
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log(`\n✅ Se realizaron ${changesMade} cambios finales`);
} else {
  console.log('\n✅ Todos los cambios ya están aplicados o completados');
}

process.exit(0);
