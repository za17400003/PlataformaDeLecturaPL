const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('db/users.db', (err) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }
  
  db.all('SELECT id, email, username, passwordResetToken, passwordResetExpires FROM users', (err, rows) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Usuarios con tokens:');
      rows.forEach(row => {
        if (row.passwordResetToken) {
          console.log(`\n📧 ${row.email} (${row.username})`);
          console.log(`   Token: ${row.passwordResetToken.substring(0, 20)}...`);
          console.log(`   Expira: ${row.passwordResetExpires}`);
        }
      });
      if (!rows.some(r => r.passwordResetToken)) {
        console.log('❌ No hay tokens activos');
      }
    }
    db.close();
  });
});
