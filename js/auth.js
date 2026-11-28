/**
 * PetStory • Autenticação, Sessões, Route Guards & Redefinição de Senhas
 * Módulo: js/auth.js
 */

// ============================================================================
// GESTÃO DE SESSÃO DO VETERINÁRIO E AUTORIZAÇÃO CLÍNICA
// ============================================================================
function salvarSessaoVet(vet) {
  try {
    const crmvRaw = vet?.crmv || '';
    const crmvFormatado = crmvRaw ? (crmvRaw.toUpperCase().startsWith('CRMV') ? crmvRaw : `CRMV-${vet?.uf || 'SP'} ${crmvRaw}`) : 'CRMV Ativo';
    sessionStorage.setItem('petstory_vet_session', JSON.stringify({
      id: vet?.id || null,
      nome: vet?.nome || 'Médico-Veterinário',
      crmv: crmvRaw,
      uf: vet?.uf || 'SP',
      clinica: vet?.clinica || 'Centro Clínico Veterinário',
      especialidade: vet?.especialidade || 'Clínica Geral',
      email: vet?.email || '',
      crmv_completo: crmvFormatado,
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
  if (typeof pararLeitorCamera === 'function') {
    pararLeitorCamera();
  }
  sessionStorage.removeItem('petstory_vet_session');
  sessionStorage.removeItem('petstory_clinical_auth');
  showToast('Plantão Encerrado', 'Sessão do médico-veterinário finalizada. Retornando ao login.', 'fa-right-from-bracket', 'info');
  setTimeout(() => {
    switchScreen('login');
  }, 400);
}

// ============================================================================
// GESTÃO DE SESSÃO DO ADMINISTRADOR
// ============================================================================
function salvarSessaoAdmin(adminData) {
  try {
    sessionStorage.setItem('petstory_admin_session', JSON.stringify({
      usuario: adminData?.usuario || 'admin',
      nome: 'Administrador do Sistema',
      perfil: 'ADMIN',
      ativo: true,
      login_at: Date.now()
    }));
  } catch (e) {
    console.warn('Erro ao salvar sessão admin:', e);
  }
}

function obterSessaoAdmin() {
  try {
    const raw = sessionStorage.getItem('petstory_admin_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function encerrarSessaoAdmin() {
  sessionStorage.removeItem('petstory_admin_session');
  showToast('Sessão Encerrada', 'Administrador desconectado com sucesso. Retornando ao login.', 'fa-right-from-bracket', 'info');
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

  // Rota restrita ao Administrador: #screen-admin e #screen-animais
  if (screenKey === 'admin' || screenKey === 'animais') {
    const admin = obterSessaoAdmin();
    if (admin && admin.ativo) {
      return { permitida: true };
    }
    return {
      permitida: false,
      redirecionarPara: 'login',
      titulo: 'Acesso Restrito ao Administrador',
      mensagem: 'Faça login com a conta de Administrador para acessar a gestão do corpo clínico.'
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

// Sessão do tutor (salva no sessionStorage só enquanto a aba estiver aberta)
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
  if (typeof pararLeitorCamera === 'function') {
    pararLeitorCamera();
  }
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

function switchScreen(screenKey, routeParams) {
  // Desliga preventivamente o leitor de câmera ao alternar de tela
  if (typeof pararLeitorCamera === 'function') {
    pararLeitorCamera();
  }

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

  let finalHash = `#${screenKey}`;
  if (screenKey === 'public-tag') {
    if (routeParams?.tagCode) {
      finalHash = `#public-tag?code=${encodeURIComponent(routeParams.tagCode)}`;
    } else if (window.location.hash.includes('public-tag?')) {
      finalHash = window.location.hash;
    }
  }
  window.history.replaceState(null, '', finalHash);

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
  } else if (screenKey === 'admin') {
    if (typeof carregarVeterinariosAdmin === 'function') {
      carregarVeterinariosAdmin();
    }
  } else if (screenKey === 'animais') {
    if (typeof carregarAnimaisRegistrados === 'function') {
      carregarAnimaisRegistrados();
    }
  } else if (screenKey === 'public-tag') {
    let tagCodeUrl = routeParams?.tagCode || null;
    if (!tagCodeUrl && window.location.hash.includes('?')) {
      const qs = window.location.hash.split('?')[1];
      const sp = new URLSearchParams(qs);
      tagCodeUrl = sp.get('code') || sp.get('tag');
    }
    if (typeof carregarTagPublica === 'function') {
      carregarTagPublica(tagCodeUrl);
    }
  }
}

function handleInitialRoute() {
  const rawHash = window.location.hash.replace('#', '').trim();
  if (!rawHash) {
    switchScreen('login');
    return;
  }

  let screenKey = rawHash;
  let tagCodeParam = null;

  if (rawHash.includes('?')) {
    const [base, qs] = rawHash.split('?');
    screenKey = base.replace(/^\/+|\/+$/g, '');
    const params = new URLSearchParams(qs);
    tagCodeParam = params.get('code') || params.get('tag');
  } else if (/^tag\/([^/?#]+)/i.test(rawHash)) {
    const m = rawHash.match(/^tag\/([^/?#]+)/i);
    screenKey = 'public-tag';
    tagCodeParam = m ? decodeURIComponent(m[1]).trim() : null;
  } else if (/^public-tag\/([^/?#]+)/i.test(rawHash)) {
    const m = rawHash.match(/^public-tag\/([^/?#]+)/i);
    screenKey = 'public-tag';
    tagCodeParam = m ? decodeURIComponent(m[1]).trim() : null;
  }

  if (screenKey && SCREENS[screenKey]) {
    switchScreen(screenKey, tagCodeParam ? { tagCode: tagCodeParam } : undefined);
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
    } else if (screenKey === 'admin' || screenKey === 'animais') {
      statusBadge.innerHTML = `<span class="status-dot" style="background:#8b5cf6; box-shadow:0 0 8px #8b5cf6;"></span> Painel Administrativo`;
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
    } else if (screenKey === 'admin' || screenKey === 'animais') {
      userPill.innerHTML = `
        <div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(139, 92, 246, 0.2); color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; margin-right: 6px;">
          <i class="fa-solid fa-user-shield"></i>
        </div>
        <span>Administrador</span>
      `;
      userPill.title = "Painel Administrativo";
    } else if (screenKey === 'public-tag') {
      userPill.innerHTML = `
        <i class="fa-solid fa-tag" style="color: #d97706; margin-right: 6px;"></i>
        <span>Consulta Pública</span>
      `;
      userPill.title = "Identificação Pública de Coleira";
    } else if (screenKey === 'login' || screenKey === 'cadastro') {
      userPill.innerHTML = `
        <i class="fa-solid fa-lock" style="color: var(--teal-primary); margin-right: 6px;"></i>
        <span>Acesso Seguro</span>
      `;
      userPill.title = "Acesso Seguro PetStory";
    } else {
      const vet = obterSessaoVet();
      const nomeVet = vet?.nome || 'Médico-Veterinário';
      const crmvVet = vet?.crmv_completo || (vet?.crmv ? `CRMV-${vet.uf || 'SP'} ${vet.crmv}` : 'CRMV Ativo');
      userPill.innerHTML = `
        <div style="width: 24px; height: 24px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; margin-right: 6px;">
          <i class="fa-solid fa-user-doctor"></i>
        </div>
        <span>${nomeVet} (${crmvVet})</span>
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

    // Detecção de login do Administrador
    if ((email === 'admin' || email === 'admin@petstory.app') && (senhaDigitada === 'admin' || senhaDigitada === 'admin123')) {
      salvarSessaoAdmin({ usuario: email });
      showToast('Acesso Administrativo', 'Bem-vindo(a), Administrador! Painel de gestão do corpo clínico liberado.', 'fa-user-shield', 'success');
      setTimeout(() => { switchScreen('admin'); }, 500);
      return;
    }

    if (!email) {
      showToast('E-mail Obrigatório', 'Informe o seu e-mail de acesso.', 'fa-envelope', 'warning');
      emailInput?.focus();
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('E-mail Inválido', 'Informe um endereço de e-mail válido (ex: nome@dominio.com).', 'fa-envelope', 'warning');
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
        showToast('Login Autorizado!', `Bem-vindo(a), ${tutor.nome}! Central de saúde carregada com segurança.`, 'fa-circle-check', 'success');
        setTimeout(() => { switchScreen('tutor'); }, 500);
        return;
      } else if (respJava.status === 401) {
        showToast('Senha Incorreta', dataJava.mensagem || 'A senha informada não confere com o cadastro deste tutor.', 'fa-circle-xmark', 'danger');
        passInput?.focus();
        return;
      } else if (respJava.status === 404 || (dataJava && dataJava.erro && dataJava.erro.includes('não localizado'))) {
        showToast('Usuário Não Encontrado', dataJava.mensagem || `Nenhum cadastro localizado para ${email}.`, 'fa-triangle-exclamation', 'warning');
        return;
      } else {
        showToast('Falha no Login', dataJava.mensagem || 'Não foi possível autenticar no servidor.', 'fa-circle-xmark', 'danger');
        return;
      }
    } catch (errNet) {
      console.error('[PetStory] Servidor Java offline em ' + BACKEND_URL + ':', errNet);
      showToast('Servidor Offline', 'Não foi possível conectar ao servidor Java (localhost:8080). Inicie o backend e tente novamente.', 'fa-server', 'danger');
    }

  } else {
    // Autenticação Estrita Cruzada de Médico-Veterinário (E-mail + CRMV + UF + Senha)
    const emailInput = document.getElementById('login-vet-email');
    const crmvInput = document.getElementById('login-vet-crmv');
    const ufInput = document.getElementById('login-vet-uf');
    const passInput = document.getElementById('login-vet-pass');

    const emailRaw = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const crmvRaw = crmvInput ? crmvInput.value.trim() : '';
    const uf = ufInput ? ufInput.value.trim().substring(0, 2).toUpperCase() : 'SP';
    const senha = passInput ? passInput.value.trim() : '';

    // Detecção de login do Administrador também na aba de veterinário
    if ((crmvRaw.toLowerCase() === 'admin' || crmvRaw.toLowerCase() === 'admin@petstory.app'
      || emailRaw === 'admin' || emailRaw === 'admin@petstory.app')
      && (senha === 'admin' || senha === 'admin123')) {
      salvarSessaoAdmin({ usuario: emailRaw === 'admin' || emailRaw === 'admin@petstory.app' ? emailRaw : crmvRaw });
      showToast('Acesso Administrativo', 'Bem-vindo(a), Administrador! Painel de gestão do corpo clínico liberado.', 'fa-user-shield', 'success');
      setTimeout(() => { switchScreen('admin'); }, 500);
      return;
    }

    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      showToast('E-mail Profissional Obrigatório', 'Informe um endereço de e-mail profissional válido.', 'fa-envelope', 'warning');
      emailInput?.focus();
      return;
    }

    const crmvDigits = crmvRaw.replace(/\D/g, '');
    if (!crmvRaw || !crmvDigits) {
      showToast('CRMV Obrigatório', 'Informe o número numérico do seu CRMV.', 'fa-id-card', 'warning');
      crmvInput?.focus();
      return;
    }

    if (!uf) {
      showToast('UF Obrigatória', 'Selecione o estado (UF) do seu Conselho Regional.', 'fa-location-dot', 'warning');
      ufInput?.focus();
      return;
    }

    if (!senha) {
      showToast('Senha Obrigatória', 'Informe sua senha de acesso profissional.', 'fa-lock', 'warning');
      passInput?.focus();
      return;
    }

    showToast('Validando Credenciais...', 'Conferindo E-mail, CRMV, UF e Senha no Servidor Backend Java...', 'fa-circle-notch fa-spin');

    // 1. Tenta autenticação direta no Servidor HTTP Java (porta 8080)
    try {
      const payloadVet = {
        email: emailRaw,
        crmv: crmvRaw,
        uf: uf,
        senha: senha
      };

      const respJava = await fetch(`${BACKEND_URL}/api/auth/login-vet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadVet)
      });

      const dataJava = await respJava.json().catch(() => ({}));

      if (respJava.ok && dataJava.sucesso) {
        const vet = dataJava.veterinario;
        salvarSessaoVet(vet);
        showToast('CRMV Validado no Java!', `${vet.nome} (${vet.crmv || crmvRaw}) autenticado com sucesso.`, 'fa-stethoscope', 'success');
        setTimeout(() => { switchScreen('vet-scan'); }, 600);
        return;
      } else if (respJava.status === 401) {
        const msg = dataJava.mensagem || 'Credenciais do médico-veterinário inválidas.';
        const msgLower = msg.toLowerCase();
        let tituloErro = 'Senha Incorreta';
        let iconeErro = 'fa-circle-xmark';
        if (msgLower.includes('inativa') || msgLower.includes('suspens') || msgLower.includes('desativad')) {
          tituloErro = 'Credencial Inativa';
          iconeErro = 'fa-ban';
        } else if (msgLower.includes('e-mail') || msgLower.includes('email')) {
          tituloErro = 'E-mail Incompatível';
          iconeErro = 'fa-envelope';
        } else if (msgLower.includes('uf') || msgLower.includes('estado')) {
          tituloErro = 'UF Incompatível';
          iconeErro = 'fa-location-dot';
        } else if (msgLower.includes('crmv') && msgLower.includes('incompat')) {
          tituloErro = 'CRMV Incompatível';
          iconeErro = 'fa-id-card';
        } else if (msgLower.includes('nenhum cadastro') || msgLower.includes('não localizado')) {
          tituloErro = 'CRMV Não Localizado';
          iconeErro = 'fa-triangle-exclamation';
        }
        showToast(tituloErro, msg, iconeErro, 'danger');
        if (tituloErro === 'Senha Incorreta') passInput?.focus();
        else if (tituloErro === 'E-mail Incompatível') emailInput?.focus();
        else if (tituloErro === 'UF Incompatível') ufInput?.focus();
        else if (tituloErro === 'CRMV Incompatível') crmvInput?.focus();
        return;
      } else if (respJava.status === 400 || respJava.status === 404) {
        showToast('Dados Incompletos', dataJava.mensagem || 'Verifique E-mail, CRMV, UF e Senha informados.', 'fa-triangle-exclamation', 'warning');
        crmvInput?.focus();
        return;
      } else {
        showToast('Falha no Login', dataJava.mensagem || 'Não foi possível validar as credenciais no servidor.', 'fa-circle-xmark', 'danger');
        return;
      }
    } catch (errNet) {
      console.error('[PetStory] Backend Java offline para login vet:', errNet);
      showToast('Servidor Offline', 'Não foi possível conectar ao servidor Java (localhost:8080). Inicie o backend e tente novamente.', 'fa-server', 'danger');
    }
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

// ============================================================================
// MÓDULO ADMINISTRATIVO (GESTÃO DO CORPO CLÍNICO)
// ============================================================================
async function carregarVeterinariosAdmin() {
  const container = document.getElementById('admin-vets-list');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--teal-primary);"></i>
      <p style="margin-top: 0.5rem; font-size: 0.85rem;">Carregando corpo clínico do banco de dados...</p>
    </div>
  `;

  let vets = [];
  let erroConexao = false;

  // Carrega do Servidor HTTP Java
  try {
    const resp = await fetch(`${BACKEND_URL}/api/admin/veterinarios`);
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.veterinarios && Array.isArray(data.veterinarios)) {
        vets = data.veterinarios;
      }
    } else {
      erroConexao = true;
    }
  } catch (errNet) {
    console.error('[Admin] Backend Java offline para listagem de veterinários:', errNet);
    erroConexao = true;
  }

  if (erroConexao) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #b91c1c; background: #fef2f2; border-radius: 8px; border: 1px dashed #fca5a5;">
        <i class="fa-solid fa-server" style="font-size: 1.6rem; display: block; margin-bottom: 0.4rem;"></i>
        Servidor Java offline (localhost:8080). Inicie o backend para gerenciar o corpo clínico.
      </div>
    `;
    return;
  }

  if (!vets || vets.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
        <i class="fa-solid fa-user-slash" style="font-size: 1.6rem; color: #94a3b8; display: block; margin-bottom: 0.4rem;"></i>
        Nenhum médico-veterinário cadastrado até o momento.
      </div>
    `;
    return;
  }

  container.innerHTML = vets.map(v => {
    const nome = v.nome || 'Médico-Veterinário';
    const crmv = v.crmv || 'CRMV Não Informado';
    const clinica = v.clinica || 'Hospital Veterinário PetStory';
    const especialidade = v.especialidade || 'Clínico Geral';
    const email = v.email || 'Não informado';
    const ativo = v.ativo !== false;
    const nomeEscapado = nome.replace(/'/g, "\\'");

    return `
      <div style="background: ${ativo ? '#ffffff' : '#f8fafc'}; border: 1px solid ${ativo ? 'var(--border-glass)' : '#cbd5e1'}; border-radius: 12px; padding: 1.1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: all 0.2s ease;">
        <div style="display: flex; align-items: center; gap: 0.9rem; flex: 1; min-width: 0;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: ${ativo ? '#e0f2fe' : '#f1f5f9'}; color: ${ativo ? '#0284c7' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; border: 2px solid ${ativo ? '#bae6fd' : '#e2e8f0'};">
            <i class="fa-solid fa-user-doctor"></i>
          </div>
          <div style="min-width: 0;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h4 style="font-size: 0.96rem; margin: 0; color: ${ativo ? '#0f172a' : '#64748b'}; font-weight: 700;">${nome}</h4>
              <span class="badge-status ${ativo ? 'badge-success' : 'badge-danger'}" style="font-size: 0.68rem; padding: 0.15rem 0.5rem;">
                <i class="fa-solid ${ativo ? 'fa-circle-check' : 'fa-circle-pause'}"></i> ${ativo ? '🟢 Ativo • Credencial Habilitada' : '🔴 Inativo • Acesso Suspenso'}
              </span>
            </div>
            <p style="font-size: 0.8rem; color: ${ativo ? '#0284c7' : '#64748b'}; font-weight: 600; margin: 2px 0 0;">
              ${crmv} • <span style="color: var(--text-secondary); font-weight: 400;">${especialidade}</span>
            </p>
            <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px; display: flex; gap: 0.8rem; flex-wrap: wrap;">
              <span><i class="fa-solid fa-hospital"></i> ${clinica}</span>
              <span><i class="fa-solid fa-envelope"></i> ${email}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
          ${ativo ? `
            <button type="button" class="btn-secondary" style="font-size: 0.75rem; padding: 0.35rem 0.7rem; border-color: #cbd5e1; color: #475569;" title="Suspender credencial clínica" onclick="alternarStatusVeterinarioAdmin('${v.id}', false)">
              <i class="fa-solid fa-pause"></i> Desativar
            </button>
          ` : `
            <button type="button" class="btn-primary" style="font-size: 0.75rem; padding: 0.35rem 0.7rem; background: #059669; border-color: #059669;" title="Reativar credencial clínica" onclick="alternarStatusVeterinarioAdmin('${v.id}', true)">
              <i class="fa-solid fa-play"></i> Reativar
            </button>
          `}
          <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.35rem 0.6rem; color: #dc2626; border-color: #fca5a5;" title="Remover profissional" onclick="excluirVeterinarioAdmin('${v.id}', '${nomeEscapado}')">
            <i class="fa-solid fa-trash-can"></i> Excluir
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function salvarNovoVeterinarioAdmin(e) {
  if (e && e.preventDefault) e.preventDefault();

  const nomeInput = document.getElementById('admin-vet-nome');
  const crmvInput = document.getElementById('admin-vet-crmv');
  const ufInput = document.getElementById('admin-vet-uf');
  const clinicaInput = document.getElementById('admin-vet-clinica');
  const especInput = document.getElementById('admin-vet-especialidade');
  const emailInput = document.getElementById('admin-vet-email');
  const senhaInput = document.getElementById('admin-vet-senha');
  const btnSubmit = document.getElementById('btn-salvar-vet-admin');

  const nome = (nomeInput?.value || '').trim();
  const crmvRaw = (crmvInput?.value || '').trim();
  const uf = (ufInput?.value || 'SP').trim().toUpperCase();
  const clinica = (clinicaInput?.value || 'Hospital Veterinário PetStory').trim();
  const especialidade = (especInput?.value || 'Clínico Geral & Cirurgião').trim();
  const email = (emailInput?.value || '').trim().toLowerCase();
  const senha = (senhaInput?.value || '').trim();

  if (!nome || !crmvRaw || !email || !senha) {
    showToast('Campos Obrigatórios', 'Preencha o nome, CRMV, e-mail e senha inicial do profissional.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  if (senha.length < 4) {
    showToast('Senha Curta', 'A senha de acesso inicial deve conter no mínimo 4 caracteres.', 'fa-lock', 'warning');
    senhaInput?.focus();
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Salvando Credencial...';
  }

  showToast('Gravando...', 'Cadastrando novo médico-veterinário e gerando credencial segura...', 'fa-circle-notch fa-spin');

  // Formata o CRMV
  let crmvFormatado = crmvRaw;
  if (!crmvFormatado.toUpperCase().startsWith('CRMV-')) {
    crmvFormatado = `CRMV-${uf} ${crmvRaw}`;
  }

  let gravadoComSucesso = false;
  let mensagemErro = 'Não foi possível cadastrar o veterinário no momento. Verifique se o servidor Java está ativo.';

  // Envia exclusivamente para o Servidor Java
  try {
    const respJava = await fetch(`${BACKEND_URL}/api/admin/veterinarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: nome,
        crmv: crmvFormatado,
        uf: uf,
        clinica: clinica,
        especialidade: especialidade,
        email: email,
        senha: senha,
        ativo: true
      })
    });

    if (respJava.ok) {
      gravadoComSucesso = true;
    } else {
      const errData = await respJava.json().catch(() => ({}));
      if (errData?.mensagem) mensagemErro = errData.mensagem;
    }
  } catch (errNet) {
    console.error('[Admin] Backend Java offline ao cadastrar veterinário:', errNet);
    mensagemErro = 'Servidor Java offline (localhost:8080). Inicie o backend e tente novamente.';
  }

  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i> Salvar e Ativar Credencial Médica';
  }

  if (gravadoComSucesso) {
    showToast('Veterinário Cadastrado!', `${nome} (${crmvFormatado}) agora possui acesso clínico ativo ao PetStory.`, 'fa-circle-check', 'success');
    document.getElementById('form-cad-vet-admin')?.reset();
    carregarVeterinariosAdmin();
  } else {
    showToast('Falha no Cadastro', mensagemErro, 'fa-circle-xmark', 'danger');
  }
}

async function alternarStatusVeterinarioAdmin(id, novoStatus) {
  if (!id) return;

  const acaoTexto = novoStatus ? 'reativar' : 'desativar';
  let sucesso = false;

  // Atualiza via Backend Java (PATCH /api/admin/veterinarios/{id})
  try {
    const respJava = await fetch(`${BACKEND_URL}/api/admin/veterinarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, ativo: novoStatus })
    });
    if (respJava.ok) {
      sucesso = true;
    }
  } catch (errNet) {
    console.error(`[Admin] Backend Java offline ao ${acaoTexto} veterinário:`, errNet);
  }

  if (sucesso) {
    if (novoStatus) {
      showToast('Credencial Reativada!', 'O médico-veterinário agora possui acesso clínico ativo ao sistema.', 'fa-circle-check', 'success');
    } else {
      showToast('Acesso Suspenso!', 'A credencial do médico-veterinário foi desativada temporariamente.', 'fa-circle-pause', 'warning');
    }
    carregarVeterinariosAdmin();
  } else {
    showToast('Falha na Operação', `Não foi possível ${acaoTexto} o veterinário no momento. Tente novamente.`, 'fa-circle-xmark', 'danger');
  }
}

async function excluirVeterinarioAdmin(id, nome) {
  if (!id) return;

  const nomeExibicao = nome || 'o médico-veterinário';
  if (!confirm(`Deseja realmente remover o cadastro de Dr(a). ${nomeExibicao} do sistema? Esta ação é irreversível.`)) {
    return;
  }

  let sucesso = false;

  // Exclui via Backend Java (DELETE /api/admin/veterinarios/{id})
  try {
    const respJava = await fetch(`${BACKEND_URL}/api/admin/veterinarios/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    if (respJava.ok) {
      sucesso = true;
    }
  } catch (errNet) {
    console.error('[Admin] Backend Java offline ao excluir veterinário:', errNet);
  }

  if (sucesso) {
    showToast('Cadastro Removido!', `O cadastro de Dr(a). ${nomeExibicao} foi removido com sucesso.`, 'fa-trash-can', 'info');
    carregarVeterinariosAdmin();
  } else {
    showToast('Falha na Exclusão', 'Não foi possível excluir o cadastro no momento. Tente novamente.', 'fa-circle-xmark', 'danger');
  }
}

// Expõe no escopo global
window.salvarSessaoVet = salvarSessaoVet;
window.obterSessaoVet = obterSessaoVet;
window.encerrarSessaoVet = encerrarSessaoVet;
window.salvarSessaoAdmin = salvarSessaoAdmin;
window.obterSessaoAdmin = obterSessaoAdmin;
window.encerrarSessaoAdmin = encerrarSessaoAdmin;
window.carregarVeterinariosAdmin = carregarVeterinariosAdmin;
window.salvarNovoVeterinarioAdmin = salvarNovoVeterinarioAdmin;
window.alternarStatusVeterinarioAdmin = alternarStatusVeterinarioAdmin;
window.excluirVeterinarioAdmin = excluirVeterinarioAdmin;
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
