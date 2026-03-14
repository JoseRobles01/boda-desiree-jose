/* ============================================================
   DESI + JOSE · Wedding Website · app.js
   ============================================================ */

// ─── CONFIGURACIÓN ───────────────────────────────────────────
// Después de desplegar el Apps Script, pega aquí la URL:
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxWgp6AaoYOVxYQzPL7KAlCTvl6gljishdboGn3T6ePahu79Au_CpkZ_YflyvqQDhcR/exec';

// ID del spreadsheet y GID de la hoja
const SHEET_ID  = '1Rps9SwfUvwzmuVtb1m7Bsxj3jaEEdQE6b5D10dIMLmQ';
const SHEET_GID = '714416940';

// ─── ESTADO ──────────────────────────────────────────────────
let gifts        = [];   // lista cacheada
let selectedGift = null; // regalo seleccionado para reservar

// ─── DOM REFS ────────────────────────────────────────────────
const navLinks       = document.querySelectorAll('.nav-link');
const pages          = document.querySelectorAll('.page');
const hamburger      = document.getElementById('hamburger');
const sidebar        = document.getElementById('sidebar');
const overlay        = document.getElementById('overlay');
const giftsGrid      = document.getElementById('giftsGrid');
const modalBackdrop  = document.getElementById('modalBackdrop');
const modalClose     = document.getElementById('modalClose');
const modalTitle     = document.getElementById('modalTitle');
const modalPrice     = document.getElementById('modalPrice');
const modalGiftImg   = document.getElementById('modalGiftImg');
const confirmBtn     = document.getElementById('confirmReserveBtn');
const modalError     = document.getElementById('modalError');
const toast          = document.getElementById('toast');

// ─── NAVIGATION ──────────────────────────────────────────────
function showPage(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navLinks.forEach(l => l.classList.remove('active'));

  const targetPage = document.getElementById('page-' + pageId);
  const targetLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);

  if (targetPage) targetPage.classList.add('active');
  if (targetLink) targetLink.classList.add('active');

  // Cargar regalos solo cuando se visita esa página
  if (pageId === 'regalos' && gifts.length === 0) {
    loadGifts();
  }

  // Cerrar sidebar en mobile
  closeMobileMenu();

  // Scroll al top
  window.scrollTo({ top: 0 });
}

navLinks.forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showPage(link.dataset.page);
  });
});

// ─── MOBILE MENU ─────────────────────────────────────────────
hamburger.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  overlay.classList.toggle('visible', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

overlay.addEventListener('click', closeMobileMenu);

function closeMobileMenu() {
  sidebar.classList.remove('open');
  hamburger.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

// ─── CARGAR REGALOS ──────────────────────────────────────────
async function loadGifts() {
  giftsGrid.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Cargando regalos…</p>
    </div>`;

  try {
    // Si el Apps Script ya fue desplegado, úsalo para leer la data
    // (más confiable, incluye CORS). Si no, usa el endpoint público de gviz.
    let data;

    if (APPS_SCRIPT_URL !== 'PEGAR_URL_DEL_APPS_SCRIPT_AQUI') {
      data = await fetchFromAppsScript();
    } else {
      data = await fetchFromGviz();
    }

    gifts = data;
    renderGifts();

  } catch (err) {
    console.error('Error al cargar regalos:', err);
    giftsGrid.innerHTML = `
      <div class="error-state">
        <p>${err.message || 'No se pudo cargar la lista de regalos.'}<br><br>
        <a href="#" onclick="gifts=[]; loadGifts(); return false;">Intentar de nuevo</a></p>
      </div>`;
  }
}

// Lee usando el Apps Script desplegado (GET ?action=list)
async function fetchFromAppsScript() {
  const url  = `${APPS_SCRIPT_URL}?action=list`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Apps Script error: ' + resp.status);
  const json = await resp.json();
  if (json.status !== 'ok') throw new Error(json.message);
  return json.data;
}

// Lee el sheet público usando JSONP (evita CORS, no requiere API key)
function fetchFromGviz() {
  return new Promise((resolve, reject) => {
    const cbName = '_gviz_cb_' + Date.now();
    const script = document.createElement('script');

    window[cbName] = function(json) {
      delete window[cbName];
      script.remove();
      try {
        if (json.status === 'error') {
          const msg = json.errors?.[0]?.reason === 'access_denied'
            ? 'El spreadsheet no es público. Ve a Google Sheets → Compartir → "Cualquier persona con el enlace".'
            : (json.errors?.[0]?.message || 'Error del servidor de Google Sheets');
          reject(new Error(msg));
          return;
        }
        const cols = json.table.cols.map(c => c.label);
        const rows = (json.table.rows || []).map(row => {
          const obj = {};
          cols.forEach((label, i) => {
            const cell = row.c ? row.c[i] : null;
            obj[label] = (cell && cell.v !== null && cell.v !== undefined) ? cell.v : '';
          });
          return obj;
        }).filter(r => r['id'] !== '');
        resolve(rows);
      } catch(e) {
        reject(e);
      }
    };

    script.onerror = () => {
      delete window[cbName];
      script.remove();
      reject(new Error('No se pudo cargar el spreadsheet. ¿Está configurado como público?'));
    };

    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${cbName}&gid=${SHEET_GID}`;
    document.head.appendChild(script);
  });
}

