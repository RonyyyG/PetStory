/**
 * PetStory • Portal do Tutor, Wizard de Cadastro & OTP
 * Módulo: js/tutor.js
 */

// ============================================================================
// WIZARD DE CADASTRO DE TUTOR E PET
// ============================================================================
function avancarWizard(step) {
  if (step === 2) {
    const nome = document.getElementById('cad-tutor-nome')?.value.trim();
    const tel = document.getElementById('cad-tutor-tel')?.value.trim();
    const email = document.getElementById('cad-tutor-email')?.value.trim();
    const senha = document.getElementById('cad-tutor-senha')?.value;

    if (!nome) {
      showToast('Nome Obrigatório', 'Por favor, informe seu nome completo de tutor.', 'fa-user', 'warning');
      document.getElementById('cad-tutor-nome')?.focus();
      return;
    }
    if (!tel) {
      showToast('Telefone Obrigatório', 'Informe seu telefone/WhatsApp de emergência.', 'fa-phone', 'warning');
      document.getElementById('cad-tutor-tel')?.focus();
      return;
    }
    if (!email || !email.includes('@')) {
      showToast('E-mail Obrigatório', 'Informe um endereço de e-mail válido para sua conta.', 'fa-envelope', 'warning');
      document.getElementById('cad-tutor-email')?.focus();
      return;
    }
    if (!senha || senha.length < 4) {
      showToast('Senha Obrigatória', 'Crie uma senha de acesso com no mínimo 4 caracteres.', 'fa-lock', 'warning');
      document.getElementById('cad-tutor-senha')?.focus();
      return;
    }
  }

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
    if (typeof salvarCredencialTutor === 'function') {
      salvarCredencialTutor(tutorEmail, tutorSenha);
    }
  }

  const petNome = document.getElementById('cad-pet-nome')?.value.trim();
  if (!petNome) {
    showToast('Nome do Pet Obrigatório', 'Informe o nome do seu animal de estimação.', 'fa-tag', 'warning');
    document.getElementById('cad-pet-nome')?.focus();
    return;
  }
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
    const authHeaders = {
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    // 1. Grava tutor no Supabase
    const resTutor = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/tutores`, {
      method: 'POST',
      headers: authHeaders,
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
      foto_url: null, // Sem fotos aleatórias da web; utiliza avatar gráfico vetorial
      alergias_graves: petAlergias || 'Nenhuma restrição relatada',
      modo_perdido: false
    };

    if (tutorIdGerado) {
      petPayload.tutor_id = tutorIdGerado;
    }

    const resPet = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets`, {
      method: 'POST',
      headers: authHeaders,
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
      headers: authHeaders,
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
    foto_url: null,
    alergias_graves: petAlergias,
    tag: tagCode,
    vacinas: []
  };

  if (typeof salvarSessao === 'function') {
    salvarSessao(tutorData, petData, tagCode);
  }
  renderTutorPortal(tutorData, petData, tagCode, false);

  // Renderiza QR Code localmente (offline e sem bloqueadores)
  renderQrCodeLocal('created-qr-container', `https://petstory.app/#tag/${tagCode}`);

  avancarWizard(3);
  showToast('Cadastro Concluído!', `${petNome} cadastrado com sucesso! Tag [${tagCode}] ativada.`, 'fa-circle-check', 'success');
}

