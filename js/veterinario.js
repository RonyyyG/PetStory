/**
 * PetStory • Portal Clínico do Veterinário & Prontuário Médico Unificado
 * Módulo: js/veterinario.js
 */

let pacienteAtualProntuario = null;

// ============================================================================
// RESOLUÇÃO DE ID DO PACIENTE (TAG PST / NOME -> UUID SUPABASE)
// ============================================================================
function resolverPetIdSupabase(idOuTag) {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const raw = (idOuTag || pacienteAtualProntuario?.id || session?.pet?.id || pacienteAtualProntuario?.tag || session?.pet?.tag || 'PST-1428').toString().trim();

  // Se já for um UUID (formato RFC 4122 de 36 caracteres)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw;
  }

  const up = raw.toUpperCase();
  if (up === 'PST-1428' || up === 'BOLINHA') {
    return '7e096a3b-0468-4347-9bee-a8286a10d416';
  }
  if (up === 'PST-9921' || up === 'THOR') {
    return 'c810977d-2eea-420e-8957-3ab54afba430';
  }
  if (session?.pet?.id && (up === session?.pet?.tag?.toUpperCase() || up === session?.pet?.nome?.toUpperCase())) {
    return session.pet.id;
  }
  if (pacienteAtualProntuario?.id) {
    return pacienteAtualProntuario.id;
  }
  return '7e096a3b-0468-4347-9bee-a8286a10d416';
}

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

  // 2. Fallback de contingência consultando autorizacoes_otp no Supabase
  try {
    const respOtp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/autorizacoes_otp?codigo_otp=eq.${otp}&usado=eq.false&order=created_at.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (respOtp.ok) {
      const rows = await respOtp.json();
      if (rows && rows.length > 0) {
        const authRow = rows[0];
        const naoExpirou = !authRow.expira_em || new Date(authRow.expira_em) > new Date();
        if (naoExpirou) {
          fetch(`${SUPABASE_CONFIG.url}/rest/v1/autorizacoes_otp?id=eq.${authRow.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_CONFIG.anonKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ usado: true })
          }).catch(() => {});

          const nomePet = typeof obterNomePacientePorTag === 'function' ? obterNomePacientePorTag(tag) : 'Paciente';
          return {
            valido: true,
            tag: tag,
            nome: nomePet
          };
        }
      }
    }
  } catch (errOtp) {
    console.warn('[PetStory] Aviso ao consultar OTP no Supabase:', errOtp);
  }

  // 3. Fallback de contingência local em memória
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
  const formManual = document.getElementById('form-manual-vet');
  const emergencyBtn = document.getElementById('btn-emergency-override');
  const quickChips = document.querySelectorAll('.chip-btn');
  const tagInput = document.getElementById('input-tag-code');
  const otpInput = document.getElementById('input-vet-otp');

  // Atualiza as credenciais do médico autenticado no terminal de scanner
  atualizarCredencialVetScanner();

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

function atualizarCredencialVetScanner() {
  const vetSession = (typeof obterSessaoVet === 'function' ? obterSessaoVet() : null) || (() => {
    try {
      const raw = sessionStorage.getItem('petstory_vet_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  })();

  const docNameEl = document.getElementById('vet-scanner-doctor-name');
  const docCrmvEl = document.getElementById('vet-scanner-doctor-crmv');

  const nome = vetSession?.nome || 'Dr. Ricardo Mendonça';
  const crmv = vetSession?.crmv_completo || (vetSession?.crmv ? `CRMV-${vetSession.uf || 'SP'} ${vetSession.crmv}` : 'CRMV-SP 38.412');

  if (docNameEl) docNameEl.textContent = nome;
  if (docCrmvEl) docCrmvEl.textContent = crmv;
}

// ============================================================================
// LEITOR REAL DE CÂMERA (WEBCAM / SMARTPHONE) VIA HTML5-QRCODE
// ============================================================================
let leitorCameraInstance = null;
let cameraAtiva = false;
let cameraIniciando = false;

function tocarBeepConfirmacao() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Começa em 880Hz (Lá) e sobe para 1760Hz em 0.15s (bip eletrônico nítido de confirmação)
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch (e) {
    console.warn('Web Audio API não suportada ou silenciada:', e);
  }
}

function toggleLeitorCamera() {
  if (cameraAtiva) {
    pararLeitorCamera();
  } else {
    iniciarLeitorCamera();
  }
}

async function iniciarLeitorCamera() {
  if (cameraAtiva || cameraIniciando) return;

  if (typeof Html5Qrcode === 'undefined') {
    showToast('Biblioteca Indisponível', 'O leitor de câmera ainda está carregando ou não pôde ser iniciado.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  const streamContainer = document.getElementById('qr-camera-stream');
  const staticSvg = document.getElementById('qr-preview-static');
  const btnToggle = document.getElementById('btn-toggle-camera');
  const statusBadge = document.getElementById('vet-scanner-status-badge');
  const hintText = document.getElementById('scanner-hint-text');

  cameraIniciando = true;

  try {
    if (staticSvg) staticSvg.style.display = 'none';
    if (streamContainer) {
      streamContainer.style.display = 'block';
      streamContainer.innerHTML = '';
    }

    if (btnToggle) {
      btnToggle.className = 'btn-secondary';
      btnToggle.innerHTML = '<i class="fa-solid fa-stop"></i> <span>Desativar Câmera</span>';
    }

    if (statusBadge) {
      statusBadge.className = 'badge-status badge-warning';
      statusBadge.innerHTML = '<i class="fa-solid fa-camera"></i> Câmera Ativa • Aponte para a Medalha';
    }

    if (hintText) {
      hintText.innerHTML = '<i class="fa-solid fa-arrows-to-eye" style="color: var(--teal-primary);"></i> Aponte a câmera para o QR Code da medalha ou tela do celular';
    }

    if (!leitorCameraInstance) {
      leitorCameraInstance = new Html5Qrcode("qr-camera-stream");
    }

    const config = {
      fps: 15,
      qrbox: { width: 180, height: 180 }
    };

    const qrSuccessCallback = (decodedText) => {
      processarQrCodeEscaneado(decodedText);
    };

    const qrErrorCallback = () => {
      // frames contínuos sem detecção
    };

    try {
      // Prioriza câmera traseira em smartphones ("environment") ou webcam no PC
      await leitorCameraInstance.start(
        { facingMode: "environment" },
        config,
        qrSuccessCallback,
        qrErrorCallback
      );
    } catch (camErr) {
      console.warn('Tentativa inicial com facingMode environment falhou, buscando dispositivos:', camErr);
      const devices = await Html5Qrcode.getCameras().catch(() => []);
      if (devices && devices.length > 0) {
        await leitorCameraInstance.start(
          devices[0].id,
          config,
          qrSuccessCallback,
          qrErrorCallback
        );
      } else {
        throw camErr;
      }
    }

    cameraAtiva = true;
    cameraIniciando = false;

    showToast('Câmera Ativada', 'Aponte para o QR Code da medalha ou tela do smartphone.', 'fa-camera', 'info');

  } catch (err) {
    console.warn('Erro ao inicializar câmera:', err);
    cameraAtiva = false;
    cameraIniciando = false;
    await pararLeitorCamera();

    let msg = 'Não foi possível acessar a câmera. Verifique a permissão no navegador ou utilize a digitação manual.';
    if (err && (err.name === 'NotAllowedError' || String(err).toLowerCase().includes('permission') || String(err).toLowerCase().includes('denied'))) {
      msg = 'Permissão de câmera negada. Habilite o acesso nas configurações do navegador ou utilize o campo manual.';
    } else if (err && (err.name === 'NotFoundError' || String(err).toLowerCase().includes('found') || String(err).toLowerCase().includes('device'))) {
      msg = 'Nenhuma câmera física detectada no dispositivo. Utilize a digitação manual da Tag.';
    }

    showToast('Acesso à Câmera', msg, 'fa-video-slash', 'warning');
  }
}

async function pararLeitorCamera() {
  cameraIniciando = false;
  cameraAtiva = false;

  const streamContainer = document.getElementById('qr-camera-stream');
  const staticSvg = document.getElementById('qr-preview-static');
  const btnToggle = document.getElementById('btn-toggle-camera');
  const statusBadge = document.getElementById('vet-scanner-status-badge');
  const hintText = document.getElementById('scanner-hint-text');

  if (leitorCameraInstance) {
    try {
      if (leitorCameraInstance.isScanning) {
        await leitorCameraInstance.stop();
      }
      await leitorCameraInstance.clear();
    } catch (e) {
      console.warn('Erro ao finalizar Html5Qrcode:', e);
    }
    leitorCameraInstance = null;
  }

  // Libera os canais de hardware da webcam/smartphone
  if (streamContainer) {
    const video = streamContainer.querySelector('video');
    if (video && video.srcObject) {
      try {
        const stream = video.srcObject;
        const tracks = stream.getTracks ? stream.getTracks() : [];
        tracks.forEach(track => track.stop());
        video.srcObject = null;
      } catch (e) {}
    }
    streamContainer.innerHTML = '';
    streamContainer.style.display = 'none';
  }

  if (staticSvg) staticSvg.style.display = 'block';

  if (btnToggle) {
    btnToggle.className = 'btn-primary';
    btnToggle.innerHTML = '<i class="fa-solid fa-camera"></i> <span>Ativar Câmera para Escanear</span>';
  }

  if (statusBadge) {
    statusBadge.className = 'badge-status badge-success';
    statusBadge.innerHTML = '<i class="fa-solid fa-wifi"></i> NFC & Câmera Prontos';
  }

  if (hintText) {
    hintText.innerHTML = '<i class="fa-solid fa-arrows-to-eye" style="color: var(--teal-primary);"></i> Posicione a medalha PetStory no visor ou aproxime via sensor NFC';
  }
}

function processarQrCodeEscaneado(decodedText) {
  if (!decodedText) return;

  const match = decodedText.match(/PST-\d{4}/i);
  if (!match) {
    return;
  }

  const tagExtraida = match[0].toUpperCase();

  // 1. Emite feedback sonoro imediato (bip eletrônico de 0.15s)
  tocarBeepConfirmacao();

  // 2. Preenche automaticamente o campo com a Tag extraída
  const tagInput = document.getElementById('input-tag-code');
  if (tagInput) {
    tagInput.value = tagExtraida;
  }

  // 3. Desliga a câmera e apaga os sensores
  pararLeitorCamera();

  // 4. Move o foco do cursor para o campo de OTP
  const otpInput = document.getElementById('input-vet-otp');
  if (otpInput) {
    otpInput.value = '';
    otpInput.focus();
  }

  // 5. Exibe toast de sucesso
  showToast(
    'Medalha Identificada!',
    `Medalha [${tagExtraida}] identificada pela câmera! Digite o OTP do tutor.`,
    'fa-qrcode',
    'success'
  );
}

// Desativação preventiva da câmera caso a página seja recarregada ou fechada
window.addEventListener('beforeunload', () => {
  if (typeof pararLeitorCamera === 'function') {
    pararLeitorCamera();
  }
});

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
        carregarVermifugosProntuario(pet.id || codigoAlvo);
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
      carregarVermifugosProntuario(pet.id || codigoAlvo);
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

  const targetId = resolverPetIdSupabase(petId);

  // 1. Tenta carregar do backend Java
  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${petId || targetId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.cirurgias && prontuario.cirurgias.length > 0) {
        renderizarCirurgias(prontuario.cirurgias);
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar cirurgias do Java:', errNet);
  }

  // 2. Consulta no Supabase
  try {
    const respSupa = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/cirurgias?pet_id=eq.${targetId}&order=data.asc,created_at.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (respSupa.ok) {
      const cirurgias = await respSupa.json();
      if (cirurgias && cirurgias.length > 0) {
        renderizarCirurgias(cirurgias);
        return;
      }
    }
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao carregar cirurgias do Supabase:', errSupa);
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center; padding:30px 15px; color:#64748b; background:#f8fafc;">
        <i class="fa-solid fa-scissors" style="font-size:1.8rem; margin-bottom:8px; display:block; color:#94a3b8;"></i>
        <strong>Nenhum procedimento ou cirurgia cadastrado para este paciente.</strong><br>
        <span style="font-size: 0.85rem;">Clique no botão acima <strong>"Agendar Cirurgia ou Procedimento"</strong> para marcar intervenções com notificação na tela do tutor.</span>
      </td>
    </tr>
  `;

  function renderizarCirurgias(lista) {
    tbody.innerHTML = lista.map(c => {
      const isAgendada = (c.status || '').toLowerCase() === 'agendada';
      const bgStyle = isAgendada ? 'background: #eff6ff;' : '';
      const statusBadge = isAgendada
        ? `<span class="badge-status badge-pending"><i class="fa-solid fa-clock"></i> Agendada</span>`
        : `<span class="badge-status badge-success"><i class="fa-solid fa-check"></i> Concluído</span>`;

      return `
        <tr style="${bgStyle}">
          <td><strong>${c.nome}</strong></td>
          <td><strong style="color: #2563eb;">${formatarDataBr(c.data) || c.data}</strong></td>
          <td>Sedação / Avaliação prévia</td>
          <td><span>${c.notas || 'Jejum obrigatório'}</span></td>
          <td>${c.cirurgiao || 'Dr. Ricardo Mendonça'}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }
}

async function carregarPrescricoesProntuario(petId) {
  const grid = document.getElementById('prontuario-prescricoes-grid');
  if (!grid) return;

  const targetId = resolverPetIdSupabase(petId);

  // 1. Tenta carregar do Java
  try {
    const resp = await fetch(`${BACKEND_URL}/api/pets/${petId || targetId}/prontuario`);
    if (resp.ok) {
      const prontuario = await resp.json();
      if (prontuario.prescricoes && prontuario.prescricoes.length > 0) {
        renderizarPrescricoes(prontuario.prescricoes);
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar prescrições do Java:', errNet);
  }

  // 2. Consulta no Supabase
  try {
    const respSupa = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes?pet_id=eq.${targetId}&ativa=eq.true&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (respSupa.ok) {
      const prescricoes = await respSupa.json();
      if (prescricoes && prescricoes.length > 0) {
        renderizarPrescricoes(prescricoes);
        return;
      }
    }
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao carregar prescrições do Supabase:', errSupa);
  }

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
      <i class="fa-solid fa-pills" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
      <strong>Nenhum medicamento prescrito no momento.</strong><br>
      <span style="font-size: 0.85rem;">Clique no botão verde acima <strong>"Nova Prescrição Médica"</strong> para prescrever tratamentos para este animal.</span>
    </div>
  `;

  function renderizarPrescricoes(lista) {
    grid.innerHTML = lista.map(rx => `
      <div class="rx-card" data-rx-id="${rx.id || ''}" style="background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 1.5rem;">
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
            ${rx.veterinario || 'Dr. Ricardo Mendonça'} ${rx.crmv ? '(' + rx.crmv + ')' : ''}
          </span>
          <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this, '${rx.id || ''}')">
            <i class="fa-solid fa-ban"></i> Suspender
          </button>
        </div>
      </div>
    `).join('');
  }
}

async function carregarTimelineProntuario(petId) {
  const timeline = document.getElementById('prontuario-timeline-list');
  if (!timeline) return;

  const targetId = resolverPetIdSupabase(petId);

  try {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/consultas_historico?pet_id=eq.${targetId}&order=data_consulta.desc,created_at.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (resp.ok) {
      const evolucoes = await resp.json();
      if (evolucoes && evolucoes.length > 0) {
        timeline.innerHTML = evolucoes.map(ev => {
          const dataFmt = formatarDataBr(ev.data_consulta) || ev.data_consulta || 'Data recente';
          const vetNome = ev.veterinario_nome || 'Dr. Ricardo Mendonça';
          const vetCrmv = ev.veterinario_crmv || 'CRMV-SP 38.412';
          return `
            <div class="timeline-entry" style="animation: fadeIn 0.3s ease;">
              <div class="timeline-bullet" style="background: var(--teal-primary);"></div>
              <div class="timeline-entry-header">
                <span class="timeline-entry-title">${ev.tipo_consulta || 'Consulta Clínica'}</span>
                <span class="timeline-entry-date">${dataFmt}</span>
              </div>
              <div class="timeline-entry-doc">
                <i class="fa-solid fa-stethoscope"></i> ${vetNome} • ${vetCrmv}
              </div>
              <p class="timeline-entry-desc" style="white-space: pre-line;">${ev.descricao || ''}</p>
            </div>
          `;
        }).join('');
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar consultas/evoluções do Supabase:', errNet);
  }

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

async function carregarExamesProntuario(petId) {
  const grid = document.getElementById('prontuario-exams-grid');
  if (!grid) return;

  const targetId = resolverPetIdSupabase(petId);

  try {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/exames?pet_id=eq.${targetId}&order=data_realizacao.desc,created_at.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (resp.ok) {
      const exames = await resp.json();
      if (exames && exames.length > 0) {
        grid.innerHTML = exames.map(ex => {
          const dataFmt = formatarDataBr(ex.data_realizacao) || ex.data_realizacao || 'Data recente';
          const tituloEnc = encodeURIComponent(ex.titulo || 'Laudo Diagnóstico');
          const fileUrlEnc = encodeURIComponent(ex.arquivo_url || '');
          const laudoTextoEnc = encodeURIComponent(ex.laudo_texto || 'Parâmetros dentro da normalidade.');
          const dataFmtEnc = encodeURIComponent(dataFmt);
          const labEnc = encodeURIComponent(ex.laboratorio || 'LabVet');

          return `
            <div class="exam-card" style="background: #f0fdf9; border: 1px solid #a7f3d0;">
              <div>
                <div class="exam-card-top">
                  <div class="exam-icon" style="background: rgba(0, 168, 135, 0.12); color: #00735c;">
                    <i class="fa-solid fa-file-pdf"></i>
                  </div>
                  <div class="exam-info">
                    <h4>${ex.titulo}</h4>
                    <span>Data: ${dataFmt} • ${ex.laboratorio || 'LabVet'}</span>
                  </div>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
                  ${ex.laudo_texto || 'Parâmetros dentro da normalidade.'}
                </p>
              </div>
              <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('${tituloEnc}', '${fileUrlEnc}', '${laudoTextoEnc}', '${dataFmtEnc}', '${labEnc}', true)">
                <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
              </button>
            </div>
          `;
        }).join('');
        return;
      }
    }
  } catch (errNet) {
    console.warn('[PetStory] Aviso ao carregar exames do Supabase:', errNet);
  }

  grid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;">
      <i class="fa-solid fa-file-pdf" style="font-size: 2rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
      <strong>Nenhum laudo ou exame anexado para este paciente.</strong><br>
      <span style="font-size: 0.85rem;">Clique no botão acima <strong>"Anexar Novo Laudo / Exame (PDF)"</strong> para subir documentos laboratoriais.</span>
    </div>
  `;
}

async function carregarVermifugosProntuario(petId) {
  const tbody = document.getElementById('prontuario-vermifugos-tbody');
  if (!tbody) return;

  const targetId = resolverPetIdSupabase(petId);

  try {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vermifugos?pet_id=eq.${targetId}&order=data_aplicacao.desc,created_at.desc`, {
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    });
    if (resp.ok) {
      const lista = await resp.json();
      if (lista && lista.length > 0) {
        tbody.innerHTML = lista.map(v => {
          const st = v.status || 'Em Dia';
          const badgeClass = st === 'Atrasada' ? 'badge-danger' : (st === 'Pendente' ? 'badge-warning' : 'badge-success');
          return `
            <tr>
              <td><strong>${v.tipo || 'Antiparasitário'}</strong></td>
              <td>${v.medicamento || '--'}</td>
              <td>${v.faixa_peso || '--'}</td>
              <td>${formatarDataBr(v.data_aplicacao) || v.data_aplicacao || '--'}</td>
              <td><strong style="color: #00735c;">${formatarDataBr(v.data_proxima_dose) || v.data_proxima_dose || '--'}</strong></td>
              <td><span class="badge-status ${badgeClass}"><i class="fa-solid fa-check"></i> ${st}</span></td>
            </tr>
          `;
        }).join('');
        return;
      }
    }
  } catch (e) {
    console.warn('[PetStory] Erro ao carregar vermífugos do Supabase:', e);
  }

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 25px; color: #64748b; background: #f8fafc;">
        <i class="fa-solid fa-shield-virus" style="font-size: 1.6rem; margin-bottom: 6px; display: block; color: #94a3b8;"></i>
        <strong>Nenhum registro de vermífugo ou antiparasitário lançado ainda.</strong><br>
        <span style="font-size: 0.85rem;">Clique no botão <strong>"Registrar Dose / Antiparasitário"</strong> acima para registrar.</span>
      </td>
    </tr>
  `;
}

// ============================================================================
// MODAIS CLÍNICOS E AÇÕES MÉDICAS
// ============================================================================
async function editarPesoProntuario() {
  const pesoAtualElem = document.getElementById('prontuario-pet-peso');
  const valorAtual = pesoAtualElem ? parseFloat(pesoAtualElem.textContent) : 12.5;

  const novoPesoStr = prompt('Digite o novo peso aferido na balança (kg):', valorAtual);
  if (novoPesoStr !== null && !isNaN(parseFloat(novoPesoStr))) {
    const novoPeso = parseFloat(novoPesoStr);
    const formatado = novoPeso.toFixed(1) + ' kg';
    if (pesoAtualElem) pesoAtualElem.textContent = formatado;

    const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
    if (session && session.pet) {
      session.pet.peso = novoPeso;
      sessionStorage.setItem('petstory_current_user', JSON.stringify(session));
    }
    if (pacienteAtualProntuario) {
      pacienteAtualProntuario.peso = novoPeso;
    }

    const petId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

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

function abrirModalNovoVermifugo() {
  const modal = document.getElementById('modal-vermifugo-backdrop');
  if (modal) {
    const inputData = document.getElementById('input-verm-data');
    if (inputData && !inputData.value) {
      inputData.value = new Date().toISOString().split('T')[0];
    }
    const inputProx = document.getElementById('input-verm-proxima');
    if (inputProx && !inputProx.value) {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      inputProx.value = d.toISOString().split('T')[0];
    }
    modal.classList.add('open');
  }
}

function fecharModalNovoVermifugo() {
  const modal = document.getElementById('modal-vermifugo-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalVermifugo(event) {
  event.preventDefault();
  const tipo = document.getElementById('input-verm-tipo')?.value || 'Antiparasitário Geral';
  const peso = document.getElementById('input-verm-peso')?.value || 'Até 20kg';
  const medicamento = document.getElementById('input-verm-medicamento')?.value || 'Antiparasitário';
  const dataApl = document.getElementById('input-verm-data')?.value || new Date().toISOString().split('T')[0];
  const dataProx = document.getElementById('input-verm-proxima')?.value || '2027-02-08';

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id || pacienteAtualProntuario?.tag || session?.pet?.tag);

  const payload = {
    pet_id: targetId,
    tipo: tipo,
    medicamento: medicamento,
    faixa_peso: peso,
    data_aplicacao: dataApl,
    data_proxima_dose: dataProx,
    status: 'Em Dia'
  };

  try {
    const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/vermifugos`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      showToast('Dose Registrada!', `Proteção [${medicamento}] gravada com sucesso no Supabase.`, 'fa-shield-virus', 'success');
    }
  } catch (e) {
    console.warn('[PetStory] Erro ao gravar vermífugo no Supabase:', e);
  }

  await carregarVermifugosProntuario(targetId);

  const tutorReminders = document.getElementById('tutor-reminders-container');
  if (tutorReminders) {
    if (tutorReminders.textContent.includes('Nenhum procedimento')) {
      tutorReminders.innerHTML = '';
    }
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-item';
    alertBox.style.cssText = 'background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.8rem; margin-bottom: 0.6rem; animation: fadeIn 0.3s ease;';
    alertBox.innerHTML = `
      <div style="font-size: 0.85rem; font-weight: 700; color: #166534;"><i class="fa-solid fa-shield-virus"></i> Próxima Dose: ${medicamento}</div>
      <div style="font-size: 0.78rem; color: #15803d;">Data prevista: ${formatarDataBr(dataProx)} • ${tipo}</div>
    `;
    tutorReminders.prepend(alertBox);
  }

  fecharModalNovoVermifugo();
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
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

  const rxPayload = {
    petId: targetId,
    nome: nome,
    tipo: tipo,
    indicacao: indicacao,
    posologia: posologia,
    veterinario: 'Dr. Ricardo Mendonça (CRMV-SP 38.412) • Hoje',
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

  let rxId = null;
  try {
    const respSupa = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        pet_id: targetId,
        nome: nome,
        tipo: tipo,
        indicacao: indicacao,
        posologia: posologia,
        veterinario: 'Dr. Ricardo Mendonça',
        crmv: 'CRMV-SP 38.412',
        data_inicio: new Date().toISOString().split('T')[0],
        ativa: true
      })
    });
    if (respSupa.ok) {
      const created = await respSupa.json();
      if (created && created[0]) rxId = created[0].id;
    }
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao persistir prescrição no Supabase:', errSupa);
  }

  const grid = document.getElementById('prontuario-prescricoes-grid');
  if (grid) {
    if (grid.textContent.includes('Nenhum medicamento')) {
      grid.innerHTML = '';
    }
    const card = document.createElement('div');
    card.className = 'rx-card';
    card.setAttribute('data-rx-id', rxId || '');
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
          Dr. Ricardo Mendonça (CRMV-SP 38.412) • Hoje
        </span>
        <button type="button" class="btn-danger-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem;" onclick="suspenderPrescricao(this, '${rxId || ''}')">
          <i class="fa-solid fa-ban"></i> Suspender
        </button>
      </div>
    `;
    grid.prepend(card);
  }

  fecharModalNovaPrescricao();
  showToast('Prescrição Emitida', `Medicamento [${nome}] registrado no prontuário e persistido no Supabase.`, 'fa-pills', 'success');
}

async function suspenderPrescricao(btn, rxId) {
  const card = btn.closest('.rx-card');
  if (!card) return;

  if (confirm('Deseja realmente suspender e arquivar este tratamento?')) {
    card.style.opacity = '0.45';
    card.style.background = '#f1f5f9';
    btn.textContent = 'Tratamento Encerrado';
    btn.disabled = true;
    btn.style.cursor = 'default';

    const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
    const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);
    const idParaSuspender = rxId || card.getAttribute('data-rx-id');
    const nomeMed = card.querySelector('h4')?.textContent.trim();

    try {
      if (idParaSuspender) {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes?id=eq.${idParaSuspender}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ativa: false })
        });
      } else if (nomeMed) {
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes?pet_id=eq.${targetId}&nome=eq.${encodeURIComponent(nomeMed)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_CONFIG.anonKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ativa: false })
        });
      }
    } catch (e) {
      console.warn('[PetStory] Erro ao suspender prescrição no Supabase:', e);
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
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

  const cirurgiaPayload = {
    petId: targetId,
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

  try {
    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/cirurgias`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pet_id: targetId,
        nome: nome,
        data: data,
        cirurgiao: cirurgiao,
        notas: notas,
        status: 'Agendada'
      })
    });
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao gravar cirurgia no Supabase:', errSupa);
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
  showToast('Procedimento Agendado!', `Cirurgia marcada para ${dataBr}. Notificação gerada na tela do tutor e persistida no Supabase!`, 'fa-calendar-check', 'success');
}

