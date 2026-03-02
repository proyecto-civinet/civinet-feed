const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "donaciones_db",
  password: "1234",
  port: 5432,
});

module.exports = pool;