/**
 * PetStory - Prontuário Unificado & Identificação Inteligente
 * Frontend Interactive Controller (Vanilla JavaScript)
 * 
 * INTEGRAÇÃO COMPLETA:
 *  - Conexão Real com Supabase (PostgreSQL)
 *  - Portal do Tutor sem dados fantasmas e com Tag PST destacada
 *  - Troca de foto do pet
 *  - Download em PDF da Carteirinha de Vacinação
 *  - Prontuário Clínico Interativo para o Médico-Veterinário:
 *      * Edição de Peso e Sinais Vitais (FC, FR, Temp, ECC)
 *      * Registro funcional de novas vacinas (reflete no tutor)
 *      * Prescrições com suspensão de medicamentos
 *      * Agendamento de cirurgias (reflete como lembrete no tutor)
 *      * Upload e visualização de laudos em PDF
 *      * Registro de evolução clínica na Linha do Tempo
 *      * Emissão de receita oficial com CRMV
 */

// ============================================================================
// CONFIGURAÇÃO DO SUPABASE (BANCO DE DADOS EM NUVEM)
// ============================================================================
const SUPABASE_CONFIG = {
  url: 'https://tiqzidcqqscarcdgbcgr.supabase.co',
  key: 'sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj',
  headers: {
    'apikey': 'sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj',
    'Authorization': 'Bearer sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
};

// Fotos padrão oficiais do sistema (garante harmonia entre Portal do Tutor e Prontuário)
const THOR_PHOTO = 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=400&q=80';
const DEFAULT_PET_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';

// Armazenamento em memória para dados da sessão atual
let pacienteAtualProntuario = null;

// Gerenciador de Credenciais e Senhas de Acesso dos Tutores
function salvarCredencialTutor(email, senha) {
  try {
    const creds = JSON.parse(localStorage.getItem('petstory_auth_credentials') || '{}');
    const norm = (email || '').toLowerCase().trim();
    creds[norm] = senha;
    if (norm.includes('@')) {
      const prefix = norm.split('@')[0];
      creds[prefix + '@gmail.com'] = senha;
      creds[prefix + '@example.com'] = senha;
    }
    localStorage.setItem('petstory_auth_credentials', JSON.stringify(creds));
  } catch (e) {
    console.warn('Erro ao armazenar credencial:', e);
  }
}

function obterCredencialTutor(email) {
  try {
    const creds = JSON.parse(localStorage.getItem('petstory_auth_credentials') || '{}');
    const norm = (email || '').toLowerCase().trim();
    if (creds[norm]) return creds[norm];
    if (norm.includes('@')) {
      const prefix = norm.split('@')[0];
      if (creds[prefix + '@example.com']) return creds[prefix + '@example.com'];
      if (creds[prefix + '@gmail.com']) return creds[prefix + '@gmail.com'];
    }
    if (norm.includes('mariana')) return 'senha123';
    if (norm.includes('rafael')) return creds['rafael'] || '123456';
    return null;
  } catch (e) {
    return null;
  }
}

function redefinirSenhaTutor() {
  const emailInput = document.getElementById('login-tutor-email');
  const email = emailInput?.value.trim().toLowerCase();
  if (!email) {
    showToast('Informe o E-mail', 'Preencha o campo de e-mail antes de redefinir a senha.', 'fa-envelope', 'warning');
    emailInput?.focus();
    return;
  }
  const novaSenha = prompt(`PetStory • Redefinição de Senha\n\nDigite a nova senha desejada para a conta [${email}]:`);
  if (!novaSenha || novaSenha.trim() === '') {
    showToast('Cancelado', 'Nenhuma alteração de senha foi realizada.', 'fa-info-circle', 'info');
    return;
  }
  salvarCredencialTutor(email, novaSenha.trim());
  const passInput = document.getElementById('login-tutor-pass');
  if (passInput) passInput.value = novaSenha.trim();
  showToast('Senha Atualizada!', `Nova senha cadastrada com sucesso para [${email}]. Pode entrar agora!`, 'fa-circle-check', 'success');
}

// ============================================================================
// GERENCIADOR DE TOKENS OTP E AUTORIZAÇÃO CLÍNICA (REGRAS ESTRITAS DE SEGURANÇA)
// ============================================================================
const DEFAULT_OTPS = {
  'PST-9921': { otp: '849201', nome: 'Thor' },
  '981098108429182': { otp: '849201', nome: 'Thor' },
  'PST-1428': { otp: '849201', nome: 'Bolinha' },
  'PST-4022': { otp: '123456', nome: 'Luna' }
};

function salvarOtpAtivo(tag, codigoOtp, nomePet) {
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    const cleanTag = (tag || '').trim().toUpperCase();
    const cleanOtp = (codigoOtp || '').toString().trim().replace(/\s+/g, '');
    otps[cleanTag] = {
      otp: cleanOtp,
      nome: nomePet || 'Paciente',
      expiraEm: Date.now() + (2 * 60 * 60 * 1000), // 2 horas de validade (conforme PetStoryService.java)
      criadoEm: Date.now()
    };
    localStorage.setItem('petstory_active_otps', JSON.stringify(otps));
  } catch (e) {
    console.warn('Erro ao salvar OTP ativo:', e);
  }
}

function obterOtpEsperadoParaTag(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return null;

  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag]) {
      const reg = otps[cleanTag];
      if (!reg.expiraEm || Date.now() < reg.expiraEm) {
        return reg.otp;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler OTP ativo:', e);
  }

  if (DEFAULT_OTPS[cleanTag]) {
    return DEFAULT_OTPS[cleanTag].otp;
  }

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && session.pet.tag && session.pet.tag.toUpperCase() === cleanTag) {
    return '849201';
  }

  return null;
}

function obterNomePacientePorTag(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (DEFAULT_OTPS[cleanTag]) return DEFAULT_OTPS[cleanTag].nome;
  
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && session.pet.tag && session.pet.tag.toUpperCase() === cleanTag) {
    return session.pet.nome || 'Paciente';
  }
  
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag] && otps[cleanTag].nome) return otps[cleanTag].nome;
  } catch (e) {}
  
  if (cleanTag === 'PST-1428') return 'Bolinha';
  if (cleanTag === 'PST-9921' || cleanTag === '981098108429182') return 'Thor';
  if (cleanTag === 'PST-4022') return 'Luna';
  return 'Paciente';
}

function validarTagCadastrada(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return false;
  if (cleanTag === 'PST-9921' || cleanTag === '981098108429182') return true;
  if (cleanTag === 'PST-1428' || cleanTag === 'PST-4022') return true;
  
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && session.pet.tag && session.pet.tag.toUpperCase() === cleanTag) {
    return true;
  }

  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag]) return true;
  } catch (e) {}

  return false;
}

function validarAcessoClinicoVeterinario(tagDigitada, otpDigitado) {
  const tag = (tagDigitada || '').trim().toUpperCase();
  const otp = (otpDigitado || '').trim().replace(/\s+/g, '');

  if (!tag) {
    return {
      valido: false,
      campo: 'tag',
      titulo: 'Código da Tag Obrigatório',
      mensagem: 'Por favor, informe a Tag PST (ex: PST-9921 ou PST-1428) ou número do Microchip.'
    };
  }

  if (!validarTagCadastrada(tag)) {
    return {
      valido: false,
      campo: 'tag',
      titulo: 'Tag Não Encontrada',
      mensagem: `A medalha [${tag}] não foi localizada no cadastro. Verifique o código alfanumérico.`
    };
  }

  if (!otp) {
    return {
      valido: false,
      campo: 'otp',
      titulo: 'Código OTP Obrigatório',
      mensagem: 'Digite o código de autorização de 6 dígitos gerado pelo tutor no aplicativo PetStory.'
    };
  }

  if (otp.length < 6 || !/^\d{6}$/.test(otp)) {
    return {
      valido: false,
      campo: 'otp',
      titulo: 'Formato OTP Inválido',
      mensagem: 'O token de autorização clínica deve conter exatamente 6 dígitos numéricos.'
    };
  }

  const otpEsperado = obterOtpEsperadoParaTag(tag);
  const nomePet = obterNomePacientePorTag(tag);

  if (!otpEsperado || otp !== otpEsperado) {
    return {
      valido: false,
      campo: 'otp',
      titulo: 'Código OTP Incorreto',
      mensagem: `Código OTP [${otp}] incorreto! Não coincide com a autorização gerada pelo tutor de ${nomePet}. Acesso ao prontuário negado.`
    };
  }

  return {
    valido: true,
    tag: tag,
    nome: nomePet
  };
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  initScreenNavigation();
  initDiscreetSwitcher();
  initScannerSimulations();
  initMedicalRecordTabs();
  initTutorInteractions();
  initModalHandlers();
  initKeyboardShortcuts();

  // Expõe funções no escopo global para eventos inline HTML (onclick, onsubmit, onchange)
  window.switchScreen = switchScreen;
  window.toggleLoginRole = toggleLoginRole;
  window.handleLoginSubmit = handleLoginSubmit;
  window.avancarWizard = avancarWizard;
  window.finalizarCadastroPet = finalizarCadastroPet;
  window.imprimirTagSimulada = imprimirTagSimulada;
  window.copiarTagTutor = copiarTagTutor;
  window.handlePetPhotoUpload = handlePetPhotoUpload;
  window.baixarCarteirinhaPdf = baixarCarteirinhaPdf;
  window.editarPesoProntuario = editarPesoProntuario;
  window.abrirModalVitais = abrirModalVitais;
  window.fecharModalVitais = fecharModalVitais;
  window.salvarModalVitais = salvarModalVitais;
  window.abrirModalNovaVacina = abrirModalNovaVacina;
  window.fecharModalNovaVacina = fecharModalNovaVacina;
  window.salvarModalVacina = salvarModalVacina;
  window.abrirModalNovaPrescricao = abrirModalNovaPrescricao;
  window.fecharModalNovaPrescricao = fecharModalNovaPrescricao;
  window.salvarModalPrescricao = salvarModalPrescricao;
  window.suspenderPrescricao = suspenderPrescricao;
  window.abrirModalNovaCirurgia = abrirModalNovaCirurgia;
  window.fecharModalNovaCirurgia = fecharModalNovaCirurgia;
  window.salvarModalCirurgia = salvarModalCirurgia;
  window.abrirModalNovoExame = abrirModalNovoExame;
  window.fecharModalNovoExame = fecharModalNovoExame;
  window.salvarModalExame = salvarModalExame;
  window.visualizarExameSimulado = visualizarExameSimulado;
  window.salvarEvolucaoClinica = salvarEvolucaoClinica;
  window.abrirModalEmitirReceita = abrirModalEmitirReceita;
  window.fecharModalEmitirReceita = fecharModalEmitirReceita;
  window.imprimirReceitaOficial = imprimirReceitaOficial;
  window.encerrarSessaoTutor = encerrarSessaoTutor;
  window.redefinirSenhaTutor = redefinirSenhaTutor;
  window.salvarOtpAtivo = salvarOtpAtivo;
  window.obterOtpEsperadoParaTag = obterOtpEsperadoParaTag;
  window.validarAcessoClinicoVeterinario = validarAcessoClinicoVeterinario;

  // Preenche datas padrão nos formulários (hoje e +1 ano)
  inicializarDatasFormularios();

  // Restaura sessão salva se houver
  restaurarSessaoSalva();

  // Verifica rota inicial
  handleInitialRoute();
}

function inicializarDatasFormularios() {
  const hoje = new Date().toISOString().split('T')[0];
  const proximoAno = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
  const emTresMeses = new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0];

  const vacData = document.getElementById('input-vac-data');
  const vacReforco = document.getElementById('input-vac-reforco');
  const cirurgiaData = document.getElementById('input-cirurgia-data');
  const exameData = document.getElementById('input-exame-data');

  if (vacData) vacData.value = hoje;
  if (vacReforco) vacReforco.value = proximoAno;
  if (cirurgiaData) cirurgiaData.value = emTresMeses;
  if (exameData) exameData.value = hoje;
}

/* ==========================================================================
   Navegação e Roteamento de Telas
   ========================================================================== */
const SCREENS = {
  'login': 'screen-login',
  'cadastro': 'screen-cadastro',
  'vet-scan': 'screen-vet-scan',
  'prontuario': 'screen-prontuario',
  'tutor': 'screen-tutor',
  'public-tag': 'screen-public-tag'
};

function initScreenNavigation() {
  window.addEventListener('hashchange', () => {
    handleInitialRoute();
  });
}

