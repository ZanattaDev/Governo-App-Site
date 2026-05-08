require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2/promise");

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "troque-esta-chave-em-producao";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "conectagov",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

function onlyNumbers(value = "") {
  return String(value).replace(/\D/g, "");
}

function formatCpf(cpf) {
  const digits = onlyNumbers(cpf).slice(0, 11);
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function isValidCpf(cpf) {
  const digits = onlyNumbers(cpf);

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base) => {
    const total = base
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * (base.length + 1 - index), 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 9));
  const secondDigit = calculateDigit(digits.slice(0, 10));
  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
}

function isValidCnpj(cnpj) {
  const digits = onlyNumbers(cnpj);

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const calculateDigit = (base, weights) => {
    const total = base
      .split("")
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === Number(digits[12]) && secondDigit === Number(digits[13]);
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      cpf: user.cpf,
      name: user.full_name,
      govbrLevel: user.govbr_level,
    },
    jwtSecret,
    { expiresIn: "8h" },
  );
}

async function audit(userId, action, entity, entityId, ip) {
  await pool.execute(
    "INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)",
    [userId || null, action, entity, entityId || null, ip || null],
  );
}

async function authOptional(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;

  if (!token) {
    return next();
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch (_error) {
    req.user = null;
  }

  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token;

  if (!token) {
    return res.status(401).json({ message: "Login necessario." });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (_error) {
    res.status(401).json({ message: "Sessao invalida ou expirada." });
  }
}

async function seedDemoUser() {
  const cpf = "123.456.789-09";
  const [users] = await pool.execute("SELECT id FROM users WHERE cpf = ?", [cpf]);
  let userId = users[0]?.id;

  if (!userId) {
    const passwordHash = await bcrypt.hash("123456", 12);
    const [result] = await pool.execute(
      "INSERT INTO users (cpf, full_name, email, password_hash, govbr_level) VALUES (?, ?, ?, ?, ?)",
      [cpf, "Pedro Henrique", "pedro.demo@conectagov.local", passwordHash, "ouro"],
    );
    userId = result.insertId;
  }

  await pool.execute(
    `INSERT INTO citizen_records (user_id, service_key, title, summary, status, payload, last_sync_at)
     VALUES
       (?, 'cnh', 'CNH Digital', 'Categoria B valida ate 12/2030', 'Regular', JSON_OBJECT('categoria', 'B', 'pontos', 0), NOW()),
       (?, 'sus', 'Cartao SUS', 'Vacinas e consultas sincronizadas', 'Atualizado', JSON_OBJECT('vacinas', 8, 'consultas', 2), NOW()),
       (?, 'clt', 'Carteira de Trabalho', 'Ultimo vinculo ativo registrado', 'Ativo', JSON_OBJECT('contratos', 1), NOW()),
       (?, 'irpf', 'Imposto de Renda', 'Declaracao em processamento', 'Pendente', JSON_OBJECT('ano', 2026), NOW()),
       (?, 'seguro_desemprego', 'Seguro-Desemprego', 'Nenhuma solicitacao ativa no momento', 'Sem pendencias', JSON_OBJECT('parcelas', 0), NOW()),
       (?, 'habitacao', 'Habitacao Popular', 'Perfil apto para simulacao habitacional', 'Em analise', JSON_OBJECT('faixa', 'Faixa 2'), NOW()),
       (?, 'titulo_eleitor', 'Titulo de Eleitor', 'Situacao eleitoral regular', 'Regular', JSON_OBJECT('zona', '001', 'secao', '0100'), NOW()),
       (?, 'cadunico', 'CadUnico', 'Cadastro atualizado ha menos de 24 meses', 'Atualizado', JSON_OBJECT('nis', '00000000000'), NOW())
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       summary = VALUES(summary),
       status = VALUES(status),
       payload = VALUES(payload),
       last_sync_at = VALUES(last_sync_at)`,
    [userId, userId, userId, userId, userId, userId, userId, userId],
  );

  return userId;
}

async function createInitialRecords(userId) {
  await pool.execute(
    `INSERT INTO citizen_records (user_id, service_key, title, summary, status, payload, last_sync_at)
     VALUES
       (?, 'cpf', 'CPF e Identidade Digital', 'Cadastro validado no ConectaGov. Aguardando vinculacao gov.br para dados oficiais.', 'Ativo', JSON_OBJECT('origem', 'cadastro_local'), NOW()),
       (?, 'sus', 'Cartao SUS', 'Conector oficial preparado. Requer autorizacao gov.br para sincronizar dados reais.', 'Aguardando gov.br', JSON_OBJECT('requiresGovBr', true), NOW()),
       (?, 'cnh', 'CNH Digital', 'Conector SENATRAN/DETRAN preparado. Requer integracao oficial.', 'Aguardando convenio', JSON_OBJECT('requiresOfficialApi', true), NOW()),
       (?, 'clt', 'Carteira de Trabalho', 'Conector trabalhista preparado. Requer autorizacao do titular.', 'Aguardando gov.br', JSON_OBJECT('requiresConsent', true), NOW()),
       (?, 'seguro_desemprego', 'Seguro-Desemprego', 'Conector preparado para parcelas e solicitacoes oficiais.', 'Aguardando gov.br', JSON_OBJECT('requiresConsent', true), NOW()),
       (?, 'habitacao', 'Habitacao Popular', 'Perfil cadastrado para analise habitacional no projeto.', 'Cadastrado', JSON_OBJECT('origem', 'cadastro_local'), NOW()),
       (?, 'titulo_eleitor', 'Titulo de Eleitor', 'Conector TSE preparado. Requer validacao oficial do eleitor.', 'Aguardando convenio', JSON_OBJECT('requiresOfficialApi', true), NOW())
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       summary = VALUES(summary),
       status = VALUES(status),
       payload = VALUES(payload),
       last_sync_at = VALUES(last_sync_at)`,
    [userId, userId, userId, userId, userId, userId, userId],
  );
}

app.post("/api/auth/register", async (req, res) => {
  const rawCpf = req.body.cpf || "";
  const cpf = formatCpf(rawCpf);
  const fullName = String(req.body.fullName || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!isValidCpf(rawCpf)) {
    return res.status(400).json({ message: "CPF invalido. Confira os 11 digitos." });
  }

  if (fullName.length < 3) {
    return res.status(400).json({ message: "Informe seu nome completo." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Informe um e-mail valido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres." });
  }

  const [existing] = await pool.execute("SELECT id FROM users WHERE cpf = ? OR email = ?", [cpf, email]);

  if (existing.length > 0) {
    return res.status(409).json({ message: "CPF ou e-mail ja cadastrado." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute(
    "INSERT INTO users (cpf, full_name, email, password_hash, govbr_level) VALUES (?, ?, ?, ?, ?)",
    [cpf, fullName, email, passwordHash, "bronze"],
  );

  await createInitialRecords(result.insertId);
  await audit(result.insertId, "REGISTER", "users", String(result.insertId), req.ip);

  const [users] = await pool.execute("SELECT * FROM users WHERE id = ?", [result.insertId]);
  const user = users[0];

  res.status(201).json({
    token: createToken(user),
    user: {
      id: user.id,
      cpf: user.cpf,
      fullName: user.full_name,
      email: user.email,
      govbrLevel: user.govbr_level,
    },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const rawCpf = req.body.cpf || "";
  const cpf = formatCpf(rawCpf);
  const password = String(req.body.password || "");

  if (!isValidCpf(rawCpf)) {
    return res.status(400).json({ message: "CPF invalido. Confira os 11 digitos." });
  }

  const [users] = await pool.execute("SELECT * FROM users WHERE cpf = ?", [cpf]);
  const user = users[0];

  if (!user) {
    return res.status(404).json({ message: "CPF nao existe na base do ConectaGov." });
  }

  if (!(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: "Senha invalida." });
  }


  await audit(user.id, "LOGIN", "users", String(user.id), req.ip);

  res.json({
    token: createToken(user),
    user: {
      id: user.id,
      cpf: user.cpf,
      fullName: user.full_name,
      email: user.email,
      govbrLevel: user.govbr_level,
    },
  });
});

app.get("/api/me", authRequired, async (req, res) => {
  const [users] = await pool.execute(
    "SELECT id, cpf, full_name, email, govbr_level, updated_at FROM users WHERE id = ?",
    [req.user.sub],
  );

  if (!users[0]) {
    return res.status(404).json({ message: "Usuario nao encontrado." });
  }

  res.json(users[0]);
});

app.get("/api/services", authOptional, async (_req, res) => {
  const [services] = await pool.execute(
    "SELECT id, title, category, icon, status, description, last_sync_at FROM services ORDER BY id",
  );

  res.json(services);
});

app.get("/api/integrations", authOptional, async (_req, res) => {
  const [integrations] = await pool.execute(
    `SELECT service_key, agency, data_scope, access_model, public_api_available, status
     FROM official_integrations
     ORDER BY public_api_available DESC, agency`,
  );

  res.json(integrations);
});

app.get("/api/records", authRequired, async (req, res) => {
  const [records] = await pool.execute(
    "SELECT service_key, title, summary, status, payload, last_sync_at FROM citizen_records WHERE user_id = ? ORDER BY title",
    [req.user.sub],
  );

  await audit(req.user.sub, "VIEW_RECORDS", "citizen_records", null, req.ip);
  res.json(records);
});

app.get("/api/cnpj/:cnpj", authOptional, async (req, res) => {
  const cnpj = onlyNumbers(req.params.cnpj).slice(0, 14);

  if (cnpj.length !== 14) {
    return res.status(400).json({ message: "CNPJ deve conter 14 digitos." });
  }

  if (!isValidCnpj(cnpj)) {
    return res.status(400).json({ message: "CNPJ invalido. Confira os digitos verificadores." });
  }


  const [cached] = await pool.execute("SELECT * FROM cnpj_cache WHERE cnpj = ?", [cnpj]);

  if (cached[0]) {
    await audit(req.user?.sub, "VIEW_CNPJ_CACHE", "cnpj_cache", cnpj, req.ip);
    return res.json({ ...cached[0], fromCache: true });
  }

  try {
    let source = "BrasilAPI";
    let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);

    if (!response.ok) {
      source = "ReceitaWS";
      response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 ConectaGovBrasil/1.0",
        },
      });
    }

    if (!response.ok) {
      throw new Error("CNPJ nao encontrado");
    }

    const company = await response.json();

    if (company.status === "ERROR") {
      throw new Error(company.message || "CNPJ nao encontrado");
    }

    const record = {
      cnpj,
      legal_name: company.razao_social || company.nome || "Razao social nao informada",
      trade_name: company.nome_fantasia || company.fantasia || null,
      registration_status: company.descricao_situacao_cadastral || company.situacao || null,
      main_activity: company.cnae_fiscal_descricao || company.atividade_principal?.[0]?.text || null,
      city: company.municipio || company.cidade || null,
      state: company.uf || null,
      raw_payload: JSON.stringify(company),
      source,
    };

    await pool.execute(
      `INSERT INTO cnpj_cache
       (cnpj, legal_name, trade_name, registration_status, main_activity, city, state, raw_payload, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.cnpj,
        record.legal_name,
        record.trade_name,
        record.registration_status,
        record.main_activity,
        record.city,
        record.state,
        record.raw_payload,
        record.source,
      ],
    );

    await audit(req.user?.sub, "FETCH_CNPJ_PUBLIC_API", "cnpj_cache", cnpj, req.ip);
    res.json({ ...record, fromCache: false });
  } catch (_error) {
    res.status(502).json({
      message: "Nao foi possivel consultar a base publica agora. Tente novamente ou use um CNPJ ja cacheado.",
    });
  }
});

app.get("/api/cep/:cep", authOptional, async (req, res) => {
  const cep = onlyNumbers(req.params.cep).slice(0, 8);

  if (cep.length !== 8) {
    return res.status(400).json({ message: "CEP deve conter 8 digitos." });
  }

  const [cached] = await pool.execute("SELECT * FROM cep_cache WHERE cep = ?", [cep]);

  if (cached[0]) {
    await audit(req.user?.sub, "VIEW_CEP_CACHE", "cep_cache", cep, req.ip);
    return res.json({ ...cached[0], fromCache: true });
  }

  try {
    // API pública de consulta de CEP (retorno típico: { cep, uf, localidade, bairro, logradouro, ... })
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    if (!response.ok) {
      return res.status(404).json({ message: "CEP nao encontrado na base ViaCEP." });
    }

    const data = await response.json();

    if (data.erro) {
      return res.status(404).json({ message: "CEP nao encontrado na base ViaCEP." });
    }

    const record = {
      cep,
      street: data.logradouro || null,
      neighborhood: data.bairro || null,
      city: data.localidade || null,
      state: data.uf || null,
      raw_payload: JSON.stringify(data),
      source: "ViaCEP",
    };

    await pool.execute(
      `INSERT INTO cep_cache
       (cep, street, neighborhood, city, state, raw_payload, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.cep,
        record.street,
        record.neighborhood,
        record.city,
        record.state,
        record.raw_payload,
        record.source,
      ],
    );

    await audit(req.user?.sub, "FETCH_CEP_PUBLIC_API", "cep_cache", cep, req.ip);
    res.json({ ...record, fromCache: false });
  } catch (_error) {
    res.status(502).json({
      message: "Nao foi possivel consultar o ViaCEP agora. Tente novamente ou use um CEP ja cacheado.",
    });
  }
});

app.get("/api/events", authRequired, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendSnapshot = async () => {
    const [[serviceInfo]] = await pool.execute(
      "SELECT COUNT(*) AS total, MAX(updated_at) AS lastUpdate FROM services",
    );
    const [[recordInfo]] = await pool.execute(
      "SELECT COUNT(*) AS total, MAX(updated_at) AS lastUpdate FROM citizen_records WHERE user_id = ?",
      [req.user.sub],
    );

    res.write(
      `event: snapshot\ndata: ${JSON.stringify({
        services: serviceInfo.total,
        records: recordInfo.total,
        lastServiceUpdate: serviceInfo.lastUpdate,
        lastRecordUpdate: recordInfo.lastUpdate,
        serverTime: new Date().toISOString(),
      })}\n\n`,
    );
  };

  await sendSnapshot();
  const timer = setInterval(sendSnapshot, 10000);

  req.on("close", () => {
    clearInterval(timer);
    res.end();
  });
});

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

seedDemoUser()
  .then(() => {
    app.listen(port, () => {
      console.log(`ConectaGov rodando em http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Erro ao iniciar. Verifique se o banco foi criado pelo HeidiSQL/schema.sql.");
    console.error(error);
    process.exit(1);
  });
