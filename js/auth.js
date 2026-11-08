/**
 * PetStory • Autenticação, Sessões, Route Guards & Redefinição de Senhas
 * Módulo: js/auth.js
 */

// ============================================================================
// GESTÃO DE SESSÃO DO VETERINÁRIO E AUTORIZAÇÃO CLÍNICA
// ============================================================================
function salvarSessaoVet(vet) {
  try {
    sessionStorage.setItem('petstory_vet_session', JSON.stringify({
      nome: vet?.nome || 'Dr. Ricardo Mendonça',
      crmv: vet?.crmv || '38412',
      uf: vet?.uf || 'SP',
      crmv_completo: `CRMV-${vet?.uf || 'SP'} ${vet?.crmv || '38412'}`,
      login_at: Date.now()
    }));
  } catch (e) {
    console.warn('Erro ao salvar sessão vet:', e);
  }
}

function obterSessaoVet() {
  try {
    const raw = sessionStorage.getItem('petstory_vet_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function encerrarSessaoVet() {
  sessionStorage.removeItem('petstory_vet_session');
  sessionStorage.removeItem('petstory_clinical_auth');
  showToast('Plantão Encerrado', 'Sessão do médico-veterinário finalizada. Retornando ao login.', 'fa-right-from-bracket', 'info');
  setTimeout(() => {
    switchScreen('login');
  }, 400);
}

function salvarAutorizacaoClinica(authData) {
  try {
    sessionStorage.setItem('petstory_clinical_auth', JSON.stringify({
      tag: authData.tag,
      nome: authData.nome || (typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(authData.tag) : authData.nome),
      timestamp: authData.timestamp || Date.now(),
      tipo: authData.tipo || 'OTP'
    }));
  } catch (e) {
    console.warn('Erro ao salvar autorização clínica:', e);
  }
}

function obterAutorizacaoClinica() {
  try {
    const raw = sessionStorage.getItem('petstory_clinical_auth');
    if (!raw) return null;
    const auth = JSON.parse(raw);
    // Validade estrita de 2 horas (7.200.000 ms)
    if (Date.now() - auth.timestamp > 7200000) {
      sessionStorage.removeItem('petstory_clinical_auth');
      return null;
    }
    return auth;
  } catch (e) {
    return null;
  }
}

function limparAutorizacaoClinica() {
  sessionStorage.removeItem('petstory_clinical_auth');
}

function finalizarAtendimentoClinico() {
  limparAutorizacaoClinica();
  showToast('Atendimento Finalizado', 'Sessão clínica do paciente encerrada. Retornando ao leitor.', 'fa-shield-halved', 'info');
  setTimeout(() => {
    switchScreen('vet-scan');
  }, 300);
}

// ============================================================================
// ROUTE GUARDS (BLINDAGEM RIGOROSA DE ACESSO)
// ============================================================================
function verificarPermissaoRota(screenKey) {
  // Rotas 100% públicas
  if (screenKey === 'login' || screenKey === 'cadastro' || screenKey === 'public-tag') {
    return { permitida: true };
  }

  // Rota restrita ao Tutor: #screen-tutor
  if (screenKey === 'tutor') {
    const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
    if (session && session.tutor && session.pet) {
      return { permitida: true };
    }
    return {
      permitida: false,
      redirecionarPara: 'login',
      titulo: 'Acesso Restrito ao Tutor',
      mensagem: 'Faça login com e-mail e senha de tutor para visualizar a central do seu pet.'
    };
  }

  // Rota restrita ao Médico-Veterinário: #screen-vet-scan (Leitor de Tags)
  if (screenKey === 'vet-scan') {
    const vet = obterSessaoVet();
    if (vet && vet.crmv) {
      return { permitida: true };
    }
    return {
      permitida: false,
      redirecionarPara: 'login',
      titulo: 'Acesso Restrito ao Veterinário',
      mensagem: 'Identifique-se com CRMV e senha na tela inicial para acessar o leitor clínico.'
    };
  }

  // Rota restrita ao Prontuário Médico: #screen-prontuario
  if (screenKey === 'prontuario') {
    const vet = obterSessaoVet();
    if (!vet || !vet.crmv) {
      return {
        permitida: false,
        redirecionarPara: 'login',
        titulo: 'Acesso Restrito',
        mensagem: 'O prontuário exige identificação prévia do médico-veterinário com CRMV.'
      };
    }
    const auth = obterAutorizacaoClinica();
    if (!auth || !auth.tag) {
      return {
        permitida: false,
        redirecionarPara: 'vet-scan',
        titulo: 'Autorização OTP Obrigatória',
        mensagem: 'É obrigatório informar a Tag e validar o código OTP do tutor antes de abrir o prontuário.'
      };
    }
    return { permitida: true };
  }

  return { permitida: true };
}

// ============================================================================
// GESTÃO DE SESSÃO DO TUTOR (SESSIONSTORAGE - PADRÃO DE SEGURANÇA BANCÁRIA)
// ============================================================================
function salvarSessao(tutor, pet, tagCode) {
  const sessionData = {
    tutor: tutor,
    pet: pet,
    tagCode: tagCode || pet?.tag,
    loginAt: Date.now()
  };
  sessionStorage.setItem('petstory_current_user', JSON.stringify(sessionData));
  try { localStorage.removeItem('petstory_current_user'); } catch (e) {}
}

function obterSessaoSalva() {
  const session = sessionStorage.getItem('petstory_current_user');
  if (session) {
    try {
      return JSON.parse(session);
    } catch (e) {
      return null;
    }
  }
  // Limpeza de resíduo legado do localStorage se houver
  try {
    const legacy = localStorage.getItem('petstory_current_user');
    if (legacy) {
      sessionStorage.setItem('petstory_current_user', legacy);
      localStorage.removeItem('petstory_current_user');
      return JSON.parse(legacy);
    }
  } catch (e) {}
  return null;
}

async function restaurarSessaoSalva() {
  const session = obterSessaoSalva();
  if (session && session.pet) {
    const petId = session.pet.id || (session.pet.tag === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
    if (petId) {
      try {
        const respPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        });
        if (respPet.ok) {
          const petsDb = await respPet.json();
          if (petsDb && petsDb.length > 0 && petsDb[0].foto_url) {
            session.pet.foto_url = petsDb[0].foto_url;
            sessionStorage.setItem('petstory_current_user', JSON.stringify(session));
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar foto na inicialização:', err);
      }
    }
  }
}

function encerrarSessaoTutor() {
  sessionStorage.removeItem('petstory_current_user');
  try { localStorage.removeItem('petstory_current_user'); } catch (e) {}
  if (window.pacienteAtualProntuario) {
    window.pacienteAtualProntuario = null;
  }
  showToast('Sessão Finalizada', 'Desconectado com sucesso. Retornando ao portal de login.', 'fa-right-from-bracket', 'info');
  setTimeout(() => {
    switchScreen('login');
  }, 400);
}

// ============================================================================
// NAVEGAÇÃO E CABEÇALHO
// ============================================================================
function initScreenNavigation() {
  window.addEventListener('hashchange', () => {
    handleInitialRoute();
  });
}

function switchScreen(screenKey) {
  // 1. Blindagem Rigorosa de Rotas (Route Guards)
  const permissao = verificarPermissaoRota(screenKey);
  if (!permissao.permitida) {
    showToast(permissao.titulo, permissao.mensagem, 'fa-shield-halved', 'warning');
    screenKey = permissao.redirecionarPara || 'login';
  }

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
  if (typeof updateSecretSwitcherActive === 'function') {
    updateSecretSwitcherActive(screenKey);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  updateHeaderContext(screenKey);

  // Sincronização automática de dados ao alternar telas
  if (screenKey === 'prontuario') {
    const auth = obterAutorizacaoClinica();
    if (auth && auth.tag) {
      if (typeof carregarProntuarioPaciente === 'function') carregarProntuarioPaciente(auth.tag);
    } else {
      const session = obterSessaoSalva();
      const tagToLoad = session?.pet?.tag || 'PST-9921';
      if (typeof carregarProntuarioPaciente === 'function') carregarProntuarioPaciente(tagToLoad);
    }
  } else if (screenKey === 'tutor') {
    const session = obterSessaoSalva();
    if (session && session.tutor && session.pet) {
      if (typeof renderTutorPortal === 'function') {
        renderTutorPortal(session.tutor, session.pet, session.pet.tag);
      }
    }
  } else if (screenKey === 'vet-scan') {
    if (typeof atualizarCredencialVetScanner === 'function') {
      atualizarCredencialVetScanner();
    }
  }
}

function handleInitialRoute() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash && SCREENS[hash]) {
    switchScreen(hash);
  } else {
    // Inicia diretamente na tela de login por padrão
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

  if (userPill) {
    if (screenKey === 'tutor') {
      const local = obterSessaoSalva();
      const nomeTutor = local?.tutor?.nome || 'Tutor(a)';
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

// ============================================================================
// SUBMISSÃO DE LOGIN (TUTOR E VETERINÁRIO)
// ============================================================================
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

    showToast('Autenticando...', `Verificando credenciais no Servidor Backend Java...`, 'fa-circle-notch fa-spin');

    // 1. Envia autenticação para o Servidor HTTP Java (porta 8080)
    try {
      const respJava = await fetch(`${BACKEND_URL}/api/auth/login-tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, senha: senhaDigitada })
      });

      const dataJava = await respJava.json().catch(() => ({}));

      if (respJava.ok && dataJava.sucesso) {
        const tutor = dataJava.tutor;
        const pet = dataJava.pet || {
          nome: 'Paciente',
          raca: 'SRD',
          peso: 10.0,
          tag: dataJava.tag || 'PST-1428',
          foto_url: DEFAULT_PET_PHOTO
        };
        const tagCode = dataJava.tag || pet.tag || 'PST-1428';

        salvarSessao(tutor, pet, tagCode);
        if (typeof renderTutorPortal === 'function') {
          renderTutorPortal(tutor, pet, tagCode);
        }
        showToast('Login Autorizado (Java)!', `Bem-vindo(a), ${tutor.nome}! Central de saúde carregada com segurança.`, 'fa-circle-check', 'success');
        setTimeout(() => { switchScreen('tutor'); }, 500);
        return;
      } else if (respJava.status === 401) {
        showToast('Senha Incorreta', dataJava.mensagem || 'A senha informada não confere com o cadastro deste tutor.', 'fa-circle-xmark', 'danger');
        passInput?.focus();
        return;
      } else if (respJava.status === 404 || (dataJava && dataJava.erro && dataJava.erro.includes('não localizado'))) {
        showToast('Usuário Não Encontrado', dataJava.mensagem || `Nenhum cadastro localizado para ${email}.`, 'fa-triangle-exclamation', 'warning');
        return;
      }
    } catch (errNet) {
      console.warn('[PetStory] Servidor Java offline em ' + BACKEND_URL + '. Utilizando contingência local:', errNet);
      showToast('Aviso: Backend Java', 'Servidor Java em localhost:8080 não detectado. Iniciando fallback de contingência.', 'fa-server', 'warning');
    }

    try {
      const respTutor = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tutores?email=eq.${encodeURIComponent(email)}`, {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });
      const tutores = await respTutor.json();

      let tutor = tutores && tutores.length > 0 ? tutores[0] : null;
      let pet = null;
      let tagCode = null;

      if (tutor) {
        const respPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?tutor_id=eq.${tutor.id}`, {
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        });
        const pets = await respPet.json();
        pet = pets && pets.length > 0 ? pets[0] : null;

        if (pet) {
          const respTag = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tags?pet_id=eq.${pet.id}`, {
            headers: {
              'apikey': SUPABASE_CONFIG.anonKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
            }
          });
          const tags = await respTag.json();
          tagCode = tags && tags.length > 0 ? tags[0].codigo : 'PST-1428';
        }
      } else {
        const local = obterSessaoSalva();
        if (local && local.tutor && local.tutor.email && local.tutor.email.toLowerCase() === email) {
          tutor = local.tutor;
          pet = local.pet;
          tagCode = local.pet?.tag || 'PST-1428';
        }
      }

      if (tutor && pet) {
        pet.tag = tagCode;
        if (!pet.foto_url) {
          pet.foto_url = DEFAULT_PET_PHOTO;
        }
        salvarSessao(tutor, pet, tagCode);
        if (typeof renderTutorPortal === 'function') {
          renderTutorPortal(tutor, pet, tagCode);
        }
        showToast('Login Efetuado!', `Bem-vindo(a), ${tutor.nome}! Central de saúde de ${pet.nome} carregada.`, 'fa-circle-check', 'success');
        setTimeout(() => { switchScreen('tutor'); }, 500);
        return;
      }

      showToast('Usuário Não Encontrado', `Nenhum cadastro localizado para ${email}.`, 'fa-triangle-exclamation', 'warning');

    } catch (err) {
      console.error('Erro na autenticação de contingência:', err);
      const local = obterSessaoSalva();
      if (local && local.tutor) {
        if (typeof renderTutorPortal === 'function') {
          renderTutorPortal(local.tutor, local.pet, local.pet?.tag);
        }
        showToast('Conectado', `Autenticado: ${local.tutor.nome}`, 'fa-shield-dog', 'info');
        switchScreen('tutor');
      } else {
        showToast('Erro de Conexão', 'Não foi possível contatar o serviço. Tente novamente.', 'fa-circle-exclamation', 'danger');
      }
    }

  } else {
    // Autenticação de Médico-Veterinário
    const crmvInput = document.getElementById('login-vet-crmv');
    const ufInput = document.getElementById('login-vet-uf');
    const passInput = document.getElementById('login-vet-pass');

    const crmv = crmvInput ? crmvInput.value.trim() : '38412';
    const uf = ufInput ? ufInput.value.trim() : 'SP';
    const senha = passInput ? passInput.value.trim() : '';

    if (!crmv) {
      showToast('CRMV Obrigatório', 'Informe o número do seu CRMV profissional.', 'fa-id-card', 'warning');
      crmvInput?.focus();
      return;
    }

    if (!senha) {
      showToast('Senha Obrigatória', 'Informe sua senha de acesso profissional.', 'fa-lock', 'warning');
      passInput?.focus();
      return;
    }

    showToast('Validando CRMV...', `Verificando credenciais no Servidor Backend Java...`, 'fa-circle-notch fa-spin');

    // 1. Tenta autenticação direta no Servidor HTTP Java (porta 8080)
    try {
      const respJava = await fetch(`${BACKEND_URL}/api/auth/login-vet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmv: crmv, uf: uf, senha: senha })
      });

      const dataJava = await respJava.json().catch(() => ({}));

      if (respJava.ok && dataJava.sucesso) {
        const vet = dataJava.veterinario || { nome: 'Dr. Ricardo Mendonça', crmv: crmv, uf: uf };
        salvarSessaoVet(vet);
        showToast('CRMV Validado no Java!', `${vet.nome} (${vet.crmv || crmv}) autenticado com sucesso.`, 'fa-stethoscope', 'success');
        setTimeout(() => { switchScreen('vet-scan'); }, 600);
        return;
      } else if (respJava.status === 401) {
        showToast('Senha Incorreta', dataJava.mensagem || 'Senha do médico-veterinário incorreta.', 'fa-circle-xmark', 'danger');
        passInput?.focus();
        return;
      } else if (respJava.status === 400 || respJava.status === 404) {
        showToast('CRMV Não Localizado', dataJava.mensagem || 'CRMV não encontrado no cadastro do Conselho.', 'fa-triangle-exclamation', 'warning');
        crmvInput?.focus();
        return;
      }
    } catch (errNet) {
      console.warn('[PetStory] Backend Java offline para login vet. Utilizando contingência:', errNet);
      showToast('Aviso: Backend Java', 'Servidor Java em localhost:8080 offline. Executando contingência.', 'fa-server', 'warning');
    }

    // 2. Fallback de contingência
    if (senha !== 'vet2026') {
      showToast('Senha Incorreta', 'Senha do médico-veterinário incorreta.', 'fa-circle-xmark', 'danger');
      passInput?.focus();
      return;
    }

    salvarSessaoVet({ nome: 'Dr. Ricardo Mendonça', crmv: crmv, uf: uf });
    showToast('CRMV Validado!', `Dr. Ricardo Mendonça (CRMV-${uf} ${crmv}) autenticado.`, 'fa-stethoscope', 'success');
    setTimeout(() => { switchScreen('vet-scan'); }, 600);
  }
}

// ============================================================================
// MODAL DE REDEFINIÇÃO DE SENHA COM DESAFIO DE IDENTIDADE
// ============================================================================
function abrirModalRedefinirSenha() {
  const modal = document.getElementById('modal-reset-pass-backdrop');
  if (!modal) return;
  const loginEmailInput = document.getElementById('login-tutor-email');
  const resetEmailInput = document.getElementById('reset-email');
  if (resetEmailInput && loginEmailInput && loginEmailInput.value.trim()) {
    resetEmailInput.value = loginEmailInput.value.trim();
  }
  const desafioInput = document.getElementById('reset-desafio');
  const novaSenhaInput = document.getElementById('reset-nova-senha');
  const confirmaSenhaInput = document.getElementById('reset-confirma-senha');
  if (desafioInput) desafioInput.value = '';
  if (novaSenhaInput) novaSenhaInput.value = '';
  if (confirmaSenhaInput) confirmaSenhaInput.value = '';

  modal.classList.add('open');
  if (resetEmailInput && !resetEmailInput.value) {
    resetEmailInput.focus();
  } else {
    desafioInput?.focus();
  }
}

function fecharModalRedefinirSenha() {
  const modal = document.getElementById('modal-reset-pass-backdrop');
  if (modal) modal.classList.remove('open');
}

async function handleRedefinirSenhaSubmit(event) {
  if (event) event.preventDefault();
  const email = document.getElementById('reset-email')?.value.trim().toLowerCase();
  const desafio = document.getElementById('reset-desafio')?.value.trim();
  const novaSenha = document.getElementById('reset-nova-senha')?.value;
  const confirmaSenha = document.getElementById('reset-confirma-senha')?.value;

  if (!email || !desafio || !novaSenha) {
    showToast('Campos Obrigatórios', 'Preencha todos os campos do formulário.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  if (novaSenha !== confirmaSenha) {
    showToast('Senhas Não Coincidem', 'A confirmação de senha deve ser idêntica à nova senha informada.', 'fa-circle-xmark', 'danger');
    document.getElementById('reset-confirma-senha')?.focus();
    return;
  }

  if (novaSenha.length < 4) {
    showToast('Senha Curta', 'A senha de acesso deve possuir ao menos 4 dígitos.', 'fa-lock', 'warning');
    document.getElementById('reset-nova-senha')?.focus();
    return;
  }

  showToast('Validando Identidade...', 'Consultando dados e criptografando senha no servidor Java...', 'fa-circle-notch fa-spin');

  try {
    const resp = await fetch(`${BACKEND_URL}/api/auth/redefinir-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        desafioIdentidade: desafio,
        novaSenha: novaSenha
      })
    });

    const data = await resp.json().catch(() => ({}));

    if (resp.ok && (data.sucesso || data.status === 'OK')) {
      const loginPassInput = document.getElementById('login-tutor-pass');
      if (loginPassInput) loginPassInput.value = novaSenha;
      fecharModalRedefinirSenha();
      showToast('Senha Atualizada!', 'Sua nova senha foi gravada com sucesso no Supabase. Você já pode entrar!', 'fa-shield-halved', 'success');
      return;
    } else if (resp.status === 401) {
      showToast('Desafio Incorreto', data.mensagem || data.erro || 'Dados de confirmação de identidade incorretos.', 'fa-circle-xmark', 'danger');
      document.getElementById('reset-desafio')?.focus();
      return;
    } else if (resp.status === 404) {
      showToast('E-mail Não Localizado', data.mensagem || data.erro || 'Nenhuma conta encontrada com este e-mail.', 'fa-triangle-exclamation', 'warning');
      document.getElementById('reset-email')?.focus();
      return;
    } else {
      showToast('Falha na Redefinição', data.mensagem || data.erro || 'Não foi possível redefinir a senha.', 'fa-triangle-exclamation', 'warning');
      return;
    }
  } catch (err) {
    console.warn('[PetStory] Backend offline para redefinir senha:', err);
    showToast('Falha de Comunicação', 'Servidor offline. Verifique a conexão com o backend.', 'fa-triangle-exclamation', 'warning');
  }
}

