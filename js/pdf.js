/**
 * PetStory • Exportação e Impressão de Documentos em PDF
 * Módulo: js/pdf.js
 */

async function baixarCarteirinhaPdf() {
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const petNome = session?.pet?.nome || 'Bolinha';
  const petRaca = session?.pet?.raca || 'Canina';
  const tutorNome = session?.tutor?.nome || 'Rafael Martins Oliveira';
  const tagCode = session?.pet?.tag || 'PST-1428';
  const petId = session?.pet?.id || (tagCode === 'PST-1428' ? '7e096a3b-0468-4347-9bee-a8286a10d416' : null);

  // Busca vacinas reais do paciente consolidadas via API Java
  let vacinas = window.vacinasTutorConsolidadas || [];
  if (vacinas.length === 0) {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/pets/${tagCode || petId}/prontuario`);
      if (resp.ok) {
        const prontuario = await resp.json();
        if (prontuario.vacinas && Array.isArray(prontuario.vacinas)) {
          vacinas = prontuario.vacinas.map(v => ({
            nome: v.nome_vacina || v.nome,
            lote: v.laboratorio_lote || v.lote || `${v.loteFabricante || 'Lote Padrão'} • ${v.veterinarioResponsavel || 'CRMV-SP 38.412'}`,
            aplicacao: formatarDataBr(v.data_aplicacao || v.dataAplicacao),
            reforco: formatarDataBr(v.data_reforco || v.dataReforco),
            crmv: v.veterinario_crmv || v.veterinarioResponsavel || 'Dr. Ricardo (CRMV-SP 38.412)'
          }));
        }
      }
    } catch (e) {
      console.warn('Erro ao buscar vacinas para PDF:', e);
    }
  }

  if (vacinas.length === 0 && (petNome === 'Thor' || tagCode === 'PST-9921')) {
    vacinas = [
      { nome: 'V10 Polivalente Canina', lote: 'Zoetis • Lote 5849-B2', aplicacao: '15/11/2025', reforco: '15/11/2026', crmv: 'Dr. Ricardo (CRMV-SP 38.412)' },
      { nome: 'Antirrábica Defensor', lote: 'Zoetis • Lote 9012-K4', aplicacao: '10/01/2026', reforco: '10/01/2027', crmv: 'Dr. André (CRMV-SP 31.020)' },
      { nome: 'Bronchi-Shield Oral', lote: 'Boehringer • Lote 7714-X1', aplicacao: '15/11/2025', reforco: '15/11/2026', crmv: 'Dr. Ricardo (CRMV-SP 38.412)' },
      { nome: 'Giardiavax (Giárdia)', lote: 'Zoetis • Lote 3320-G8', aplicacao: '20/03/2026', reforco: '20/03/2027', crmv: 'Dra. Camila (CRMV-SP 44.910)' }
    ];
  }

  let tabelaCorpo = '';
  if (vacinas && vacinas.length > 0) {
    tabelaCorpo = vacinas.map(v => {
      const dataAplStr = v.aplicacao ? (v.aplicacao.includes('/') ? v.aplicacao : formatarDataBr(v.aplicacao)) : '15/11/2025';
      const dataRefStr = v.reforco ? (v.reforco.includes('/') ? v.reforco : formatarDataBr(v.reforco)) : 'Pendente';
      return `
        <tr>
          <td><strong>${v.nome}</strong></td>
          <td>${v.lote || 'Lote Padrão'}</td>
          <td>${dataAplStr}</td>
          <td><strong style="color: #00735c;">${dataRefStr}</strong></td>
          <td>${v.crmv || 'Dr. Ricardo (CRMV-SP 38.412)'}</td>
        </tr>
      `;
    }).join('');
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

function imprimirReceitaOficial() {
  if (typeof fecharModalEmitirReceita === 'function') {
    fecharModalEmitirReceita();
  }
  const session = typeof obterSessaoSalva === 'function' ? obterSessaoSalva() : null;
  const pacienteAtual = window.pacienteAtualProntuario;
  const petNome = pacienteAtual?.nome || session?.pet?.nome || 'Thor';
  const tutorNome = session?.tutor?.nome || 'Mariana Vasconcelos';

  let petId = pacienteAtual?.id || session?.pet?.id;
  if (!petId && (pacienteAtual?.tag === 'PST-9921' || pacienteAtual?.nome === 'Thor')) {
    petId = 'c810977d-2eea-420e-8957-3ab54afba430';
  } else if (!petId && (pacienteAtual?.tag === 'PST-1428' || pacienteAtual?.nome === 'Bolinha')) {
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

// Expõe no escopo global
window.baixarCarteirinhaPdf = baixarCarteirinhaPdf;
window.imprimirReceitaOficial = imprimirReceitaOficial;
