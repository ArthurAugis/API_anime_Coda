const mysql = require("mysql2/promise");

// Utilise un pool pour éviter les erreurs de connexion fermée
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function queryDatabase(query, params = []) {
  const [rows] = await pool.execute(query, params);
  return rows;
}

module.exports = { queryDatabase, pool };