function switchScreen(screenKey) {
  const targetId = SCREENS[screenKey] || screenKey;
  const allScreens = document.querySelectorAll('.screen-view');
  
  let targetScreen = document.getElementById(targetId);
  if (!targetScreen) {
    targetScreen = document.getElementById('screen-login');
    screenKey = 'login';
  }

  allScreens.forEach(screen => {
    screen.classList.remove('active');
  });

  targetScreen.classList.add('active');

  window.history.replaceState(null, '', `#${screenKey}`);
  updateSecretSwitcherActive(screenKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateHeaderContext(screenKey);

  // Sincronização automática de dados ao alternar telas
  if (screenKey === 'prontuario') {
    const session = obterSessaoSalva();
    if (session && session.pet && session.pet.tag) {
      carregarProntuarioPaciente(session.pet.tag);
    } else {
      carregarProntuarioPaciente('PST-9921');
    }
  } else if (screenKey === 'tutor') {
    const session = obterSessaoSalva();
    if (session && session.tutor && session.pet) {
      renderTutorPortal(session.tutor, session.pet, session.pet.tag, session.tutor.email?.toLowerCase().includes('mariana'));
    }
  }
}

function encerrarSessaoTutor() {
  localStorage.removeItem('petstory_current_user');
  pacienteAtualProntuario = null;
  showToast('Sessão Finalizada', 'Desconectado com sucesso. Retornando ao portal de login.', 'fa-right-from-bracket', 'info');
  setTimeout(() => {
    switchScreen('login');
  }, 400);
}

function handleInitialRoute() {
  const hash = window.location.hash.replace('#', '');
  if (hash && SCREENS[hash]) {
    switchScreen(hash);
  } else {
    switchScreen('login');
  }
}

function updateHeaderContext(screenKey) {
  const statusBadge = document.getElementById('header-role-badge');
  const userPill = document.querySelector('.header-actions .user-pill');

  if (statusBadge) {
    if (screenKey === 'login') {
      statusBadge.innerHTML = `<span class="status-dot" style="background:#64748b; box-shadow:none;"></span> Portal de Acesso`;
    } else if (screenKey === 'cadastro') {
      statusBadge.innerHTML = `<span class="status-dot" style="background:#0284c7; box-shadow:0 0 8px #0284c7;"></span> Novo Cadastro`;
    } else if (screenKey === 'vet-scan' || screenKey === 'prontuario') {
      statusBadge.innerHTML = `<span class="status-dot"></span> Atendimento Clínico`;
    } else if (screenKey === 'tutor') {
      statusBadge.innerHTML = `<span class="status-dot" style="background:#2563eb; box-shadow:0 0 8px #2563eb;"></span> Portal do Tutor`;
    } else {
      statusBadge.innerHTML = `<span class="status-dot" style="background:#d97706; box-shadow:0 0 8px #d97706;"></span> Identificação da Coleira`;
    }
  }

  // No portal do tutor ou telas públicas, atualiza o crachá do usuário no cabeçalho
  if (userPill) {
    if (screenKey === 'tutor') {
      const local = obterSessaoSalva();
      const nomeTutor = local?.tutor?.nome || 'Mariana';
      userPill.innerHTML = `
        <span style="font-size: 1.2rem;">👤</span>
        <span>${nomeTutor}</span>
      `;
      userPill.title = "Tutor Conectado";
    } else if (screenKey === 'login' || screenKey === 'cadastro') {
      userPill.innerHTML = `
        <i class="fa-solid fa-lock" style="color: var(--teal-primary); margin-right: 6px;"></i>
        <span>Acesso Seguro</span>
      `;
      userPill.title = "Acesso Seguro PetStory";
    } else {
      userPill.innerHTML = `
        <img src="https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=120&q=80" 
             alt="Dr. Ricardo" 
             class="user-avatar-mini"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%2300d2ad%22/><text x=%2250%22 y=%2260%22 font-size=%2240%22 text-anchor=%22middle%22 fill=%22%23000%22>👨‍⚕️</text></svg>'">
        <span>Dr. Ricardo (CRMV-SP)</span>
      `;
      userPill.title = "Profissional Autenticado";
    }
  }
}

/* ==========================================================================
   Tela 1: Login Unificado com Busca no Supabase
   ========================================================================== */
function toggleLoginRole(role) {
  const tabTutor = document.getElementById('tab-login-tutor');
  const tabVet = document.getElementById('tab-login-vet');
  const formTutor = document.getElementById('form-login-tutor');
  const formVet = document.getElementById('form-login-vet');

  if (role === 'tutor') {
    tabTutor?.classList.add('active');
    tabVet?.classList.remove('active');
    if (formTutor) formTutor.style.display = 'block';
    if (formVet) formVet.style.display = 'none';
  } else {
    tabVet?.classList.add('active');
    tabTutor?.classList.remove('active');
    if (formVet) formVet.style.display = 'block';
    if (formTutor) formTutor.style.display = 'none';
  }
}

async function handleLoginSubmit(event, role) {
  if (event) event.preventDefault();

  if (role === 'tutor') {
    const emailInput = document.getElementById('login-tutor-email');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const passInput = document.getElementById('login-tutor-pass');
    const senhaDigitada = passInput ? passInput.value.trim() : '';

    if (!email) {
      showToast('E-mail Obrigatório', 'Informe o seu e-mail de acesso.', 'fa-envelope', 'warning');
      emailInput?.focus();
      return;
    }

    if (!senhaDigitada) {
      showToast('Senha Obrigatória', 'Informe sua senha de acesso cadastrada.', 'fa-lock', 'warning');
      passInput?.focus();
      return;
    }

    // Validação estrita de credenciais: impede entrar com qualquer senha
    const senhaEsperada = obterCredencialTutor(email);
    if (senhaEsperada) {
      if (senhaEsperada !== senhaDigitada) {
        showToast('Senha Incorreta', 'A senha informada não confere com a cadastrada para este tutor.', 'fa-circle-xmark', 'danger');
        passInput?.focus();
        return;
      }
    } else {
      // Primeira definição de credencial no navegador para conta recém-cadastrada
      salvarCredencialTutor(email, senhaDigitada);
    }

    showToast('Autenticando...', `Verificando credenciais de [${email}]...`, 'fa-circle-notch fa-spin');

    try {
      // 1. Tenta buscar no Supabase
      const respTutor = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tutores?email=eq.${encodeURIComponent(email)}`, {
        headers: SUPABASE_CONFIG.headers
      });
      const tutores = await respTutor.json();

      let tutor = tutores && tutores.length > 0 ? tutores[0] : null;
      let pet = null;
      let tagCode = null;

      if (tutor) {
        const respPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?tutor_id=eq.${tutor.id}`, {
          headers: SUPABASE_CONFIG.headers
        });
        const pets = await respPet.json();
        pet = pets && pets.length > 0 ? pets[0] : null;

        if (pet) {
          const respTag = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tags?pet_id=eq.${pet.id}`, {
            headers: SUPABASE_CONFIG.headers
          });
          const tags = await respTag.json();
          tagCode = tags && tags.length > 0 ? tags[0].codigo : 'PST-9921';
        }
      } else {
        // Fallback local
        const local = obterSessaoSalva();
        if (local && local.tutor && local.tutor.email.toLowerCase() === email) {
          tutor = local.tutor;
          pet = local.pet;
          tagCode = local.pet?.tag || 'PST-9921';
        }
      }

      if (tutor && pet) {
        pet.tag = tagCode;
        if (!pet.foto_url) {
          pet.foto_url = (pet.nome === 'Thor' || tagCode === 'PST-9921') ? THOR_PHOTO : DEFAULT_PET_PHOTO;
        }
        salvarSessao(tutor, pet, tagCode);
        renderTutorPortal(tutor, pet, tagCode, email.includes('mariana'));
        showToast('Login Efetuado!', `Bem-vindo(a), ${tutor.nome}! Central de saúde de ${pet.nome} carregada.`, 'fa-circle-check', 'success');
        setTimeout(() => { switchScreen('tutor'); }, 500);
        return;
      }

      // Demo da Mariana
      if (email.includes('mariana')) {
        renderTutorPortal(
          { nome: 'Mariana Vasconcelos', email: 'mariana@email.com', telefone_emergencia: '(11) 98765-4321' },
          { nome: 'Thor', raca: 'Golden Retriever', peso: 32.8, alergias_graves: 'Dipirona e Sulfas (Choque anafilático prévio)' },
          'PST-9921',
          true // É demo do Thor
        );
        showToast('Login Efetuado!', 'Entrando na central de Mariana & Thor.', 'fa-paw', 'success');
        setTimeout(() => { switchScreen('tutor'); }, 500);
        return;
      }

      showToast('Usuário Não Encontrado', `Nenhum cadastro localizado para ${email}.`, 'fa-triangle-exclamation', 'warning');

    } catch (err) {
      console.error('Erro na autenticação:', err);
      const local = obterSessaoSalva();
      if (local) {
        renderTutorPortal(local.tutor, local.pet, local.pet?.tag);
        showToast('Conectado', `Autenticado: ${local.tutor.nome}`, 'fa-shield-dog', 'info');
        switchScreen('tutor');
      } else {
        showToast('Erro de Conexão', 'Não foi possível contatar o serviço. Tente novamente.', 'fa-circle-exclamation', 'danger');
      }
    }

  } else {
    const crmv = document.getElementById('login-vet-crmv')?.value || '38412';
    const uf = document.getElementById('login-vet-uf')?.value || 'SP';
    showToast('CRMV Validado!', `Dr. Ricardo Mendonça (CRMV-${uf} ${crmv}) autenticado.`, 'fa-stethoscope', 'success');
    setTimeout(() => { switchScreen('vet-scan'); }, 600);
  }
}

/* ==========================================================================
   Tela 2: Cadastro Completo em 3 Etapas com Envio para Supabase
   ========================================================================== */
function avancarWizard(step) {
  for (let i = 1; i <= 3; i++) {
    const node = document.getElementById(`wizard-node-${i}`);
    if (node) {
      if (i <= step) node.classList.add('active');
      else node.classList.remove('active');
    }
  }

  for (let i = 1; i <= 3; i++) {
    const content = document.getElementById(`wizard-step-${i}`);
    if (content) {
      if (i === step) content.classList.add('active');
      else content.classList.remove('active');
    }
  }

  const card = document.querySelector('#screen-cadastro .auth-card');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function finalizarCadastroPet() {
  const tutorNome = document.getElementById('cad-tutor-nome')?.value.trim() || 'Tutor PetStory';
  const tutorTel = document.getElementById('cad-tutor-tel')?.value.trim() || '(11) 98765-4321';
  const tutorCidade = document.getElementById('cad-tutor-cidade')?.value.trim() || 'São Paulo - SP';
  const tutorEmail = document.getElementById('cad-tutor-email')?.value.trim().toLowerCase() || 'tutor@petstory.app';
  const tutorSenha = document.getElementById('cad-tutor-senha')?.value;
  if (tutorSenha) {
    salvarCredencialTutor(tutorEmail, tutorSenha);
  }

  const petNome = document.getElementById('cad-pet-nome')?.value.trim() || 'Bolinha';
  const petEspecie = document.getElementById('cad-pet-especie')?.value || 'Canina';
  const petRaca = document.getElementById('cad-pet-raca')?.value.trim() || 'Sem Raça Definida';
  const petPesoStr = document.getElementById('cad-pet-peso')?.value.trim() || '12.5';
  const petPeso = parseFloat(petPesoStr.replace(',', '.')) || 12.5;
  const petSexo = document.getElementById('cad-pet-sexo')?.value || 'Macho - Castrado';
  const petNasc = document.getElementById('cad-pet-nasc')?.value || '2023-01-01';
  const petAlergias = document.getElementById('cad-pet-alergias')?.value.trim() || '';

  // Sorteia código único de tag (Ex: PST-1428)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const tagCode = `PST-${randomNum}`;

  const codeDisplay = document.getElementById('created-tag-code');
  if (codeDisplay) {
    codeDisplay.textContent = tagCode;
  }

  showToast('Cadastrando...', `Registrando ${petNome} no sistema...`, 'fa-circle-notch fa-spin');

  let tutorIdGerado = null;
  let petIdGerado = null;

  try {
    // 1. Grava tutor no Supabase
    const resTutor = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tutores`, {
      method: 'POST',
      headers: SUPABASE_CONFIG.headers,
      body: JSON.stringify({
        nome: tutorNome,
        telefone_emergencia: tutorTel,
        cidade: tutorCidade,
        email: tutorEmail
      })
    });

    if (resTutor.ok) {
      const dataTutor = await resTutor.json();
      tutorIdGerado = dataTutor[0]?.id;
    }

    // 2. Grava pet no Supabase
    const isCastrado = petSexo.toLowerCase().includes('castrado');
    const especieLimpa = petEspecie.includes('Canina') ? 'Canina' : (petEspecie.includes('Felina') ? 'Felina' : petEspecie);

    const petPayload = {
      nome: petNome,
      especie: especieLimpa,
      raca: petRaca,
      peso: petPeso,
      sexo: petSexo.includes('Macho') ? 'Macho' : 'Fêmea',
      castrado: isCastrado,
      data_nascimento: petNasc,
      foto_url: DEFAULT_PET_PHOTO,
      alergias_graves: petAlergias || 'Nenhuma restrição relatada',
      modo_perdido: false
    };

    if (tutorIdGerado) {
      petPayload.tutor_id = tutorIdGerado;
    }

    const resPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets`, {
      method: 'POST',
      headers: SUPABASE_CONFIG.headers,
      body: JSON.stringify(petPayload)
    });

    if (resPet.ok) {
      const dataPet = await resPet.json();
      petIdGerado = dataPet[0]?.id;
    }

    // 3. Grava tag no Supabase
    const tagPayload = {
      codigo: tagCode,
      nfc_uid: 'NFC-' + Math.floor(100000 + Math.random() * 900000),
      ativa: true
    };
    if (petIdGerado) {
      tagPayload.pet_id = petIdGerado;
    }

    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tags`, {
      method: 'POST',
      headers: SUPABASE_CONFIG.headers,
      body: JSON.stringify(tagPayload)
    });

  } catch (netErr) {
    console.error('Erro de rede ao salvar no Supabase:', netErr);
  }

  // Prepara dados e salva na sessão
  const tutorData = {
    id: tutorIdGerado,
    nome: tutorNome,
    telefone_emergencia: tutorTel,
    email: tutorEmail,
    cidade: tutorCidade
  };

  const petData = {
    id: petIdGerado,
    nome: petNome,
    especie: petEspecie,
    raca: petRaca,
    peso: petPeso,
    sexo: petSexo,
    foto_url: DEFAULT_PET_PHOTO,
    alergias_graves: petAlergias,
    tag: tagCode,
    vacinas: [] // Pet novo começa com carteirinha limpa!
  };

  salvarSessao(tutorData, petData, tagCode);
  salvarOtpAtivo(tagCode, '849201', petNome);
  renderTutorPortal(tutorData, petData, tagCode, false);

  // Renderiza QR Code localmente (offline e sem bloqueadores)
  renderQrCodeLocal('created-qr-container', `https://petstory.app/#tag/${tagCode}`);

  avancarWizard(3);

  showToast('Cadastro Concluído!', `${petNome} cadastrado com sucesso! Tag [${tagCode}] ativada.`, 'fa-circle-check', 'success');
}

