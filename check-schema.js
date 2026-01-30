const db = require('./db/init-db');

db.all("PRAGMA table_info(experiments)", (err, rows) => {
  console.log("=== TABLA: experiments ===");
  console.log(JSON.stringify(rows, null, 2));
  
  db.all("PRAGMA table_info(users)", (err, rows2) => {
    console.log("\n=== TABLA: users ===");
    console.log(JSON.stringify(rows2, null, 2));
    
    db.get("SELECT * FROM users LIMIT 1", (err, row) => {
      console.log("\n=== PRIMER USUARIO ===");
      console.log(JSON.stringify(row, null, 2));
      db.close();
    });
  });
});
