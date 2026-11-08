/**
 * PetStory • Configurações Globais & Utilitários Base
 * Módulo: js/config.js
 */

const BACKEND_URL = 'http://localhost:8080';

const SUPABASE_CONFIG = {
  url: 'https://tiqzidcqqscarcdgbcgr.supabase.co',
  anonKey: 'sb_publishable_92MgWBkRVu6i3vmS2xTWdw_io6Gk-wj'
};

const SCREENS = {
  'login': 'screen-login',
  'cadastro': 'screen-cadastro',
  'vet-scan': 'screen-vet-scan',
  'prontuario': 'screen-prontuario',
  'tutor': 'screen-tutor',
  'public-tag': 'screen-public-tag',
  'admin': 'screen-admin'
};

const DEFAULT_PET_NEUTRAL_AVATAR = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' width='100%25' height='100%25'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23e2e8f0'/%3E%3Cstop offset='100%25' stop-color='%23cbd5e1'/%3E%3C/linearGradient%3E%3ClinearGradient id='paw' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2300d2ad'/%3E%3Cstop offset='100%25' stop-color='%2300a887'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='120' rx='24' fill='url(%23bg)'/%3E%3Ccircle cx='60' cy='68' r='24' fill='url(%23paw)'/%3E%3Cellipse cx='38' cy='44' rx='9' ry='13' transform='rotate(-20 38 44)' fill='url(%23paw)'/%3E%3Cellipse cx='53' cy='36' rx='9' ry='14' transform='rotate(-6 53 36)' fill='url(%23paw)'/%3E%3Cellipse cx='67' cy='36' rx='9' ry='14' transform='rotate(6 67 36)' fill='url(%23paw)'/%3E%3Cellipse cx='82' cy='44' rx='9' ry='13' transform='rotate(20 82 44)' fill='url(%23paw)'/%3E%3C/svg%3E";

const DEFAULT_PET_PHOTO = DEFAULT_PET_NEUTRAL_AVATAR;

function formatarDataBr(isoString) {
  if (!isoString) return '--/--/----';
  const partes = isoString.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return isoString;
}

function renderQrCodeLocal(containerId, urlText) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    try {
      new QRCode(container, {
        text: urlText,
        width: 160,
        height: 160,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: (typeof QRCode.CorrectLevel !== 'undefined') ? QRCode.CorrectLevel.M : 0
      });
      return;
    } catch (err) {
      console.warn('Erro gerando QRCode com lib local:', err);
    }
  }
  const safeUrl = encodeURIComponent(urlText);
  const img = document.createElement('img');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${safeUrl}&color=0f172a`;
  img.alt = 'QR Code PetStory';
  img.style.maxWidth = '100%';
  img.style.height = 'auto';
  container.appendChild(img);
}

// Expõe no escopo global
window.BACKEND_URL = BACKEND_URL;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.SCREENS = SCREENS;
window.DEFAULT_PET_NEUTRAL_AVATAR = DEFAULT_PET_NEUTRAL_AVATAR;
window.DEFAULT_PET_PHOTO = DEFAULT_PET_PHOTO;
window.formatarDataBr = formatarDataBr;
window.renderQrCodeLocal = renderQrCodeLocal;