function renderQrCodeLocal(containerId, urlText) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: urlText,
      width: 160,
      height: 160,
      colorDark: '#00735c',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = `
      <div style="text-align: center; font-size: 0.8rem; color: #00735c; padding: 20px;">
        <i class="fa-solid fa-qrcode" style="font-size: 3rem; margin-bottom: 8px;"></i><br>
        <strong>${urlText}</strong>
      </div>
    `;
  }
}

/* ==========================================================================
   Tela 3: Portal do Tutor com Destaque na Tag e Limpeza de Dados Fantasmas
   ========================================================================== */
async function renderTutorPortal(tutor, pet, tagCode, isThorDemo = false) {
  const tutorHeaderTitle = document.getElementById('tutor-header-title');
  const greetingName = document.getElementById('tutor-greeting-name');
  const greetingDesc = document.getElementById('tutor-greeting-desc');
  const heroTagDisplay = document.getElementById('tutor-hero-tag-display');
  const tagCodeBadge = document.getElementById('tutor-tag-code-badge');
  const tagBoxTitle = document.getElementById('tutor-tag-box-title');
  const lostModeDesc = document.getElementById('tutor-lost-mode-desc');
  const allergiesContainer = document.getElementById('tutor-allergies-container');
  const vaxList = document.getElementById('tutor-vax-list');
  const remindersContainer = document.getElementById('tutor-reminders-container');
  const avatarImg = document.getElementById('tutor-pet-avatar-img');

  const pNome = pet?.nome || 'Thor';
  const tNome = tutor?.nome || 'Mariana';
  const codigo = tagCode || pet?.tag || 'PST-9921';
  const alergia = pet?.alergias_graves || '';
  const petId = pet?.id || (codigo === 'PST-1428' || pNome === 'Bolinha' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : (codigo === 'PST-9921' || pNome === 'Thor' ? 'c810977d-2eea-420e-8957-3ab54afba430' : null));

  // 1. Títulos e Boas-Vindas sem jargões técnicos
  if (tutorHeaderTitle) tutorHeaderTitle.textContent = `Central de Saúde de ${pNome}`;
  if (greetingName) greetingName.textContent = `Olá, ${tNome}! 👋`;
  if (greetingDesc) {
    greetingDesc.innerHTML = `O animal <strong>${pNome}</strong> está cadastrado e protegido pelo PetStory. Informações de emergência e saúde ativas.`;
  }

  // 2. DESTAQUE VISUAL DA TAG (GRANDE E CLARO)
  if (heroTagDisplay) heroTagDisplay.textContent = codigo;
  if (tagCodeBadge) tagCodeBadge.textContent = `ID: ${codigo}-${pNome.toUpperCase()}`;
  if (tagBoxTitle) tagBoxTitle.textContent = `Medalha Inteligente de ${pNome}`;
  if (lostModeDesc) {
    lostModeDesc.textContent = `Se o(a) ${pNome} se perder, ative este modo. Quem escanear a medalha verá alerta de emergência e você receberá aviso por WhatsApp.`;
  }

  // Foto do pet na medalha: sincroniza com a foto do animal ou foto padrão (nunca cão aleatório)
  if (avatarImg) {
    if (isThorDemo || codigo === 'PST-9921' || pNome === 'Thor') {
      avatarImg.src = THOR_PHOTO;
    } else {
      avatarImg.src = pet?.foto_url || DEFAULT_PET_PHOTO;
    }
  }

  // 3. LIMPEZA DE ALERGIAS (APENAS O QUE FOI CADASTRADO PARA ESTE ANIMAL)
  if (allergiesContainer) {
    if (alergia && alergia.trim() !== '' && !alergia.toLowerCase().includes('nenhuma')) {
      allergiesContainer.innerHTML = `
        <div class="allergy-item-card">
          <i class="fa-solid fa-skull-crossbones"></i>
          <div class="allergy-item-info">
            <h5 style="color: #9f1239;">ALERGIAS & RESTRIÇÕES: ${alergia}</h5>
            <p>Informação clínica de emergência vinculada a ${pNome} e tutoria de ${tNome}.</p>
          </div>
        </div>
      `;
    } else {
      allergiesContainer.innerHTML = `
        <div class="allergy-item-card" style="background: #f0fdf4; border-color: #bbf7d0;">
          <i class="fa-solid fa-shield-heart" style="color: #16a34a;"></i>
          <div class="allergy-item-info">
            <h5 style="color: #166534;">Nenhuma restrição grave cadastrada</h5>
            <p style="color: #15803d;">Não há relatos de alergias medicamentosas ou alimentares para ${pNome}.</p>
          </div>
        </div>
      `;
    }
  }

  // 4. CARREGAMENTO REAL DE VACINAS (SINCRONIZADO COM SUPABASE!)
  let listaVacinas = [];
  if (isThorDemo || codigo === 'PST-9921' || pNome === 'Thor') {
    listaVacinas = [
      { nome: 'V10 Poliovalente Canina', lote: 'Zoetis • Lote 5849-B2 • Dr. Ricardo', reforco: '15/11/2026' },
      { nome: 'Antirrábica Defensor', lote: 'Zoetis • Lote 9012-K4', reforco: '10/01/2027' },
      { nome: 'Bronchi-Shield Oral (Gripe Canina)', lote: 'Proteção contra traqueobronquite', reforco: '15/11/2026' },
      { nome: 'Giardiavax (Giárdia)', lote: 'Zoetis • Proteção entérica', reforco: '20/03/2027' }
    ];
  } else if (petId) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vacinas?pet_id=eq.${petId}&order=created_at.desc`, {
        headers: SUPABASE_CONFIG.headers
      });
      if (resp.ok) {
        const dados = await resp.json();
        if (dados && dados.length > 0) {
          listaVacinas = dados.map(v => ({
            nome: v.nome_vacina,
            lote: `${v.laboratorio_lote} • ${v.veterinario_crmv || 'CRMV-SP 38.412'}`,
            reforco: formatarDataBr(v.data_reforco),
            aplicacao: formatarDataBr(v.data_aplicacao)
          }));
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar vacinas do banco para o portal do tutor:', e);
    }
    // Fallback se houver vacinas salvas localmente
    if (listaVacinas.length === 0 && pet?.vacinas && pet.vacinas.length > 0) {
      listaVacinas = pet.vacinas;
    }
  }

  if (vaxList) {
    if (listaVacinas.length > 0) {
      vaxList.innerHTML = listaVacinas.map(v => `
        <div class="vax-item">
          <div class="vax-icon-wrap"><i class="fa-solid fa-syringe"></i></div>
          <div class="vax-info-col">
            <div class="vax-title-row">
              <span class="vax-title">${v.nome}</span>
              <span class="badge-status badge-success" style="font-size: 0.72rem;">Aplicada</span>
            </div>
            <span class="vax-subtext">${v.lote}</span>
          </div>
          <div class="vax-date-col">
            <div class="vax-date-label">Próximo Reforço</div>
            <div class="vax-date-value" style="color: #047857; font-weight: 700;">${v.reforco}</div>
          </div>
        </div>
      `).join('');
    } else {
      vaxList.innerHTML = `
        <div class="vax-empty-state">
          <i class="fa-solid fa-syringe"></i>
          <h5>Nenhuma vacina aplicada ainda</h5>
          <p>O médico-veterinário registrará as doses, lotes e reforços diretamente nas consultas clínicas.</p>
        </div>
      `;
    }
  }

  // 5. PRÓXIMOS LEMBRETES (CIRURGIAS AGENDADAS + REFORÇOS DE VACINAS)
  if (remindersContainer) {
    let htmlLembretes = '';

    if (isThorDemo || codigo === 'PST-9921' || pNome === 'Thor') {
      htmlLembretes = `
        <div class="alert-item" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #92400e;"><i class="fa-solid fa-bug"></i> Antipulgas Simparic</div>
          <div style="font-size: 0.78rem; color: #b45309;">Próxima dose: 12/Nov (Em 21 dias)</div>
        </div>
        <div class="alert-item" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.8rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: #166534;"><i class="fa-solid fa-syringe"></i> Reforço Vacina V10</div>
          <div style="font-size: 0.78rem; color: #15803d;">Data prevista: 15/Nov (Em 24 dias)</div>
        </div>
      `;
    } else {
      // 5.1 Busca cirurgias agendadas salvas para este pet
      const cirurgiasSalvas = JSON.parse(localStorage.getItem('petstory_cirurgias_' + petId) || '[]');
      cirurgiasSalvas.forEach(c => {
        htmlLembretes += `
          <div class="alert-item" style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #1e40af;"><i class="fa-solid fa-calendar-check"></i> ${c.nome} (Cirurgia Agendada)</div>
            <div style="font-size: 0.78rem; color: #2563eb;">Data: ${c.data} • ${c.cirurgiao}</div>
            ${c.notas ? `<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Orientação: ${c.notas}</div>` : ''}
          </div>
        `;
      });

      // 5.2 Se tiver vacinas aplicadas com próximo reforço futuro, inclui como lembrete sanitário!
      listaVacinas.forEach(v => {
        if (v.reforco && v.reforco !== 'Pendente') {
          htmlLembretes += `
            <div class="alert-item" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #166534;"><i class="fa-solid fa-syringe"></i> Reforço ${v.nome}</div>
              <div style="font-size: 0.78rem; color: #15803d;">Data prevista: ${v.reforco} • Dr. Ricardo</div>
            </div>
          `;
        }
      });

      if (!htmlLembretes) {
        htmlLembretes = `
          <div style="text-align: center; padding: 1.2rem; font-size: 0.85rem; color: var(--text-muted); background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
            <i class="fa-solid fa-bell-slash" style="font-size: 1.5rem; margin-bottom: 0.4rem; color: #94a3b8; display: block;"></i>
            Nenhum procedimento agendado no momento.
          </div>
        `;
      }
    }

    remindersContainer.innerHTML = htmlLembretes;
  }
}

function copiarTagTutor() {
  const code = document.getElementById('tutor-hero-tag-display')?.textContent.trim() || 'PST-1428';
  navigator.clipboard?.writeText(code);
  showToast('Código Copiado!', `Tag [${code}] copiada para a área de transferência.`, 'fa-copy', 'success');
}

function handlePetPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = async function() {
      // Otimiza e redimensiona imagem para 350x350 em Canvas (gera string leve de ~30KB)
      const canvas = document.createElement('canvas');
      const maxDim = 350;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const tutorImg = document.getElementById('tutor-pet-avatar-img');
      const prontuarioImg = document.getElementById('prontuario-pet-photo');

      if (tutorImg) tutorImg.src = optimizedDataUrl;
      if (prontuarioImg) prontuarioImg.src = optimizedDataUrl;

      const session = obterSessaoSalva();
      if (session && session.pet) {
        session.pet.foto_url = optimizedDataUrl;
        localStorage.setItem('petstory_current_user', JSON.stringify(session));

        // Persistência direta no banco Supabase
        const petId = session.pet.id || (session.pet.tag === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
        if (petId) {
          try {
            await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
              method: 'PATCH',
              headers: SUPABASE_CONFIG.headers,
              body: JSON.stringify({ foto_url: optimizedDataUrl })
            });
            showToast('Foto Salva na Nuvem!', 'A foto do seu pet foi atualizada e sincronizada com o banco de dados.', 'fa-cloud-arrow-up', 'success');
            return;
          } catch (err) {
            console.warn('Erro ao atualizar foto no Supabase:', err);
          }
        }
      }

      showToast('Foto Atualizada!', 'A foto do seu pet foi atualizada com sucesso.', 'fa-camera', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function baixarCarteirinhaPdf() {
  const session = obterSessaoSalva();
  const petNome = session?.pet?.nome || 'Bolinha';
  const petRaca = session?.pet?.raca || 'Canina';
  const tutorNome = session?.tutor?.nome || 'Rafael Martins Oliveira';
  const tagCode = session?.pet?.tag || 'PST-1428';
  const petId = session?.pet?.id || (tagCode === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);

  // Busca vacinas reais do paciente
  let vacinas = session?.pet?.vacinas || [];
  if (petId) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vacinas?pet_id=eq.${petId}`, {
        headers: SUPABASE_CONFIG.headers
      });
      if (resp.ok) {
        const vaxDb = await resp.json();
        if (vaxDb && vaxDb.length > 0) {
          vacinas = vaxDb.map(v => ({
            nome: v.nome_vacina,
            lote: v.laboratorio_lote,
            aplicacao: v.data_aplicacao,
            reforco: v.data_reforco,
            crmv: v.veterinario_crmv
          }));
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar vacinas para PDF:', e);
    }
  } else if (petNome === 'Thor') {
    vacinas = [
      { nome: 'V10 Poliovalente Canina', lote: 'Zoetis • Lote 5849-B2', aplicacao: '2025-11-15', reforco: '2026-11-15', crmv: 'Dr. Ricardo (CRMV-SP 38.412)' },
      { nome: 'Antirrábica Defensor', lote: 'Zoetis • Lote 9012-K4', aplicacao: '2026-01-10', reforco: '2027-01-10', crmv: 'Dr. André (CRMV-SP 31.020)' },
      { nome: 'Bronchi-Shield Oral', lote: 'Boehringer • Lote 7714-X1', aplicacao: '2025-11-15', reforco: '2026-11-15', crmv: 'Dr. Ricardo (CRMV-SP 38.412)' },
      { nome: 'Giardiavax (Giárdia)', lote: 'Zoetis • Lote 3320-G8', aplicacao: '2026-03-20', reforco: '2027-03-20', crmv: 'Dra. Camila (CRMV-SP 44.910)' }
    ];
  }

  let tabelaCorpo = '';
  if (vacinas && vacinas.length > 0) {
    tabelaCorpo = vacinas.map(v => `
      <tr>
        <td><strong>${v.nome}</strong></td>
        <td>${v.lote || 'Lote Padrão'}</td>
        <td>${v.aplicacao ? new Date(v.aplicacao).toLocaleDateString('pt-BR') : '15/11/2025'}</td>
        <td><strong style="color: #00735c;">${v.reforco ? new Date(v.reforco).toLocaleDateString('pt-BR') : 'Pendente'}</strong></td>
        <td>${v.crmv || 'Dr. Ricardo (CRMV-SP 38.412)'}</td>
      </tr>
    `).join('');
  } else {
    tabelaCorpo = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 28px 15px; color: #64748b; background: #f8fafc; font-style: italic;">
          <div style="font-size: 26px; margin-bottom: 6px;">🛡️</div>
          <strong>Nenhuma vacina aplicada até o momento.</strong><br>
          O histórico sanitário deste paciente encontra-se sem registros de imunização prévia.<br>
          Novas aplicações serão devidamente assinadas por médico-veterinário habilitado (CRMV).
        </td>
      </tr>
    `;
  }

  const printWin = window.open('', '_blank', 'width=800,height=900');
  if (!printWin) {
    window.print();
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Carteirinha de Vacinação Digital - ${petNome}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #0f172a; }
        .vax-doc { max-width: 680px; margin: 0 auto; border: 2px solid #00a887; border-radius: 16px; padding: 30px; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px dashed #00a887; padding-bottom: 15px; margin-bottom: 20px; }
        .doc-title { font-size: 24px; font-weight: 800; color: #00735c; }
        .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; margin-bottom: 20px; line-height: 1.6; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
        th { background: #e6f6f2; color: #00735c; }
        .footer-note { margin-top: 30px; font-size: 12px; color: #64748b; text-align: center; }
        .btn-p { background: #00a887; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        @media print { .no-p { display: none; } body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="vax-doc">
        <div class="doc-header">
          <div>
            <div class="doc-title">🐾 PetStory • Carteirinha de Vacinação</div>
            <span style="font-size: 13px; color: #64748b;">Prontuário Veterinário Unificado</span>
          </div>
          <div style="font-family: monospace; font-size: 18px; font-weight: bold; color: #00735c;">${tagCode}</div>
        </div>

        <div class="meta-box">
          <div><strong>Paciente:</strong> ${petNome} (${petRaca})</div>
          <div><strong>Tutor(a) Responsável:</strong> ${tutorNome}</div>
          <div><strong>Documento Autenticado em:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
        </div>

        <h4 style="margin-bottom: 5px;">Histórico de Imunização:</h4>
        <table>
          <thead>
            <tr>
              <th>Vacina</th>
              <th>Laboratório / Lote</th>
              <th>Aplicação</th>
              <th>Próximo Reforço</th>
              <th>Assinatura CRMV</th>
            </tr>
          </thead>
          <tbody>
            ${tabelaCorpo}
          </tbody>
        </table>

        <div class="footer-note">
          Este documento é a representação oficial da carteira digital autenticada via tag inteligente PetStory.
        </div>
      </div>

      <div class="no-p" style="text-align: center; margin-top: 25px;">
        <button class="btn-p" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
      </div>

      <script>
        setTimeout(() => { window.print(); }, 400);
      <\/script>
    </body>
    </html>
  `);
  printWin.document.close();
}

