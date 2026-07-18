/* ============================================================
   Cap — suivi personnel
   Toutes les données restent en localStorage, sur cet appareil.
   ============================================================ */

const ENTRIES_KEY = 'cap_entries_v1';
const SETTINGS_KEY = 'cap_settings_v1';

const RELAPSE_TYPES = ['relapse_no_stim', 'relapse_erotica', 'relapse_porn'];
const TYPE_LABELS = {
  relapse_no_stim: 'Sans stimulation',
  relapse_erotica: 'Lecture érotique',
  relapse_porn: 'Porno',
  partner: 'Avec ma compagne'
};
const TYPE_COLORS_VAR = {
  relapse_no_stim: '--no-stim',
  relapse_erotica: '--erotica',
  relapse_porn: '--porn',
  partner: '--partner'
};

function todayISO() { return toISO(new Date()); }

const DEFAULT_SETTINGS = {
  trackingStart: todayISO(),
  partnerBreaksStreak: false,
  darkMode: false,
  pinHash: null
};

/* ---------- Stockage ---------- */

function loadEntries() {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}
function saveEntries(entries) { localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries)); }

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

let entries = loadEntries();
let settings = loadSettings();

/* ---------- Utilitaires de dates ---------- */

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function fromISO(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / MS);
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

/* ============================================================
   Calculs : séries, stats
   ============================================================ */

function entryFor(iso) { return entries.find(e => e.date === iso) || null; }

function breakingEntriesSorted() {
  return entries
    .filter(e => RELAPSE_TYPES.includes(e.type) || (settings.partnerBreaksStreak && e.type === 'partner'))
    .slice()
    .sort((a, b) => fromISO(a.date) - fromISO(b.date));
}

function computeStreaks() {
  const today = new Date();
  const breaking = breakingEntriesSorted();
  let prevDate = fromISO(settings.trackingStart);
  let best = 0;
  for (const b of breaking) {
    const bd = fromISO(b.date);
    const gap = daysBetween(prevDate, bd);
    if (gap > best) best = gap;
    prevDate = bd;
  }
  const current = Math.max(0, daysBetween(prevDate, today));
  if (current > best) best = current;
  return { current, best };
}

function computeStats() {
  const today = new Date();
  const totalDays = Math.max(1, daysBetween(fromISO(settings.trackingStart), today) + 1);
  const relapseDays = entries.filter(e => RELAPSE_TYPES.includes(e.type)).length;
  const successRate = Math.round(((totalDays - relapseDays) / totalDays) * 100);
  const counts = {
    relapse_no_stim: entries.filter(e => e.type === 'relapse_no_stim').length,
    relapse_erotica: entries.filter(e => e.type === 'relapse_erotica').length,
    relapse_porn: entries.filter(e => e.type === 'relapse_porn').length,
    partner: entries.filter(e => e.type === 'partner').length
  };
  return { totalDays, successRate, counts };
}

/* ============================================================
   État de navigation du calendrier
   ============================================================ */

let viewDate = new Date();
viewDate.setDate(1);

/* ============================================================
   Rendu
   ============================================================ */

function renderDashboard() {
  const { current, best } = computeStreaks();
  const stats = computeStats();

  document.getElementById('currentStreak').textContent = current;
  document.getElementById('bestStreak').textContent = best;
  document.getElementById('totalDays').textContent = stats.totalDays;
  document.getElementById('successRate').textContent = `${stats.successRate}%`;

  const captions = ['série en cours'];
  document.getElementById('streakCaption').textContent = current === 0 ? 'nouveau départ' : 'série en cours';

  // Boutons rapides : état du jour
  const todayEntry = entryFor(todayISO());
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.classList.toggle('active-today', !!todayEntry && todayEntry.type === btn.dataset.log);
  });
  document.getElementById('clearTodayBtn').classList.toggle('hidden', !todayEntry);

  // Barres de répartition
  const bars = document.getElementById('statsBars');
  const maxCount = Math.max(1, ...Object.values(stats.counts));
  const order = ['relapse_no_stim', 'relapse_erotica', 'relapse_porn', 'partner'];
  bars.innerHTML = order.map(type => {
    const count = stats.counts[type];
    const pct = Math.round((count / maxCount) * 100);
    const colorVar = `var(${TYPE_COLORS_VAR[type]})`;
    return `
      <div class="bar-row">
        <span class="bar-label">${TYPE_LABELS[type]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${colorVar}"></div></div>
        <span class="bar-value">${count}</span>
      </div>`;
  }).join('');
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  document.getElementById('monthLabel').textContent = `${MONTHS_FR[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = addDays(firstOfMonth, -startWeekday);
  const today = new Date();
  const trackingStart = fromISO(settings.trackingStart);

  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    const btn = document.createElement('button');
    btn.className = 'day-cell';
    btn.type = 'button';
    btn.textContent = d.getDate();
    if (d.getMonth() !== viewDate.getMonth()) btn.classList.add('outside');
    if (isSameDay(d, today)) btn.classList.add('today');

    const iso = toISO(d);
    const entry = entryFor(iso);
    if (entry) {
      btn.classList.add(entry.type);
    } else if (d > today || d < trackingStart) {
      btn.classList.add('future');
    } else {
      btn.classList.add('clean-streak');
    }

    btn.addEventListener('click', () => openDayModal(iso));
    grid.appendChild(btn);
  }
}

function renderJournal() {
  const list = document.getElementById('journalList');
  const empty = document.getElementById('journalEmpty');
  const sorted = [...entries].sort((a, b) => fromISO(b.date) - fromISO(a.date));
  empty.classList.toggle('hidden', sorted.length > 0);
  list.innerHTML = sorted.map(e => {
    const d = fromISO(e.date);
    const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <li class="journal-item" data-date="${e.date}">
        <div>
          <div class="journal-item-date">${label}</div>
          ${e.note ? `<div class="journal-item-note">${escapeHtml(e.note)}</div>` : ''}
        </div>
        <span class="journal-item-tag tag-${e.type}">${TYPE_LABELS[e.type]}</span>
      </li>`;
  }).join('');
  list.querySelectorAll('.journal-item').forEach(li => {
    li.addEventListener('click', () => openDayModal(li.dataset.date));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  renderDashboard();
  renderCalendar();
  renderJournal();
}

/* ============================================================
   Saisie rapide (aujourd'hui)
   ============================================================ */

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.log;
    const iso = todayISO();
    const existing = entryFor(iso);
    if (existing && existing.type === type) {
      entries = entries.filter(e => e.date !== iso);
      showToast('Saisie du jour annulée.');
    } else {
      upsertEntry(iso, type, existing ? existing.note : '');
      showToast('Enregistré.');
    }
    saveEntries(entries);
    renderAll();
  });
});

