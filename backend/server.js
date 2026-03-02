require("dotenv").config();
const emailService = require("./src/services/emailService");
const app  = require("./src/app");
const pool = require("./src/config/db");

pool.query("SELECT NOW()")
  .then(res  => console.log("âœ… Conectado a PostgreSQL:", res.rows))
  .catch(err => console.error("âŒ Error conexiÃ³n:", err.message));

app.listen(4000, () => {
  console.log("ðŸš€ Servidor corriendo en puerto 4000");
});