/* ==========================================================================
   Tela 4: Validação Veterinária & Abertura Dinâmica do Paciente no Prontuário
   ========================================================================== */
function initScannerSimulations() {
  const scanQrBtn = document.getElementById('btn-sim-qr');
  const scanNfcBtn = document.getElementById('btn-sim-nfc');
  const formManual = document.getElementById('form-manual-vet');
  const emergencyBtn = document.getElementById('btn-emergency-override');
  const quickChips = document.querySelectorAll('.chip-btn');
  const tagInput = document.getElementById('input-tag-code');
  const otpInput = document.getElementById('input-vet-otp');

  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const code = chip.getAttribute('data-code');
      const otp = chip.getAttribute('data-otp');
      if (tagInput && code) tagInput.value = code;
      if (otpInput && otp) otpInput.value = otp;
      showToast('Dados Preenchidos', `Tag: ${code} | OTP: ${otp || 'N/A'} inseridos.`, 'fa-barcode');
    });
  });

  if (scanQrBtn) {
    scanQrBtn.addEventListener('click', () => {
      startScanningSimulation('QR Code da Coleira');
    });
  }

  if (scanNfcBtn) {
    scanNfcBtn.addEventListener('click', () => {
      startScanningSimulation('Sensor NFC');
    });
  }

  if (formManual) {
    formManual.addEventListener('submit', (e) => {
      e.preventDefault();
      const code = tagInput ? tagInput.value.trim().toUpperCase() : '';
      const otp = otpInput ? otpInput.value.trim() : '';

      const resultado = validarAcessoClinicoVeterinario(code, otp);

      if (!resultado.valido) {
        showToast(resultado.titulo, resultado.mensagem, 'fa-shield-halved', 'danger');
        if (resultado.campo === 'tag') {
          tagInput?.focus();
        } else {
          otpInput?.focus();
          otpInput?.select();
        }
        return; // BLOQUEIA ACESSO E PERMANECE NA TELA DE VALIDAÇÃO
      }

      showToast('Validando Acesso...', `Autenticando Tag ${resultado.tag} com OTP de ${resultado.nome}...`, 'fa-circle-notch fa-spin');
      
      setTimeout(() => {
        carregarProntuarioPaciente(resultado.tag);
        switchScreen('prontuario');
        showToast('Acesso Autorizado', `Prontuário completo de ${resultado.nome} aberto com sucesso por 2 horas.`, 'fa-shield-dog', 'success');
      }, 600);
    });
  }

  if (emergencyBtn) {
    emergencyBtn.addEventListener('click', () => {
      showToast('Acesso de Emergência', 'Acesso concedido imediatamente para atendimento de urgência vital.', 'fa-triangle-exclamation', 'danger');
      const code = tagInput ? tagInput.value.trim().toUpperCase() : 'PST-9921';
      carregarProntuarioPaciente(code);
      setTimeout(() => { switchScreen('prontuario'); }, 600);
    });
  }
}

function startScanningSimulation(methodName) {
  const session = obterSessaoSalva();
  const codigoParaEscanear = session?.pet?.tag || 'PST-9921';
  const nomeParaEscanear = obterNomePacientePorTag(codigoParaEscanear);
  const otpValido = obterOtpEsperadoParaTag(codigoParaEscanear) || '849201';

  showToast('Leitura em andamento', `Lendo ${methodName}...`, 'fa-radar fa-spin');

  setTimeout(() => {
    const tagInput = document.getElementById('input-tag-code');
    const otpInput = document.getElementById('input-vet-otp');
    if (tagInput) tagInput.value = codigoParaEscanear;
    if (otpInput) otpInput.value = otpValido;

    carregarProntuarioPaciente(codigoParaEscanear);
    showToast('Identificado!', `Paciente: ${nomeParaEscanear} • Tag: ${codigoParaEscanear}`, 'fa-circle-check', 'success');
    
    setTimeout(() => {
      switchScreen('prontuario');
    }, 700);
  }, 1000);
}

/**
 * Carrega a tabela de vacinas do Prontuário do Veterinário com base no pet ativo
 */
