require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const mysql = require("mysql2/promise");

async function main() {
  const sql = await fs.readFile(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  await connection.query(sql);
  await connection.end();
  console.log("Banco conectagov criado/atualizado com sucesso.");
}

main().catch((error) => {
  console.error("Nao foi possivel configurar o banco. Confira usuario e senha no .env.");
  console.error(error.message);
  process.exit(1);
});
