# ConectaGov Brasil

Prototipo academico profissional de um portal/app de governo digital com backend, login por CPF, banco MySQL/MariaDB e consulta de CNPJ com cache.

## Recursos implementados

- Site responsivo com painel de servicos publicos.
- Backend Node.js/Express.
- Banco MySQL ou MariaDB, administravel pelo HeidiSQL.
- Login com CPF e senha usando hash bcrypt.
- Cadastro de novo cidadao por CPF real validado matematicamente.
- Token JWT para sessao.
- Registros pessoais protegidos por autenticacao.
- Consulta de CNPJ via backend, com armazenamento em `cnpj_cache`.
- Consulta de CEP via ViaCEP, com armazenamento em `cep_cache`.
- Validação real de CPF e CNPJ por dígitos verificadores.
- Mensagem separada para CPF inválido e CPF válido não cadastrado.
- Atualizacao em tempo real via Server-Sent Events em `/api/events`.
- Auditoria basica em `audit_logs`.
- Mapa de integrações oficiais para SUS, CNH, CLT, seguro-desemprego, habitação e título de eleitor.

## Como rodar com HeidiSQL

1. Abra o HeidiSQL e conecte no seu MySQL/MariaDB local.
2. Abra o arquivo `database/schema.sql`.
3. Execute o script completo para criar o banco `conectagov` e as tabelas.
4. Copie `.env.example` para `.env`.
5. Ajuste usuario e senha do banco no `.env`.
6. Instale as dependencias:

```bash
npm install
```

7. Inicie o servidor:

```bash
npm run dev
```

8. Abra:

```text
http://localhost:3000
```

## Login de demonstracao

```text
CPF: 123.456.789-09
Senha: 123456
```

O usuario demo e criado automaticamente quando o backend inicia, desde que o banco ja tenha sido criado pelo `schema.sql`.

## Usando seu CPF real no prototipo

O sistema permite cadastrar um CPF real no banco local do projeto. Depois do cadastro, ao logar com esse CPF, o painel puxa os registros vinculados a esse usuario no MySQL/MariaDB.

Importante: o sistema nao consulta dados sigilosos reais do governo apenas pelo CPF. SUS, CNH, CLT, IRPF, seguro-desemprego e titulo de eleitor exigem login gov.br, consentimento e integracoes oficiais autorizadas. Por isso, para novos CPFs, o projeto cria registros iniciais com status de "Aguardando gov.br" ou "Aguardando convenio".

## Estrutura do banco

- `users`: cidadaos autenticaveis por CPF.
- `services`: catalogo de servicos do portal.
- `citizen_records`: documentos e registros pessoais vinculados ao usuario.
- `cnpj_cache`: cache local das consultas de CNPJ.
- `cep_cache`: cache local das consultas de CEP.
- `official_integrations`: mapa tecnico de APIs publicas e integracoes oficiais protegidas.
- `audit_logs`: historico de acessos importantes.

## Observacao importante sobre Receita Federal

Este projeto e academico. A Receita Federal possui dados e servicos com regras proprias de acesso. Em um sistema real, a integracao precisa de API oficial/autorizada, autenticacao gov.br, consentimento, logs de auditoria, LGPD, criptografia, controle de perfil e trilha de acesso.

No prototipo, a consulta de CNPJ usa BrasilAPI e ReceitaWS como provedores publicos. A consulta de CEP usa ViaCEP. Dados pessoais sensiveis, como SUS, CNH, CLT, seguro-desemprego, habitacao social e titulo de eleitor, ficam representados como conectores oficiais porque exigem autorizacao institucional e consentimento do titular.
