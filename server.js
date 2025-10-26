const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

const librosPath = path.join(__dirname, 'public', 'libros');

app.get('/api/libros', (req, res) => {
  fs.readdir(librosPath, (err, files) => {
    if (err) return res.status(500).json({ error: 'No se pudo leer la carpeta de libros' });

    const epubs = files
      .filter(file => file.endsWith('.epub'))
      .map(file => ({
        titulo: file.replace('.epub', ''),
        archivo: `/libros/${file}`
      }));

    res.json(epubs);
  });
});

app.listen(3001, () => {
  console.log('Servidor backend corriendo en http://localhost:3001');
});