// Oscillation OS v1.0 – Core Logic

const STORAGE_KEY_STATE_LOG = "oscillation.os.stateLog";
const STORAGE_KEY_FIELD_LOG = "oscillation.os.fieldLog";

// Utility helpers
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

function todayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function toggleInfo(id) {
  const box = document.getElementById(id);
  box.classList.toggle("hidden");
}

// Initial data
let stateLog = loadJSON(STORAGE_KEY_STATE_LOG, []);
let fieldLog = loadJSON(STORAGE_KEY_FIELD_LOG, { ground: [], flight: [] });

// Elements
const dateEl = document.getElementById("osc-date");
const poleSliderEl = document.getElementById("osc-pole-slider");
const intensityLabelEl = document.getElementById("osc-intensity-label");
const currentPolePillEl = document.getElementById("osc-current-pole-pill");
const energySliderEl = document.getElementById("osc-energy-rating");
const energyTextEl = document.getElementById("osc-energy-text");
const noteEl = document.getElementById("osc-note");
const setStateBtn = document.getElementById("osc-set-state-btn");

const groundInputEl = document.getElementById("osc-ground-input");
const flightInputEl = document.getElementById("osc-flight-input");
const addGroundBtn = document.getElementById("osc-add-ground-btn");
const addFlightBtn = document.getElementById("osc-add-flight-btn");
const groundListEl = document.getElementById("osc-ground-list");
const flightListEl = document.getElementById("osc-flight-list");

const todayLogEl = document.getElementById("osc-today-log");
const historySummaryEl = document.getElementById("osc-history-summary");
const reflectionEl = document.getElementById("osc-engine-reflection");

const momentumPhaseEl = document.getElementById("osc-momentum-phase");
const frequencyLabelEl = document.getElementById("osc-frequency-label");
const resetBtn = document.getElementById("osc-reset-btn");