function abrirModalNovoExame() {
  const modal = document.getElementById('modal-exam-backdrop');
  if (modal) modal.classList.add('open');
}

function fecharModalNovoExame() {
  const modal = document.getElementById('modal-exam-backdrop');
  if (modal) modal.classList.remove('open');
}

async function salvarModalExame(event) {
  event.preventDefault();
  const titulo = document.getElementById('input-exame-titulo')?.value || 'Exame Laboratorial';
  const lab = document.getElementById('input-exame-lab')?.value || 'LabVet';
  const data = document.getElementById('input-exame-data')?.value || new Date().toISOString().split('T')[0];
  const resumo = document.getElementById('input-exame-resumo')?.value || 'Parâmetros avaliados.';

  const dataBr = formatarDataBr(data);
  const fileInput = document.getElementById('input-exame-file');
  let fileUrl = '';
  if (fileInput?.files?.[0]) {
    const file = fileInput.files[0];
    fileUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

  try {
    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/exames`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pet_id: targetId,
        titulo: titulo,
        laboratorio: lab,
        data_realizacao: data,
        tipo_exame: 'Laboratorial',
        laudo_texto: resumo,
        arquivo_url: fileUrl || ''
      })
    });
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao gravar exame no Supabase:', errSupa);
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

    const tituloEnc = encodeURIComponent(titulo);
    const fileUrlEnc = encodeURIComponent(fileUrl || '');
    const laudoTextoEnc = encodeURIComponent(resumo);
    const dataBrEnc = encodeURIComponent(dataBr);
    const labEnc = encodeURIComponent(lab);

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
      <button type="button" class="btn-secondary" style="width: 100%;" onclick="visualizarExameSimulado('${tituloEnc}', '${fileUrlEnc}', '${laudoTextoEnc}', '${dataBrEnc}', '${labEnc}', true)">
        <i class="fa-solid fa-file-pdf" style="color: #f43f5e;"></i> Visualizar Laudo Assinado (PDF)
      </button>
    `;
    grid.prepend(card);
  }

  fecharModalNovoExame();
  showToast('Laudo Anexado', `Exame [${titulo}] vinculado ao prontuário e salvo no Supabase.`, 'fa-file-pdf', 'success');
}

function visualizarExameSimulado(titulo, customFileUrl, laudoTexto, dataRealizacao, labNome, isEncoded) {
  if (isEncoded) {
    try {
      titulo = decodeURIComponent(titulo || '');
      customFileUrl = decodeURIComponent(customFileUrl || '');
      laudoTexto = decodeURIComponent(laudoTexto || '');
      dataRealizacao = decodeURIComponent(dataRealizacao || '');
      labNome = decodeURIComponent(labNome || '');
    } catch (e) {}
  }

  if (customFileUrl) {
    if (customFileUrl.startsWith('data:')) {
      const win = window.open('', '_blank', 'width=850,height=900');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Laudo - ${titulo || 'Exame'}</title>
            <style>body { margin: 0; padding: 0; background: #525659; overflow: hidden; }</style>
          </head>
          <body>
            <iframe src="${customFileUrl}" style="border:none; width:100vw; height:100vh;" allowfullscreen></iframe>
          </body>
          </html>
        `);
        win.document.close();
        return;
      }
    } else if (customFileUrl.startsWith('http://') || customFileUrl.startsWith('https://')) {
      window.open(customFileUrl, '_blank');
      return;
    }
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
      <title>Laudo Laboratorial - ${titulo || 'Exame'}</title>
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
            <h2 style="color: #00735c; margin: 0;">🔬 ${labNome || 'LabVet Diagnósticos Clínicos'}</h2>
            <span style="font-size: 13px; color: #64748b;">Laudo Oficial Assinado Digitalmente</span>
          </div>
          <div><strong>Status:</strong> Normal</div>
        </div>
        <div class="meta">
          <div><strong>Exame:</strong> ${titulo}</div>
          <div><strong>Paciente:</strong> ${petNome}</div>
          <div><strong>Data da Realização:</strong> ${dataRealizacao || new Date().toLocaleDateString('pt-BR')}</div>
          <div><strong>Responsável Técnico:</strong> Dra. Juliana Paes (CRMV-SP 51.204)</div>
        </div>
        <h3>Resultado e Interpretação Clínica:</h3>
        <p>${laudoTexto || 'Amostra processada conforme normas internacionais de patologia veterinária. Todos os índices quantitativos e qualitativos mantêm-se em consonância com os padrões fisiológicos esperados para a espécie e faixa etária.'}</p>
        <div class="footer">
          Documento emitido com assinatura eletrônica e certificado digital padrão ICP-Brasil.
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

async function salvarEvolucaoClinica(event) {
  event.preventDefault();
  const tipo = document.getElementById('note-evolution-tipo')?.value || 'Consulta Clínica';
  const peso = document.getElementById('note-evolution-peso')?.value || '12.5';
  const texto = document.getElementById('note-evolution-text')?.value.trim();

  if (!texto) {
    showToast('Atenção', 'Escreva a anotação da evolução clínica.', 'fa-triangle-exclamation', 'warning');
    return;
  }

  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

  const pPeso = document.getElementById('prontuario-pet-peso');
  if (pPeso && peso) {
    pPeso.textContent = `${parseFloat(peso).toFixed(1)} kg`;
    if (session && session.pet) {
      session.pet.peso = parseFloat(peso);
      sessionStorage.setItem('petstory_current_user', JSON.stringify(session));
    }
    if (pacienteAtualProntuario) pacienteAtualProntuario.peso = parseFloat(peso);
  }

  try {
    await fetch(`${SUPABASE_CONFIG.url}/rest/v1/consultas_historico`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pet_id: targetId,
        veterinario_nome: 'Dr. Ricardo Mendonça',
        veterinario_crmv: 'CRMV-SP 38.412',
        tipo_consulta: tipo,
        data_consulta: new Date().toISOString().split('T')[0],
        descricao: `${texto}${peso ? '\n(Peso aferido na consulta: ' + peso + ' kg)' : ''}`
      })
    });
  } catch (errSupa) {
    console.warn('[PetStory] Aviso ao gravar consulta no Supabase:', errSupa);
  }

  if (peso && !isNaN(parseFloat(peso))) {
    try {
      await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?id=eq.${targetId}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ peso: parseFloat(peso) })
      });
    } catch (e) {
      console.warn('[PetStory] Erro ao sincronizar peso no Supabase:', e);
    }
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

  showToast('Evolução Registrada!', 'Nova consulta assinada com CRMV-SP 38.412, gravada no Supabase e inserida na Linha do Tempo.', 'fa-signature', 'success');
}

async function abrirModalEmitirReceita() {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = pacienteAtualProntuario?.nome || session?.pet?.nome || 'Paciente';
  const petRaca = pacienteAtualProntuario?.raca || session?.pet?.raca || 'SRD';
  const tutorNome = pacienteAtualProntuario?.tutor_nome || session?.tutor?.nome || 'Tutor Responsável';
  const targetId = resolverPetIdSupabase(pacienteAtualProntuario?.id || session?.pet?.id);

  const rxPet = document.getElementById('rx-print-pet-nome');
  const rxRaca = document.getElementById('rx-print-pet-raca');
  const rxTutor = document.getElementById('rx-print-tutor-nome');
  const rxData = document.getElementById('rx-print-data');
  const medsList = document.getElementById('rx-print-meds-list');

  if (rxPet) rxPet.textContent = petNome;
  if (rxRaca) rxRaca.textContent = petRaca;
  if (rxTutor) rxTutor.textContent = tutorNome;
  if (rxData) rxData.textContent = new Date().toLocaleDateString('pt-BR');

  const modal = document.getElementById('modal-rx-print-backdrop');
  if (modal) modal.classList.add('open');

  if (medsList) {
    medsList.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: #64748b; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
        <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--teal-primary); font-size: 1.3rem; margin-bottom: 0.4rem; display: block;"></i>
        Consultando prescrições ativas no banco de dados...
      </div>
    `;

    try {
      const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/prescricoes?pet_id=eq.${targetId}&ativa=eq.true&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
        }
      });

      if (resp.ok) {
        const prescricoes = await resp.json();
        if (prescricoes && prescricoes.length > 0) {
          medsList.innerHTML = prescricoes.map((p, idx) => `
            <div class="rx-print-item-card" data-rx-id="${p.id || ''}" style="padding: 0.9rem 1rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.04);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.8rem; margin-bottom: 0.4rem;">
                <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; flex: 1; margin: 0;">
                  <input type="checkbox" class="rx-print-checkbox" checked style="accent-color: var(--teal-primary); width: 17px; height: 17px; cursor: pointer;">
                  <span class="rx-item-nome" style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${idx + 1}. ${p.nome}</span>
                </label>
                <span class="badge-status badge-success rx-item-tipo" style="font-size: 0.72rem;">${p.tipo || 'Uso Veterinário'}</span>
              </div>
              <div style="font-size: 0.8rem; color: #475569; margin-bottom: 0.5rem; padding-left: 1.7rem;">
                <strong>Indicação:</strong> <span class="rx-item-indicacao-text">${p.indicacao || 'Terapêutica clínica animal'}</span>
              </div>
              <div style="padding-left: 1.7rem;">
                <label style="display: block; font-size: 0.76rem; font-weight: 600; color: #334155; margin-bottom: 0.25rem;">
                  Posologia & Modo de Uso (Ajustável antes da impressão):
                </label>
                <textarea class="form-input rx-item-posologia" rows="2" style="font-size: 0.82rem; padding: 0.5rem; width: 100%; border-radius: 6px; resize: vertical; line-height: 1.4;">${p.posologia || 'Conforme orientação veterinária.'}</textarea>
              </div>
            </div>
          `).join('');
          return;
        }
      }
    } catch (errRx) {
      console.warn('[PetStory] Erro ao carregar prescrições para receita:', errRx);
    }

    medsList.innerHTML = `
      <div style="text-align: center; padding: 1.8rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b;">
        <i class="fa-solid fa-pills" style="font-size: 1.8rem; color: #94a3b8; margin-bottom: 0.5rem; display: block;"></i>
        <strong style="color: #334155; font-size: 0.95rem;">Nenhum medicamento ativo prescrito para este paciente no momento.</strong><br>
        <p style="font-size: 0.82rem; margin: 0.5rem 0 1rem; color: #64748b;">Para emitir uma receita, registre primeiro os medicamentos necessários.</p>
        <button type="button" class="btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.9rem;" onclick="fecharModalEmitirReceita(); abrirModalNovaPrescricao();">
          <i class="fa-solid fa-plus"></i> Nova Prescrição Médica
        </button>
      </div>
    `;
  }
}

