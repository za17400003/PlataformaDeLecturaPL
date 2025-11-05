const http = require('http');
const url = 'http://localhost:3001/api/libros';

http.get(url, (res) => {
  console.log('STATUS:', res.statusCode);
  let body = '';
  res.setEncoding('utf8');
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('BODY:', body.substring(0, 1000));
    process.exit(0);
  });
}).on('error', (e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});