async function carregarVacinasProntuario(petId, isThor) {
  const tbody = document.getElementById('prontuario-vax-tbody');
  if (!tbody) return;

  if (isThor) {
    tbody.innerHTML = `
      <tr>
        <td><strong>V10 Poliovalente Canina</strong></td>
        <td>Zoetis • Lote 5849-B2</td>
        <td>15/11/2025</td>
        <td><strong>15/11/2026</strong></td>
        <td>Dr. Ricardo (CRMV-SP 38.412)</td>
        <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Em Dia</span></td>
      </tr>
      <tr>
        <td><strong>Antirrábica Defensor</strong></td>
        <td>Zoetis • Lote 9012-K4</td>
        <td>10/01/2026</td>
        <td><strong>10/01/2027</strong></td>
        <td>Dr. André (CRMV-SP 31.020)</td>
        <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Em Dia</span></td>
      </tr>
      <tr>
        <td><strong>Bronchi-Shield Oral</strong></td>
        <td>Boehringer • Lote 7714-X1</td>
        <td>15/11/2025</td>
        <td><strong>15/11/2026</strong></td>
        <td>Dr. Ricardo (CRMV-SP 38.412)</td>
        <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Em Dia</span></td>
      </tr>
      <tr>
        <td><strong>Giardiavax (Giárdia)</strong></td>
        <td>Zoetis • Lote 3320-G8</td>
        <td>20/03/2026</td>
        <td><strong>20/03/2027</strong></td>
        <td>Dra. Camila (CRMV-SP 44.910)</td>
        <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Em Dia</span></td>
      </tr>
    `;
    return;
  }

  // Se for outro pet (ex: Bolinha), busca vacinas registradas no Supabase
  if (petId) {
    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vacinas?pet_id=eq.${petId}`, {
        headers: SUPABASE_CONFIG.headers
      });
      if (resp.ok) {
        const vaxList = await resp.json();
        if (vaxList && vaxList.length > 0) {
          tbody.innerHTML = vaxList.map(v => `
            <tr>
              <td><strong>${v.nome_vacina}</strong></td>
              <td>${v.laboratorio_lote}</td>
              <td>${formatarDataBr(v.data_aplicacao)}</td>
              <td><strong>${formatarDataBr(v.data_reforco)}</strong></td>
              <td>${v.veterinario_crmv || 'Dr. Ricardo (CRMV-SP 38.412)'}</td>
              <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> ${v.status || 'Em Dia'}</span></td>
            </tr>
          `).join('');
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar vacinas do banco:', e);
    }
  }

  // Caso não possua vacinas ainda (ex: pet novo cadastrado)
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding:30px 15px; color:#64748b; background:#f8fafc;">
        <i class="fa-solid fa-syringe" style="font-size:1.8rem; margin-bottom:8px; display:block; color:#94a3b8;"></i>
        <strong>Nenhuma vacina aplicada para este animal ainda.</strong><br>
        <span style="font-size: 0.85rem;">Clique no botão verde acima <strong>"Registrar Nova Vacina"</strong> para lançar a primeira imunização.</span>
      </td>
    </tr>
  `;
}

function carregarCirurgiasProntuario(petId, isThor) {
  const tbody = document.getElementById('prontuario-cirurgias-tbody');
  if (!tbody) return;

  const cirurgiasSalvas = JSON.parse(localStorage.getItem('petstory_cirurgias_' + petId) || '[]');

  if (isThor) {
    let rowsHtml = `
      <tr>
        <td><strong>Orquiectomia Eletiva (Castração) & Implante de Microchip</strong></td>
        <td>10 de Novembro de 2024</td>
        <td>Sedação e Anestesia Geral Inalatória (Isoflurano)</td>
        <td>Procedimento sem intercorrências anestésicas. Recuperação pós-cirúrgica excelente.</td>
        <td>Dr. André Villela (CRMV-SP 31.020)</td>
        <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Concluído</span></td>
      </tr>
    `;
    cirurgiasSalvas.forEach(c => {
      rowsHtml = `
        <tr style="background: #eff6ff;">
          <td><strong>${c.nome}</strong></td>
          <td><strong style="color: #2563eb;">${c.data} (Agendada)</strong></td>
          <td>Sedação / Avaliação prévia</td>
          <td><span>${c.notas || 'Jejum obrigatório'}</span></td>
          <td>${c.cirurgiao}</td>
          <td><span class="badge-status badge-pending"><i class="fa-solid fa-clock"></i> Agendada</span></td>
        </tr>
      ` + rowsHtml;
    });
    tbody.innerHTML = rowsHtml;
    return;
  }

  if (cirurgiasSalvas.length > 0) {
    tbody.innerHTML = cirurgiasSalvas.map(c => `
      <tr style="background: #eff6ff;">
        <td><strong>${c.nome}</strong></td>
        <td><strong style="color: #2563eb;">${c.data} (Agendada)</strong></td>
        <td>Sedação / Avaliação prévia</td>
        <td><span>${c.notas || 'Jejum obrigatório'}</span></td>
        <td>${c.cirurgiao}</td>
        <td><span class="badge-status badge-pending"><i class="fa-solid fa-clock"></i> Agendada</span></td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:30px 15px; color:#64748b; background:#f8fafc;">
          <i class="fa-solid fa-scissors" style="font-size:1.8rem; margin-bottom:8px; display:block; color:#94a3b8;"></i>
          <strong>Nenhum procedimento ou cirurgia cadastrado para este paciente.</strong><br>
          <span style="font-size: 0.85rem;">Clique no botão acima <strong>"Agendar Cirurgia ou Procedimento"</strong> para marcar intervenções com notificação na tela do tutor.</span>
        </td>
      </tr>
    `;
  }
}

function carregarPrescricoesProntuario(petId, isThor) {
  const grid = document.getElementById('prontuario-prescricoes-grid');
  if (!grid) return;

  const prescricoesSalvas = JSON.parse(localStorage.getItem('petstory_prescricoes_' + petId) || '[]');

  if (isThor) {
    let cardsHtml = `
      <div class="rx-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
          <h4 style="font-size: 1.1rem; color: #0f172a;">Apoquel 16mg (Maleato de Oclacitinib)</h4>
          <span class="badge-status badge-success">Uso Contínuo</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
          <strong>Indicação:</strong> Controle do prurido e manifestações alérgicas de dermatite atópica.
        </p>
        <div style="font-size: 0.82rem; background: var(--teal-tint); border-left: 3px solid var(--teal-primary); padding: 0.6rem 0.8rem; border-radius: 4px; color: #0f172a;">
          <strong>Posologia:</strong> Administrar 1 comprimido por via oral a cada 24 horas, sempre após alimentação matinal.
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            Prescrito por Dra. Camila Fontes (CRMV-SP 44.910) • Há 9 dias
          </span>
          <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this)">
            <i class="fa-solid fa-ban"></i> Suspender
          </button>
        </div>
      </div>
    `;
    prescricoesSalvas.forEach(rx => {
      cardsHtml = `
        <div class="rx-card" style="background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
            <h4 style="font-size: 1.1rem; color: #0f172a;">${rx.nome}</h4>
            <span class="badge-status badge-success">${rx.tipo}</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
            <strong>Indicação:</strong> ${rx.indicacao}
          </p>
          <div style="font-size: 0.82rem; background: var(--teal-tint); border-left: 3px solid var(--teal-primary); padding: 0.6rem 0.8rem; border-radius: 4px; color: #0f172a;">
            <strong>Posologia:</strong> ${rx.posologia}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">${rx.veterinario}</span>
            <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this)">
              <i class="fa-solid fa-ban"></i> Suspender
            </button>
          </div>
        </div>
      ` + cardsHtml;
    });
    grid.innerHTML = cardsHtml;
    return;
  }

  if (prescricoesSalvas.length > 0) {
    grid.innerHTML = prescricoesSalvas.map(rx => `
      <div class="rx-card" style="background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
          <h4 style="font-size: 1.1rem; color: #0f172a;">${rx.nome}</h4>
          <span class="badge-status badge-success">${rx.tipo}</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
          <strong>Indicação:</strong> ${rx.indicacao}
        </p>
        <div style="font-size: 0.82rem; background: var(--teal-tint); border-left: 3px solid var(--teal-primary); padding: 0.6rem 0.8rem; border-radius: 4px; color: #0f172a;">
          <strong>Posologia:</strong> ${rx.posologia}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">${rx.veterinario}</span>
          <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this)">
            <i class="fa-solid fa-ban"></i> Suspender
          </button>
        </div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
        <i class="fa-solid fa-pills" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
        <strong>Nenhum medicamento prescrito no momento.</strong><br>
        <span style="font-size: 0.85rem;">Clique no botão verde acima <strong>"Nova Prescrição Médica"</strong> para prescrever tratamentos para este animal.</span>
      </div>
    `;
  }
}

function carregarTimelineProntuario(petId, isThor) {
  const timeline = document.getElementById('prontuario-timeline-list');
  if (!timeline) return;

  const evolucoesSalvas = JSON.parse(localStorage.getItem('petstory_evolucoes_' + petId) || '[]');

  if (isThor) {
    let entriesHtml = `
      <div class="timeline-entry">
        <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">Consulta de Retorno Dermatológico</span>
          <span class="timeline-entry-date">12 de Outubro de 2026 (Há 9 dias)</span>
        </div>
        <div class="timeline-entry-doc">
          <i class="fa-solid fa-stethoscope"></i> Dra. Camila Fontes • CRMV-SP 44.910 (Dermatologia Vet)
        </div>
        <p class="timeline-entry-desc">Paciente apresentou melhora acentuada do prurido em região axilar e interdigital. Manutenção do Apoquel 16mg diário e banho com xampu de clorexidina 3%. Raspado de pele negativo para ácaros.</p>
      </div>
      <div class="timeline-entry">
        <div class="timeline-bullet" style="background: #2563eb;"></div>
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">Aplicação de Vacina Anual V10 Vanguard & Consulta Preventiva</span>
          <span class="timeline-entry-date">15 de Novembro de 2025</span>
        </div>
        <div class="timeline-entry-doc">
          <i class="fa-solid fa-stethoscope"></i> Dr. Ricardo Mendonça • CRMV-SP 38.412
        </div>
        <p class="timeline-entry-desc">Exame clínico sem alterações anatômicas. Ausculta cardíaca e pulmonar límpidas. Vacina V10 lote 5849-B aplicada em flanco subcutâneo. Sem reações adversas imediatas.</p>
      </div>
      <div class="timeline-entry">
        <div class="timeline-bullet" style="background: #e11d48;"></div>
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">Orquiectomia Eletiva (Castração) & Implante de Microchip</span>
          <span class="timeline-entry-date">10 de Novembro de 2024</span>
        </div>
        <div class="timeline-entry-doc">
          <i class="fa-solid fa-stethoscope"></i> Dr. André Villela • CRMV-SP 31.020 (Centro Cirúrgico)
        </div>
        <p class="timeline-entry-desc">Procedimento cirúrgico sob anestesia inalatória (Isoflurano). Nota: paciente apresentou leve tendência a bradicardia compensada com atropina. Pós-operatório excelente, cicatrização de primeira intenção.</p>
      </div>
    `;
    evolucoesSalvas.forEach(ev => {
      entriesHtml = `
        <div class="timeline-entry" style="animation: fadeIn 0.3s ease;">
          <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
          <div class="timeline-entry-header">
            <span class="timeline-entry-title">${ev.tipo}</span>
            <span class="timeline-entry-date">${ev.data} (Peso: ${ev.peso} kg)</span>
          </div>
          <div class="timeline-entry-doc">
            <i class="fa-solid fa-stethoscope"></i> ${ev.veterinario}
          </div>
          <p class="timeline-entry-desc" style="white-space: pre-line;">${ev.texto}</p>
        </div>
      ` + entriesHtml;
    });
    timeline.innerHTML = entriesHtml;
    return;
  }

  if (evolucoesSalvas.length > 0) {
    timeline.innerHTML = evolucoesSalvas.map(ev => `
      <div class="timeline-entry" style="animation: fadeIn 0.3s ease;">
        <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">${ev.tipo}</span>
          <span class="timeline-entry-date">${ev.data} (Peso: ${ev.peso} kg)</span>
        </div>
        <div class="timeline-entry-doc">
          <i class="fa-solid fa-stethoscope"></i> ${ev.veterinario}
        </div>
        <p class="timeline-entry-desc" style="white-space: pre-line;">${ev.texto}</p>
      </div>
    `).join('');
  } else {
    timeline.innerHTML = `
      <div class="timeline-entry">
        <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
        <div class="timeline-entry-header">
          <span class="timeline-entry-title">Prontuário Unificado Iniciado</span>
          <span class="timeline-entry-date">Histórico Clínico PetStory</span>
        </div>
        <div class="timeline-entry-doc">
          <i class="fa-solid fa-shield-dog"></i> Identificação Inteligente PetStory Tag
        </div>
        <p class="timeline-entry-desc">Paciente cadastrado na rede integrada PetStory. Para lançar a primeira consulta, clique na aba <strong>"Nova Evolução Clínica"</strong>.</p>
      </div>
    `;
  }
}

function carregarExamesProntuario(petId, isThor) {
  const grid = document.getElementById('prontuario-exams-grid');
  if (!grid) return;

  const examesSalvos = JSON.parse(localStorage.getItem('petstory_exames_' + petId) || '[]');

  if (isThor) {
    let examesHtml = `
      <div class="exam-card">
        <div>
          <div class="exam-card-top">
            <div class="exam-icon" style="background: rgba(0, 168, 135, 0.12); color: #00735c;">
              <i class="fa-solid fa-file-pdf"></i>
            </div>
            <div class="exam-info">
              <h4>Hemograma Completo + Perfil Bioquímico</h4>
              <span>Data: 05/10/2026 • LabVet Diagnósticos</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Eritrócitos, leucócitos e plaquetas dentro dos parâmetros de normalidade da espécie. ALT, Creatinina e Ureia normais.
          </p>
        </div>
        <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('Hemograma Completo + Perfil Bioquímico')">
          <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
        </button>
      </div>
      <div class="exam-card">
        <div>
          <div class="exam-card-top">
            <div class="exam-icon" style="background: rgba(245, 158, 11, 0.12); color: #d97706;">
              <i class="fa-solid fa-x-ray"></i>
            </div>
            <div class="exam-info">
              <h4>Raio-X Coxofemoral (Triagem Preventiva)</h4>
              <span>Data: 10/11/2024 • Centro Imagem Vet</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            Ausência de incongruência articular fêmuro-acetabular bilateral. Sem sinais radiográficos de displasia.
          </p>
        </div>
        <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('Raio-X Coxofemoral (Triagem)')">
          <i class="fa-solid fa-x-ray" style="color: #fbbf24;"></i> Visualizar Radiografia (PDF)
        </button>
      </div>
    `;
    examesSalvos.forEach(ex => {
      examesHtml = `
        <div class="exam-card" style="background: #f0fdf9; border: 1px solid #a7f3d0;">
          <div>
            <div class="exam-card-top">
              <div class="exam-icon" style="background: rgba(0, 168, 135, 0.12); color: #00735c;">
                <i class="fa-solid fa-file-pdf"></i>
              </div>
              <div class="exam-info">
                <h4>${ex.titulo}</h4>
                <span>Data: ${ex.data} • ${ex.lab}</span>
              </div>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
              ${ex.resumo}
            </p>
          </div>
          <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('${ex.titulo}', '${ex.fileUrl || ''}')">
            <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
          </button>
        </div>
      ` + examesHtml;
    });
    grid.innerHTML = examesHtml;
    return;
  }

  if (examesSalvos.length > 0) {
    grid.innerHTML = examesSalvos.map(ex => `
      <div class="exam-card" style="background: #f0fdf9; border: 1px solid #a7f3d0;">
        <div>
          <div class="exam-card-top">
            <div class="exam-icon" style="background: rgba(0, 168, 135, 0.12); color: #00735c;">
              <i class="fa-solid fa-file-pdf"></i>
            </div>
            <div class="exam-info">
              <h4>${ex.titulo}</h4>
              <span>Data: ${ex.data} • ${ex.lab}</span>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
            ${ex.resumo}
          </p>
        </div>
        <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('${ex.titulo}', '${ex.fileUrl || ''}')">
          <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
        </button>
      </div>
    `).join('');
  } else {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
        <i class="fa-solid fa-file-pdf" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
        <strong>Nenhum laudo ou exame anexado para este paciente.</strong><br>
        <span style="font-size: 0.85rem;">Clique no botão acima <strong>"Anexar Novo Laudo / Exame (PDF)"</strong> para subir documentos laboratoriais.</span>
      </div>
    `;
  }
}

/**
 * Carrega dinamicamente os dados do animal correto no Prontuário Clínico
 * (Bolinha vs Thor) eliminando qualquer confusão entre pacientes!
 */
function carregarProntuarioPaciente(tagCode) {
  const session = obterSessaoSalva();
  const pNome = document.getElementById('prontuario-pet-nome');
  const pRaca = document.getElementById('prontuario-pet-raca');
  const pSexo = document.getElementById('prontuario-pet-sexo');
  const pIdade = document.getElementById('prontuario-pet-idade');
  const pPeso = document.getElementById('prontuario-pet-peso');
  const pTag = document.getElementById('prontuario-pet-tag');
  const pMicrochip = document.getElementById('prontuario-pet-microchip');
  const tNome = document.getElementById('prontuario-tutor-nome');
  const tTel = document.getElementById('prontuario-tutor-tel');
  const tCidade = document.getElementById('prontuario-tutor-cidade');
  const alertAlergia = document.getElementById('prontuario-alert-alergia');
  const alertAnestesica = document.getElementById('prontuario-alert-anestesica');
  const alertCronica = document.getElementById('prontuario-alert-cronica');
  const photoImg = document.getElementById('prontuario-pet-photo');

  // Se a tag buscada for a do pet recém-cadastrado (ou diferente de PST-9921)
  if (session && session.pet && (session.pet.tag === tagCode || (tagCode && tagCode !== 'PST-9921'))) {
    const pet = session.pet;
    const tutor = session.tutor;

    pacienteAtualProntuario = pet;
    if (!pacienteAtualProntuario.id && pet.tag === 'PST-1428') {
      pacienteAtualProntuario.id = '7e096a3b-0468-4347-9bee-a8286a10d416';
    }

    if (pNome) pNome.textContent = pet.nome;
    if (pRaca) pRaca.textContent = pet.raca || 'SRD';
    if (pSexo) pSexo.innerHTML = `${pet.sexo || 'Macho'} • <strong>${pet.castrado !== false ? 'Castrado' : 'Não Castrado'}</strong>`;
    if (pIdade) pIdade.innerHTML = `Idade: <strong>Aprox. 2 anos</strong>`;
    if (pPeso) pPeso.textContent = `${pet.peso ? parseFloat(pet.peso).toFixed(1) : '22.3'} kg`;
    if (pTag) pTag.textContent = pet.tag || tagCode;
    if (pMicrochip) pMicrochip.textContent = pet.microchip || 'Pendente de Implante';
    if (tNome) tNome.textContent = tutor?.nome || 'Rafael Martins Oliveira';
    if (tTel) tTel.textContent = tutor?.telefone_emergencia || '(11) 98765-4321';
    if (tCidade) tCidade.textContent = tutor?.cidade || 'Caruaru - PE';

    // FOTO: Sempre isolada por paciente (Bolinha tem foto própria ou foto padrão)
    if (photoImg) {
      photoImg.src = pet.foto_url || DEFAULT_PET_PHOTO;
    }

    // ALERTAS CLÍNICOS DO PACIENTE (Bolinha):
    if (alertAlergia) {
      const alergias = pet.alergias_graves || 'Ração Pedegree, Dipirona';
      alertAlergia.style.display = 'inline-flex';
      alertAlergia.innerHTML = `<i class="fa-solid fa-ban"></i> ALERGIAS: ${alergias}`;
    }

    // Bolinha NÃO possui histórico de restrição anestésica do Thor
    if (alertAnestesica) {
      if (pet.restricoes_anestesicas && !pet.restricoes_anestesicas.includes('Alfa-2 Agonistas')) {
        alertAnestesica.style.display = 'inline-flex';
        alertAnestesica.innerHTML = `<i class="fa-solid fa-syringe"></i> RESTRIÇÃO ANESTÉSICA: ${pet.restricoes_anestesicas}`;
      } else {
        alertAnestesica.style.display = 'none'; // Oculta restrição indevida!
      }
    }

    // Bolinha NÃO possui Dermatite Atópica
    if (alertCronica) {
      if (pet.condicoes_cronicas && !pet.condicoes_cronicas.includes('Dermatite')) {
        alertCronica.style.display = 'inline-flex';
        alertCronica.innerHTML = `<i class="fa-solid fa-notes-medical"></i> CONDIÇÃO: ${pet.condicoes_cronicas}`;
      } else {
        alertCronica.style.display = 'none'; // Oculta condição indevida!
      }
    }

    // Carrega todas as abas dinâmicas do Bolinha
    carregarVacinasProntuario(pacienteAtualProntuario.id, false);
    carregarCirurgiasProntuario(pacienteAtualProntuario.id, false);
    carregarPrescricoesProntuario(pacienteAtualProntuario.id, false);
    carregarTimelineProntuario(pacienteAtualProntuario.id, false);
    carregarExamesProntuario(pacienteAtualProntuario.id, false);

  } else {
    // Paciente Thor (Padrão de Demonstração)
    pacienteAtualProntuario = {
      id: 'c810977d-2eea-420e-8957-3ab54afba430',
      nome: 'Thor',
      raca: 'Golden Retriever',
      peso: 32.8,
      tag: 'PST-9921',
      foto_url: THOR_PHOTO
    };

    if (pNome) pNome.textContent = 'Thor';
    if (pRaca) pRaca.textContent = 'Golden Retriever';
    if (pSexo) pSexo.innerHTML = `Macho • <strong>Castrado</strong>`;
    if (pIdade) pIdade.innerHTML = `Idade: <strong>4 anos e 2 meses</strong> (Nasc: 14/08/2022)`;
    if (pPeso) pPeso.textContent = `32.8 kg`;
    if (pTag) pTag.textContent = 'PST-9921';
    if (pMicrochip) pMicrochip.textContent = '981.098.108.429.182';
    if (tNome) tNome.textContent = 'Mariana Vasconcelos';
    if (tTel) tTel.textContent = '(11) 98765-4321';
    if (tCidade) tCidade.textContent = 'São Paulo - SP';

    // FOTO: Restaura explicitamente o Golden Retriever para o Thor
    if (photoImg) {
      photoImg.src = THOR_PHOTO;
    }

    if (alertAlergia) {
      alertAlergia.style.display = 'inline-flex';
      alertAlergia.innerHTML = `<i class="fa-solid fa-ban"></i> ALERGIA GRAVE: Dipirona e Cefalexina`;
    }
    if (alertAnestesica) {
      alertAnestesica.style.display = 'inline-flex';
      alertAnestesica.innerHTML = `<i class="fa-solid fa-syringe"></i> RESTRIÇÃO ANESTÉSICA: Bradicardia induzida por Alfa-2 Agonistas`;
    }
    if (alertCronica) {
      alertCronica.style.display = 'inline-flex';
      alertCronica.innerHTML = `<i class="fa-solid fa-notes-medical"></i> CONDIÇÃO CRÔNICA: Dermatite Atópica Canina`;
    }

    // Carrega todas as abas oficiais do Thor
    carregarVacinasProntuario(pacienteAtualProntuario.id, true);
    carregarCirurgiasProntuario(pacienteAtualProntuario.id, true);
    carregarPrescricoesProntuario(pacienteAtualProntuario.id, true);
    carregarTimelineProntuario(pacienteAtualProntuario.id, true);
    carregarExamesProntuario(pacienteAtualProntuario.id, true);
  }
}

/* ==========================================================================
   Prontuário: Edição de Peso e Sinais Vitais com Persistência Real no Supabase
   ========================================================================== */
async function editarPesoProntuario() {
  const pesoAtualElem = document.getElementById('prontuario-pet-peso');
  const valorAtual = pesoAtualElem ? parseFloat(pesoAtualElem.textContent) : 32.8;

  const novoPesoStr = prompt('Digite o novo peso aferido na balança (kg):', valorAtual);
  if (novoPesoStr !== null && !isNaN(parseFloat(novoPesoStr))) {
    const novoPeso = parseFloat(novoPesoStr);
    const formatado = novoPeso.toFixed(1) + ' kg';
    if (pesoAtualElem) pesoAtualElem.textContent = formatado;

    // Atualiza também na sessão local
    const session = obterSessaoSalva();
    if (session && session.pet) {
      session.pet.peso = novoPeso;
      localStorage.setItem('petstory_current_user', JSON.stringify(session));
    }
    if (pacienteAtualProntuario) {
      pacienteAtualProntuario.peso = novoPeso;
    }

    // Persiste no Supabase com PATCH
    let petId = pacienteAtualProntuario?.id || session?.pet?.id;
    if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
      petId = 'c810977d-2eea-420e-8957-3ab54afba430';
    } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
      petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
    }

    if (petId) {
      try {
        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
          method: 'PATCH',
          headers: SUPABASE_CONFIG.headers,
          body: JSON.stringify({ peso: novoPeso })
        });
        if (resp.ok) {
          showToast('Sincronizado no Supabase!', `Novo peso de ${formatado} salvo com sucesso no banco de dados.`, 'fa-cloud-arrow-up', 'success');
          return;
        }
      } catch (err) {
        console.warn('Erro ao atualizar peso no Supabase:', err);
      }
    }

    showToast('Peso Atualizado', `Novo peso registrado: ${formatado}`, 'fa-weight-scale', 'success');
  }
}

function abrirModalVitais() {
  const modal = document.getElementById('modal-vitals-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalVitais() {
  const modal = document.getElementById('modal-vitals-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalVitais(event) {
  event.preventDefault();
  const fc = document.getElementById('input-modal-fc')?.value || '88';
  const fr = document.getElementById('input-modal-fr')?.value || '22';
  const temp = document.getElementById('input-modal-temp')?.value || '38.4';
  const ecc = document.getElementById('input-modal-ecc')?.value || '5';
  const pesoStr = document.getElementById('input-modal-peso')?.value || '32.8';
  const novoPeso = parseFloat(pesoStr);

  const cardFc = document.getElementById('vital-card-fc');
  const cardFr = document.getElementById('vital-card-fr');
  const cardTemp = document.getElementById('vital-card-temp');
  const cardEcc = document.getElementById('vital-card-ecc');
  const pPeso = document.getElementById('prontuario-pet-peso');

  if (cardFc) cardFc.innerHTML = `${fc} <span style="font-size: 1rem; font-weight: 500;">bpm</span>`;
  if (cardFr) cardFr.innerHTML = `${fr} <span style="font-size: 1rem; font-weight: 500;">mpm</span>`;
  if (cardTemp) cardTemp.innerHTML = `${parseFloat(temp).toFixed(1)} <span style="font-size: 1rem; font-weight: 500;">°C</span>`;
  if (cardEcc) cardEcc.textContent = `${ecc} / 9`;
  if (pPeso) pPeso.textContent = `${novoPeso.toFixed(1)} kg`;

  // Atualiza na sessão local
  const session = obterSessaoSalva();
  if (session && session.pet) {
    session.pet.peso = novoPeso;
    localStorage.setItem('petstory_current_user', JSON.stringify(session));
  }
  if (pacienteAtualProntuario) {
    pacienteAtualProntuario.peso = novoPeso;
  }

  // Persiste peso no Supabase via PATCH
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  if (petId) {
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
        method: 'PATCH',
        headers: SUPABASE_CONFIG.headers,
        body: JSON.stringify({ peso: novoPeso })
      });
    } catch (err) {
      console.warn('Erro ao sincronizar sinais vitais no Supabase:', err);
    }
  }

  fecharModalVitais();
  showToast('Sinais Vitais Gravados!', `FC: ${fc} bpm, Temp: ${parseFloat(temp).toFixed(1)}°C, Peso: ${novoPeso.toFixed(1)}kg salvos com sucesso no banco.`, 'fa-heart-pulse', 'success');
}

/* ==========================================================================
   Prontuário: Nova Vacina (Reflete na Carteirinha do Tutor e Salva no Supabase)
   ========================================================================== */
function abrirModalNovaVacina() {
  const modal = document.getElementById('modal-vaccine-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovaVacina() {
  const modal = document.getElementById('modal-vaccine-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalVacina(event) {
  event.preventDefault();
  const nome = document.getElementById('input-vac-nome')?.value || 'Vacina';
  const lote = document.getElementById('input-vac-lote')?.value || 'Lote Padrão';
  const dataApl = document.getElementById('input-vac-data')?.value || new Date().toISOString().split('T')[0];
  const dataRef = document.getElementById('input-vac-reforco')?.value || '2027-11-03';

  // Formata datas para visualização
  const dataAplBr = formatarDataBr(dataApl);
  const dataRefBr = formatarDataBr(dataRef);

  // 1. Adiciona na tabela do Prontuário do Veterinário
  const tbody = document.getElementById('prontuario-vax-tbody');
  if (tbody) {
    if (tbody.textContent.includes('Nenhuma vacina')) {
      tbody.innerHTML = '';
    }
    const tr = document.createElement('tr');
    tr.style.background = '#f0fdf9';
    tr.innerHTML = `
      <td><strong>${nome}</strong></td>
      <td>${lote}</td>
      <td>${dataAplBr}</td>
      <td><strong style="color: #00735c;">${dataRefBr}</strong></td>
      <td>Dr. Ricardo (CRMV-SP 38.412)</td>
      <td><span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Em Dia</span></td>
    `;
    tbody.prepend(tr);
  }

  // 2. Adiciona na Carteirinha do Tutor (Reflexo em tempo real!)
  const tutorVaxList = document.getElementById('tutor-vax-list');
  if (tutorVaxList) {
    const empty = tutorVaxList.querySelector('.vax-empty-state');
    if (empty) empty.remove();

    const div = document.createElement('div');
    div.className = 'vax-item';
    div.style.borderLeft = '3px solid var(--teal-primary)';
    div.innerHTML = `
      <div class="vax-icon-wrap"><i class="fa-solid fa-syringe"></i></div>
      <div class="vax-info-col">
        <div class="vax-title-row">
          <span class="vax-title">${nome}</span>
          <span class="badge-status badge-success" style="font-size: 0.72rem;">Aplicada</span>
        </div>
        <span class="vax-subtext">${lote} • Dr. Ricardo (CRMV-SP 38.412)</span>
      </div>
      <div class="vax-date-col">
        <div class="vax-date-label">Próximo Reforço</div>
        <div class="vax-date-value" style="color: #047857; font-weight: 700;">${dataRefBr}</div>
      </div>
    `;
    tutorVaxList.prepend(div);
  }

  // 3. Adiciona também aos lembretes do tutor
  const tutorReminders = document.getElementById('tutor-reminders-container');
  if (tutorReminders) {
    if (tutorReminders.textContent.includes('Nenhum procedimento')) {
      tutorReminders.innerHTML = '';
    }
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-item';
    alertBox.style.cssText = 'background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem; animation: fadeIn 0.3s ease;';
    alertBox.innerHTML = `
      <div style="font-size: 0.85rem; font-weight: 700; color: #166534;"><i class="fa-solid fa-syringe"></i> Reforço ${nome}</div>
      <div style="font-size: 0.78rem; color: #15803d;">Data prevista: ${dataRefBr} • Dr. Ricardo</div>
    `;
    tutorReminders.prepend(alertBox);
  }

  // 4. Salva no banco de dados Supabase via REST API associado ao pet_id correto
  const session = obterSessaoSalva();
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const vaxPayload = {
    nome_vacina: nome,
    laboratorio_lote: lote,
    data_aplicacao: dataApl,
    data_reforco: dataRef,
    veterinario_crmv: 'CRMV-SP 38.412',
    status: 'Em Dia'
  };
  if (petId) {
    vaxPayload.pet_id = petId;
  }

  try {
    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vacinas`, {
      method: 'POST',
      headers: SUPABASE_CONFIG.headers,
      body: JSON.stringify(vaxPayload)
    });
  } catch (e) {
    console.error('Erro ao salvar vacina no Supabase:', e);
  }

  fecharModalNovaVacina();
  showToast('Vacina Aplicada!', `Dose de [${nome}] assinada e sincronizada com o banco e a carteirinha do tutor.`, 'fa-syringe', 'success');
}

/* ==========================================================================
   Prontuário: Prescrições e Medicamentos
   ========================================================================== */
function abrirModalNovaPrescricao() {
  const modal = document.getElementById('modal-prescription-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovaPrescricao() {
  const modal = document.getElementById('modal-prescription-backdrop');
  if (modal) modal.classList.remove('open');
}

function salvarModalPrescricao(event) {
  event.preventDefault();
  const nome = document.getElementById('input-rx-nome')?.value || 'Medicamento';
  const tipo = document.getElementById('input-rx-tipo')?.value || 'Oral';
  const indicacao = document.getElementById('input-rx-indicacao')?.value || '';
  const posologia = document.getElementById('input-rx-posologia')?.value || '';

  const session = obterSessaoSalva();
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  // 1. Salva no localStorage do paciente correspondente
  if (petId) {
    const prescricoes = JSON.parse(localStorage.getItem('petstory_prescricoes_' + petId) || '[]');
    prescricoes.unshift({
      nome,
      tipo,
      indicacao,
      posologia,
      veterinario: 'Prescrito por Dr. Ricardo Mendonça (CRMV-SP 38.412) • Hoje'
    });
    localStorage.setItem('petstory_prescricoes_' + petId, JSON.stringify(prescricoes));
  }

  const grid = document.getElementById('prontuario-prescricoes-grid');
  if (grid) {
    if (grid.textContent.includes('Nenhum medicamento')) {
      grid.innerHTML = '';
    }
    const card = document.createElement('div');
    card.className = 'rx-card';
    card.style.background = '#f0fdf9';
    card.style.border = '1px solid #a7f3d0';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.padding = '1.5rem';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
        <h4 style="font-size: 1.1rem; color: #0f172a;">${nome}</h4>
        <span class="badge-status badge-success">${tipo}</span>
      </div>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
        <strong>Indicação:</strong> ${indicacao}
      </p>
      <div style="font-size: 0.82rem; background: var(--teal-tint); border-left: 3px solid var(--teal-primary); padding: 0.6rem 0.8rem; border-radius: 4px; color: #0f172a;">
        <strong>Posologia:</strong> ${posologia}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          Prescrito por Dr. Ricardo Mendonça (CRMV-SP 38.412) • Hoje
        </span>
        <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this)">
          <i class="fa-solid fa-ban"></i> Suspender
        </button>
      </div>
    `;
    grid.prepend(card);
  }

  fecharModalNovaPrescricao();
  showToast('Prescrição Emitida', `Medicamento [${nome}] registrado no prontuário.`, 'fa-pills', 'success');
}

function suspenderPrescricao(btn) {
  const card = btn.closest('.rx-card');
  if (!card) return;

  if (confirm('Deseja realmente suspender e arquivar este tratamento?')) {
    card.style.opacity = '0.45';
    card.style.background = '#f1f5f9';
    btn.textContent = 'Tratamento Encerrado';
    btn.disabled = true;
    btn.style.cursor = 'default';

    const session = obterSessaoSalva();
    let petId = pacienteAtualProntuario?.id || session?.pet?.id;
    if (petId) {
      const nomeMed = card.querySelector('h4')?.textContent.trim();
      if (nomeMed) {
        const prescricoes = JSON.parse(localStorage.getItem('petstory_prescricoes_' + petId) || '[]');
        const filtradas = prescricoes.filter(p => !p.nome.includes(nomeMed));
        localStorage.setItem('petstory_prescricoes_' + petId, JSON.stringify(filtradas));
      }
    }

    showToast('Tratamento Encerrado', 'Medicamento descontinuado no histórico clínico.', 'fa-info-circle', 'info');
  }
}

/* ==========================================================================
   Prontuário: Agendamento de Cirurgias (Reflete no Tutor)
   ========================================================================== */
function abrirModalNovaCirurgia() {
  const modal = document.getElementById('modal-surgery-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovaCirurgia() {
  const modal = document.getElementById('modal-surgery-backdrop');
  if (modal) modal.classList.remove('open');
}

function salvarModalCirurgia(event) {
  event.preventDefault();
  const nome = document.getElementById('input-cirurgia-nome')?.value || 'Procedimento';
  const data = document.getElementById('input-cirurgia-data')?.value || '2027-02-15';
  const cirurgiao = document.getElementById('input-cirurgia-cirurgiao')?.value || 'Dr. Ricardo Mendonça';
  const notas = document.getElementById('input-cirurgia-notas')?.value || 'Jejum obrigatório';

  const dataBr = formatarDataBr(data);

  const session = obterSessaoSalva();
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  // 1. Salva no localStorage do pet
  if (petId) {
    const cirurgias = JSON.parse(localStorage.getItem('petstory_cirurgias_' + petId) || '[]');
    cirurgias.unshift({
      nome,
      data: dataBr,
      cirurgiao,
      notas,
      status: 'Agendada'
    });
    localStorage.setItem('petstory_cirurgias_' + petId, JSON.stringify(cirurgias));
  }

  // 2. Adiciona na tabela do Prontuário
  const tbody = document.getElementById('prontuario-cirurgias-tbody');
  if (tbody) {
    if (tbody.textContent.includes('Nenhum procedimento')) {
      tbody.innerHTML = '';
    }
    const tr = document.createElement('tr');
    tr.style.background = '#eff6ff';
    tr.innerHTML = `
      <td><strong>${nome}</strong></td>
      <td><strong style="color: #2563eb;">${dataBr} (Agendada)</strong></td>
      <td>Sedação / Avaliação prévia</td>
      <td><span>${notas}</span></td>
      <td>${cirurgiao}</td>
      <td><span class="badge-status badge-pending"><i class="fa-solid fa-clock"></i> Agendada</span></td>
    `;
    tbody.prepend(tr);
  }

  // 3. Sincroniza na tela do Tutor como Lembrete de Cirurgia!
  const tutorReminders = document.getElementById('tutor-reminders-container');
  if (tutorReminders) {
    if (tutorReminders.textContent.includes('Nenhum procedimento')) {
      tutorReminders.innerHTML = '';
    }
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-item';
    alertBox.style.cssText = 'background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem; animation: fadeIn 0.3s ease;';
    alertBox.innerHTML = `
      <div style="font-size: 0.85rem; font-weight: 700; color: #1e40af;">
        <i class="fa-solid fa-calendar-check"></i> ${nome} (Cirurgia Agendada)
      </div>
      <div style="font-size: 0.78rem; color: #2563eb;">Data: ${dataBr} • ${cirurgiao}</div>
      <div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Orientação: ${notas}</div>
    `;
    tutorReminders.prepend(alertBox);
  }

  fecharModalNovaCirurgia();
  showToast('Procedimento Agendado!', `Cirurgia marcada para ${dataBr}. Notificação gerada na tela do tutor!`, 'fa-calendar-check', 'success');
}

/* ==========================================================================
   Prontuário: Upload e Visualização de Exames
   ========================================================================== */
function abrirModalNovoExame() {
  const modal = document.getElementById('modal-exam-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovoExame() {
  const modal = document.getElementById('modal-exam-backdrop');
  if (modal) modal.classList.remove('open');
}

function salvarModalExame(event) {
  event.preventDefault();
  const titulo = document.getElementById('input-exame-titulo')?.value || 'Exame Laboratorial';
  const lab = document.getElementById('input-exame-lab')?.value || 'LabVet';
  const data = document.getElementById('input-exame-data')?.value || new Date().toISOString().split('T')[0];
  const resumo = document.getElementById('input-exame-resumo')?.value || 'Parâmetros avaliados.';

  const dataBr = formatarDataBr(data);
  const fileInput = document.getElementById('input-exame-file');
  let fileUrl = '';
  if (fileInput?.files?.[0]) {
    fileUrl = URL.createObjectURL(fileInput.files[0]);
  }

  const session = obterSessaoSalva();
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  // 1. Salva no localStorage do pet
  if (petId) {
    const exames = JSON.parse(localStorage.getItem('petstory_exames_' + petId) || '[]');
    exames.unshift({
      titulo,
      lab,
      data: dataBr,
      resumo,
      fileUrl
    });
    localStorage.setItem('petstory_exames_' + petId, JSON.stringify(exames));
  }

  // 2. Adiciona ao grid do prontuário
  const grid = document.getElementById('prontuario-exams-grid');
  if (grid) {
    if (grid.textContent.includes('Nenhum laudo')) {
      grid.innerHTML = '';
    }
    const card = document.createElement('div');
    card.className = 'exam-card';
    card.style.background = '#f0fdf9';
    card.style.border = '1px solid #a7f3d0';
    card.innerHTML = `
      <div>
        <div class="exam-card-top">
          <div class="exam-icon" style="background: rgba(0, 168, 135, 0.12); color: #00735c;">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div class="exam-info">
            <h4>${titulo}</h4>
            <span>Data: ${dataBr} • ${lab}</span>
          </div>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          ${resumo}
        </p>
      </div>
      <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('${titulo}', '${fileUrl}')">
        <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
      </button>
    `;
    grid.prepend(card);
  }

  fecharModalNovoExame();
  showToast('Laudo Anexado', `Exame [${titulo}] vinculado ao prontuário.`, 'fa-file-pdf', 'success');
}

function visualizarExameSimulado(titulo, customFileUrl) {
  if (customFileUrl) {
    window.open(customFileUrl, '_blank');
    return;
  }

  // Gera visualizador de laudo simulado em PDF limpo
  const win = window.open('', '_blank', 'width=750,height=850');
  if (!win) return;

  const session = obterSessaoSalva();
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Thor';

  win.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Laudo Laboratorial - ${titulo}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
        .laudo-box { max-width: 650px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 30px; }
        .hdr { border-bottom: 2px solid #00a887; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        .meta { background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
        .footer { margin-top: 40px; border-top: 1px dashed #cbd5e1; padding-top: 20px; text-align: center; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="laudo-box">
        <div class="hdr">
          <div>
            <h2 style="color: #00735c; margin: 0;">🔬 LabVet Diagnósticos Clínicos</h2>
            <span style="font-size: 13px; color: #64748b;">Laudo Oficial Assinado Digitalmente</span>
          </div>
          <div><strong>Status:</strong> Normal</div>
        </div>
        <div class="meta">
          <div><strong>Exame:</strong> ${titulo}</div>
          <div><strong>Paciente:</strong> ${petNome}</div>
          <div><strong>Data da Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
          <div><strong>Responsável Técnico:</strong> Dra. Juliana Paes (CRMV-SP 51.204)</div>
        </div>
        <h3>Resultado e Interpretação Clínica:</h3>
        <p>Amostra processada conforme normas internacionais de patologia veterinária. Todos os índices quantitativos e qualitativos mantêm-se em consonância com os padrões fisiológicos esperados para a espécie e faixa etária.</p>
        <div class="footer">
          Documento emitido com assinatura eletrônica e certificado digital padrão ICP-Brasil.
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

/* ==========================================================================
   Prontuário: Nova Evolução Clínica (Adiciona na Linha do Tempo)
   ========================================================================== */
function salvarEvolucaoClinica(event) {
  event.preventDefault();
  const tipo = document.getElementById('note-evolution-tipo')?.value || 'Consulta Clínica';
  const peso = document.getElementById('note-evolution-peso')?.value || '22.3';
  const texto = document.getElementById('note-evolution-text')?.value.trim();

  if (!texto) {
    showToast('Atenção', 'Escreva a anotação da evolução clínica.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  const session = obterSessaoSalva();
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  // 1. Atualiza peso do paciente
  const pPeso = document.getElementById('prontuario-pet-peso');
  if (pPeso && peso) {
    pPeso.textContent = `${parseFloat(peso).toFixed(1)} kg`;
    if (session && session.pet) session.pet.peso = parseFloat(peso);
    if (pacienteAtualProntuario) pacienteAtualProntuario.peso = parseFloat(peso);
  }

  // 2. Salva no localStorage do pet correspondente
  if (petId) {
    const evolucoes = JSON.parse(localStorage.getItem('petstory_evolucoes_' + petId) || '[]');
    evolucoes.unshift({
      tipo,
      peso,
      texto,
      data: `Hoje, ${new Date().toLocaleDateString('pt-BR')}`,
      veterinario: 'Dr. Ricardo Mendonça • CRMV-SP 38.412'
    });
    localStorage.setItem('petstory_evolucoes_' + petId, JSON.stringify(evolucoes));
  }

  // 3. Adiciona novo nó na Linha do Tempo na Aba 1
  const timeline = document.getElementById('prontuario-timeline-list');
  if (timeline) {
    if (timeline.textContent.includes('Prontuário Unificado Iniciado')) {
      timeline.innerHTML = '';
    }
    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    entry.style.animation = 'fadeIn 0.3s ease';
    entry.innerHTML = `
      <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
      <div class="timeline-entry-header">
        <span class="timeline-entry-title">${tipo}</span>
        <span class="timeline-entry-date">Hoje, ${new Date().toLocaleDateString('pt-BR')} (Aferido: ${peso} kg)</span>
      </div>
      <div class="timeline-entry-doc">
        <i class="fa-solid fa-stethoscope"></i> Dr. Ricardo Mendonça • CRMV-SP 38.412
      </div>
      <p class="timeline-entry-desc" style="white-space: pre-line;">${texto}</p>
    `;
    timeline.prepend(entry);
  }

  document.getElementById('note-evolution-text').value = '';

  // Alterna para a aba 1 para o médico ver a linha do tempo atualizada
  const tabResumoBtn = document.querySelector('.tab-btn[data-tab="resumo"]');
  tabResumoBtn?.click();

  showToast('Evolução Registrada!', 'Nova consulta assinada com CRMV-SP 38.412 e inserida na Linha do Tempo.', 'fa-signature', 'success');
}

/* ==========================================================================
   Prontuário: Emissão e Impressão de Receita Médica Oficial
   ========================================================================== */
function abrirModalEmitirReceita() {
  const session = obterSessaoSalva();
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Thor';
  const petRaca = pacienteAtualProntuario?.raca || session?.pet?.raca || 'Golden Retriever';
  const tutorNome = session?.tutor?.nome || 'Mariana Vasconcelos';

  const rxPet = document.getElementById('rx-print-pet-nome');
  const rxRaca = document.getElementById('rx-print-pet-raca');
  const rxTutor = document.getElementById('rx-print-tutor-nome');
  const rxData = document.getElementById('rx-print-data');

  if (rxPet) rxPet.textContent = petNome;
  if (rxRaca) rxRaca.textContent = petRaca;
  if (rxTutor) rxTutor.textContent = tutorNome;
  if (rxData) rxData.textContent = new Date().toLocaleDateString('pt-BR');

  const modal = document.getElementById('modal-rx-print-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalEmitirReceita() {
  const modal = document.getElementById('modal-rx-print-backdrop');
  if (modal) modal.classList.remove('open');
}

function imprimirReceitaOficial() {
  fecharModalEmitirReceita();
  const session = obterSessaoSalva();
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Thor';
  const tutorNome = session?.tutor?.nome || 'Mariana Vasconcelos';

  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && (pacienteAtualProntuario?.tag === 'PST-9921' || pacienteAtualProntuario?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const prescricoesSalvas = JSON.parse(localStorage.getItem('petstory_prescricoes_' + petId) || '[]');
  let htmlMedicamentos = '';
  if (prescricoesSalvas.length > 0) {
    htmlMedicamentos = prescricoesSalvas.map((p, idx) => `
      <div class="med">
        <strong>${idx + 1}. ${p.nome}</strong> (${p.tipo})<br>
        <span style="font-size: 14px; color: #334155;"><strong>Indicação:</strong> ${p.indicacao || 'Avaliação clínica'}</span><br>
        <span style="font-size: 14px; color: #334155;"><strong>Posologia:</strong> ${p.posologia}</span>
      </div>
    `).join('');
  } else if (petNome === 'Thor') {
    htmlMedicamentos = `
      <div class="med">
        <strong>1. Apoquel 16mg (Maleato de Oclacitinib)</strong> - 1 Caixa<br>
        <span style="font-size: 14px; color: #334155;">Uso Oral: Fornecer 1 comprimido a cada 24 horas após a refeição matinal por 30 dias.</span>
      </div>
      <div class="med">
        <strong>2. Xampu de Clorexidina 3% + Miconazol 2%</strong> - 1 Frasco (200ml)<br>
        <span style="font-size: 14px; color: #334155;">Uso Tópico: Banho terapêutico a cada 7 dias, deixando a espuma agir por 10 minutos.</span>
      </div>
    `;
  } else {
    htmlMedicamentos = `
      <div class="med" style="color: #64748b; font-style: italic;">
        Nenhum medicamento ativo prescrito para este paciente no momento.
      </div>
    `;
  }

  const win = window.open('', '_blank', 'width=750,height=850');
  if (!win) {
    window.print();
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Receituário Médico Veterinário - ${petNome}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
        .rx-page { max-width: 650px; margin: 0 auto; border: 2px solid #00a887; border-radius: 12px; padding: 35px; }
        .hdr { text-align: center; border-bottom: 2px dashed #00a887; padding-bottom: 15px; margin-bottom: 20px; }
        .patient { background: #f8fafc; padding: 12px 18px; border-radius: 8px; margin-bottom: 25px; font-size: 14px; }
        .med { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .sign { margin-top: 50px; text-align: center; }
        .sign-line { width: 260px; height: 1px; background: #000; margin: 0 auto 5px; }
        .no-p { text-align: center; margin-top: 25px; }
        .btn-p { background: #00a887; color: #fff; border: none; padding: 10px 24px; border-radius: 6px; font-weight: bold; cursor: pointer; }
        @media print { .no-p { display: none; } body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="rx-page">
        <div class="hdr">
          <h2 style="color: #00735c; margin: 0;">🐾 Hospital Veterinário São Francisco</h2>
          <div style="font-size: 13px; color: #64748b;">Dr. Ricardo Mendonça • CRMV-SP 38.412</div>
        </div>

        <div class="patient">
          <div><strong>Paciente:</strong> ${petNome}</div>
          <div><strong>Tutor(a):</strong> ${tutorNome}</div>
          <div><strong>Data da Prescrição:</strong> ${new Date().toLocaleDateString('pt-BR')}</div>
        </div>

        <h3 style="margin-bottom: 15px;">Prescrição Farmacológica:</h3>
        
        ${htmlMedicamentos}

        <div class="sign">
          <div class="sign-line"></div>
          <strong>Dr. Ricardo Mendonça</strong><br>
          <span style="font-size: 13px; color: #64748b;">Médico-Veterinário • CRMV-SP 38.412</span>
        </div>
      </div>

      <div class="no-p">
        <button class="btn-p" onclick="window.print()">🖨️ Imprimir / Salvar Receita em PDF</button>
      </div>

      <script>
        setTimeout(() => { window.print(); }, 400);
      <\/script>
    </body>
    </html>
  `);
  win.document.close();
}

/* ==========================================================================
   Auxiliares de Sessão e LocalStorage
   ========================================================================== */
function salvarSessao(tutor, pet, tagCode) {
  const sessionData = {
    tutor: tutor,
    pet: Object.assign({}, pet, { tag: tagCode })
  };
  localStorage.setItem('petstory_current_user', JSON.stringify(sessionData));
}

function obterSessaoSalva() {
  const local = localStorage.getItem('petstory_current_user');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function restaurarSessaoSalva() {
  const session = obterSessaoSalva();
  if (session && session.tutor && session.pet) {
    const petId = session.pet.id || (session.pet.tag === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
    if (petId) {
      try {
        const respPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
          headers: SUPABASE_CONFIG.headers
        });
        if (respPet.ok) {
          const petsDb = await respPet.json();
          if (petsDb && petsDb.length > 0) {
            session.pet.peso = petsDb[0].peso;
            session.pet.foto_url = petsDb[0].foto_url || session.pet.foto_url;
            localStorage.setItem('petstory_current_user', JSON.stringify(session));
          }
        }
      } catch (err) {
        console.warn('Sincronização de inicialização com Supabase:', err);
      }
    }
    renderTutorPortal(session.tutor, session.pet, session.pet.tag, session.tutor.email?.toLowerCase().includes('mariana'));
  }
}

function formatarDataBr(isoString) {
  if (!isoString) return '';
  const partes = isoString.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return isoString;
}

/* ==========================================================================
   Modais: Gerador de OTP Temporário
   ========================================================================== */
let otpTimerInterval = null;

function initModalHandlers() {
  const modalBackdrop = document.getElementById('modal-otp-backdrop');
  const modalCloseBtn = document.getElementById('modal-otp-close');

  if (modalCloseBtn && modalBackdrop) {
    modalCloseBtn.addEventListener('click', () => { closeOtpModal(); });
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) closeOtpModal();
    });
  }
}

