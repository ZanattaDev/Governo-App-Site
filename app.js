const api = {
  token: null,
  user: null,
  events: null,
};

localStorage.removeItem("conectagov_token");
localStorage.removeItem("conectagov_user");

const fallbackServices = [
  {
    title: "CNH Digital",
    category: "documentos",
    icon: "CNH",
    status: "Ativo",
    description: "Consulta de validade, categoria, pontuacao, exames e renovacao.",
  },
  {
    title: "Cartao SUS",
    category: "saude",
    icon: "SUS",
    status: "Ativo",
    description: "Vacinas, consultas, medicamentos, exames e historico de atendimento.",
  },
  {
    title: "Imposto de Renda",
    category: "impostos",
    icon: "IR",
    status: "Pendente",
    description: "Declaracoes, recibos, restituicao, pendencias e notificacoes.",
  },
  {
    title: "Carteira de Trabalho",
    category: "trabalho",
    icon: "CLT",
    status: "Ativo",
    description: "Contratos, salarios, ferias, FGTS, seguro-desemprego e abono.",
  },
  {
    title: "Consulta CNPJ",
    category: "empresa",
    icon: "CNPJ",
    status: "Beta",
    description: "Dados cadastrais de empresas com origem em bases autorizadas.",
  },
  {
    title: "Consulta CEP",
    category: "moradia",
    icon: "CEP",
    status: "Ativo",
    description: "Consulta endereco real por CEP usando ViaCEP e cache local no MySQL.",
  },
  {
    title: "Beneficios Sociais",
    category: "beneficios",
    icon: "BEN",
    status: "Ativo",
    description: "Bolsa Familia, BPC, auxilios, calendario e situacao cadastral.",
  },
  {
    title: "Seguro-Desemprego",
    category: "trabalho",
    icon: "SD",
    status: "Ativo",
    description: "Solicitacao, parcelas, calendario de pagamento e exigencias.",
  },
  {
    title: "Habitacao Popular",
    category: "moradia",
    icon: "CASA",
    status: "Ativo",
    description: "Programas habitacionais, financiamento social e faixa de renda.",
  },
  {
    title: "Titulo de Eleitor",
    category: "documentos",
    icon: "TSE",
    status: "Ativo",
    description: "Situacao eleitoral, zona, secao, quitacao e regularizacao.",
  },
];

let services = [...fallbackServices];
let currentRecords = [];

const serviceGrid = document.querySelector("#serviceGrid");
const tabs = document.querySelectorAll(".tab");
const cnpjForm = document.querySelector("#cnpjForm");
const cnpjInput = document.querySelector("#cnpjInput");
const cnpjResult = document.querySelector("#cnpjResult");
const cepForm = document.querySelector("#cepForm");
const cepInput = document.querySelector("#cepInput");
const cepResult = document.querySelector("#cepResult");

const loginForm = document.querySelector("#loginForm");
const cpfInput = document.querySelector("#cpfInput");
const passwordInput = document.querySelector("#passwordInput");
const loginMessage = document.querySelector("#loginMessage");
const fullNameInput = document.querySelector("#fullNameInput");
const emailInput = document.querySelector("#emailInput");
const loginModeButton = document.querySelector("#loginModeButton");
const registerModeButton = document.querySelector("#registerModeButton");
const authTitle = document.querySelector("#authTitle");
const authSubmit = document.querySelector("#authSubmit");

