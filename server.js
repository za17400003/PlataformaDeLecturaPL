const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public'));

// middleware to accept multipart uploads handled by multer below
const multer = require('multer');
const recordingsDir = path.join(__dirname, 'camera-recorder-app', 'server', 'recordings');
try { fs.mkdirSync(recordingsDir, { recursive: true }); } catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, recordingsDir),
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname) || '.webm';
    cb(null, `recording-${Date.now()}${safeExt}`);
  }
});
const upload = multer({ storage });

const librosPath = path.join(__dirname, 'public', 'libros');

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  return res.status(200).send({ ok: true, filename: path.basename(req.file.path) });
});

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