// Date display
function updateDateDisplay() {
  const now = new Date();
  dateEl.textContent = now.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

// Energy label
function describeEnergyLevel(v) {
  const n = Number(v);
  switch (n) {
    case 1:
      return "Drained";
    case 2:
      return "Low";
    case 3:
      return "Neutral";
    case 4:
      return "Charged";
    case 5:
      return "Electric";
    default:
      return "Neutral";
  }
}

// Pole label
function describePole(value) {
  const num = Number(value);
  if (num > 10) return "FLIGHT";
  if (num < -10) return "GROUND";
  return "CENTER";
}

// Momentum phase from last few states
function computeMomentumPhase(log) {
  if (log.length < 2) return "Seeding";

  const recent = log.slice(-4);
  const last = recent[recent.length - 1];
  const prev = recent[recent.length - 2];

  if (last.pole === "CENTER") return "Resetting";

  const lastVal = last.pole === "FLIGHT" ? 1 : -1;
  const prevVal = prev.pole === "FLIGHT" ? 1 : prev.pole === "GROUND" ? -1 : 0;

  const diffMinutes =
    (last.timestamp - prev.timestamp) / (1000 * 60);

  if (diffMinutes > 180) {
    return last.pole === "FLIGHT" ? "Gentle Rise" : "Deep Grounding";
  }

  if (lastVal === prevVal && lastVal !== 0) {
    return lastVal === 1 ? "Ascent" : "Descent";
  }

  if (lastVal !== prevVal && lastVal !== 0 && prevVal !== 0) {
    return "Snap Turn";
  }

  return "Oscillating";
}

// Frequency classification
function computeFrequencyLabel(log) {
  if (log.length < 3) return "Low (warming up)";

  const changes = [];
  for (let i = 1; i < log.length; i++) {
    const prev = log[i - 1];
    const curr = log[i];
    if (prev.pole !== curr.pole) {
      const diffMinutes =
        (curr.timestamp - prev.timestamp) / (1000 * 60);
      changes.push(diffMinutes);
    }
  }
  if (changes.length === 0) return "Flat";

  const avg = changes.reduce((a, b) => a + b, 0) / changes.length;

  if (avg > 240) return "Very Low (long stretches)";
  if (avg > 90) return "Low";
  if (avg > 30) return "Medium";
  if (avg > 10) return "High";
  return "Humming";
}

// Rendering

function renderPoleState() {
  const value = Number(poleSliderEl.value);
  const intensity = Math.abs(value);
  intensityLabelEl.textContent = `${intensity}%`;

  const pole = describePole(value);
  if (pole === "FLIGHT") {
    currentPolePillEl.textContent = "FLIGHT – creative / refined";
    currentPolePillEl.style.background =
      "linear-gradient(120deg, rgba(102,224,255,0.18), rgba(255,255,255,0.06))";
  } else if (pole === "GROUND") {
    currentPolePillEl.textContent = "GROUND – body / real work";
    currentPolePillEl.style.background =
      "linear-gradient(120deg, rgba(245,124,107,0.24), rgba(255,255,255,0.06))";
  } else {
    currentPolePillEl.textContent = "CENTER – reset / neutral";
    currentPolePillEl.style.background =
      "linear-gradient(120deg, rgba(255,255,255,0.02), rgba(255,255,255,0.08))";
  }
}

function renderEnergyText() {
  energyTextEl.textContent = describeEnergyLevel(energySliderEl.value);
}

function renderFieldLists() {
  groundListEl.innerHTML = "";
  flightListEl.innerHTML = "";

  fieldLog.ground
    .slice()
    .reverse()
    .forEach((entry) => {
      const li = document.createElement("li");
      li.className = "entry-item";
      li.innerHTML = `
        <div class="entry-meta">
          <span>${formatTime(entry.timestamp)}</span>
          <span>${formatDateShort(entry.timestamp)}</span>
        </div>
        <div>${entry.text}</div>
      `;
      groundListEl.appendChild(li);
    });

  fieldLog.flight
    .slice()
    .reverse()
    .forEach((entry) => {
      const li = document.createElement("li");
      li.className = "entry-item";
      li.innerHTML = `
        <div class="entry-meta">
          <span>${formatTime(entry.timestamp)}</span>
          <span>${formatDateShort(entry.timestamp)}</span>
        </div>
        <div>${entry.text}</div>
      `;
      flightListEl.appendChild(li);
    });
}

function renderTodayLog() {
  todayLogEl.innerHTML = "";
  const today = todayKey(Date.now());
  const todays = stateLog.filter((s) => s.dayKey === today);

  if (todays.length === 0) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent =
      "No states logged yet today. Log one above to start today’s cycle.";
    todayLogEl.appendChild(p);
    return;
  }

  todays
    .slice()
    .reverse()
    .forEach((s) => {
      const li = document.createElement("li");
      li.className = "state-log-item";

      const label =
        s.pole === "FLIGHT"
          ? "FLIGHT"
          : s.pole === "GROUND"
          ? "GROUND"
          : "CENTER";

      li.innerHTML = `
        <div class="state-log-meta">
          <span>${formatTime(s.timestamp)} • ${label}</span>
          <span>${"⚡".repeat(s.energy || 1)}</span>
        </div>
        <div class="state-log-note">${
          s.note ? s.note : "<span class='hint'>No note</span>"
        }</div>
      `;

      todayLogEl.appendChild(li);
    });
}

function renderHistorySummary() {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const recent = stateLog.filter((s) => s.timestamp >= sevenDaysAgo);

  if (recent.length === 0) {
    historySummaryEl.innerHTML = `
      <p class="hint">
        When you’ve logged a few days of states, this panel will show your
        Ground vs Flight distribution for the last 7 days.
      </p>
    `;
    return;
  }

  let groundCount = 0;
  let flightCount = 0;
  recent.forEach((s) => {
    if (s.pole === "GROUND") groundCount++;
    if (s.pole === "FLIGHT") flightCount++;
  });

  const total = groundCount + flightCount || 1;
  const groundPct = Math.round((groundCount / total) * 100);
  const flightPct = Math.round((flightCount / total) * 100);

  historySummaryEl.innerHTML = `
    <div class="history-bars">
      <div class="history-bar-row">
        <span class="history-bar-label">GROUND</span>
        <div class="history-bar-track">
          <div class="history-bar-fill-ground" style="width: ${groundPct}%;"></div>
        </div>
        <span class="history-bar-count">${groundCount}</span>
      </div>
      <div class="history-bar-row">
        <span class="history-bar-label">FLIGHT</span>
        <div class="history-bar-track">
          <div class="history-bar-fill-flight" style="width: ${flightPct}%;"></div>
        </div>
        <span class="history-bar-count">${flightCount}</span>
      </div>
    </div>
    <p class="hint" style="margin-top:6px;">
      Last 7 days • ${groundPct}% Ground, ${flightPct}% Flight
    </p>
  `;
}