const openLogin = document.querySelector("#openLogin");
const accountCard = document.querySelector("#accountCard");
const recordsGrid = document.querySelector("#recordsGrid");
const liveStrip = document.querySelector("#liveStrip");
const integrationGrid = document.querySelector("#integrationGrid");
const serviceWorkspace = document.querySelector("#serviceWorkspace");
let authMode = "login";

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function formatCpf(value) {
  const digits = onlyNumbers(value).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function isValidCpf(value) {
  const digits = onlyNumbers(value);

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

  return (
    calculateDigit(digits.slice(0, 9)) === Number(digits[9]) &&
    calculateDigit(digits.slice(0, 10)) === Number(digits[10])
  );
}

function formatCnpj(value) {
  const digits = onlyNumbers(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value) {
  const digits = onlyNumbers(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, "$1-$2");
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (api.token) {
    headers.Authorization = `Bearer ${api.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || "Falha ao comunicar com o servidor.");
    error.status = response.status;

    if (response.status === 401) {
      clearSession("Sua sessao expirou. Entre novamente para ver seus documentos.");
    }

    throw error;
  }

  return data;
}

function renderGuestRecords(message = "Entre com CPF para carregar seus documentos e registros.") {
  recordsGrid.innerHTML = `
    <article>
      <span class="record-icon">CPF</span>
      <h3>Aguardando login</h3>
      <p>${message}</p>
    </article>
  `;
}

function renderServices(category = "todos") {
  const visibleServices =
    category === "todos" ? services : services.filter((service) => service.category === category);

  if (!visibleServices.length) {
    serviceGrid.innerHTML = `
      <article class="service-card">
        <header>
          <span class="service-icon">...</span>
          <span class="status">Vazio</span>
        </header>
        <h3>Nenhum servico nesta categoria</h3>
        <p>Escolha outra aba para visualizar os servicos disponiveis.</p>
      </article>
    `;
    return;
  }

  serviceGrid.innerHTML = visibleServices
    .map(
      (service) => {
        const serviceId = service.id ?? service.title;
        return `
        <article class="service-card" data-service-id="${serviceId}">
          <header>
            <span class="service-icon">${service.icon}</span>
            <span class="status">${service.status}</span>
          </header>
          <h3>${service.title}</h3>
          <p>${service.description}</p>
          <button type="button" data-open-service="${serviceId}">Abrir servico</button>
        </article>
      `;
      },
    )
    .join("");
}

function renderAccount() {
  if (!api.user) {
    accountCard.innerHTML = `
      <span class="muted">Sessao</span>
      <strong>Nenhum cidadao autenticado</strong>
      <p>Entre com CPF para carregar dados pessoais, registros e atualizacoes ao vivo do banco.</p>
    `;
    openLogin.textContent = "Entrar com CPF";
    return;
  }

  accountCard.innerHTML = `
    <span class="muted">Sessao ativa</span>
    <strong>${api.user.fullName}</strong>
    <p>CPF ${api.user.cpf} - nivel gov.br ${api.user.govbrLevel}. Dados sincronizados com MySQL/MariaDB.</p>
    <button class="ghost-button" type="button" id="logoutButton">Sair</button>
  `;
  openLogin.textContent = "Sair";
  document.querySelector("#logoutButton").addEventListener("click", logout);
}

function showLoginScreen(message = "") {
  document.body.classList.add("auth-only");
  document.body.classList.remove("app-ready");
  loginMessage.textContent = message;
}

function showAppScreen() {
  document.body.classList.remove("auth-only");
  document.body.classList.add("app-ready");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";

  document.querySelectorAll(".register-only").forEach((element) => {
    element.style.display = isRegister ? "" : "none";
    if ("required" in element) {
      element.required = isRegister;
    }
  });

  loginModeButton.classList.toggle("active", !isRegister);
  registerModeButton.classList.toggle("active", isRegister);
  authTitle.textContent = isRegister ? "Cadastrar CPF" : "Login com CPF";
  authSubmit.textContent = isRegister ? "Criar conta e acessar" : "Acessar painel";
  loginMessage.textContent = "";
}

function renderRecords(records) {
  if (!records.length) {
    recordsGrid.innerHTML = `
      <article>
        <span class="record-icon">CPF</span>
        <h3>Erro ao carregar</h3>
        <p>${api.token ? "Nenhum registro retornado pelo backend para este CPF." : "Entre com CPF para carregar seus documentos."}</p>
      </article>
    `;
    return;
  }


  recordsGrid.innerHTML = records
    .map(
      (record) => `
        <article>
          <span class="record-icon">${record.service_key.toUpperCase()}</span>
          <h3>${record.title}</h3>
          <p>${record.summary}</p>
          <strong class="record-status">${record.status}</strong>
        </article>
      `,
    )
    .join("");
}

function renderCompany(company) {
  cnpjResult.innerHTML = `
    <strong>${company.legal_name}</strong><br>
    Nome fantasia: ${company.trade_name || "Nao informado"}<br>
    Situacao cadastral: ${company.registration_status || "Nao informada"}<br>
    Atividade principal: ${company.main_activity || "Nao informada"}<br>
    Localizacao: ${company.city || "Cidade nao informada"}/${company.state || "UF"}<br>
    Fonte: ${company.source}${company.fromCache ? " - cache MySQL" : ""}
  `;
}

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getServiceAction(service) {
  const title = normalize(service.title);

  if (title.includes("cnpj")) {
    return {
      type: "public-api",
      title: "Consulta publica real de CNPJ",
      text: "Este servico usa o backend, valida o CNPJ e consulta provedores publicos reais. O resultado fica salvo no MySQL.",
      primaryLabel: "Consultar CNPJ",
      target: "#cnpj",
    };
  }

  if (title.includes("cep") || title.includes("endereco")) {
    return {
      type: "public-api",
      title: "Consulta publica real de CEP",
      text: "Digite um CEP existente. O backend consulta o ViaCEP em tempo real e salva o endereco no cache local.",
      primaryLabel: "Consultar CEP",
      target: "#cep",
    };
  }

  if (title.includes("sus") || title.includes("cnh") || title.includes("carteira") || title.includes("seguro") || title.includes("titulo")) {
    return {
      type: "protected",
      title: "Dado pessoal protegido",
      text: "Este servico abre os registros vinculados ao CPF logado. Em producao, a sincronizacao real precisa de gov.br, consentimento e API oficial.",
      primaryLabel: "Ver meus registros",
      target: "#documentos",
    };
  }

  if (title.includes("habitacao") || title.includes("beneficio") || title.includes("cadunico") || title.includes("imposto") || title.includes("tributo")) {
    return {
      type: "account",
      title: "Servico vinculado ao CPF",
      text: "Este modulo usa os dados cadastrados no MySQL e fica pronto para receber uma integracao oficial quando autorizada.",
      primaryLabel: "Abrir carteira digital",
      target: "#documentos",
    };
  }

  return {
    type: "integration",
    title: "Conector preparado",
    text: "Modulo funcional no painel, com catalogo no banco e trilha tecnica no mapa de integracoes.",
    primaryLabel: "Ver integracoes",
    target: "#integracoes",
  };
}

function getRecordByKeys(keys) {
  return currentRecords.find((record) =>
    keys.some((key) => normalize(record.service_key).includes(key) || normalize(record.title).includes(key)),
  );
}

function parsePayload(record) {
  if (!record?.payload) {
    return {};
  }

  if (typeof record.payload === "object") {
    return record.payload;
  }

  try {
    return JSON.parse(record.payload);
  } catch (_error) {
    return {};
  }
}

function makeDetailRows(service) {
  const title = normalize(service.title);

  if (title.includes("cnh")) {
    const record = getRecordByKeys(["cnh"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / conector SENATRAN-DETRAN preparado",
      rows: [
        ["Documento", "Carteira Nacional de Habilitacao"],
        ["Situacao", record?.status || "Aguardando login gov.br"],
        ["Categoria", payload.categoria || "B"],
        ["Pontuacao", payload.pontos !== undefined ? `${payload.pontos} pontos` : "Disponivel apos sincronizacao"],
        ["Validade", record?.summary || "Disponivel apos integracao oficial"],
        ["Origem", "Base local do projeto; dados reais exigem API oficial"],
      ],
    };
  }

  if (title.includes("sus")) {
    const record = getRecordByKeys(["sus", "cartao sus"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / Conecte SUS preparado",
      rows: [
        ["Documento", "Cartao Nacional de Saude"],
        ["Situacao", record?.status || "Aguardando gov.br"],
        ["Vacinas registradas", payload.vacinas ?? "Disponivel apos autorizacao"],
        ["Consultas recentes", payload.consultas ?? "Disponivel apos autorizacao"],
        ["Resumo", record?.summary || "Sincronizacao real depende do Ministerio da Saude"],
        ["Origem", "Base local do projeto; dados reais exigem consentimento"],
      ],
    };
  }

  if (title.includes("carteira") || title.includes("clt")) {
    const record = getRecordByKeys(["clt", "carteira"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / Carteira de Trabalho Digital preparada",
      rows: [
        ["Modulo", "Carteira de Trabalho"],
        ["Situacao", record?.status || "Aguardando gov.br"],
        ["Contratos", payload.contratos ?? "Disponivel apos autorizacao"],
        ["Ultimo vinculo", record?.summary || "Disponivel apos integracao oficial"],
        ["FGTS e beneficios", "Conector preparado"],
        ["Origem", "Base local do projeto; dados reais exigem gov.br"],
      ],
    };
  }

  if (title.includes("imposto") || title.includes("tributo") || title.includes("nota")) {
    const record = getRecordByKeys(["irpf", "imposto"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / Receita Federal preparada",
      rows: [
        ["Modulo", title.includes("nota") ? "Notas e Tributos" : "Imposto de Renda"],
        ["Situacao", record?.status || service.status],
        ["Ano-base", payload.ano || "Disponivel apos autorizacao"],
        ["Declaracao", record?.summary || "Consulta oficial depende da Receita Federal"],
        ["Restituicao", "Conector preparado"],
        ["Origem", "Base local do projeto; dados reais exigem e-CAC/gov.br"],
      ],
    };
  }

  if (title.includes("cnpj")) {
    return {
      source: "APIs publicas reais: BrasilAPI/ReceitaWS com cache MySQL",
      rows: [
        ["Servico", "Consulta cadastral de pessoa juridica"],
        ["Entrada", "CNPJ com 14 digitos"],
        ["Dados exibidos", "Razao social, fantasia, situacao, atividade, cidade e UF"],
        ["Validacao", "Digitos verificadores do CNPJ"],
        ["Persistencia", "Tabela cnpj_cache no MySQL"],
        ["Exemplo testado", "33.000.167/0001-01 - Petrobras"],
      ],
    };
  }

  if (title.includes("cep")) {
    return {
      source: "API publica real ViaCEP com cache MySQL",
      rows: [
        ["Servico", "Consulta de endereco por CEP"],
        ["Entrada", "CEP com 8 digitos"],
        ["Dados exibidos", "Logradouro, bairro, cidade, UF e origem"],
        ["CEP existente", "Exibe endereco real"],
        ["CEP inexistente", "Mostra mensagem de nao encontrado"],
        ["Exemplo testado", "01001-000 - Praca da Se, Sao Paulo/SP"],
      ],
    };
  }

  if (title.includes("seguro")) {
    const record = getRecordByKeys(["seguro"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / Ministerio do Trabalho preparado",
      rows: [
        ["Servico", "Seguro-Desemprego"],
        ["Situacao", record?.status || "Aguardando gov.br"],
        ["Parcelas", payload.parcelas ?? "Disponivel apos autorizacao"],
        ["Resumo", record?.summary || "Nenhuma consulta oficial sincronizada"],
        ["Calendario", "Conector preparado"],
        ["Origem", "Dados reais exigem gov.br e API oficial"],
      ],
    };
  }

  if (title.includes("habitacao")) {
    const record = getRecordByKeys(["habitacao"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / conector habitacional preparado",
      rows: [
        ["Servico", "Habitacao Popular"],
        ["Situacao", record?.status || "Cadastrado"],
        ["Faixa", payload.faixa || "A calcular"],
        ["Resumo", record?.summary || "Perfil local pronto para analise"],
        ["Integracao", "Ministerio das Cidades / Caixa"],
        ["Origem", "Base local do projeto"],
      ],
    };
  }

  if (title.includes("titulo")) {
    const record = getRecordByKeys(["titulo"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / TSE preparado",
      rows: [
        ["Documento", "Titulo de Eleitor"],
        ["Situacao", record?.status || "Aguardando convenio"],
        ["Zona", payload.zona || "Disponivel apos integracao"],
        ["Secao", payload.secao || "Disponivel apos integracao"],
        ["Quitacao eleitoral", record?.summary || "Consulta oficial depende do TSE"],
        ["Origem", "Base local do projeto; dados reais exigem API autorizada"],
      ],
    };
  }

  if (title.includes("cadunico") || title.includes("beneficio")) {
    const record = getRecordByKeys(["cadunico", "beneficio"]);
    const payload = parsePayload(record);
    return {
      source: "Registro do CPF logado / CadUnico preparado",
      rows: [
        ["Servico", service.title],
        ["Situacao", record?.status || service.status],
        ["NIS", payload.nis || "Disponivel apos autorizacao"],
        ["Resumo", record?.summary || service.description],
        ["Beneficios", "Bolsa Familia, BPC e auxilios preparados"],
        ["Origem", "Base local do projeto; dados reais exigem autorizacao"],
      ],
    };
  }

  return {
    source: "Catalogo de servicos no MySQL",
    rows: [
      ["Servico", service.title],
      ["Categoria", service.category],
      ["Situacao", service.status],
      ["Descricao", service.description],
      ["Ultima sincronizacao", service.last_sync_at || "Nao informada"],
      ["Origem", "Tabela services"],
    ],
  };
}

function renderServiceWorkspace(service) {
  const action = getServiceAction(service);
  const details = makeDetailRows(service);
  const relatedRecords = currentRecords.filter((record) => {
    const title = normalize(service.title);
    return title.includes(normalize(record.title).split(" ")[0]) || normalize(record.title).includes(title.split(" ")[0]);
  });

  serviceWorkspace.innerHTML = `
    <span class="service-kind">${action.type === "public-api" ? "API publica real" : action.type === "protected" ? "Dados protegidos" : "Conector"}</span>
    <h3>${service.title}</h3>
    <p>${action.text}</p>
    <div class="detail-table" aria-label="Dados do servico ${service.title}">
      ${details.rows.map(([label, value]) => `<div><strong>${label}</strong><span>${value}</span></div>`).join("")}
    </div>
    <p class="detail-source">Fonte: ${details.source}</p>
    <div class="workspace-actions">
      <button type="button" data-scroll-target="${action.target}">${action.primaryLabel}</button>
      <button type="button" data-scroll-target="#integracoes">Ver requisito tecnico</button>
    </div>
    <div class="workspace-records">
      ${
        relatedRecords.length
          ? relatedRecords
              .map(
                (record) => `<div class="record-line"><strong>${record.title}</strong><span class="muted">${record.status}</span><p class="record-summary">${record.summary}</p></div>`,
              )
              .join("")
          : "<span>Nenhum registro especifico carregado para este servico ainda.</span>"
      }
    </div>
  `;


  serviceWorkspace.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderCep(address) {
  cepResult.innerHTML = `
    <strong>${address.street || "Logradouro nao informado"}</strong><br>
    Bairro: ${address.neighborhood || "Nao informado"}<br>
    Cidade: ${address.city || "Nao informada"}/${address.state || "UF"}<br>
    CEP: ${address.cep}<br>
    Fonte: ${address.source}${address.fromCache ? " - cache MySQL" : ""}
  `;
}

function renderIntegrations(integrations) {
  if (!integrationGrid) {
    return;
  }

  const names = {
    cep: "Consulta de CEP",
    cnpj: "Consulta de CNPJ",
    sus: "Cartao SUS",
    cnh: "CNH Digital",
    clt: "Carteira de Trabalho",
    seguro_desemprego: "Seguro-Desemprego",
    titulo_eleitor: "Titulo de Eleitor",
    habitacao: "Habitacao Popular",
  };

  integrationGrid.innerHTML = integrations
    .map(
      (integration) => `
        <article>
          <div class="integration-card-header">
            <span class="integration-status ${integration.public_api_available ? "public" : "protected"}">
              ${integration.status}
            </span>
            <span class="integration-compliance">LGPD</span>
          </div>
          <h3>${names[integration.service_key] || integration.service_key}</h3>
          <dl class="integration-meta">
            <div>
              <dt>Orgao responsavel</dt>
              <dd>${integration.agency}</dd>
            </div>
            <div>
              <dt>Escopo dos dados</dt>
              <dd>${integration.data_scope}</dd>
            </div>
            <div>
              <dt>Modelo de acesso</dt>
              <dd>${integration.access_model}</dd>
            </div>
            <div>
              <dt>Situacao tecnica</dt>
              <dd>${integration.public_api_available ? "Operacional no prototipo com dados publicos." : "Conector regularizado para ambiente oficial autorizado."}</dd>
            </div>
          </dl>
        </article>
      `,
    )
    .join("");
}

async function loadServices() {
  try {
    services = await request("/api/services");
  } catch (_error) {
    services = [...fallbackServices];
  }

  const activeTab = document.querySelector(".tab.active")?.dataset.category || "todos";
  renderServices(activeTab);
}

async function loadIntegrations() {
  if (!integrationGrid) {
    return;
  }

  try {
    const integrations = await request("/api/integrations");
    renderIntegrations(integrations);
  } catch (_error) {
    renderIntegrations([
      {
        agency: "Backend indisponivel",
        data_scope: "Execute npm run dev para carregar o mapa de integracoes.",
        access_model: "Sem conexao local no momento.",
        public_api_available: false,
        status: "Offline",
      },
    ]);
  }
}

async function loadRecords() {
  if (!api.token) {
    renderGuestRecords();
    return;
  }

  try {
    const records = await request("/api/records");
    currentRecords = records;
    renderRecords(records);
  } catch (error) {
    if (error.status === 401) {
      renderGuestRecords("Sua sessao expirou. Faca login novamente para carregar os documentos.");
      return;
    }

    recordsGrid.innerHTML = `
      <article>
        <span class="record-icon">CPF</span>
        <h3>Erro ao carregar</h3>
        <p>${error.message}</p>
      </article>
    `;
  }
}

function connectRealtime() {
  if (!api.token || api.events) {
    return;
  }

  api.events = new EventSource(`/api/events?token=${encodeURIComponent(api.token)}`);
  api.events.addEventListener("snapshot", (event) => {
    const data = JSON.parse(event.data);
    const time = new Date(data.serverTime).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    liveStrip.textContent = `Tempo real ativo: ${data.services} servicos, ${data.records} registros pessoais, ultima verificacao ${time}.`;
  });

  api.events.onerror = () => {
    liveStrip.textContent = "Tempo real indisponivel. Entre novamente se a sessao tiver expirado.";
  };
}

async function validateSession() {
  if (!api.token) {
    clearSession();
    return false;
  }

  try {
    const user = await request("/api/me");
    api.user = {
      id: user.id,
      cpf: user.cpf,
      fullName: user.full_name,
      email: user.email,
      govbrLevel: user.govbr_level,
    };
    renderAccount();
    return true;
  } catch (error) {
    if (error.status !== 401) {
      liveStrip.textContent = "Nao foi possivel validar a sessao agora.";
    }
    return false;
  }
}

async function login(event) {
  event.preventDefault();
  loginMessage.textContent = authMode === "register" ? "Criando cadastro..." : "Validando CPF no backend...";

  if (!isValidCpf(cpfInput.value)) {
    loginMessage.textContent = "CPF invalido. Confira os 11 digitos.";
    return;
  }

  try {
    const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    const body =
      authMode === "register"
        ? {
            cpf: cpfInput.value,
            fullName: fullNameInput.value,
            email: emailInput.value,
            password: passwordInput?.value || loginForm.password?.value,
          }
        : {
            cpf: cpfInput.value,
            password: passwordInput?.value || loginForm.password?.value,
          };

    const data = await request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });

    api.token = data.token;
    api.user = data.user;
    const successMessage =
      authMode === "register" ? "CPF cadastrado e painel carregado." : "Login realizado com sucesso.";
    setAuthMode("login");
    loginMessage.textContent = successMessage;
    renderAccount();
    await loadRecords();
    connectRealtime();
    showAppScreen();
  } catch (error) {
    loginMessage.textContent = error.message;
  }
}

function clearSession(message = "") {
  api.token = null;
  api.user = null;
  localStorage.removeItem("conectagov_token");
  localStorage.removeItem("conectagov_user");

  if (api.events) {
    api.events.close();
    api.events = null;
  }

  liveStrip.textContent = "Backend aguardando login para sincronizacao em tempo real.";
  renderAccount();
  renderGuestRecords(message || "Entre com CPF para carregar seus documentos e registros.");
  showLoginScreen(message);
}

function logout() {
  clearSession("");
}

async function searchCnpj(cnpj) {
  const digits = onlyNumbers(cnpj);

  if (digits.length !== 14) {

    cnpjResult.textContent = "Informe um CNPJ com 14 digitos.";
    return;
  }

  cnpjResult.textContent = "Consultando backend, base publica e cache MySQL...";

  try {
    const company = await request(`/api/cnpj/${digits}`);
    renderCompany(company);
  } catch (error) {
    cnpjResult.textContent = error.message;
  }
}

async function searchCep(cep) {
  const digits = onlyNumbers(cep);

  if (digits.length !== 8) {
    cepResult.textContent = "Informe um CEP com 8 digitos.";
    return;
  }

  cepResult.textContent = "Consultando backend, ViaCEP e cache MySQL...";

  try {
    const address = await request(`/api/cep/${digits}`);
    renderCep(address);
  } catch (error) {
    cepResult.textContent = error.message;
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    renderServices(tab.dataset.category);
  });
});

serviceGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open-service]");

  if (!button) {
    return;
  }

  const service = services.find((item) => String(item.id ?? item.title) === button.dataset.openService);

  if (service) {
    renderServiceWorkspace(service);
  }
});

serviceWorkspace.addEventListener("click", (event) => {
  const button = event.target.closest("[data-scroll-target]");

  if (!button) {
    return;
  }

  document.querySelector(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
});

cpfInput.addEventListener("input", (event) => {
  event.target.value = formatCpf(event.target.value);
});

cnpjInput.addEventListener("input", (event) => {
  event.target.value = formatCnpj(event.target.value);
});

cepInput?.addEventListener("input", (event) => {
  event.target.value = formatCep(event.target.value);
});

openLogin.addEventListener("click", () => {
  if (api.user) {
    logout();
    return;
  }

  showLoginScreen();
});

loginModeButton.addEventListener("click", () => setAuthMode("login"));
registerModeButton.addEventListener("click", () => setAuthMode("register"));

loginForm.addEventListener("submit", login);

cnpjForm.addEventListener("submit", (event) => {
  event.preventDefault();
  searchCnpj(cnpjInput.value);
});

cepForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchCep(cepInput.value);
});

async function initApp() {
  showLoginScreen();
  renderAccount();
  setAuthMode("login");
  renderGuestRecords();
  await Promise.all([loadServices(), loadIntegrations()]);
}

initApp();