// Expõe no escopo global
window.salvarSessaoVet = salvarSessaoVet;
window.obterSessaoVet = obterSessaoVet;
window.encerrarSessaoVet = encerrarSessaoVet;
window.salvarAutorizacaoClinica = salvarAutorizacaoClinica;
window.obterAutorizacaoClinica = obterAutorizacaoClinica;
window.limparAutorizacaoClinica = limparAutorizacaoClinica;
window.finalizarAtendimentoClinico = finalizarAtendimentoClinico;
window.verificarPermissaoRota = verificarPermissaoRota;
window.salvarSessao = salvarSessao;
window.obterSessaoSalva = obterSessaoSalva;
window.restaurarSessaoSalva = restaurarSessaoSalva;
window.encerrarSessaoTutor = encerrarSessaoTutor;
window.initScreenNavigation = initScreenNavigation;
window.switchScreen = switchScreen;
window.handleInitialRoute = handleInitialRoute;
window.updateHeaderContext = updateHeaderContext;
window.toggleLoginRole = toggleLoginRole;
window.handleLoginSubmit = handleLoginSubmit;
window.abrirModalRedefinirSenha = abrirModalRedefinirSenha;
window.fecharModalRedefinirSenha = fecharModalRedefinirSenha;
window.handleRedefinirSenhaSubmit = handleRedefinirSenhaSubmit;
window.redefinirSenhaTutor = abrirModalRedefinirSenha; // Compatibilidade retroativa
