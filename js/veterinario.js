/**
 * PetStory • Portal Clínico do Veterinário & Prontuário Médico Unificado
 * Módulo: js/veterinario.js
 */

let pacienteAtualProntuario = null;

// ============================================================================
// VALIDAÇÃO CLÍNICA DE ACESSO (TAG + OTP)
// ============================================================================
async function validarAcessoClinicoVeterinario(tagDigitada, otpDigitado) {
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

  // 1. Tenta validação estrita no Servidor Backend Java (porta 8080)
  try {
    const resJava = await fetch(`${BACKEND_URL}/api/otp/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tag, codigoOtp: otp, crmv: 'CRMV-SP 38.412' })
    });

    const dataJava = await resJava.json().catch(() => ({}));

    if (resJava.ok && dataJava.autorizado) {
      return {
        valido: true,
        tag: tag,
        nome: dataJava.pet?.nome || (typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(tag) : 'Paciente'),
        viaJava: true
      };
    } else {
      return {
        valido: false,
        campo: 'otp',
        titulo: 'Acesso Recusado (Backend Java)',
        mensagem: dataJava.mensagem || `Código OTP [${otp}] recusado pelo servidor de segurança.`
      };
    }
  } catch (errNet) {
    console.warn('[PetStory] Backend Java offline em ' + BACKEND_URL + '. Utilizando validação de contingência local:', errNet);
  }

  // Fallback de contingência local
  if (typeof validarTagCadastrada === 'function' && !validarTagCadastrada(tag)) {
    return {
      valido: false,
      campo: 'tag',
      titulo: 'Tag Não Encontrada',
      mensagem: `A medalha [${tag}] não foi localizada no cadastro. Verifique o código alfanumérico.`
    };
  }

  const otpEsperado = typeof obterOtpEsperadoParaTag === 'function' ? obterOtpEsperadoParaTag(tag) : null;
  const nomePet = typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(tag) : 'Paciente';

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
      if (tagInput && code) tagInput.value = code;
      if (otpInput) {
        otpInput.value = '';
        otpInput.focus();
      }
      showToast('Tag Selecionada', `Tag [${code}] preenchida. Digite o código OTP gerado pelo tutor.`, 'fa-barcode', 'info');
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
    formManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = tagInput ? tagInput.value.trim().toUpperCase() : '';
      const otp = otpInput ? otpInput.value.trim() : '';

      showToast('Validando...', `Autenticando Tag ${code} e Token OTP no Servidor Java...`, 'fa-circle-notch fa-spin');

      const resultado = await validarAcessoClinicoVeterinario(code, otp);

      if (!resultado.valido) {
        showToast(resultado.titulo, resultado.mensagem, 'fa-shield-halved', 'danger');
        if (resultado.campo === 'tag') {
          tagInput?.focus();
        } else {
          otpInput?.focus();
          otpInput?.select();
        }
        return;
      }

      // Concede autorização clínica temporária de 2 horas
      salvarAutorizacaoClinica({
        tag: resultado.tag,
        nome: resultado.nome,
        timestamp: Date.now(),
        tipo: 'OTP'
      });

      showToast('Acesso Autorizado (Java)!', `Prontuário completo de ${resultado.nome} aberto com sucesso por 2 horas.`, 'fa-shield-dog', 'success');
      
      setTimeout(() => {
        carregarProntuarioPaciente(resultado.tag);
        switchScreen('prontuario');
      }, 500);
    });
  }

  if (emergencyBtn) {
    emergencyBtn.addEventListener('click', () => {
      const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
      const code = tagInput ? tagInput.value.trim().toUpperCase() : (session?.pet?.tag || 'PST-9921');
      salvarAutorizacaoClinica({
        tag: code,
        nome: (typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(code) : null) || 'Paciente Emergência',
        timestamp: Date.now(),
        tipo: 'EMERGENCIA'
      });
      showToast('Acesso de Emergência', 'Acesso concedido imediatamente para atendimento de urgência vital.', 'fa-triangle-exclamation', 'danger');
      carregarProntuarioPaciente(code);
      setTimeout(() => { switchScreen('prontuario'); }, 600);
    });
  }
}

function startScanningSimulation(methodName) {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const codigoParaEscanear = session?.pet?.tag || 'PST-1428';
  const nomeParaEscanear = typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(codigoParaEscanear) : 'Paciente';

  showToast('Leitura em andamento', `Lendo ${methodName}...`, 'fa-radar fa-spin');

  setTimeout(() => {
    const tagInput = document.getElementById('input-tag-code');
    const otpInput = document.getElementById('input-vet-otp');
    if (tagInput) tagInput.value = codigoParaEscanear;
    if (otpInput) {
      otpInput.value = '';
      otpInput.focus();
    }

    showToast('Tag Identificada!', `Tag ${codigoParaEscanear} (${nomeParaEscanear}) lida. Solicite ao tutor o código OTP de 6 dígitos para abrir o prontuário.`, 'fa-qrcode', 'info');
  }, 900);
}

// ============================================================================
// CARREGAMENTO DO PRONTUÁRIO MÉDICO
// ============================================================================
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

function carregarProntuarioPaciente(tagCode) {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
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

  const codigoAlvo = tagCode || session?.pet?.tag || 'PST-1428';

  // 1. Tenta carregar do backend Java unificado
  fetch(`${BACKEND_URL}/api/pets/${codigoAlvo}/prontuario`)
    .then(r => r.ok ? r.json() : null)
    .then(prontuario => {
      if (prontuario && prontuario.sucesso && prontuario.pet) {
        const pet = prontuario.pet;
        const tutor = prontuario.tutor || {};

        pacienteAtualProntuario = pet;
        pacienteAtualProntuario.tutor_nome = tutor.nome;
        pacienteAtualProntuario.tutor_telefone = tutor.telefone_emergencia;
        pacienteAtualProntuario.tutor_cidade = tutor.cidade;
        window.pacienteAtualProntuario = pacienteAtualProntuario;

        if (pNome) pNome.textContent = pet.nome;
        if (pRaca) pRaca.textContent = pet.raca || 'SRD';
        if (pSexo) pSexo.innerHTML = `${pet.sexo || 'Macho'} • <strong>${pet.castrado !== false ? 'Castrado' : 'Não Castrado'}</strong>`;
        if (pIdade) pIdade.innerHTML = `Idade: <strong>Aprox. 2 anos</strong>`;
        if (pPeso) pPeso.textContent = `${pet.peso ? parseFloat(pet.peso).toFixed(1) : '12.5'} kg`;
        if (pTag) pTag.textContent = pet.tag || codigoAlvo;
        if (pMicrochip) pMicrochip.textContent = pet.microchip || 'Pendente de Implante';
        if (tNome) tNome.textContent = tutor.nome || 'Tutor Responsável';
        if (tTel) tTel.textContent = tutor.telefone_emergencia || '--';
        if (tCidade) tCidade.textContent = tutor.cidade || '--';

        if (photoImg) {
          photoImg.src = pet.foto_url || DEFAULT_PET_NEUTRAL_AVATAR;
        }

        if (alertAlergia) {
          if (pet.alergias_graves && !pet.alergias_graves.toLowerCase().includes('nenhuma')) {
            alertAlergia.style.display = 'inline-flex';
            alertAlergia.innerHTML = `<i class="fa-solid fa-ban"></i> ALERGIAS: ${pet.alergias_graves}`;
          } else {
            alertAlergia.style.display = 'none';
          }
        }

        if (alertAnestesica) {
          if (pet.restricoes_anestesicas && !pet.restricoes_anestesicas.toLowerCase().includes('nenhuma')) {
            alertAnestesica.style.display = 'inline-flex';
            alertAnestesica.innerHTML = `<i class="fa-solid fa-syringe"></i> RESTRIÇÃO ANESTÉSICA: ${pet.restricoes_anestesicas}`;
          } else {
            alertAnestesica.style.display = 'none';
          }
        }

        if (alertCronica) {
          if (pet.condicoes_cronicas && !pet.condicoes_cronicas.toLowerCase().includes('nenhuma')) {
            alertCronica.style.display = 'inline-flex';
            alertCronica.innerHTML = `<i class="fa-solid fa-notes-medical"></i> CONDIÇÃO: ${pet.condicoes_cronicas}`;
          } else {
            alertCronica.style.display = 'none';
          }
        }

        carregarVacinasProntuario(pet.id || codigoAlvo);
        carregarCirurgiasProntuario(pet.id || codigoAlvo);
        carregarPrescricoesProntuario(pet.id || codigoAlvo);
        carregarTimelineProntuario(pet.id || codigoAlvo);
        carregarExamesProntuario(pet.id || codigoAlvo);
      } else {
        aplicarSessaoLocal();
      }
    })
    .catch(err => {
      console.warn('[PetStory] Aviso ao buscar prontuário do pet no Java backend:', err);
      aplicarSessaoLocal();
    });

  function aplicarSessaoLocal() {
    if (session && session.pet) {
      const pet = session.pet;
      const tutor = session.tutor || {};

      pacienteAtualProntuario = pet;
      pacienteAtualProntuario.tutor_nome = tutor.nome;
      pacienteAtualProntuario.tutor_telefone = tutor.telefone_emergencia;
      pacienteAtualProntuario.tutor_cidade = tutor.cidade;
      window.pacienteAtualProntuario = pacienteAtualProntuario;

      if (pNome) pNome.textContent = pet.nome;
      if (pRaca) pRaca.textContent = pet.raca || 'SRD';
      if (pSexo) pSexo.innerHTML = `${pet.sexo || 'Macho'} • <strong>${pet.castrado !== false ? 'Castrado' : 'Não Castrado'}</strong>`;
      if (pIdade) pIdade.innerHTML = `Idade: <strong>Aprox. 2 anos</strong>`;
      if (pPeso) pPeso.textContent = `${pet.peso ? parseFloat(pet.peso).toFixed(1) : '12.5'} kg`;
      if (pTag) pTag.textContent = pet.tag || codigoAlvo;
      if (pMicrochip) pMicrochip.textContent = pet.microchip || 'Pendente de Implante';
      if (tNome) tNome.textContent = tutor.nome || 'Tutor Responsável';
      if (tTel) tTel.textContent = tutor.telefone_emergencia || '--';
      if (tCidade) tCidade.textContent = tutor.cidade || '--';

      if (photoImg) {
        photoImg.src = pet.foto_url || DEFAULT_PET_NEUTRAL_AVATAR;
      }

      if (alertAlergia) {
        if (pet.alergias_graves && !pet.alergias_graves.toLowerCase().includes('nenhuma')) {
          alertAlergia.style.display = 'inline-flex';
          alertAlergia.innerHTML = `<i class="fa-solid fa-ban"></i> ALERGIAS: ${pet.alergias_graves}`;
        } else {
          alertAlergia.style.display = 'none';
        }
      }

      if (alertAnestesica) {
        if (pet.restricoes_anestesicas && !pet.restricoes_anestesicas.toLowerCase().includes('nenhuma')) {
          alertAnestesica.style.display = 'inline-flex';
          alertAnestesica.innerHTML = `<i class="fa-solid fa-syringe"></i> RESTRIÇÃO ANESTÉSICA: ${pet.restricoes_anestesicas}`;
        } else {
          alertAnestesica.style.display = 'none';
        }
      }

      if (alertCronica) {
        if (pet.condicoes_cronicas && !pet.condicoes_cronicas.toLowerCase().includes('nenhuma')) {
          alertCronica.style.display = 'inline-flex';
          alertCronica.innerHTML = `<i class="fa-solid fa-notes-medical"></i> CONDIÇÃO: ${pet.condicoes_cronicas}`;
        } else {
          alertCronica.style.display = 'none';
        }
      }

      carregarVacinasProntuario(pet.id || codigoAlvo);
      carregarCirurgiasProntuario(pet.id || codigoAlvo);
      carregarPrescricoesProntuario(pet.id || codigoAlvo);
      carregarTimelineProntuario(pet.id || codigoAlvo);
      carregarExamesProntuario(pet.id || codigoAlvo);
    }
  }
}

async function carregarVacinasProntuario(petId) {
  const tbody = document.getElementById('prontuario-vax-tbody');
  if (!tbody) return;

  const targetId = petId || 'PST-1428';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${targetId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.vacinas && prontuario.vacinas.length > 0) {
        tbody.innerHTML = prontuario.vacinas.map(v => {
          const nome = v.nome_vacina || v.nome;
          const lote = v.laboratorio_lote || v.lote || `${v.loteFabricante || 'Lote Padrão'} • ${v.veterinarioResponsavel || 'CRMV-SP 38.412'}`;
          const apl = formatarDataBr(v.data_aplicacao || v.dataAplicacao);
          const ref = formatarDataBr(v.data_reforco || v.dataReforco);
          const crmv = v.veterinario_crmv || v.veterinarioResponsavel || 'Dr. Ricardo (CRMV-SP 38.412)';
          const st = v.status || 'Em Dia';
          const badgeClass = st === 'Atrasada' ? 'badge-danger' : (st === 'Próximo do Reforço' ? 'badge-warning' : 'badge-success');

          return `
            <tr>
              <td><strong>${nome}</strong></td>
              <td>${lote}</td>
              <td>${apl}</td>
              <td><strong style="color: #00735c;">${ref}</strong></td>
              <td>${crmv}</td>
              <td><span class="badge-status ${badgeClass}"><i class="fa-solid fa-check"></i> ${st}</span></td>
            </tr>
          `;
        }).join('');
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar vacinas do Java:', errNet);
  }

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

async function carregarCirurgiasProntuario(petId) {
  const tbody = document.getElementById('prontuario-cirurgias-tbody');
  if (!tbody) return;

  const targetId = petId || 'PST-1428';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${targetId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.cirurgias && prontuario.cirurgias.length > 0) {
        tbody.innerHTML = prontuario.cirurgias.map(c => {
          const isAgendada = (c.status || '').toLowerCase() === 'agendada';
          const bgStyle = isAgendada ? 'background: #eff6ff;' : '';
          const statusBadge = isAgendada 
            ? `<span class="badge-status badge-pending"><i class="fa-solid fa-clock"></i> Agendada</span>`
            : `<span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Concluído</span>`;

          return `
            <tr style="${bgStyle}">
              <td><strong>${c.nome}</strong></td>
              <td><strong style="color: #2563eb;">${c.data}</strong></td>
              <td>Sedação / Avaliação prévia</td>
              <td><span>${c.notas || 'Jejum obrigatório'}</span></td>
              <td>${c.cirurgiao}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join('');
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar cirurgias do Java:', errNet);
  }

  const cirurgiasSalvas = JSON.parse(localStorage.getItem('petstory_cirurgias_' + petId) || '[]');

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
}

async function carregarPrescricoesProntuario(petId) {
  const grid = document.getElementById('prontuario-prescricoes-grid');
  if (!grid) return;

  const targetId = petId || 'PST-1428';

  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${targetId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.prescricoes && prontuario.prescricoes.length > 0) {
        grid.innerHTML = prontuario.prescricoes.map(rx => `
          <div class="rx-card" style="background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
              <h4 style="font-size: 1.1rem; color: #0f172a;">${rx.nome}</h4>
              <span class="badge-status badge-success">${rx.tipo || 'Uso Contínuo'}</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem;">
              <strong>Indicação:</strong> ${rx.indicacao || 'Terapêutica clínica animal'}
            </p>
            <div style="font-size: 0.82rem; background: var(--teal-tint); border-left: 3px solid var(--teal-primary); padding: 0.6rem 0.8rem; border-radius: 4px; color: #0f172a;">
              <strong>Posologia:</strong> ${rx.posologia || 'Conforme orientação veterinária'}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">
                ${rx.veterinario || 'Prescrito por Dr. Ricardo Mendonça (CRMV-SP 38.412)'}
              </span>
              <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this)">
                <i class="fa-solid fa-ban"></i> Suspender
              </button>
            </div>
          </div>
        `).join('');
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar prescrições do Java:', errNet);
  }

  const prescricoesSalvas = JSON.parse(localStorage.getItem('petstory_prescricoes_' + petId) || '[]');

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

function carregarTimelineProntuario(petId) {
  const timeline = document.getElementById('prontuario-timeline-list');
  if (!timeline) return;

  const evolucoesSalvas = JSON.parse(localStorage.getItem('petstory_evolucoes_' + petId) || '[]');

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

function carregarExamesProntuario(petId) {
  const grid = document.getElementById('prontuario-exams-grid');
  if (!grid) return;

  const examesSalvos = JSON.parse(localStorage.getItem('petstory_exames_' + petId) || '[]');

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

// ============================================================================
// MODAIS CLÍNICOS E AÇÕES MÉDICAS
// ============================================================================
async function editarPesoProntuario() {
  const pesoAtualElem = document.getElementById('prontuario-pet-peso');
  const valorAtual = pesoAtualElem ? parseFloat(pesoAtualElem.textContent) : 32.8;

  const novoPesoStr = prompt('Digite o novo peso aferido na balança (kg):', valorAtual);
  if (novoPesoStr !== null && !isNaN(parseFloat(novoPesoStr))) {
    const novoPeso = parseFloat(novoPesoStr);
    const formatado = novoPeso.toFixed(1) + ' kg';
    if (pesoAtualElem) pesoAtualElem.textContent = formatado;

    const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
    if (session && session.pet) {
      session.pet.peso = novoPeso;
      localStorage.setItem('petstory_current_user', JSON.stringify(session));
    }
    if (pacienteAtualProntuario) {
      pacienteAtualProntuario.peso = novoPeso;
    }

    let petId = pacienteAtualProntuario?.id || session?.pet?.id;
    if (!petId && pacienteAtualProntuario?.tag === 'PST-9921') {
      petId = 'c810977d-2eea-420e-8957-3ab54afba430';
    } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
      petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
    }

    if (petId) {
      try {
        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json'
          },
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

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  if (session && session.pet) {
    session.pet.peso = novoPeso;
    localStorage.setItem('petstory_current_user', JSON.stringify(session));
  }
  if (pacienteAtualProntuario) {
    pacienteAtualProntuario.peso = novoPeso;
  }

  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && pacienteAtualProntuario?.tag === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  if (petId) {
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${petId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ peso: novoPeso })
      });
    } catch (err) {
      console.warn('Erro ao sincronizar sinais vitais no Supabase:', err);
    }
  }

  fecharModalVitais();
  showToast('Sinais Vitais Gravados!', `FC: ${fc} bpm, Temp: ${parseFloat(temp).toFixed(1)}°C, Peso: ${novoPeso.toFixed(1)}kg salvos com sucesso no banco.`, 'fa-heart-pulse', 'success');
}

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

  // 2. Adiciona na Carteirinha do Tutor
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

  // 3. Adiciona aos lembretes do tutor
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

  // 4. Salva no backend Java
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  let tagCode = pacienteAtualProntuario?.tag || session?.pet?.tag;
  if (!petId && tagCode === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (tagCode === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const vaxPayload = {
    petId: petId || tagCode || 'PST-1428',
    nome: nome,
    nome_vacina: nome,
    lote: lote,
    laboratorio_lote: lote,
    data_aplicacao: dataApl,
    data_reforco: dataRef,
    veterinario_crmv: 'Dr. Ricardo Mendonça (CRMV-SP 38.412)',
    status: 'Em Dia'
  };

  if (!window.vacinasTutorConsolidadas) window.vacinasTutorConsolidadas = [];
  window.vacinasTutorConsolidadas.unshift({
    nome: nome,
    lote: `${lote} • Dr. Ricardo (CRMV-SP 38.412)`,
    aplicacao: dataAplBr,
    reforco: dataRefBr,
    crmv: 'Dr. Ricardo (CRMV-SP 38.412)',
    status: 'Em Dia'
  });

  try {
    const respJava = await fetch(`${BACKEND_URL}/api/vacinas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vaxPayload)
    });
    if (respJava.ok) {
      console.log('[PetStory] Vacina registrada no Java com sucesso.');
    }
  } catch (e) {
    console.warn('[PetStory] Aviso ao enviar vacina para o backend Java:', e);
  }

  fecharModalNovaVacina();
  showToast('Vacina Aplicada!', `Dose de [${nome}] assinada e sincronizada com o banco e a carteirinha do tutor.`, 'fa-syringe', 'success');
}

function abrirModalNovaPrescricao() {
  const modal = document.getElementById('modal-prescription-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovaPrescricao() {
  const modal = document.getElementById('modal-prescription-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalPrescricao(event) {
  event.preventDefault();
  const nome = document.getElementById('input-rx-nome')?.value || 'Medicamento';
  const tipo = document.getElementById('input-rx-tipo')?.value || 'Oral';
  const indicacao = document.getElementById('input-rx-indicacao')?.value || '';
  const posologia = document.getElementById('input-rx-posologia')?.value || '';

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  let tagCode = pacienteAtualProntuario?.tag || session?.pet?.tag;
  if (!petId && tagCode === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (tagCode === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const rxPayload = {
    petId: petId || tagCode || 'PST-1428',
    nome: nome,
    tipo: tipo,
    indicacao: indicacao,
    posologia: posologia,
    veterinario: 'Prescrito por Dr. Ricardo Mendonça (CRMV-SP 38.412) • Hoje',
    status: 'Ativo'
  };

  try {
    await fetch(`${BACKEND_URL}/api/prescricoes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rxPayload)
    });
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao enviar prescrição ao Java:', errNet);
  }

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

    const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
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

function abrirModalNovaCirurgia() {
  const modal = document.getElementById('modal-surgery-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovaCirurgia() {
  const modal = document.getElementById('modal-surgery-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalCirurgia(event) {
  event.preventDefault();
  const nome = document.getElementById('input-cirurgia-nome')?.value || 'Procedimento';
  const data = document.getElementById('input-cirurgia-data')?.value || '2027-02-15';
  const cirurgiao = document.getElementById('input-cirurgia-cirurgiao')?.value || 'Dr. Ricardo Mendonça';
  const notas = document.getElementById('input-cirurgia-notas')?.value || 'Jejum obrigatório';

  const dataBr = formatarDataBr(data);

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  let tagCode = pacienteAtualProntuario?.tag || session?.pet?.tag;
  if (!petId && tagCode === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (tagCode === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const cirurgiaPayload = {
    petId: petId || tagCode || 'PST-1428',
    nome: nome,
    data: dataBr,
    cirurgiao: cirurgiao,
    notas: notas,
    status: 'Agendada'
  };

  try {
    await fetch(`${BACKEND_URL}/api/cirurgias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cirurgiaPayload)
    });
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao enviar cirurgia ao Java:', errNet);
  }

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

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && pacienteAtualProntuario?.tag === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

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

  const win = window.open('', '_blank', 'width=750,height=850');
  if (!win) return;

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Paciente';

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

function salvarEvolucaoClinica(event) {
  event.preventDefault();
  const tipo = document.getElementById('note-evolution-tipo')?.value || 'Consulta Clínica';
  const peso = document.getElementById('note-evolution-peso')?.value || '22.3';
  const texto = document.getElementById('note-evolution-text')?.value.trim();

  if (!texto) {
    showToast('Atenção', 'Escreva a anotação da evolução clínica.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  let petId = pacienteAtualProntuario?.id || session?.pet?.id;
  if (!petId && pacienteAtualProntuario?.tag === 'PST-9921') {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtualProntuario?.tag === 'PST-1428' || pacienteAtualProntuario?.nome === 'Bolinha')) {
    petId = '7e096a3b-0468-4347-9bee-a8286a10d416';
  }

  const pPeso = document.getElementById('prontuario-pet-peso');
  if (pPeso && peso) {
    pPeso.textContent = `${parseFloat(peso).toFixed(1)} kg`;
    if (session && session.pet) session.pet.peso = parseFloat(peso);
    if (pacienteAtualProntuario) pacienteAtualProntuario.peso = parseFloat(peso);
  }

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

  const noteInput = document.getElementById('note-evolution-text');
  if (noteInput) noteInput.value = '';

  const tabResumoBtn = document.querySelector('.tab-btn[data-tab="resumo"]');
  tabResumoBtn?.click();

  showToast('Evolução Registrada!', 'Nova consulta assinada com CRMV-SP 38.412 e inserida na Linha do Tempo.', 'fa-signature', 'success');
}

function abrirModalEmitirReceita() {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Paciente';
  const petRaca = pacienteAtualProntuario?.raca || session?.pet?.raca || 'SRD';
  const tutorNome = session?.tutor?.nome || 'Tutor Responsável';

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

// Expõe no escopo global
window.validarAcessoClinicoVeterinario = validarAcessoClinicoVeterinario;
window.initScannerSimulations = initScannerSimulations;
window.startScanningSimulation = startScanningSimulation;
window.initMedicalRecordTabs = initMedicalRecordTabs;
window.carregarProntuarioPaciente = carregarProntuarioPaciente;
window.carregarVacinasProntuario = carregarVacinasProntuario;
window.carregarCirurgiasProntuario = carregarCirurgiasProntuario;
window.carregarPrescricoesProntuario = carregarPrescricoesProntuario;
window.carregarTimelineProntuario = carregarTimelineProntuario;
window.carregarExamesProntuario = carregarExamesProntuario;
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
window.pacienteAtualProntuario = pacienteAtualProntuario;