// ─── RENDERIZAR TARJETAS ──────────────────────────────────────
function renderGifts() {
  if (!gifts.length) {
    giftsGrid.innerHTML = `<div class="error-state"><p>No hay regalos en la lista aún.</p></div>`;
    return;
  }

  const yapeCard = `
    <div class="gift-card yape-card">
      <div class="yape-body">
        <div class="yape-icon">💚</div>
        <p class="yape-title">¿Prefieres una transferencia?</p>
        <p class="yape-text">¡Sin problema! El día de la boda tendremos el código Yape disponible para quien prefiera esta opción.</p>
      </div>
    </div>`;

  giftsGrid.innerHTML = gifts.map(gift => {
    const isReserved = String(gift['Status']).toLowerCase() === 'reservado';
    const name       = escapeHtml(gift['Articulo'] || '');
    const desc       = escapeHtml(gift['Descripción'] || gift['Descripcion'] || '');
    const price      = formatPrice(gift['Precio']);
    const photo      = gift['Foto URL'] || '';
    const id         = gift['id'];

    return `
      <div class="gift-card ${isReserved ? 'reserved' : ''}" data-id="${id}">
        <div class="gift-img-wrap">
          ${photo
            ? `<img class="gift-img" src="${escapeHtml(photo)}" alt="${name}" loading="lazy" onerror="this.style.display='none'" />`
            : ''}
          <span class="gift-badge ${isReserved ? 'badge-reserved' : 'badge-available'}">
            ${isReserved ? 'Reservado' : 'Disponible'}
          </span>
        </div>
        <div class="gift-body">
          <p class="gift-name">${name}</p>
          ${desc ? `<p class="gift-desc">${desc}</p>` : ''}
          ${price ? `<p class="gift-price">${price}<span class="gift-price-label">Precio de referencia</span></p>` : ''}
        </div>
        ${isReserved
          ? `<div class="reserved-label">Ya fue reservado ✓<span class="reserved-note">¿Necesitas un cambio? Avísanos</span></div>`
          : `<button class="btn-reserve" data-id="${id}">Reservar este regalo</button>`
        }
      </div>`;
  }).join('') + yapeCard;

  // Eventos en botones de reservar
  giftsGrid.querySelectorAll('.btn-reserve').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.id));
  });
}

function formatPrice(raw) {
  if (!raw && raw !== 0) return '';
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return raw;
  return 'S/. ' + num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── MODAL DE RESERVA ─────────────────────────────────────────
function openModal(id) {
  selectedGift = gifts.find(g => String(g['id']) === String(id));
  if (!selectedGift) return;

  const isReserved = String(selectedGift['Status']).toLowerCase() === 'reservado';
  if (isReserved) return;

  modalTitle.textContent   = selectedGift['Articulo'] || '';
  modalPrice.textContent   = formatPrice(selectedGift['Precio']);
  modalGiftImg.src         = selectedGift['Foto URL'] || '';
  modalGiftImg.alt         = selectedGift['Articulo'] || '';
  modalError.textContent   = '';
  confirmBtn.disabled      = false;
  confirmBtn.textContent   = 'Reservar este regalo';

  modalBackdrop.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalBackdrop.classList.remove('visible');
  document.body.style.overflow = '';
  selectedGift = null;
}

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => {
  if (e.target === modalBackdrop) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── CONFIRMAR RESERVA ────────────────────────────────────────
confirmBtn.addEventListener('click', async () => {
  if (!selectedGift) return;

  const id = selectedGift['id'];
  const giftName = selectedGift['Articulo'] || 'el regalo';
  modalError.textContent   = '';
  confirmBtn.disabled      = true;
  confirmBtn.textContent   = 'Reservando…';

  // Sin Apps Script: modo demo (solo esta sesión)
  if (APPS_SCRIPT_URL === 'PEGAR_URL_DEL_APPS_SCRIPT_AQUI') {
    updateGiftLocally(id);
    closeModal();
    showToast(`¡Listo! Reservaste "${giftName}"`);
    return;
  }

  try {
    const url  = `${APPS_SCRIPT_URL}?action=reserve&id=${encodeURIComponent(id)}`;
    const resp = await fetch(url);
    const json = await resp.json();

    if (json.status === 'ok') {
      updateGiftLocally(id);
      closeModal();
      showToast(`¡Listo! Reservaste "${giftName}"`);
    } else {
      modalError.textContent = json.message || 'Ocurrió un error, intenta de nuevo.';
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'Reservar este regalo';
    }
  } catch (err) {
    console.error(err);
    modalError.textContent = 'Error de conexión. Intenta de nuevo.';
    confirmBtn.disabled    = false;
    confirmBtn.textContent = 'Reservar este regalo';
  }
});

// Actualiza el estado local del regalo
function updateGiftLocally(id) {
  gifts = gifts.map(g =>
    String(g['id']) === String(id) ? { ...g, Status: 'reservado' } : g
  );
  renderGifts();
}

// ─── TOAST ───────────────────────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── INIT ─────────────────────────────────────────────────────
showPage('inicio');
