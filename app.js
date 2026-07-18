/* ============================================================
   Cap — suivi personnel
   Toutes les données restent en localStorage, sur cet appareil.
   ============================================================ */

const ENTRIES_KEY = 'cap_entries_v1';
const SETTINGS_KEY = 'cap_settings_v1';
const NOTES_KEY = 'cap_notes_v1';

const RELAPSE_TYPES = ['relapse_no_stim', 'relapse_erotica', 'relapse_porn'];
// Ordre = priorité d'affichage sur le calendrier (le plus "fort" gagne la couleur de la case)
const TYPE_ORDER = ['relapse_porn', 'relapse_erotica', 'relapse_no_stim', 'partner'];
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

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}
function saveNotes(notes) { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

let entries = loadEntries();
let settings = loadSettings();
let notes = loadNotes();

// Migration : les anciennes versions stockaient une note par entrée (un seul type/jour).
// On la reporte vers le nouveau stockage de notes par jour si besoin, une seule fois.
(function migrateNotes() {
  let changed = false;
  for (const e of entries) {
    if (e.note && !notes[e.date]) { notes[e.date] = e.note; changed = true; }
    delete e.note;
  }
  if (changed) { saveNotes(notes); saveEntries(entries); }
})();

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

function entriesForDate(iso) { return entries.filter(e => e.date === iso); }
function hasType(iso, type) { return entries.some(e => e.date === iso && e.type === type); }

function breakingEntriesSorted() {
  const dates = new Set(
    entries
      .filter(e => RELAPSE_TYPES.includes(e.type) || (settings.partnerBreaksStreak && e.type === 'partner'))
      .map(e => e.date)
  );
  return [...dates].sort((a, b) => fromISO(a) - fromISO(b)).map(date => ({ date }));
}

// Nombre de jours depuis la dernière occurrence de chaque type (indépendamment des autres)
function computeItemStreaks() {
  const today = new Date();
  const result = {};
  for (const type of TYPE_ORDER) {
    const dates = entries.filter(e => e.type === type).map(e => fromISO(e.date));
    if (!dates.length) { result[type] = null; continue; }
    const last = new Date(Math.max(...dates));
    result[type] = Math.max(0, daysBetween(last, today));
  }
  return result;
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
  const relapseDays = new Set(entries.filter(e => RELAPSE_TYPES.includes(e.type)).map(e => e.date)).size;
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

  // Boutons rapides : état du jour (plusieurs peuvent être actifs en même temps)
  const todayEntries = entriesForDate(todayISO());
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.classList.toggle('active-today', todayEntries.some(e => e.type === btn.dataset.log));
  });
  document.getElementById('clearTodayBtn').classList.toggle('hidden', todayEntries.length === 0);

  // Séries par item
  const itemStreaks = computeItemStreaks();
  const itemBox = document.getElementById('itemStreaks');
  itemBox.innerHTML = TYPE_ORDER.map(type => {
    const val = itemStreaks[type];
    return `
      <div class="item-streak">
        <span class="item-streak-value">${val === null ? '—' : val}</span>
        <span class="item-streak-label">depuis${type === 'partner' ? '' : ' craquage'}<br>${TYPE_LABELS[type].toLowerCase()}</span>
      </div>`;
  }).join('');

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
    const dayEntries = entriesForDate(iso);
    if (dayEntries.length) {
      const primaryType = TYPE_ORDER.find(t => dayEntries.some(e => e.type === t));
      btn.classList.add(primaryType);
      if (dayEntries.length > 1) {
        btn.classList.add('multi');
        btn.title = dayEntries.map(e => TYPE_LABELS[e.type]).join(' + ');
      }
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
  const dates = [...new Set(entries.map(e => e.date))].sort((a, b) => fromISO(b) - fromISO(a));
  empty.classList.toggle('hidden', dates.length > 0);
  list.innerHTML = dates.map(date => {
    const d = fromISO(date);
    const label = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    const dayTypes = TYPE_ORDER.filter(t => hasType(date, t));
    const note = notes[date];
    const tags = dayTypes.map(t => `<span class="journal-item-tag tag-${t}">${TYPE_LABELS[t]}</span>`).join('');
    return `
      <li class="journal-item" data-date="${date}">
        <div>
          <div class="journal-item-date">${label}</div>
          ${note ? `<div class="journal-item-note">${escapeHtml(note)}</div>` : ''}
        </div>
        <div class="journal-item-tags">${tags}</div>
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
    if (hasType(iso, type)) {
      removeEntry(iso, type);
      showToast('Retiré.');
    } else {
      addEntry(iso, type);
      showToast('Enregistré.');
    }
    saveEntries(entries);
    renderAll();
  });
});

document.getElementById('clearTodayBtn').addEventListener('click', () => {
  const iso = todayISO();
  entries = entries.filter(e => e.date !== iso);
  delete notes[iso];
  saveEntries(entries);
  saveNotes(notes);
  renderAll();
  showToast('Saisie du jour effacée.');
});

function addEntry(iso, type) {
  if (hasType(iso, type)) return;
  entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + type, date: iso, type });
}
function removeEntry(iso, type) {
  entries = entries.filter(e => !(e.date === iso && e.type === type));
}

/* ============================================================
   Modale : jour
   ============================================================ */

const dayModal = document.getElementById('dayModal');
let selectedTypes = new Set();

function openDayModal(iso) {
  document.getElementById('dayDate').value = iso;
  const dayEntries = entriesForDate(iso);
  selectedTypes = new Set(dayEntries.map(e => e.type));
  document.getElementById('dayModalTitle').textContent = fromISO(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('dayNote').value = notes[iso] || '';
  document.querySelectorAll('#typeChoice .type-opt').forEach(opt => {
    opt.classList.toggle('active', selectedTypes.has(opt.dataset.type));
  });
  document.getElementById('deleteDayBtn').classList.toggle('hidden', dayEntries.length === 0 && !notes[iso]);
  dayModal.classList.remove('hidden');
}

document.getElementById('typeChoice').addEventListener('click', (e) => {
  const opt = e.target.closest('.type-opt');
  if (!opt) return;
  const type = opt.dataset.type;
  if (selectedTypes.has(type)) selectedTypes.delete(type); else selectedTypes.add(type);
  opt.classList.toggle('active', selectedTypes.has(type));
});

document.getElementById('dayForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const iso = document.getElementById('dayDate').value;
  const note = document.getElementById('dayNote').value.trim();

  for (const type of TYPE_ORDER) {
    if (selectedTypes.has(type)) addEntry(iso, type);
    else removeEntry(iso, type);
  }
  if (note) notes[iso] = note; else delete notes[iso];

  saveEntries(entries);
  saveNotes(notes);
  dayModal.classList.add('hidden');
  renderAll();
  showToast('Enregistré.');
});

document.getElementById('deleteDayBtn').addEventListener('click', () => {
  const iso = document.getElementById('dayDate').value;
  entries = entries.filter(x => x.date !== iso);
  delete notes[iso];
  saveEntries(entries);
  saveNotes(notes);
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
  const data = { entries, notes, settings: { ...settings, pinHash: undefined }, exportedAt: new Date().toISOString() };
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
      notes = data.notes && typeof data.notes === 'object' ? data.notes : {};
      settings = { ...settings, ...(data.settings || {}) };
      saveEntries(entries);
      saveNotes(notes);
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