document.getElementById('clearTodayBtn').addEventListener('click', () => {
  entries = entries.filter(e => e.date !== todayISO());
  saveEntries(entries);
  renderAll();
  showToast('Saisie du jour effacée.');
});

function upsertEntry(iso, type, note) {
  const existing = entries.find(e => e.date === iso);
  if (existing) {
    existing.type = type;
    existing.note = note || '';
  } else {
    entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date: iso, type, note: note || '' });
  }
}

/* ============================================================
   Modale : jour
   ============================================================ */

const dayModal = document.getElementById('dayModal');
let selectedType = '';

function openDayModal(iso) {
  document.getElementById('dayDate').value = iso;
  const entry = entryFor(iso);
  selectedType = entry ? entry.type : '';
  document.getElementById('dayModalTitle').textContent = fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('dayNote').value = entry ? entry.note || '' : '';
  document.querySelectorAll('#typeChoice .type-opt').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.type === selectedType);
  });
  document.getElementById('deleteDayBtn').classList.toggle('hidden', !entry);
  dayModal.classList.remove('hidden');
}

document.getElementById('typeChoice').addEventListener('click', (e) => {
  const opt = e.target.closest('.type-opt');
  if (!opt) return;
  selectedType = opt.dataset.type;
  document.querySelectorAll('#typeChoice .type-opt').forEach(o => o.classList.toggle('active', o === opt));
});

document.getElementById('dayForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const iso = document.getElementById('dayDate').value;
  const note = document.getElementById('dayNote').value.trim();
  if (!selectedType) {
    entries = entries.filter(x => x.date !== iso);
  } else {
    upsertEntry(iso, selectedType, note);
  }
  saveEntries(entries);
  dayModal.classList.add('hidden');
  renderAll();
  showToast('Enregistré.');
});

document.getElementById('deleteDayBtn').addEventListener('click', () => {
  const iso = document.getElementById('dayDate').value;
  entries = entries.filter(x => x.date !== iso);
  saveEntries(entries);
  dayModal.classList.add('hidden');
  renderAll();
  showToast('Entrée supprimée.');
});

/* ============================================================
   Modale : réglages
   ============================================================ */

const settingsModal = document.getElementById('settingsModal');

document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('trackingStart').value = settings.trackingStart;
  document.getElementById('partnerBreaksStreak').checked = !!settings.partnerBreaksStreak;
  document.getElementById('darkMode').checked = !!settings.darkMode;
  document.getElementById('removePinBtn').classList.toggle('hidden', !settings.pinHash);
  settingsModal.classList.remove('hidden');
});

document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  settings.trackingStart = document.getElementById('trackingStart').value || todayISO();
  settings.partnerBreaksStreak = document.getElementById('partnerBreaksStreak').checked;
  settings.darkMode = document.getElementById('darkMode').checked;
  saveSettings(settings);
  applyTheme();
  settingsModal.classList.add('hidden');
  renderAll();
  showToast('Réglages enregistrés.');
});

document.getElementById('removePinBtn').addEventListener('click', () => {
  if (!confirm('Retirer le code d\'accès ?')) return;
  settings.pinHash = null;
  saveSettings(settings);
  document.getElementById('removePinBtn').classList.add('hidden');
  showToast('Code retiré.');
});