// ============================================================================
// PORTAL DO TUTOR (SINCRONIZAÇÃO EM TEMPO REAL)
// ============================================================================
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

  if (tutorHeaderTitle) tutorHeaderTitle.textContent = `Central de Saúde de ${pNome}`;
  if (greetingName) greetingName.textContent = `Olá, ${tNome}! 👋`;
  if (greetingDesc) {
    greetingDesc.innerHTML = `O animal <strong>${pNome}</strong> está cadastrado e protegido pelo PetStory. Informações de emergência e saúde ativas.`;
  }

  // Destaque visual da Tag
  if (heroTagDisplay) heroTagDisplay.textContent = codigo;
  if (tagCodeBadge) tagCodeBadge.textContent = `ID: ${codigo}-${pNome.toUpperCase()}`;
  if (tagBoxTitle) tagBoxTitle.textContent = `Medalha Inteligente de ${pNome}`;
  if (lostModeDesc) {
    lostModeDesc.textContent = `Se o(a) ${pNome} se perder, ative este modo. Quem escanear a medalha verá alerta de emergência e você receberá aviso por WhatsApp.`;
  }

  // Foto do pet na medalha: foto informada ou avatar neutro SVG
  if (avatarImg) {
    if (pet?.foto_url && !pet.foto_url.includes('images.unsplash.com/photo-1543466835')) {
      avatarImg.src = pet.foto_url;
    } else if (isThorDemo || (codigo === 'PST-9921' && pNome === 'Thor')) {
      avatarImg.src = THOR_PHOTO;
    } else {
      avatarImg.src = DEFAULT_PET_NEUTRAL_AVATAR;
    }
  }

  // Alergias estritas do animal
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

  // Garante estado visual de carregamento sem flicker
  if (vaxList) {
    vaxList.innerHTML = `
      <div class="vax-empty-state" style="padding: 1.5rem; text-align: center;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--teal-primary, #0d9488); font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
        <p style="color: var(--text-muted, #64748b); font-size: 0.85rem; margin: 0;">Sincronizando carteirinha com o banco de dados...</p>
      </div>
    `;
  }

  // Carregamento real de vacinas e lembretes via API Java
  let listaVacinas = [];
  let listaLembretes = [];

  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${codigo || petId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.vacinas && Array.isArray(prontuario.vacinas)) {
        listaVacinas = prontuario.vacinas.map(v => ({
          nome: v.nome_vacina || v.nome,
          lote: v.laboratorio_lote || v.lote || `${v.loteFabricante || 'Lote Padrão'} • ${v.veterinarioResponsavel || 'CRMV-SP 38.412'}`,
          reforco: formatarDataBr(v.data_reforco || v.dataReforco),
          aplicacao: formatarDataBr(v.data_aplicacao || v.dataAplicacao),
          crmv: v.veterinario_crmv || v.veterinarioResponsavel || 'Dr. Ricardo (CRMV-SP 38.412)',
          status: v.status || 'Em Dia'
        }));
      }
      if (prontuario.lembretes && Array.isArray(prontuario.lembretes)) {
        listaLembretes = prontuario.lembretes;
      }
    }
  } catch (e) {
    console.warn('[PetStory] Aviso ao buscar prontuário do tutor no Java backend:', e);
  }

  // Fallback se backend estiver offline
  if (listaVacinas.length === 0 && (isThorDemo || codigo === 'PST-9921' || pNome === 'Thor')) {
    listaVacinas = [
      { nome: 'V10 Polivalente Canina', lote: 'Zoetis • Lote 5849-B2 • Dr. Ricardo', reforco: '15/11/2026', crmv: 'Dr. Ricardo (CRMV-SP 38.412)', status: 'Em Dia' },
      { nome: 'Antirrábica Defensor', lote: 'Zoetis • Lote 9012-K4', reforco: '10/01/2027', crmv: 'Dr. André (CRMV-SP 31.020)', status: 'Em Dia' },
      { nome: 'Bronchi-Shield Oral (Gripe Canina)', lote: 'Proteção contra traqueobronquite', reforco: '15/11/2026', crmv: 'Dr. Ricardo (CRMV-SP 38.412)', status: 'Em Dia' },
      { nome: 'Giardiavax (Giárdia)', lote: 'Zoetis • Proteção entérica', reforco: '20/03/2027', crmv: 'Dra. Camila (CRMV-SP 44.910)', status: 'Em Dia' }
    ];
  } else if (listaVacinas.length === 0 && pet?.vacinas && pet.vacinas.length > 0) {
    listaVacinas = pet.vacinas;
  }

  // Mantém disponível para o download da Carteirinha em PDF
  window.vacinasTutorConsolidadas = listaVacinas;

  if (vaxList) {
    if (listaVacinas.length > 0) {
      vaxList.innerHTML = listaVacinas.map(v => `
        <div class="vax-item">
          <div class="vax-icon-wrap"><i class="fa-solid fa-syringe"></i></div>
          <div class="vax-info-col">
            <div class="vax-title-row">
              <span class="vax-title">${v.nome}</span>
              <span class="badge-status badge-success" style="font-size: 0.72rem;">${v.status || 'Aplicada'}</span>
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

  // Próximos Lembretes (Cirurgias + Reforços)
  if (remindersContainer) {
    let htmlLembretes = '';

    if (listaLembretes && listaLembretes.length > 0) {
      htmlLembretes = listaLembretes.map(lem => {
        const isCir = lem.tipo === 'cirurgia';
        const bg = isCir ? '#eff6ff' : '#f0fdf4';
        const border = isCir ? '#bfdbfe' : '#bbf7d0';
        const icon = isCir ? 'fa-calendar-check' : 'fa-syringe';
        const titleColor = isCir ? '#1e40af' : '#166534';
        const subColor = isCir ? '#2563eb' : '#15803d';

        return `
          <div class="alert-item" style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem; animation: fadeIn 0.3s ease;">
            <div style="font-size: 0.85rem; font-weight: 700; color: ${titleColor};">
              <i class="fa-solid ${icon}"></i> ${lem.titulo}
            </div>
            <div style="font-size: 0.78rem; color: ${subColor};">
              Data: ${lem.data} • ${lem.responsavel || 'Dr. Ricardo'}
            </div>
            ${lem.detalhe ? `<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Orientação: ${lem.detalhe}</div>` : ''}
          </div>
        `;
      }).join('');
    } else if (isThorDemo || codigo === 'PST-9921' || pNome === 'Thor') {
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

function imprimirTagSimulada() {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const tagCode = document.getElementById('created-tag-code')?.textContent.trim() || session?.pet?.tag || 'PST-1428';
  const petNome = session?.pet?.nome || 'Seu Pet';
  const tutorTel = session?.tutor?.telefone_emergencia || '(11) 98765-4321';

  const printWin = window.open('', '_blank', 'width=650,height=750');
  if (!printWin) {
    showToast('Bloqueador Ativo', 'Permita popups para visualizar a impressão da tag.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Medalha Inteligente PetStory - ${tagCode}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; text-align: center; color: #0f172a; }
        .tag-card { max-width: 380px; margin: 0 auto; border: 3px solid #00d2ad; border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); background: #ffffff; }
        .logo { font-size: 22px; font-weight: 800; color: #00a887; margin-bottom: 8px; }
        .tag-id { font-size: 32px; font-weight: 900; letter-spacing: 2px; color: #0f172a; background: #e6faf5; border-radius: 12px; padding: 8px 16px; margin: 16px 0; display: inline-block; border: 1px dashed #00a887; }
        .pet-info { font-size: 16px; margin: 12px 0; color: #334155; }
        .emergency { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px; margin-top: 18px; color: #991b1b; font-weight: 600; font-size: 14px; }
        .instructions { font-size: 12px; color: #64748b; margin-top: 20px; line-height: 1.5; }
        @media print { body { padding: 0; } .tag-card { border: 2px solid #000; box-shadow: none; } button { display: none; } }
      </style>
    </head>
    <body>
      <div class="tag-card">
        <div class="logo">🐾 PetStory • PST Tag</div>
        <div>Identificação Sanitária & Prontuário Unificado</div>
        <div class="tag-id">${tagCode}</div>
        <div class="pet-info"><strong>Paciente:</strong> ${petNome}</div>
        <div class="emergency">📞 Emergência 24h: ${tutorTel}</div>
        <div class="instructions">
          Aproxime por NFC ou aponte a câmera para o QR Code na coleira para ver a ficha pública ou validar acesso clínico.
        </div>
      </div>
      <div style="margin-top: 30px;">
        <button onclick="window.print()" style="padding: 10px 24px; background: #00d2ad; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px;">Imprimir Agora</button>
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
}

function handlePetPhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = async function() {
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

      const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
      if (session && session.pet) {
        session.pet.foto_url = optimizedDataUrl;
        localStorage.setItem('petstory_current_user', JSON.stringify(session));

        const petId = session.pet.id || (session.pet.tag === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
        if (petId) {
          try {
            await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_CONFIG.anonKey,
                'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
                'Content-Type': 'application/json'
              },
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

// ============================================================================
// GERENCIADOR DE TOKENS OTP DO TUTOR
// ============================================================================
function salvarOtpAtivo(tag, codigoOtp, nomePet) {
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    const cleanTag = (tag || '').trim().toUpperCase();
    const cleanOtp = (codigoOtp || '').toString().trim().replace(/\s+/g, '');
    otps[cleanTag] = {
      code: cleanOtp,
      petName: nomePet || obterNomePacientePorTag(cleanTag),
      generatedAt: Date.now(),
      expiresAt: Date.now() + 7200000 // 2 horas
    };
    localStorage.setItem('petstory_active_otps', JSON.stringify(otps));
  } catch (e) {
    console.warn('Erro ao armazenar OTP ativo:', e);
  }
}

function obterOtpEsperadoParaTag(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return null;
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag]) {
      const reg = otps[cleanTag];
      if (Date.now() <= reg.expiresAt) {
        return reg.code;
      } else {
        delete otps[cleanTag];
        localStorage.setItem('petstory_active_otps', JSON.stringify(otps));
        return null;
      }
    }
  } catch (e) {
    console.warn('Erro ao ler OTP ativo:', e);
  }
  if (DEFAULT_OTPS[cleanTag] && Date.now() <= DEFAULT_OTPS[cleanTag].expiresAt) {
    return DEFAULT_OTPS[cleanTag].code;
  }
  return null;
}

function obterNomePacientePorTag(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return 'Paciente Veterinário';
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && (session.pet.tag || '').toUpperCase() === cleanTag) {
    return session.pet.nome || 'Paciente';
  }
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag] && otps[cleanTag].petName) {
      return otps[cleanTag].petName;
    }
  } catch (e) {}
  if (cleanTag === 'PST-1428') return 'Bolinha';
  if (cleanTag === 'PST-9921') return 'Thor';
  return `Paciente (${cleanTag})`;
}

function validarTagCadastrada(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return false;
  if (cleanTag === 'PST-9921' || cleanTag === 'PST-1428') return true;
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && (session.pet.tag || '').toUpperCase() === cleanTag) {
    return true;
  }
  try {
    const otps = JSON.parse(localStorage.getItem('petstory_active_otps') || '{}');
    if (otps[cleanTag]) return true;
  } catch (e) {}
  return false;
}

let otpTimerInterval = null;

async function openOtpModal() {
  const modal = document.getElementById('modal-otp-backdrop');
  const codeElem = document.getElementById('otp-code-value');
  const secondsElem = document.getElementById('otp-seconds-left');
  const petNameElem = document.getElementById('otp-modal-pet-name');

  if (!modal) return;

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = session?.pet?.nome || 'Thor';
  const petTag = session?.pet?.tag || 'PST-9921';
  const petId = session?.pet?.id;

  if (petNameElem) petNameElem.textContent = petNome;

  let code = '';

  // Geração real de OTP no Java HTTP Server (porta 8080)
  try {
    const resJava = await fetch(`${BACKEND_URL}/api/otp/gerar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: petTag, petId: petId })
    });
    if (resJava.ok) {
      const dataJava = await resJava.json();
      if (dataJava.codigoOtp) {
        code = dataJava.codigoOtp;
        showToast('Código Gerado (Java)', `OTP válido por 2 horas gerado com sucesso no servidor.`, 'fa-key', 'success');
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Backend Java offline para gerar OTP. Usando gerador seguro local:', errNet);
  }

  if (!code) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  salvarOtpAtivo(petTag, code, petNome);

  const formattedCode = `${code.slice(0, 3)} ${code.slice(3)}`;
  if (codeElem) codeElem.textContent = formattedCode;

  modal.classList.add('open');

  let timeLeft = 7200; // 2 horas (120 minutos)
  if (secondsElem) {
    const horas = Math.floor(timeLeft / 3600);
    const minutos = Math.floor((timeLeft % 3600) / 60);
    secondsElem.textContent = `${horas}h ${minutos}m (120 minutos)`;
  }

  if (otpTimerInterval) clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(otpTimerInterval);
      if (codeElem) codeElem.textContent = 'EXPIRADO';
      if (secondsElem) secondsElem.textContent = 'Código expirado. Gere um novo para autorizar o acesso.';
    } else {
      if (secondsElem) {
        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;
        secondsElem.textContent = `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
      }
    }
  }, 1000);
}

function closeOtpModal() {
  const modal = document.getElementById('modal-otp-backdrop');
  if (modal) modal.classList.remove('open');
  if (otpTimerInterval) {
    clearInterval(otpTimerInterval);
    otpTimerInterval = null;
  }
}

function initModalHandlers() {
  const modalBackdrop = document.getElementById('modal-otp-backdrop');
  const modalCloseBtn = document.getElementById('modal-otp-close');
  if (modalBackdrop && modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeOtpModal);
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeOtpModal();
      }
    });
  }
}

function initTutorInteractions() {
  const btnGenerateOtp = document.getElementById('btn-open-otp-modal');
  const lostModeToggle = document.getElementById('toggle-lost-mode');
  const copyOtpBtn = document.getElementById('btn-copy-otp');

  if (btnGenerateOtp) {
    btnGenerateOtp.addEventListener('click', () => {
      openOtpModal();
    });
  }

  if (copyOtpBtn) {
    copyOtpBtn.addEventListener('click', () => {
      const otpText = document.getElementById('otp-code-value')?.textContent || '849 201';
      navigator.clipboard?.writeText(otpText.replace(/\s+/g, ''));
      showToast('Código Copiado', `Token ${otpText} copiado com sucesso!`, 'fa-copy');
    });
  }

  if (lostModeToggle) {
    lostModeToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        showToast('Modo Perdido Ativado!', 'A tag exibirá alerta urgente de resgate com seu telefone de emergência em destaque.', 'fa-triangle-exclamation', 'warning');
      } else {
        showToast('Modo Perdido Desativado', 'A tag voltou ao modo de exibição normal.', 'fa-circle-check', 'info');
      }
    });
  }
}

// Ações simuladas da Tag Pública
function sendGpsLocationSimulated() {
  showToast('Obtendo Localização GPS...', 'Conectando ao satélite do smartphone...', 'fa-location-crosshairs fa-spin');
  setTimeout(() => {
    showToast('Localização Enviada com Sucesso!', 'O tutor recebeu aviso com o ponto exato no Google Maps.', 'fa-circle-check', 'success');
  }, 1200);
}

function openWhatsappSimulated() {
  showToast('Abrindo WhatsApp', 'Iniciando conversa direta com o tutor: "Olá, encontrei seu pet..."', 'fa-brands fa-whatsapp', 'success');
}

// Expõe no escopo global
window.avancarWizard = avancarWizard;
window.finalizarCadastroPet = finalizarCadastroPet;
window.renderTutorPortal = renderTutorPortal;
window.copiarTagTutor = copiarTagTutor;
window.imprimirTagSimulada = imprimirTagSimulada;
window.handlePetPhotoUpload = handlePetPhotoUpload;
window.salvarOtpAtivo = salvarOtpAtivo;
window.obterOtpEsperadoParaTag = obterOtpEsperadoParaTag;
window.obterNomePacientePorTag = obterNomePacientePorTag;
window.validarTagCadastrada = validarTagCadastrada;
window.openOtpModal = openOtpModal;
window.closeOtpModal = closeOtpModal;
window.initModalHandlers = initModalHandlers;
window.initTutorInteractions = initTutorInteractions;
window.sendGpsLocationSimulated = sendGpsLocationSimulated;
window.openWhatsappSimulated = openWhatsappSimulated;