function renderReflection() {
  if (stateLog.length < 3) {
    reflectionEl.textContent =
      "Log at least 3 states to unlock pattern reflections.";
    return;
  }

  const phase = computeMomentumPhase(stateLog);
  const freq = computeFrequencyLabel(stateLog);

  let message = "";

  if (freq.startsWith("Very Low")) {
    message =
      "Your engine is on long stretches. Nothing wrong with that, but consider a deliberate snap: a strong Ground move followed by a clean Flight session.";
  } else if (freq.startsWith("Low")) {
    message =
      "Low oscillation frequency. You’re holding phases for a while. Choose one sharp contrasting action to nudge the loop.";
  } else if (freq.startsWith("Medium")) {
    message =
      "You’re in a healthy medium oscillation. Keep one meaningful Ground move and one focused Flight move each day to maintain the hum.";
  } else if (freq.startsWith("High")) {
    message =
      "High oscillation frequency. You’re switching states often. Protect recovery windows and make sure each switch is intentional, not reactive.";
  } else if (freq.startsWith("Humming")) {
    message =
      "Humming. Your engine is running close to its natural rhythm. This is prime territory for deep creation and structural decisions.";
  } else if (freq === "Flat") {
    message =
      "Flat pattern. Poles aren’t switching much. Either you’re resting (good) or stuck (less good). A single decisive move can restart the loop.";
  } else {
    message =
      "Your pattern is still forming. Keep logging honestly; the engine will surface a clearer rhythm soon.";
  }

  reflectionEl.textContent = `${phase} • ${freq}. ${message}`;
}

function renderMeta() {
  const phase = computeMomentumPhase(stateLog);
  const freq = computeFrequencyLabel(stateLog);
  momentumPhaseEl.textContent = phase;
  frequencyLabelEl.textContent = freq;
}

// Actions

function handleLogState() {
  const timestamp = Date.now();
  const value = Number(poleSliderEl.value);
  const energy = Number(energySliderEl.value);
  const note = noteEl.value.trim();
  const pole = describePole(value);

  const entry = {
    timestamp,
    dayKey: todayKey(timestamp),
    pole,
    rawValue: value,
    energy,
    note,
  };

  stateLog.push(entry);
  saveJSON(STORAGE_KEY_STATE_LOG, stateLog);

  noteEl.value = "";

  renderTodayLog();
  renderHistorySummary();
  renderReflection();
  renderMeta();
}

function handleAddField(kind) {
  const text =
    kind === "ground"
      ? groundInputEl.value.trim()
      : flightInputEl.value.trim();
  if (!text) return;

  const entry = {
    timestamp: Date.now(),
    text,
  };

  fieldLog[kind].push(entry);
  saveJSON(STORAGE_KEY_FIELD_LOG, fieldLog);

  if (kind === "ground") {
    groundInputEl.value = "";
  } else {
    flightInputEl.value = "";
  }

  renderFieldLists();
}

function handleResetAll() {
  if (!confirm("Reset all Oscillation OS data? This cannot be undone.")) return;
  stateLog = [];
  fieldLog = { ground: [], flight: [] };
  saveJSON(STORAGE_KEY_STATE_LOG, stateLog);
  saveJSON(STORAGE_KEY_FIELD_LOG, fieldLog);
  renderFieldLists();
  renderTodayLog();
  renderHistorySummary();
  renderReflection();
  renderMeta();
}

// Event wiring

poleSliderEl.addEventListener("input", renderPoleState);
energySliderEl.addEventListener("input", renderEnergyText);
setStateBtn.addEventListener("click", handleLogState);
addGroundBtn.addEventListener("click", () => handleAddField("ground"));
addFlightBtn.addEventListener("click", () => handleAddField("flight"));
resetBtn.addEventListener("click", handleResetAll);

// Initial render

updateDateDisplay();
renderPoleState();
renderEnergyText();
renderFieldLists();
renderTodayLog();
renderHistorySummary();
renderReflection();
renderMeta();
