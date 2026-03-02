const STORAGE_KEY = "activity-tracking-v1";

const defaultCategories = [
  { id: crypto.randomUUID(), name: "READING", emoji: "📚", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "ENGLISH", emoji: "🇬🇧", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "RUSSIAN", emoji: "🇷🇺", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "SKILLS", emoji: "🧠", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "MEDITATION", emoji: "🧘", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "SPORT", emoji: "🏋️", targets: { week: 4, month: 16, year: 192 } },
  { id: crypto.randomUUID(), name: "FINANCE", emoji: "💰", targets: { week: 4, month: 16, year: 192 } },
];

const state = {
  period: "week",
  offset: 0,
  data: loadState(),
};

const refs = {
  periodButtons: document.querySelectorAll("[data-period]"),
  periodLabel: document.getElementById("periodLabel"),
  prevPeriod: document.getElementById("prevPeriod"),
  nextPeriod: document.getElementById("nextPeriod"),
  overallBattery: document.getElementById("overallBattery"),
  categoryList: document.getElementById("categoryList"),
  addCategoryForm: document.getElementById("addCategoryForm"),
  newCategoryName: document.getElementById("newCategoryName"),
  newCategoryEmoji: document.getElementById("newCategoryEmoji"),
  addLogForm: document.getElementById("addLogForm"),
  logCategory: document.getElementById("logCategory"),
  logDate: document.getElementById("logDate"),
  logUnits: document.getElementById("logUnits"),
  logList: document.getElementById("logList"),
};

refs.logDate.value = todayISO();

bindEvents();
render();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { categories: defaultCategories, logs: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.logs)) throw new Error();
    return parsed;
  } catch {
    return { categories: defaultCategories, logs: [] };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function bindEvents() {
  refs.periodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.period = btn.dataset.period;
      state.offset = 0;
      render();
    });
  });

  refs.prevPeriod.addEventListener("click", () => {
    state.offset -= 1;
    render();
  });

  refs.nextPeriod.addEventListener("click", () => {
    state.offset += 1;
    render();
  });

  refs.addCategoryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = refs.newCategoryName.value.trim().toUpperCase();
    if (!name) return;
    state.data.categories.push({
      id: crypto.randomUUID(),
      name,
      emoji: refs.newCategoryEmoji.value.trim() || "🧩",
      targets: { week: 4, month: 16, year: 192 },
    });
    refs.newCategoryName.value = "";
    refs.newCategoryEmoji.value = "";
    persist();
    render();
  });

  refs.addLogForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const units = Math.max(1, Number(refs.logUnits.value) || 1);
    state.data.logs.push({
      id: crypto.randomUUID(),
      categoryId: refs.logCategory.value,
      date: refs.logDate.value,
      units,
    });
    refs.logUnits.value = "1";
    persist();
    render();
  });
}

function render() {
  refs.periodButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.period === state.period));
  refs.periodLabel.textContent = periodText();
  renderSelect();
  renderOverall();
  renderCategories();
  renderLogs();
}

function renderSelect() {
  refs.logCategory.innerHTML = "";
  state.data.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = `${cat.emoji} ${cat.name}`;
    refs.logCategory.appendChild(opt);
  });
}

function renderOverall() {
  const range = getRange();
  const completed = state.data.categories.reduce((sum, cat) => sum + totalFor(cat.id, range.start, range.end), 0);
  const target = state.data.categories.reduce((sum, cat) => sum + (cat.targets[state.period] || 0), 0);
  refs.overallBattery.innerHTML = "";
  refs.overallBattery.appendChild(makeBattery("Toplam", completed, target));
}

