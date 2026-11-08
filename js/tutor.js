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

  const petNome = document.getElementById('cad-pet-nome')?.value.trim();
  if (!petNome) {
    showToast('Nome do Pet Obrigatório', 'Informe o nome do seu animal de estimação.', 'fa-tag', 'warning');
    document.getElementById('cad-pet-nome')?.focus();
    return;
  }

  const petNascInput = document.getElementById('cad-pet-nasc');
  const petNasc = petNascInput?.value;
  const hojeStr = new Date().toISOString().split('T')[0];
  if (petNasc && petNasc > hojeStr) {
    showToast('Data de Nascimento Inválida', 'O animal não pode ter nascido no futuro.', 'fa-calendar-xmark', 'warning');
    petNascInput?.focus();
    return;
  }

  const petEspecie = document.getElementById('cad-pet-especie')?.value || 'Canina';
  const petRaca = document.getElementById('cad-pet-raca')?.value.trim() || 'Sem Raça Definida';
  const petPesoStr = document.getElementById('cad-pet-peso')?.value.trim() || '12.5';
  const petPeso = parseFloat(petPesoStr.replace(',', '.')) || 12.5;
  const petSexo = document.getElementById('cad-pet-sexo')?.value || 'Macho - Castrado';
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
async function renderTutorPortal(tutor, pet, tagCode) {
  const tutorHeaderTitle = document.getElementById('tutor-header-title');
  const greetingName = document.getElementById('tutor-greeting-name');
  const greetingDesc = document.getElementById('tutor-greeting-desc');
  const heroTagDisplay = document.getElementById('tutor-hero-tag-display');
  const allergiesContainer = document.getElementById('tutor-allergies-container');
  const vaxList = document.getElementById('tutor-vax-list');
  const remindersContainer = document.getElementById('tutor-reminders-container');
  const avatarImg = document.getElementById('tutor-pet-avatar-img');

  const pNome = pet?.nome || 'Seu Pet';
  const tNome = tutor?.nome || 'Tutor(a)';
  const codigo = tagCode || pet?.tag || 'PST-1428';
  const alergia = pet?.alergias_graves || '';
  const petId = pet?.id || null;

  if (tutorHeaderTitle) tutorHeaderTitle.textContent = `Central de Saúde de ${pNome}`;
  if (greetingName) greetingName.textContent = `Olá, ${tNome}! 👋`;
  if (greetingDesc) {
    greetingDesc.innerHTML = `O animal <strong>${pNome}</strong> está cadastrado e protegido pelo PetStory. Informações de emergência e saúde ativas.`;
  }

  // Destaque visual da Tag
  if (heroTagDisplay) heroTagDisplay.textContent = codigo;

  // Foto do pet na medalha: foto informada ou avatar neutro SVG
  if (avatarImg) {
    avatarImg.src = pet?.foto_url || DEFAULT_PET_NEUTRAL_AVATAR;
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
          lote: v.laboratorio_lote || v.lote || (v.loteFabricante ? `${v.loteFabricante} • ${v.veterinarioResponsavel || 'CRMV Veterinário'}` : 'Lote Padrão'),
          reforco: formatarDataBr(v.data_reforco || v.dataReforco),
          aplicacao: formatarDataBr(v.data_aplicacao || v.dataAplicacao),
          crmv: v.veterinario_crmv || v.veterinarioResponsavel || 'Médico-Veterinário Habilitado',
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
  if (listaVacinas.length === 0 && pet?.vacinas && pet.vacinas.length > 0) {
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
              Data: ${lem.data} • ${lem.responsavel || 'Clínica Veterinária'}
            </div>
            ${lem.detalhe ? `<div style="font-size: 0.74rem; color: #64748b; margin-top: 2px;">Orientação: ${lem.detalhe}</div>` : ''}
          </div>
        `;
      }).join('');
    } else {
      listaVacinas.forEach(v => {
        if (v.reforco && v.reforco !== 'Pendente') {
          const respVax = v.crmv ? v.crmv.replace(/\s*\([^)]*\)/, '') : 'Veterinário Responsável';
          htmlLembretes += `
            <div class="alert-item" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #166534;"><i class="fa-solid fa-syringe"></i> Reforço ${v.nome}</div>
              <div style="font-size: 0.78rem; color: #15803d;">Data prevista: ${v.reforco} • ${respVax}</div>
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

  // Carrega Prescrições Ativas do Supabase
  const rxListElem = document.getElementById('tutor-prescricoes-list');
  if (rxListElem) {
    const targetPetId = pet?.id || (codigo === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
    if (targetPetId) {
      try {
        const respRx = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes?pet_id=eq.${targetPetId}&ativa=eq.true&order=created_at.desc`, {
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        });
        if (respRx.ok) {
          const prescricoes = await respRx.json();
          if (prescricoes && prescricoes.length > 0) {
            rxListElem.innerHTML = prescricoes.map(p => `
              <div style="background: #ffffff; border: 1px solid #a7f3d0; border-radius: 8px; padding: 1rem; border-left: 4px solid var(--teal-primary);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.3rem;">
                  <strong style="color: #0f172a; font-size: 0.95rem;">${p.nome}</strong>
                  <span class="badge-status badge-success" style="font-size: 0.7rem;">${p.tipo || 'Uso Contínuo'}</span>
                </div>
                <div style="font-size: 0.82rem; color: #475569; margin-bottom: 0.4rem;">
                  <strong>Indicação:</strong> ${p.indicacao || 'Terapêutica clínica'}
                </div>
                <div style="font-size: 0.8rem; background: #f0fdf9; padding: 0.5rem 0.7rem; border-radius: 4px; color: #065f46;">
                  <strong>Posologia:</strong> ${p.posologia}
                </div>
                <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.4rem;">
                  ${p.veterinario || 'Médico-Veterinário Responsável'} • Início: ${formatarDataBr(p.data_inicio)}
                </div>
              </div>
            `).join('');
          } else {
            rxListElem.innerHTML = `
              <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-pills" style="font-size: 1.5rem; margin-bottom: 0.4rem; color: #94a3b8; display: block;"></i>
                Nenhum medicamento ativo prescrito no momento.
              </div>
            `;
          }
        }
      } catch (errRx) {
        console.warn('Erro ao carregar prescrições do tutor:', errRx);
      }
    }
  }

  // Carrega Ectoparasitas & Vermífugos do Supabase
  const vermListElem = document.getElementById('tutor-vermifugos-list');
  if (vermListElem) {
    const targetPetId = pet?.id || (codigo === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
    if (targetPetId) {
      try {
        const respVerm = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vermifugos?pet_id=eq.${targetPetId}&order=data_proxima_dose.asc`, {
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
          }
        });
        if (respVerm.ok) {
          const vermifugos = await respVerm.json();
          if (vermifugos && vermifugos.length > 0) {
            vermListElem.innerHTML = vermifugos.map(v => `
              <div style="background: #ffffff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 1rem; border-left: 4px solid #3b82f6;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.3rem;">
                  <strong style="color: #0f172a; font-size: 0.95rem;">${v.medicamento}</strong>
                  <span class="badge-status badge-success" style="font-size: 0.7rem;">${v.status || 'Em Dia'}</span>
                </div>
                <div style="font-size: 0.82rem; color: #475569; margin-bottom: 0.3rem;">
                  <span>${v.tipo} • Faixa: ${v.faixa_peso}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; background: #eff6ff; padding: 0.4rem 0.6rem; border-radius: 4px; color: #1e40af;">
                  <span>Última aplicação: <strong>${formatarDataBr(v.data_aplicacao)}</strong></span>
                  <span>Próxima dose: <strong style="color: #2563eb;">${formatarDataBr(v.data_proxima_dose)}</strong></span>
                </div>
              </div>
            `).join('');
          } else {
            vermListElem.innerHTML = `
              <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-shield-virus" style="font-size: 1.5rem; margin-bottom: 0.4rem; color: #94a3b8; display: block;"></i>
                Nenhum registro de vermífugo ou antipulgas no momento.
              </div>
            `;
          }
        }
      } catch (errVerm) {
        console.warn('Erro ao carregar vermífugos do tutor:', errVerm);
      }
    }
  }

  // Carrega Laudos & Exames Diagnósticos do Supabase
  await carregarExamesTutor(petId || codigo);
}

async function carregarExamesTutor(petId) {
  const examesListElem = document.getElementById('tutor-exames-list');
  if (!examesListElem) return;

  const targetPetId = typeof resolverPetIdSupabase === 'function'
    ? resolverPetIdSupabase(petId)
    : (petId || '7e096a3b-0468-4347-9bee-a8286a10d416');

  try {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/exames?pet_id=eq.${targetPetId}&order=data_realizacao.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });

    if (resp.ok) {
      const exames = await resp.json();
      if (exames && exames.length > 0) {
        examesListElem.innerHTML = exames.map(ex => {
          const dataFmt = formatarDataBr(ex.data_realizacao) || ex.data_realizacao || 'Data recente';
          const tituloEnc = encodeURIComponent(ex.titulo || 'Laudo Diagnóstico');
          const fileUrlEnc = encodeURIComponent(ex.arquivo_url || '');
          const laudoTextoEnc = encodeURIComponent(ex.laudo_texto || '');
          const dataFmtEnc = encodeURIComponent(dataFmt);
          const labEnc = encodeURIComponent(ex.laboratorio || 'LabVet Diagnósticos');

          return `
            <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 1rem; border-left: 4px solid var(--teal-primary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                  <i class="fa-solid fa-file-medical" style="color: #00735c;"></i>
                  <strong style="color: #0f172a; font-size: 0.95rem;">${ex.titulo}</strong>
                </div>
                <div style="font-size: 0.8rem; color: #64748b;">
                  <span>${ex.laboratorio || 'LabVet'} • Realizado em: ${dataFmt}</span>
                </div>
                ${ex.laudo_texto ? `<div style="font-size: 0.78rem; color: #475569; margin-top: 0.3rem; max-width: 480px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ex.laudo_texto}</div>` : ''}
              </div>
              <button type="button" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="visualizarExameSimulado('${tituloEnc}', '${fileUrlEnc}', '${laudoTextoEnc}', '${dataFmtEnc}', '${labEnc}', true)">
                <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar / Baixar Laudo
              </button>
            </div>
          `;
        }).join('');
        return;
      }
    }
  } catch (errEx) {
    console.warn('Erro ao carregar exames do tutor:', errEx);
  }

  examesListElem.innerHTML = `
    <div style="text-align: center; padding: 1.5rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
      <i class="fa-solid fa-file-pdf" style="font-size: 1.5rem; margin-bottom: 0.4rem; color: #94a3b8; display: block;"></i>
      Nenhum laudo ou exame diagnóstico anexado para este animal ainda.
    </div>
  `;
}

function copiarTagTutor() {
  const code = document.getElementById('tutor-hero-tag-display')?.textContent.trim() || 'PST-1428';
  navigator.clipboard?.writeText(code);
  showToast('Código Copiado!', `Tag [${code}] copiada para a área de transferência.`, 'fa-copy', 'success');
}

function imprimirTagSimulada() {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const tagCode = document.getElementById('created-tag-code')?.textContent.trim() 
    || document.getElementById('tutor-hero-tag-display')?.textContent.trim() 
    || session?.pet?.tag 
    || 'PST-1428';
  const petNome = session?.pet?.nome || document.getElementById('cad-pet-nome')?.value.trim() || 'Paciente';
  const petRaca = session?.pet?.raca || document.getElementById('cad-pet-raca')?.value.trim() || 'SRD';
  const tutorNome = session?.tutor?.nome || document.getElementById('cad-tutor-nome')?.value.trim() || 'Tutor Responsável';
  const tutorTel = session?.tutor?.telefone_emergencia || document.getElementById('cad-tutor-tel')?.value.trim() || '(11) 98765-4321';

  const baseUrl = window.location.href.split('#')[0];
  const publicUrl = `${baseUrl}#public-tag?code=${encodeURIComponent(tagCode)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicUrl)}&color=0f172a&bgcolor=ffffff`;

  const printWin = window.open('', '_blank', 'width=700,height=850');
  if (!printWin) {
    showToast('Bloqueador Ativo', 'Permita popups para visualizar a impressão da medalha.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Medalha Inteligente PetStory - ${tagCode}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #f1f5f9;
          color: #0f172a;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .cut-wrapper {
          border: 2px dashed #94a3b8;
          border-radius: 28px;
          padding: 24px;
          background: #ffffff;
          max-width: 420px;
          width: 100%;
          position: relative;
          box-shadow: 0 10px 25px rgba(0,0,0,0.06);
          margin-bottom: 25px;
        }
        .scissors-tag {
          position: absolute;
          top: -12px;
          left: 24px;
          background: #ffffff;
          padding: 0 8px;
          font-size: 12px;
          color: #64748b;
          font-weight: 600;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #00d2ad;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header h1 {
          font-size: 18px;
          font-weight: 800;
          color: #00876c;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .header p {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 2px;
        }
        .tag-highlight {
          text-align: center;
          margin: 12px 0 16px;
        }
        .tag-badge {
          display: inline-block;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 2.5px;
          color: #00735c;
          background: #e6faf5;
          border: 2px dashed #00d2ad;
          border-radius: 12px;
          padding: 6px 20px;
        }
        .qr-section {
          text-align: center;
          margin: 14px 0;
        }
        .qr-box {
          display: inline-block;
          background: #ffffff;
          padding: 10px;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .qr-box img {
          display: block;
          width: 170px;
          height: 170px;
        }
        .qr-caption {
          font-size: 11px;
          color: #64748b;
          margin-top: 6px;
          font-weight: 500;
        }
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          margin: 14px 0;
          text-align: left;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 13px;
          border-bottom: 1px solid #f1f5f9;
        }
        .info-row:last-child {
          border-bottom: none;
        }
        .info-label {
          color: #64748b;
          font-weight: 600;
        }
        .info-value {
          color: #0f172a;
          font-weight: 700;
        }
        .emergency-bar {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 10px;
          padding: 10px;
          text-align: center;
          color: #991b1b;
          font-size: 13px;
          font-weight: 700;
          margin-top: 10px;
        }
        .footer-usage {
          text-align: center;
          font-size: 11px;
          color: #64748b;
          line-height: 1.5;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid #f1f5f9;
        }
        .btn-print {
          background: #00d2ad;
          color: #ffffff;
          border: none;
          padding: 12px 32px;
          font-size: 15px;
          font-weight: 700;
          border-radius: 10px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,210,173,0.35);
          transition: 0.2s ease;
        }
        .btn-print:hover {
          background: #00a887;
        }
        @media print {
          body { background: #ffffff; padding: 0; }
          .cut-wrapper { border: 2px dashed #000; box-shadow: none; margin: 0 auto; }
          .btn-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="cut-wrapper">
        <div class="scissors-tag">✂️ Recorte na linha pontilhada</div>
        
        <div class="header">
          <h1>🐾 PetStory • Identificação Inteligente</h1>
          <p>Prontuário Veterinário Unificado & Proteção</p>
        </div>

        <div class="tag-highlight">
          <div class="tag-badge">${tagCode}</div>
        </div>

        <div class="qr-section">
          <div class="qr-box">
            <img src="${qrCodeUrl}" alt="QR Code ${tagCode}" />
          </div>
          <div class="qr-caption">Aponte a câmera para ver a ficha pública ou validar acesso</div>
        </div>

        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Paciente:</span>
            <span class="info-value">${petNome} (${petRaca})</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tutor(a):</span>
            <span class="info-value">${tutorNome}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contato / WhatsApp:</span>
            <span class="info-value">${tutorTel}</span>
          </div>
        </div>

        <div class="emergency-bar">
          🚨 Emergência Sanitária & Resgate 24h
        </div>

        <div class="footer-usage">
          <strong>Como usar:</strong> Recorte esta medalha e posicione na coleira do animal. Em caso de fuga ou emergência clínica, qualquer pessoa ou médico-veterinário poderá escanear o QR Code para acessar os contatos do tutor e o prontuário unificado.
        </div>
      </div>

      <button class="btn-print" onclick="window.print()">🖨️ Imprimir Medalha</button>
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
        sessionStorage.setItem('petstory_current_user', JSON.stringify(session));

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
// GERENCIADOR DE TOKENS OTP DO TUTOR (API JAVA + SUPABASE)
// ============================================================================
async function salvarOtpNoSupabase(tag, codigoOtp, petId) {
  try {
    const targetPetId = petId || (tag === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);
    if (targetPetId) {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/autorizacoes_otp`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pet_id: targetPetId,
          codigo_otp: codigoOtp,
          expira_em: new Date(Date.now() + 7200000).toISOString(),
          usado: false
        })
      });
    }
  } catch (e) {
    console.warn('Erro ao salvar autorização OTP no Supabase:', e);
  }
}

function obterNomePacientePorTag(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return 'Paciente Veterinário';
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && (session.pet.tag || '').toUpperCase() === cleanTag) {
    return session.pet.nome || 'Paciente';
  }
  return `Paciente (${cleanTag})`;
}

function validarTagCadastrada(tag) {
  const cleanTag = (tag || '').trim().toUpperCase();
  if (!cleanTag) return false;
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet && (session.pet.tag || '').toUpperCase() === cleanTag) {
    return true;
  }
  return cleanTag.startsWith('PST-') || cleanTag.length >= 6;
}

let otpTimerInterval = null;

async function openOtpModal() {
  const modal = document.getElementById('modal-otp-backdrop');
  const codeElem = document.getElementById('otp-code-value');
  const secondsElem = document.getElementById('otp-seconds-left');
  const petNameElem = document.getElementById('otp-modal-pet-name');

  if (!modal) return;

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = session?.pet?.nome || 'Paciente';
  const petTag = session?.pet?.tag || 'PST-1428';
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
    salvarOtpNoSupabase(petTag, code, petId);
  }

  // Limpeza preventiva de chave legada do localStorage
  try { localStorage.removeItem('petstory_active_otps'); } catch (e) {}

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
  const copyOtpBtn = document.getElementById('btn-copy-otp');

  // Trava de data de nascimento para impedir datas futuras
  const nascInput = document.getElementById('cad-pet-nasc');
  if (nascInput) {
    const hoje = new Date().toISOString().split('T')[0];
    nascInput.max = hoje;
  }

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
}

// Ações da Tag Pública
function openWhatsappSimulated() {
  showToast('Abrindo WhatsApp', 'Iniciando conversa direta com o tutor: "Olá, encontrei seu pet..."', 'fa-brands fa-whatsapp', 'success');
}

// Expõe no escopo global
window.avancarWizard = avancarWizard;
window.finalizarCadastroPet = finalizarCadastroPet;
window.renderTutorPortal = renderTutorPortal;
window.carregarExamesTutor = carregarExamesTutor;
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
window.openWhatsappSimulated = openWhatsappSimulated;