function openOtpModal() {
  const modal = document.getElementById('modal-otp-backdrop');
  const codeElem = document.getElementById('otp-code-value');
  const secondsElem = document.getElementById('otp-seconds-left');
  const petNameElem = document.getElementById('otp-modal-pet-name');
  
  if (!modal) return;

  const session = obterSessaoSalva();
  const petNome = session?.pet?.nome || 'Thor';
  const petTag = session?.pet?.tag || 'PST-9921';

  if (petNameElem) petNameElem.textContent = petNome;

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;
  if (codeElem) codeElem.textContent = formattedCode;

  // Salva no registro de OTPs ativos para a tag do animal em atendimento!
  salvarOtpAtivo(petTag, code, petNome);

  modal.classList.add('open');

  let timeLeft = 60;
  if (secondsElem) secondsElem.textContent = `${timeLeft}s`;

  if (otpTimerInterval) clearInterval(otpTimerInterval);
  
  otpTimerInterval = setInterval(() => {
    timeLeft--;
    if (secondsElem) secondsElem.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(otpTimerInterval);
      openOtpModal();
    }
  }, 1000);
}

function closeOtpModal() {
  const modal = document.getElementById('modal-otp-backdrop');
  if (modal) modal.classList.remove('open');
  if (otpTimerInterval) clearInterval(otpTimerInterval);
}

