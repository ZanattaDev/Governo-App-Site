CREATE DATABASE IF NOT EXISTS conectagov
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE conectagov;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cpf VARCHAR(14) NOT NULL UNIQUE,
  full_name VARCHAR(140) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  govbr_level ENUM('bronze', 'prata', 'ouro') NOT NULL DEFAULT 'prata',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(90) NOT NULL,
  category VARCHAR(40) NOT NULL,
  icon VARCHAR(12) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Ativo',
  description TEXT NOT NULL,
  last_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_service_title (title)
);

CREATE TABLE IF NOT EXISTS citizen_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  service_key VARCHAR(40) NOT NULL,
  title VARCHAR(90) NOT NULL,
  summary VARCHAR(255) NOT NULL,
  status VARCHAR(40) NOT NULL,
  payload JSON NULL,
  last_sync_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_records_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_user_service (user_id, service_key)
);

CREATE TABLE IF NOT EXISTS cnpj_cache (
  cnpj CHAR(14) PRIMARY KEY,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255) NULL,
  registration_status VARCHAR(80) NULL,
  main_activity VARCHAR(255) NULL,
  city VARCHAR(120) NULL,
  state CHAR(2) NULL,
  raw_payload JSON NULL,
  source VARCHAR(120) NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cep_cache (
  cep CHAR(8) PRIMARY KEY,
  street VARCHAR(255) NULL,
  neighborhood VARCHAR(255) NULL,
  city VARCHAR(140) NULL,
  state CHAR(2) NULL,
  raw_payload JSON NULL,
  source VARCHAR(120) NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS official_integrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  service_key VARCHAR(40) NOT NULL UNIQUE,
  agency VARCHAR(120) NOT NULL,
  data_scope VARCHAR(255) NOT NULL,
  access_model VARCHAR(255) NOT NULL,
  public_api_available BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(40) NOT NULL DEFAULT 'Requer convenio',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user_created (user_id, created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO services (title, category, icon, status, description, last_sync_at)
VALUES
  ('CNH Digital', 'documentos', 'CNH', 'Ativo', 'Consulta de validade, categoria, pontuacao, exames e renovacao.', NOW()),
  ('Cartao SUS', 'saude', 'SUS', 'Ativo', 'Vacinas, consultas, medicamentos, exames e historico de atendimento.', NOW()),
  ('Imposto de Renda', 'impostos', 'IR', 'Pendente', 'Declaracoes, recibos, restituicao, pendencias e notificacoes.', NOW()),
  ('Carteira de Trabalho', 'trabalho', 'CLT', 'Ativo', 'Contratos, salarios, ferias, FGTS, seguro-desemprego e abono.', NOW()),
  ('Consulta CNPJ', 'empresa', 'CNPJ', 'Beta', 'Dados cadastrais de empresas com origem em bases autorizadas.', NOW()),
  ('Consulta CEP', 'moradia', 'CEP', 'Ativo', 'Consulta endereco real por CEP usando ViaCEP e cache local no MySQL.', NOW()),
  ('Beneficios Sociais', 'beneficios', 'BEN', 'Ativo', 'Bolsa Familia, BPC, auxilios, calendario e situacao cadastral.', NOW()),
  ('Educacao', 'documentos', 'EDU', 'Ativo', 'Enem, historico escolar, diplomas, certificados e inscricoes.', NOW()),
  ('Veiculos', 'documentos', 'VEI', 'Ativo', 'CRLV, multas, licenciamento, IPVA e transferencia digital.', NOW()),
  ('Notas e Tributos', 'impostos', 'NF', 'Beta', 'Notas fiscais, debitos, certidoes e pagamentos unificados.', NOW()),
  ('Seguro-Desemprego', 'trabalho', 'SD', 'Ativo', 'Solicitacao, parcelas, calendario de pagamento e exigencias.', NOW()),
  ('Habitacao Popular', 'moradia', 'CASA', 'Ativo', 'Consulta de programas habitacionais, financiamento social e faixa de renda.', NOW()),
  ('Titulo de Eleitor', 'documentos', 'TSE', 'Ativo', 'Situacao eleitoral, zona, secao, quitacao e regularizacao.', NOW()),
  ('Reservista', 'documentos', 'MIL', 'Ativo', 'Certificado militar, situacao e regularidade cadastral.', NOW()),
  ('CadUnico', 'beneficios', 'CAD', 'Ativo', 'Cadastro Unico, NIS, composicao familiar e atualizacao cadastral.', NOW()),
  ('Processos e Certidoes', 'juridico', 'JUS', 'Beta', 'Certidoes, andamento processual e pendencias documentais.', NOW())
ON DUPLICATE KEY UPDATE
  category = VALUES(category),
  icon = VALUES(icon),
  status = VALUES(status),
  description = VALUES(description),
  last_sync_at = VALUES(last_sync_at);

INSERT INTO official_integrations (service_key, agency, data_scope, access_model, public_api_available, status)
VALUES
  ('cnpj', 'Receita Federal / bases publicas espelhadas', 'Dados cadastrais publicos de pessoa juridica', 'Consulta publica por BrasilAPI/ReceitaWS no prototipo; API oficial em producao mediante autorizacao institucional.', TRUE, 'API publica ativa'),
  ('cep', 'Correios / ViaCEP', 'Endereco publico por CEP', 'Consulta publica sem dados pessoais sensiveis, com cache local auditavel.', TRUE, 'API publica ativa'),
  ('sus', 'Ministerio da Saude / Conecte SUS', 'Vacinas, consultas, medicamentos e cartao SUS', 'Integracao preparada para OAuth gov.br, consentimento do titular, trilha de auditoria e API autorizada.', FALSE, 'Preparado para convenio'),
  ('cnh', 'SENATRAN / DETRANs', 'CNH, pontuacao, multas e validade', 'Integracao preparada para autenticacao forte, consentimento e acesso oficial SENATRAN/DETRAN.', FALSE, 'Preparado para convenio'),
  ('clt', 'Ministerio do Trabalho / Carteira de Trabalho Digital', 'Contratos, vinculos, salarios e beneficios trabalhistas', 'Integracao preparada para gov.br, autorizacao do titular e consulta oficial trabalhista.', FALSE, 'Preparado para convenio'),
  ('seguro_desemprego', 'Ministerio do Trabalho', 'Solicitacoes, parcelas e situacao do seguro-desemprego', 'Integracao preparada para gov.br, consentimento e API oficial do Ministerio do Trabalho.', FALSE, 'Preparado para convenio'),
  ('titulo_eleitor', 'Tribunal Superior Eleitoral', 'Situacao eleitoral, zona, secao e quitacao', 'Integracao preparada para validacao oficial do eleitor, consentimento e API autorizada do TSE.', FALSE, 'Preparado para convenio'),
  ('habitacao', 'Ministerio das Cidades / Caixa', 'Programas habitacionais, faixa de renda e contratos', 'Integracao preparada para consentimento, validacao cadastral e consulta oficial de programas habitacionais.', FALSE, 'Preparado para convenio')
ON DUPLICATE KEY UPDATE
  agency = VALUES(agency),
  data_scope = VALUES(data_scope),
  access_model = VALUES(access_model),
  public_api_available = VALUES(public_api_available),
  status = VALUES(status);
