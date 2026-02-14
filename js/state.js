/* ============================================================
   state.js — Game state init/save/load, DOM helpers
   ============================================================ */

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function renderMarkdown(text) {
  let h = escapeHtml(text);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`(.+?)`/g, '<code>$1</code>');
  h = h.split(/\n{2,}/).map(p => `<p>${p.trim()}</p>`).join('');
  h = h.replace(/\n/g, '<br>');
  return h;
}

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function randRange(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(randRange(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function weighted(val, weight) { return val * weight + (1 - weight) * 50; }

// Format game date
function formatDate(turn) {
  const totalMonth = CONFIG.START_MONTH + turn;
  const month = totalMonth % 12;
  const year = CONFIG.START_YEAR + Math.floor(totalMonth / 12);
  return `${CONFIG.MONTHS[month]} ${year}`;
}

function getMonth(turn) {
  return (CONFIG.START_MONTH + turn) % 12;
}

function getYear(turn) {
  return CONFIG.START_YEAR + Math.floor((CONFIG.START_MONTH + turn) / 12);
}

// ---- Game State ----

const SAVE_SLOTS = 3;

let gameState = null;

function createGameState(playerParty, playerName) {
  const party = PARTIES[playerParty];
  return {
    version: CONFIG.VERSION,
    playerParty,
    playerName,
    phase: 'governing', // 'campaign' or 'governing'
    turn: 0,
    turnsInParliament: 0,
    electionCount: 0,
    saveSlot: 1, // active save slot (1-3)

    // Seats from last election
    seats: { ...BASELINE_SEATS },

    // National polling (%)
    polling: { ...BASELINE_POLLING },

    // Player party stats
    approval: 45,           // PM approval rating 0-100
    approvalTrend: 0,       // last change
    unity: 70,              // party unity 0-100
    partyFunds: 500,        // campaign funds
    activists: 200,         // grassroots strength

    // Policy positions (player's party — 0-100 per axis)
    policy: { ...party.ideology },

    // Governing
    bills: [],              // active legislation
    billHistory: [],        // passed/failed bills
    governmentBudget: 100,  // political capital for whipping

    // Parliament state
    isInGovernment: playerParty === 'lab', // Labour won 2024
    pmParty: 'lab',
    oppositionLeader: playerParty === 'lab' ? 'con' : playerParty,
    coalitionPartners: [],

    // Events
    currentEvent: null,
    eventLog: [],
    newsLog: [],

    // Campaign
    campaignTargets: [],     // targeted regions
    campaignResources: { funds: 0, activists: 0 },

    // Election results history
    electionHistory: [],

    // Settings
    ollamaEndpoint: CONFIG.OLLAMA_ENDPOINT,
    ollamaModel: CONFIG.OLLAMA_MODEL,
    aiEnabled: true,
    aiQuality: 'standard', // 'standard' or 'enhanced'
  };
}

// ---- Multi-Slot Save System ----

function slotKey(slot) {
  return `parliament_save_${slot}`;
}

function getSaveSlots() {
  const slots = [];
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(slotKey(i));
      if (raw) {
        const state = JSON.parse(raw);
        slots.push({
          slot: i,
          name: state.playerName || 'Unknown',
          party: state.playerParty || 'lab',
          date: formatDate(state.turn || 0),
          turn: state.turn || 0,
        });
      } else {
        slots.push({ slot: i, empty: true });
      }
    } catch {
      slots.push({ slot: i, empty: true });
    }
  }
  return slots;
}

function saveGameToSlot(slot) {
  if (!gameState) return;
  try {
    gameState.saveSlot = slot;
    localStorage.setItem(slotKey(slot), JSON.stringify(gameState));
  } catch (e) {
    console.warn('Save failed:', e);
  }
}

function loadGameFromSlot(slot) {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state && state.version) {
      state.saveSlot = slot;
      gameState = state;
      return state;
    }
  } catch (e) {
    console.warn('Load failed:', e);
  }
  return null;
}

function deleteSlot(slot) {
  localStorage.removeItem(slotKey(slot));
  if (gameState && gameState.saveSlot === slot) {
    gameState = null;
  }
}

function hasSaveSlots() {
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    if (localStorage.getItem(slotKey(i))) return true;
  }
  return false;
}

// Auto-save to the currently active slot
function saveGame() {
  if (!gameState) return;
  const slot = gameState.saveSlot || 1;
  saveGameToSlot(slot);
}

// Compat shim: migrate old single-key save to slot 1
function loadGame() {
  // Check for legacy save and migrate
  try {
    const legacy = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (legacy) {
      const state = JSON.parse(legacy);
      if (state && state.version) {
        state.saveSlot = 1;
        gameState = state;
        localStorage.setItem(slotKey(1), legacy);
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        // Re-save with saveSlot field
        saveGameToSlot(1);
        return state;
      }
    }
  } catch (e) {
    console.warn('Legacy migration failed:', e);
  }

  // Try loading from any occupied slot (prefer slot 1)
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    const state = loadGameFromSlot(i);
    if (state) return state;
  }
  return null;
}

function deleteSave() {
  for (let i = 1; i <= SAVE_SLOTS; i++) {
    localStorage.removeItem(slotKey(i));
  }
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  gameState = null;
}

function hasSave() {
  // Check legacy key or any slot
  if (localStorage.getItem(CONFIG.STORAGE_KEY)) return true;
  return hasSaveSlots();
}

// ---- Toast ----
let toastTimer;
function showToast(msg, type) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast visible' + (type === 'success' ? ' success' : type === 'danger' ? ' danger' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 3500);
}
