/**
 * PetStory • Inicializador & Bootstrap da Aplicação
 * Módulo: js/app.js
 */

// ============================================================================
// SISTEMA DE NOTIFICAÇÕES (TOAST NOTIFICATIONS)
// ============================================================================
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
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4500);
}

// ============================================================================
// UTILITÁRIOS DE FORMULÁRIO E ATALHOS DE TECLADO
// ============================================================================
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

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (typeof closeOtpModal === 'function') closeOtpModal();
      if (typeof fecharModalNovoVermifugo === 'function') fecharModalNovoVermifugo();
      if (typeof fecharModalNovaVacina === 'function') fecharModalNovaVacina();
      if (typeof fecharModalNovaPrescricao === 'function') fecharModalNovaPrescricao();
      if (typeof fecharModalNovaCirurgia === 'function') fecharModalNovaCirurgia();
      if (typeof fecharModalNovoExame === 'function') fecharModalNovoExame();
      if (typeof fecharModalEmitirReceita === 'function') fecharModalEmitirReceita();
      if (typeof fecharModalRedefinirSenha === 'function') fecharModalRedefinirSenha();
    }
  });
}

function initDiscreetSwitcher() {
  // Atalhos e botões de depuração removidos para a versão de produção
}

function updateSecretSwitcherActive(screenKey) {
  const navItems = document.querySelectorAll('.secret-nav-item');
  navItems.forEach(item => {
    if (item.getAttribute('data-target') === screenKey) item.classList.add('active');
    else item.classList.remove('active');
  });
}

// ============================================================================
// BOOTSTRAP PRINCIPAL DO SISTEMA
// ============================================================================
function initApp() {
  // Inicialização de módulos da interface
  if (typeof initScreenNavigation === 'function') initScreenNavigation();
  if (typeof initDiscreetSwitcher === 'function') initDiscreetSwitcher();
  if (typeof initScannerSimulations === 'function') initScannerSimulations();
  if (typeof initMedicalRecordTabs === 'function') initMedicalRecordTabs();
  if (typeof initTutorInteractions === 'function') initTutorInteractions();
  if (typeof initModalHandlers === 'function') initModalHandlers();
  initKeyboardShortcuts();
  inicializarDatasFormularios();

  // Restaura sessão salva se houver
  if (typeof restaurarSessaoSalva === 'function') {
    restaurarSessaoSalva();
  }

  // Avalia rota inicial segura
  if (typeof handleInitialRoute === 'function') {
    handleInitialRoute();
  }
}

// Expõe no escopo global
window.showToast = showToast;
window.inicializarDatasFormularios = inicializarDatasFormularios;
window.initKeyboardShortcuts = initKeyboardShortcuts;
window.initDiscreetSwitcher = initDiscreetSwitcher;
window.updateSecretSwitcherActive = updateSecretSwitcherActive;
window.initApp = initApp;

// Disparo na carga do DOM
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