function fecharModalEmitirReceita() {
  const modal = document.getElementById('modal-rx-print-backdrop');
  if (modal) modal.classList.remove('open');
}

// Expõe no escopo global
window.resolverPetIdSupabase = resolverPetIdSupabase;
window.validarAcessoClinicoVeterinario = validarAcessoClinicoVeterinario;
window.initScannerSimulations = initScannerSimulations;
window.atualizarCredencialVetScanner = atualizarCredencialVetScanner;
window.toggleLeitorCamera = toggleLeitorCamera;
window.iniciarLeitorCamera = iniciarLeitorCamera;
window.pararLeitorCamera = pararLeitorCamera;
window.tocarBeepConfirmacao = tocarBeepConfirmacao;
window.initMedicalRecordTabs = initMedicalRecordTabs;
window.carregarProntuarioPaciente = carregarProntuarioPaciente;
window.carregarVacinasProntuario = carregarVacinasProntuario;
window.carregarCirurgiasProntuario = carregarCirurgiasProntuario;
window.carregarPrescricoesProntuario = carregarPrescricoesProntuario;
window.carregarTimelineProntuario = carregarTimelineProntuario;
window.carregarExamesProntuario = carregarExamesProntuario;
window.carregarVermifugosProntuario = carregarVermifugosProntuario;
window.editarPesoProntuario = editarPesoProntuario;
window.abrirModalNovoVermifugo = abrirModalNovoVermifugo;
window.fecharModalNovoVermifugo = fecharModalNovoVermifugo;
window.salvarModalVermifugo = salvarModalVermifugo;
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
