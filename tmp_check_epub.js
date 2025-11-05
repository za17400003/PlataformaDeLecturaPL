const http = require('http');
const url = 'http://localhost:3001/public/libros/Charlie%20y%20la%20fabrica%20de%20chocolate%20Ilus%20por%20Quentin%20Blake%20-%20Roald%20Dahl.epub';

http.get(url, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let size = 0;
  res.on('data', (chunk) => { size += chunk.length; });
  res.on('end', () => {
    console.log('BODY_BYTES:', size);
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});