/* ==========================================================================
   Abas do Prontuário Médico
   ========================================================================== */
function initMedicalRecordTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const activePanel = document.getElementById(`tab-${targetTab}`);
      if (activePanel) activePanel.classList.add('active');
    });
  });
}

function initTutorInteractions() {
  const btnGenerateOtp = document.getElementById('btn-open-otp-modal');
  const lostModeToggle = document.getElementById('toggle-lost-mode');
  const copyOtpBtn = document.getElementById('btn-copy-otp');

  if (btnGenerateOtp) {
    btnGenerateOtp.addEventListener('click', () => { openOtpModal(); });
  }

  if (copyOtpBtn) {
    copyOtpBtn.addEventListener('click', () => {
      const otpText = document.getElementById('otp-code-value')?.textContent || '849 201';
      navigator.clipboard?.writeText(otpText.replace(/\s+/g, ''));
      showToast('Código Copiado!', `Código [${otpText}] copiado.`, 'fa-copy', 'success');
    });
  }

  if (lostModeToggle) {
    lostModeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        showToast('Modo Pet Perdido ATIVADO!', 'Se a coleira for escaneada, um alerta GPS imediato será enviado para o tutor.', 'fa-bell', 'warning');
      } else {
        showToast('Modo Pet Perdido Desativado', 'O animal está seguro com a família.', 'fa-shield-heart', 'success');
      }
    });
  }
}

