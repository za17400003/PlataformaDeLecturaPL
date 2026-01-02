#!/usr/bin/env node
/**
 * Script para actualizar server.js con soporte para bookId y pageNumber
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');
let changesMade = 0;

console.log('🔄 Actualizando server.js...\n');

// ============ CAMBIO 1: POST /api/experiments/:experimentId/blocks ============
const change1Old = `app.post('/api/experiments/:experimentId/blocks', requireVerified, (req, res) => {
  const { blockNumber, name, duration } = req.body;`;

const change1New = `app.post('/api/experiments/:experimentId/blocks', requireVerified, (req, res) => {
  const { blockNumber, name, duration, bookId, pageNumber } = req.body;`;

if (content.includes(change1Old)) {
  content = content.replace(change1Old, change1New);
  console.log('✅ Actualizado: Desestructuración de parámetros POST');
  changesMade++;
}

// ============ CAMBIO 2: INSERT statement ============
const change2Old = `        'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration) VALUES (?, ?, ?, ?)',
        [experimentId, blockNumber, name, duration],`;

const change2New = `        'INSERT INTO reading_blocks (experimentId, blockNumber, name, duration, bookId, pageNumber) VALUES (?, ?, ?, ?, ?, ?)',
        [experimentId, blockNumber, name, duration, bookId || null, pageNumber || 1],`;

if (content.includes(change2Old)) {
  content = content.replace(change2Old, change2New);
  console.log('✅ Actualizado: INSERT con bookId y pageNumber');
  changesMade++;
}

// ============ CAMBIO 3: Response del POST ============
const change3Old = `          res.status(201).json({ 
            id: this.lastID, 
            experimentId, 
            blockNumber, 
            name, 
            duration 
          });`;

const change3New = `          res.status(201).json({ 
            id: this.lastID, 
            experimentId, 
            blockNumber, 
            name, 
            duration,
            bookId: bookId || null,
            pageNumber: pageNumber || 1
          });`;

if (content.includes(change3Old)) {
  content = content.replace(change3Old, change3New);
  console.log('✅ Actualizado: Response del POST');
  changesMade++;
}

// ============ CAMBIO 4: PUT /api/experiments/:experimentId/blocks/:blockId ============
const change4Old = `app.put('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { name, duration } = req.body;`;

const change4New = `app.put('/api/experiments/:experimentId/blocks/:blockId', requireVerified, (req, res) => {
  const { name, duration, bookId, pageNumber } = req.body;`;

if (content.includes(change4Old)) {
  content = content.replace(change4Old, change4New);
  console.log('✅ Actualizado: Desestructuración de parámetros PUT');
  changesMade++;
}

// ============ CAMBIO 5: UPDATE statement ============
const change5Old = `        'UPDATE reading_blocks SET name = ?, duration = ? WHERE id = ? AND experimentId = ?',
        [name, duration, blockId, experimentId],`;

const change5New = `        'UPDATE reading_blocks SET name = ?, duration = ?, bookId = ?, pageNumber = ? WHERE id = ? AND experimentId = ?',
        [name, duration, bookId || null, pageNumber || 1, blockId, experimentId],`;

if (content.includes(change5Old)) {
  content = content.replace(change5Old, change5New);
  console.log('✅ Actualizado: UPDATE con bookId y pageNumber');
  changesMade++;
}

// ============ CAMBIO 6: Agregar endpoint GET /api/books ============
const apiLibrosEnd = `  });
});

// ============ FUNCIONES AUXILIARES ============`;

const newBooksEndpoint = `  });
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
        id: file.replace(/\.epub$/i, ''),
        name: file.replace(/\.epub$/i, ''),
        title: file.replace(/\.epub$/i, ''),
        path: \`/public/libros/\${file}\`
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    
    res.json(books);
  });
});

// ============ FUNCIONES AUXILIARES ============`;

if (content.includes(apiLibrosEnd) && !content.includes("app.get('/api/books'")) {
  content = content.replace(apiLibrosEnd, newBooksEndpoint);
  console.log('✅ Actualizado: Agregado endpoint GET /api/books');
  changesMade++;
}

// ============ Guardar cambios ============
if (changesMade > 0) {
  fs.writeFileSync(serverPath, content, 'utf8');
  console.log(`\n✅ Se realizaron ${changesMade} cambios en server.js`);
  console.log('📝 Archivo guardado exitosamente');
} else {
  console.log('\n⚠️  No se realizaron cambios - Los cambios ya podrían estar aplicados');
}

process.exit(0);
