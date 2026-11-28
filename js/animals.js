let animaisRegistradosCache = [];

function obterCabecalhosSupabase() {
  return {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
    'Accept': 'application/json'
  };
}

function escaparHtml(textoOriginal) {
  if (textoOriginal === null || textoOriginal === undefined) return '';
  return String(textoOriginal)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizarTextoBusca(textoOriginal) {
  return String(textoOriginal || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function calcularIdadeAnimal(dataNascimentoIso) {
  if (!dataNascimentoIso) return 'Idade não informada';
  const dataNascimento = new Date(`${dataNascimentoIso}T00:00:00`);
  if (isNaN(dataNascimento.getTime())) return 'Idade não informada';

  const hoje = new Date();
  let totalMeses = (hoje.getFullYear() - dataNascimento.getFullYear()) * 12
    + (hoje.getMonth() - dataNascimento.getMonth());
  if (hoje.getDate() < dataNascimento.getDate()) totalMeses -= 1;
  if (totalMeses < 0) return 'Idade não informada';

  const anos = Math.floor(totalMeses / 12);
  const mesesRestantes = totalMeses % 12;
  if (anos === 0) {
    if (mesesRestantes === 0) return 'Menos de 1 mês';
    return mesesRestantes === 1 ? '1 mês' : `${mesesRestantes} meses`;
  }
  if (mesesRestantes === 0) return anos === 1 ? '1 ano' : `${anos} anos`;
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${mesesRestantes} ${mesesRestantes === 1 ? 'mês' : 'meses'}`;
}

function possuiAlertaClinico(textoAlerta) {
  if (!textoAlerta) return false;
  const textoNormalizado = normalizarTextoBusca(textoAlerta).trim();
  if (!textoNormalizado) return false;
  return !/^(nenhum|nenhuma|nao|sem)\b/.test(textoNormalizado);
}

function obterIconeEspecie(especie) {
  const especieNormalizada = normalizarTextoBusca(especie);
  if (especieNormalizada.includes('felin') || especieNormalizada.includes('gato')) return 'fa-cat';
  if (especieNormalizada.includes('canin') || especieNormalizada.includes('cachorro') || especieNormalizada.includes('cao')) return 'fa-dog';
  return 'fa-paw';
}

function classificarEspecie(especie) {
  const icone = obterIconeEspecie(especie);
  if (icone === 'fa-dog') return 'canina';
  if (icone === 'fa-cat') return 'felina';
  return 'outra';
}

async function buscarTutorPublico(tutorId) {
  if (!tutorId) return null;
  try {
    const resposta = await chamarSupabaseRpc('rpc_obter_tutor_publico', { p_tutor_id: tutorId });
    if (resposta.ok) {
      const tutor = await resposta.json();
      if (tutor && typeof tutor === 'object') return tutor;
    }
  } catch (erroTutor) {
    console.warn('[Animais] Falha ao buscar tutor público:', tutorId, erroTutor);
  }
  return null;
}

async function carregarAnimaisRegistrados() {
  const grade = document.getElementById('animais-grid');
  if (!grade) return;

  grade.innerHTML = `
    <div class="animais-estado-vazio">
      <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--teal-primary);"></i>
      <p>Carregando animais registrados no Supabase...</p>
    </div>
  `;

  try {
    const colunasPet = 'id,tutor_id,nome,especie,raca,peso,sexo,castrado,data_nascimento,microchip,foto_url,alergias_graves,restricoes_anestesicas,condicoes_cronicas,modo_perdido';
    const [respostaPets, respostaTags] = await Promise.all([
      fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?select=${colunasPet}&order=nome.asc`, { headers: obterCabecalhosSupabase() }),
      fetch(`${SUPABASE_CONFIG.url}/rest/v1/tags?select=codigo,pet_id`, { headers: obterCabecalhosSupabase() })
    ]);

    let pets = [];
    if (respostaPets.ok) {
      pets = await respostaPets.json();
    } else {
      // Algumas colunas opcionais podem não existir no schema: tenta novamente com select=*
      const respostaPetsCompleta = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/pets?select=*&order=nome.asc`, { headers: obterCabecalhosSupabase() });
      if (!respostaPetsCompleta.ok) throw new Error(`Supabase respondeu ${respostaPetsCompleta.status}`);
      pets = await respostaPetsCompleta.json();
    }

    const tags = respostaTags.ok ? await respostaTags.json() : [];
    const tagPorPetId = new Map();
    (tags || []).forEach(tag => {
      if (tag && tag.pet_id && !tagPorPetId.has(tag.pet_id)) tagPorPetId.set(tag.pet_id, tag.codigo);
    });

    const idsTutoresUnicos = [...new Set((pets || []).map(pet => pet.tutor_id).filter(Boolean))];
    const tutoresEncontrados = await Promise.all(idsTutoresUnicos.map(tutorId => buscarTutorPublico(tutorId)));
    const tutorPorId = new Map();
    idsTutoresUnicos.forEach((tutorId, indice) => tutorPorId.set(tutorId, tutoresEncontrados[indice]));

    animaisRegistradosCache = (pets || []).map(pet => ({
      ...pet,
      tag: tagPorPetId.get(pet.id) || null,
      tutor: tutorPorId.get(pet.tutor_id) || null
    }));

    atualizarResumoAnimais();
    filtrarAnimaisRegistrados();
  } catch (erroCarregamento) {
    console.error('[Animais] Erro ao carregar animais registrados:', erroCarregamento);
    animaisRegistradosCache = [];
    atualizarResumoAnimais();
    grade.innerHTML = `
      <div class="animais-estado-vazio">
        <i class="fa-solid fa-cloud-exclamation" style="color: var(--danger);"></i>
        <p>Não foi possível carregar os animais agora. Verifique a conexão e clique em <strong>Atualizar</strong>.</p>
      </div>
    `;
  }
}

function atualizarResumoAnimais() {
  const contagemTotal = animaisRegistradosCache.length;
  const contagemCaes = animaisRegistradosCache.filter(animal => classificarEspecie(animal.especie) === 'canina').length;
  const contagemGatos = animaisRegistradosCache.filter(animal => classificarEspecie(animal.especie) === 'felina').length;
  const contagemComAlerta = animaisRegistradosCache.filter(animal =>
    possuiAlertaClinico(animal.alergias_graves) || possuiAlertaClinico(animal.restricoes_anestesicas)
  ).length;

  const valoresResumo = {
    'animais-total': contagemTotal,
    'animais-total-caes': contagemCaes,
    'animais-total-gatos': contagemGatos,
    'animais-total-alertas': contagemComAlerta
  };
  Object.entries(valoresResumo).forEach(([elementoId, valor]) => {
    const elemento = document.getElementById(elementoId);
    if (elemento) elemento.textContent = valor;
  });
}

function filtrarAnimaisRegistrados() {
  const campoBusca = document.getElementById('animais-busca');
  const campoEspecie = document.getElementById('animais-filtro-especie');
  const termoBusca = normalizarTextoBusca(campoBusca?.value || '').trim();
  const especieSelecionada = campoEspecie?.value || 'todas';

  const animaisFiltrados = animaisRegistradosCache.filter(animal => {
    if (especieSelecionada !== 'todas' && classificarEspecie(animal.especie) !== especieSelecionada) return false;
    if (!termoBusca) return true;
    const textoPesquisavel = normalizarTextoBusca([
      animal.nome, animal.raca, animal.especie, animal.tag, animal.microchip,
      animal.tutor?.nome, animal.tutor?.cidade
    ].join(' '));
    return textoPesquisavel.includes(termoBusca);
  });

  renderizarAnimaisRegistrados(animaisFiltrados);
}

function renderizarAnimaisRegistrados(animais) {
  const grade = document.getElementById('animais-grid');
  const contadorResultados = document.getElementById('animais-contador-resultados');
  if (!grade) return;

  if (contadorResultados) {
    contadorResultados.textContent = animais.length === animaisRegistradosCache.length
      ? `${animais.length} ${animais.length === 1 ? 'animal' : 'animais'}`
      : `${animais.length} de ${animaisRegistradosCache.length}`;
  }

  if (animais.length === 0) {
    grade.innerHTML = `
      <div class="animais-estado-vazio">
        <i class="fa-solid fa-magnifying-glass" style="color: #94a3b8;"></i>
        <p>${animaisRegistradosCache.length === 0 ? 'Nenhum animal registrado até o momento.' : 'Nenhum animal corresponde à busca.'}</p>
      </div>
    `;
    return;
  }

  grade.innerHTML = animais.map(animal => {
    const nome = escaparHtml(animal.nome || 'Sem nome');
    const especie = escaparHtml(animal.especie || 'Espécie não informada');
    const raca = escaparHtml(animal.raca || 'Raça não informada');
    const sexo = animal.sexo
      ? `${escaparHtml(animal.sexo)}${animal.castrado === true ? (animal.sexo === 'Fêmea' ? ' • Castrada' : ' • Castrado') : ''}`
      : 'Sexo não informado';
    const peso = (animal.peso !== null && animal.peso !== undefined && animal.peso !== '') ? `${escaparHtml(animal.peso)} kg` : '-- kg';
    const idade = escaparHtml(calcularIdadeAnimal(animal.data_nascimento));
    const fotoUrl = animal.foto_url || DEFAULT_PET_NEUTRAL_AVATAR;
    const tagCodigo = animal.tag ? escaparHtml(animal.tag) : null;
    const tutorNome = escaparHtml(animal.tutor?.nome || 'Tutor não localizado');
    const tutorCidade = escaparHtml(animal.tutor?.cidade || '');
    const iconeEspecie = obterIconeEspecie(animal.especie);

    const alertasClinicos = [];
    if (possuiAlertaClinico(animal.alergias_graves)) {
      alertasClinicos.push(`<span class="animal-alerta"><i class="fa-solid fa-ban"></i> Alergia: ${escaparHtml(animal.alergias_graves)}</span>`);
    }
    if (possuiAlertaClinico(animal.restricoes_anestesicas)) {
      alertasClinicos.push(`<span class="animal-alerta"><i class="fa-solid fa-syringe"></i> Anestesia: ${escaparHtml(animal.restricoes_anestesicas)}</span>`);
    }
    if (possuiAlertaClinico(animal.condicoes_cronicas)) {
      alertasClinicos.push(`<span class="animal-alerta animal-alerta-cronica"><i class="fa-solid fa-notes-medical"></i> ${escaparHtml(animal.condicoes_cronicas)}</span>`);
    }

    return `
      <article class="animal-card${animal.modo_perdido ? ' animal-card-perdido' : ''}">
        <div class="animal-card-topo">
          <img class="animal-card-foto" src="${escaparHtml(fotoUrl)}" alt="Foto de ${nome}"
            onerror="this.src=DEFAULT_PET_NEUTRAL_AVATAR">
          <div class="animal-card-identidade">
            <h3>${nome}</h3>
            <span class="animal-card-raca"><i class="fa-solid ${iconeEspecie}"></i> ${especie} • ${raca}</span>
            ${tagCodigo
              ? `<span class="tag-id-badge animal-card-tag">${tagCodigo}</span>`
              : `<span class="animal-card-sem-tag">Sem Tag vinculada</span>`}
          </div>
          ${animal.modo_perdido ? '<span class="badge-status badge-danger animal-card-status"><i class="fa-solid fa-location-crosshairs"></i> Perdido</span>' : ''}
        </div>

        <div class="animal-card-dados">
          <span><i class="fa-solid fa-venus-mars"></i> ${sexo}</span>
          <span><i class="fa-solid fa-cake-candles"></i> ${idade}</span>
          <span><i class="fa-solid fa-weight-scale"></i> ${peso}</span>
        </div>

        ${alertasClinicos.length > 0 ? `<div class="animal-card-alertas">${alertasClinicos.join('')}</div>` : ''}

        <div class="animal-card-rodape">
          <div class="animal-card-tutor">
            <i class="fa-solid fa-user"></i>
            <div>
              <strong>${tutorNome}</strong>
              ${tutorCidade ? `<span>${tutorCidade}</span>` : ''}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Expõe no escopo global
window.carregarAnimaisRegistrados = carregarAnimaisRegistrados;
window.filtrarAnimaisRegistrados = filtrarAnimaisRegistrados;