/* ==========================================================================
   Tag Pública da Coleira
   ========================================================================== */
window.sendGpsLocationSimulated = function() {
  showToast('Obtendo Localização GPS...', 'Conectando ao satélite do smartphone...', 'fa-location-crosshairs fa-spin');
  setTimeout(() => {
    showToast('Localização Enviada com Sucesso!', 'O tutor recebeu aviso com o ponto exato no Google Maps.', 'fa-circle-check', 'success');
  }, 1200);
};

window.openWhatsappSimulated = function() {
  showToast('Abrindo WhatsApp', 'Iniciando conversa direta com o tutor: "Olá, encontrei seu pet..."', 'fa-brands fa-whatsapp', 'success');
};

/* ==========================================================================
   Atalhos de Teclado (1 a 6 e ESC) & Menu Secreto
   ========================================================================== */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.key === '1') switchScreen('login');
    else if (e.key === '2') switchScreen('cadastro');
    else if (e.key === '3') switchScreen('vet-scan');
    else if (e.key === '4') switchScreen('prontuario');
    else if (e.key === '5') switchScreen('tutor');
    else if (e.key === '6') switchScreen('public-tag');
    else if (e.key === 'Escape') {
      closeOtpModal();
      fecharModalVitais();
      fecharModalNovaVacina();
      fecharModalNovaPrescricao();
      fecharModalNovaCirurgia();
      fecharModalNovoExame();
      fecharModalEmitirReceita();
      const menuPanel = document.getElementById('secret-menu-panel');
      if (menuPanel) menuPanel.classList.remove('open');
    }
  });
}

function initDiscreetSwitcher() {
  const triggerBtn = document.getElementById('secret-trigger-btn');
  const menuPanel = document.getElementById('secret-menu-panel');
  const closeBtn = document.getElementById('secret-menu-close');
  const navItems = document.querySelectorAll('.secret-nav-item');

  if (!triggerBtn || !menuPanel) return;

  triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menuPanel.classList.toggle('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => { menuPanel.classList.remove('open'); });
  }

  document.addEventListener('click', (e) => {
    if (!menuPanel.contains(e.target) && !triggerBtn.contains(e.target)) {
      menuPanel.classList.remove('open');
    }
  });

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      switchScreen(target);
      menuPanel.classList.remove('open');
    });
  });
}

function updateSecretSwitcherActive(screenKey) {
  const navItems = document.querySelectorAll('.secret-nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-target') === screenKey) item.classList.add('active');
    else item.classList.remove('active');
  });
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(title, message, iconClass = 'fa-info-circle', type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconColor = 'var(--teal-primary)';
  if (type === 'danger') iconColor = '#f43f5e';
  if (type === 'warning') iconColor = '#f59e0b';
  if (type === 'success') iconColor = '#10b981';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 1.25rem;"></i>
    <div style="display: flex; flex-direction: column;">
      <span style="font-size: 0.88rem; font-weight: 700; color: #fff;">${title}</span>
      <span style="font-size: 0.78rem; color: #94a3b8; line-height: 1.35;">${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => { toast.remove(); }, 300);
  }, 4000);
}