function renderCategories() {
  const range = getRange();
  refs.categoryList.innerHTML = "";

  state.data.categories.forEach((cat) => {
    const card = document.createElement("article");
    card.className = "card";

    const done = totalFor(cat.id, range.start, range.end);
    const target = cat.targets[state.period] || 0;

    card.innerHTML = `
      <div class="card-top">
        <div class="category-id"><span class="emoji">${cat.emoji}</span><span>${cat.name}</span></div>
        <button class="danger" data-remove-cat="${cat.id}">Sil</button>
      </div>
    `;

    card.appendChild(makeBattery(`${cat.name}`, done, target));

    const targetEditor = document.createElement("div");
    targetEditor.className = "target-editor";
    targetEditor.innerHTML = `
      <label>Hafta <input type="number" min="0" value="${cat.targets.week}" data-target="week"></label>
      <label>Ay <input type="number" min="0" value="${cat.targets.month}" data-target="month"></label>
      <label>Yıl <input type="number" min="0" value="${cat.targets.year}" data-target="year"></label>
      <button data-save-target="${cat.id}">Hedef Kaydet</button>
      <span class="small">Bu görünüm: ${done}/${target}</span>
    `;

    targetEditor.querySelector("[data-save-target]").addEventListener("click", () => {
      targetEditor.querySelectorAll("input").forEach((input) => {
        cat.targets[input.dataset.target] = Math.max(0, Number(input.value) || 0);
      });
      persist();
      render();
    });

    card.querySelector("[data-remove-cat]").addEventListener("click", () => {
      state.data.categories = state.data.categories.filter((c) => c.id !== cat.id);
      state.data.logs = state.data.logs.filter((l) => l.categoryId !== cat.id);
      persist();
      render();
    });

    card.appendChild(targetEditor);
    refs.categoryList.appendChild(card);
  });
}

function renderLogs() {
  refs.logList.innerHTML = "";
  const byId = new Map(state.data.categories.map((c) => [c.id, c]));

  [...state.data.logs]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 80)
    .forEach((log) => {
      const cat = byId.get(log.categoryId);
      if (!cat) return;
      const li = document.createElement("li");
      li.className = "log-item";
      li.innerHTML = `
        <div>
          <strong>${cat.emoji} ${cat.name}</strong>
          <div class="small">${formatDate(log.date)} • ${log.units} birim</div>
        </div>
        <button class="danger" data-remove-log="${log.id}">Sil</button>
      `;
      li.querySelector("[data-remove-log]").addEventListener("click", () => {
        state.data.logs = state.data.logs.filter((l) => l.id !== log.id);
        persist();
        render();
      });
      refs.logList.appendChild(li);
    });
}

function makeBattery(label, done, target) {
  const progress = target <= 0 ? 0 : Math.min(100, Math.round((done / target) * 100));
  const box = document.createElement("div");
  box.className = "battery-wrap";
  box.innerHTML = `
    <div class="battery-label">
      <span>${label}</span>
      <span>%${progress} (${done}/${target})</span>
    </div>
    <div class="battery" aria-label="${label} yüzde ${progress}">
      <div class="battery-fill" style="width:${progress}%"></div>
    </div>
  `;
  return box;
}

function periodText() {
  const now = new Date();
  if (state.period === "week") {
    const { start, end } = getWeekRange(now, state.offset);
    return `${formatDate(start)} - ${formatDate(end)} (Pzt-Paz)`;
  }
  if (state.period === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() + state.offset, 1);
    return d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
  }
  const y = now.getFullYear() + state.offset;
  return `${y}`;
}

function getRange() {
  const now = new Date();
  if (state.period === "week") {
    return getWeekRange(now, state.offset);
  }
  if (state.period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth() + state.offset, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start: toISO(start), end: toISO(end) };
  }
  const year = now.getFullYear() + state.offset;
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function getWeekRange(baseDate, offset) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offset * 7);
  const day = d.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayDelta);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISO(monday), end: toISO(sunday) };
}

function totalFor(categoryId, startISO, endISO) {
  return state.data.logs
    .filter((log) => log.categoryId === categoryId && log.date >= startISO && log.date <= endISO)
    .reduce((sum, log) => sum + log.units, 0);
}

function todayISO() {
  return toISO(new Date());
}

function toISO(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(isoOrDate) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}