/* ============================================================
   Fermeture générique des modales
   ============================================================ */

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    dayModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    pinSetupModal.classList.add('hidden');
  });
});
[dayModal, settingsModal].forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

/* ============================================================
   Export / Import
   ============================================================ */

document.getElementById('exportBtn').addEventListener('click', () => {
  const data = { entries, settings: { ...settings, pinHash: undefined }, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cap-sauvegarde-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.entries)) throw new Error('Format invalide');
      if (!confirm(`Importer ${data.entries.length} entrée(s) ? Cela remplacera les données actuelles.`)) return;
      entries = data.entries;
      settings = { ...settings, ...(data.settings || {}) };
      saveEntries(entries);
      saveSettings(settings);
      applyTheme();
      renderAll();
      showToast('Import réussi.');
    } catch (err) {
      showToast('Fichier invalide.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

/* ============================================================
   Thème, toast, navigation
   ============================================================ */

function applyTheme() { document.documentElement.setAttribute('data-theme', settings.darkMode ? 'dark' : 'light'); }

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2400);
}

document.getElementById('prevMonth').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); renderCalendar(); });
document.getElementById('todayBtn').addEventListener('click', () => { viewDate = new Date(); viewDate.setDate(1); renderCalendar(); });

/* ============================================================
   Verrouillage par code PIN
   ============================================================ */

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const lockScreen = document.getElementById('lockScreen');
const appRoot = document.getElementById('appRoot');
let enteredPin = '';

function updatePinDots(containerId, length) {
  const dots = document.querySelectorAll(`#${containerId} span`);
  dots.forEach((dot, i) => dot.classList.toggle('filled', i < length));
}

document.querySelectorAll('.pin-pad [data-key]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.key;
    if (key === 'clear') { enteredPin = ''; }
    else if (key === 'back') { enteredPin = enteredPin.slice(0, -1); }
    else if (enteredPin.length < 4) { enteredPin += key; }
    updatePinDots('pinDots', enteredPin.length);
    document.getElementById('lockError').classList.add('hidden');
    if (enteredPin.length === 4) {
      const hash = await sha256(enteredPin);
      if (hash === settings.pinHash) {
        unlockApp();
      } else {
        document.getElementById('lockError').classList.remove('hidden');
        enteredPin = '';
        setTimeout(() => updatePinDots('pinDots', 0), 300);
      }
    }
  });
});

function unlockApp() {
  enteredPin = '';
  updatePinDots('pinDots', 0);
  lockScreen.classList.add('hidden');
  appRoot.classList.remove('hidden');
  renderAll();
}

document.getElementById('lockNowBtn').addEventListener('click', () => {
  if (!settings.pinHash) { showToast('Aucun code défini — voir Réglages.'); return; }
  appRoot.classList.add('hidden');
  lockScreen.classList.remove('hidden');
  enteredPin = '';
  updatePinDots('pinDots', 0);
});

/* ---------- Définition du PIN ---------- */

const pinSetupModal = document.getElementById('pinSetupModal');
let setupStage = 'first';
let setupFirstPin = '';
let setupPin = '';

document.getElementById('setPinBtn').addEventListener('click', () => {
  setupStage = 'first';
  setupFirstPin = '';
  setupPin = '';
  document.getElementById('setupPinPrompt').classList.add('hidden');
  updatePinDots('setupPinDots', 0);
  pinSetupModal.classList.remove('hidden');
});

document.querySelectorAll('.pin-pad [data-setup-key]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const key = btn.dataset.setupKey;
    if (key === 'clear') { setupPin = ''; }
    else if (key === 'back') { setupPin = setupPin.slice(0, -1); }
    else if (setupPin.length < 4) { setupPin += key; }
    updatePinDots('setupPinDots', setupPin.length);

    if (setupPin.length === 4) {
      if (setupStage === 'first') {
        setupFirstPin = setupPin;
        setupPin = '';
        setupStage = 'confirm';
        document.getElementById('setupPinPrompt').textContent = 'Confirmez le code';
        document.getElementById('setupPinPrompt').classList.remove('hidden');
        setTimeout(() => updatePinDots('setupPinDots', 0), 200);
      } else {
        if (setupPin === setupFirstPin) {
          settings.pinHash = await sha256(setupPin);
          saveSettings(settings);
          pinSetupModal.classList.add('hidden');
          document.getElementById('removePinBtn').classList.remove('hidden');
          showToast('Code défini.');
        } else {
          document.getElementById('setupPinPrompt').textContent = 'Les codes ne correspondent pas — recommencez';
          document.getElementById('setupPinPrompt').classList.remove('hidden');
          setupStage = 'first';
          setupFirstPin = '';
          setupPin = '';
          setTimeout(() => updatePinDots('setupPinDots', 0), 300);
        }
      }
    }
  });
});

/* ============================================================
   Initialisation
   ============================================================ */

applyTheme();
if (settings.pinHash) {
  lockScreen.classList.remove('hidden');
} else {
  appRoot.classList.remove('hidden');
  renderAll();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
