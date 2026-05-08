# TODO - ConectaGov melhorias

- [ ] Atualizar `server.js`:
  - [x] Login: diferenciar CPF inexistente vs senha inválida
  - [ ] Adicionar endpoint `GET /api/cep/:cep` com cache (cep_cache)



- [ ] Atualizar `database/schema.sql`:
- [x] Criar tabela `cep_cache`


- [ ] Atualizar front (`index.html`, `app.js`, `styles.css` se necessário):
  - [ ] Adicionar UI para consulta de CEP (form + resultado + indicador cache/origem)
  - [ ] Corrigir login JS para usar `passwordInput` corretamente

- [ ] Testar localmente:
  - [ ] Rodar `npm install` e `npm run dev`
  - [ ] Testar login com CPF inexistente
  - [ ] Testar consulta de CEP (primeira vez: origem API; segunda: cache)


