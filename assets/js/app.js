// =============================================================
// 1. CONFIGURAÇÕES E ESTADO
// =============================================================

const CYCLE_LENGTH = 7;
const PROGRAM_LENGTH = 12;

const categories = {
  corpo: { label: "Corpo", icon: "◒", message: "Energia e saúde", color: "#ff7557" },
  carreira: { label: "Carreira", icon: "↗", message: "Trabalho e crescimento", color: "#8e7dff" },
  vida: { label: "Vida", icon: "⌂", message: "Rotina e relações", color: "#57c995" },
  mente: { label: "Mente", icon: "✦", message: "Clareza e aprendizado", color: "#f3bc4d" },
};

// O state representa somente o que está sendo exibido agora.
// Os dados permanentes continuam guardados no IndexedDB.
const state = {
  activeCycle: null,
  tasks: [],
  history: [],
  filter: "all",
};

const elements = {
  today: document.querySelector("#today"),
  cycleNumber: document.querySelector("#cycleNumber"),
  cyclePeriod: document.querySelector("#cyclePeriod"),
  cycleDay: document.querySelector("#cycleDay"),
  cycleObjective: document.querySelector("#cycleObjective"),
  weekGrid: document.querySelector("#weekGrid"),
  categoryGrid: document.querySelector("#categoryGrid"),
  taskList: document.querySelector("#taskList"),
  emptyState: document.querySelector("#emptyState"),
  historyList: document.querySelector("#historyList"),
  emptyHistory: document.querySelector("#emptyHistory"),
  totalCompleted: document.querySelector("#totalCompleted"),
  totalTasks: document.querySelector("#totalTasks"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskDate: document.querySelector("#taskDate"),
  closeCycleDialog: document.querySelector("#closeCycleDialog"),
  closeCycleForm: document.querySelector("#closeCycleForm"),
  closeCycleSummary: document.querySelector("#closeCycleSummary"),
  taskTemplate: document.querySelector("#taskTemplate"),
};

// =============================================================
// 2. FUNÇÕES DE DATA
// =============================================================
// Datas no formato YYYY-MM-DD evitam problemas de fuso horário e podem
// ser comparadas e ordenadas como texto.

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateKey, amount) {
  const date = fromDateKey(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function daysBetween(startKey, endKey) {
  const milliseconds = fromDateKey(endKey) - fromDateKey(startKey);
  return Math.floor(milliseconds / 86400000);
}

function formatDate(dateKey, options = { day: "2-digit", month: "short" }) {
  return new Intl.DateTimeFormat("pt-BR", options).format(fromDateKey(dateKey));
}

function cycleDates(cycle) {
  return Array.from({ length: CYCLE_LENGTH }, (_, index) => addDays(cycle.startDate, index));
}

// =============================================================
// 3. CRIAÇÃO E CARREGAMENTO DOS CICLOS
// =============================================================

function buildCycle(number, startDate = toDateKey(new Date())) {
  return {
    number,
    startDate,
    endDate: addDays(startDate, CYCLE_LENGTH - 1),
    objective: "",
    feedback: "",
    status: "active",
    createdAt: new Date().toISOString(),
    closedAt: null,
    summary: null,
  };
}

async function createNextCycle(existingCycles) {
  const lastNumber = Math.max(0, ...existingCycles.map((cycle) => cycle.number));
  const cycle = buildCycle(lastNumber + 1);
  cycle.id = await NextDB.cycles.add(cycle);
  return cycle;
}

async function loadData() {
  const [cycles, allTasks] = await Promise.all([
    NextDB.cycles.getAll(),
    NextDB.tasks.getAll(),
  ]);

  state.activeCycle = cycles.find((cycle) => cycle.status === "active") || await createNextCycle(cycles);
  state.history = cycles
    .filter((cycle) => cycle.status === "completed")
    .sort((a, b) => b.number - a.number);

  // Migração amigável: tarefas criadas antes dos ciclos passam para o ciclo atual.
  const orphanTasks = allTasks.filter((task) => !task.cycleId);
  for (const task of orphanTasks) {
    task.cycleId = state.activeCycle.id;
    task.scheduledDate = state.activeCycle.startDate;
    await NextDB.tasks.update(task);
  }

  state.tasks = allTasks.filter((task) => task.cycleId === state.activeCycle.id);
}

// =============================================================
// 4. RENDERIZAÇÃO DO CICLO ATUAL
// =============================================================

function renderCycleHeader() {
  const cycle = state.activeCycle;
  const todayKey = toDateKey(new Date());
  const currentDay = Math.min(CYCLE_LENGTH, Math.max(1, daysBetween(cycle.startDate, todayKey) + 1));

  elements.cycleNumber.textContent = `Ciclo ${cycle.number} de ${PROGRAM_LENGTH}`;
  elements.cyclePeriod.textContent = `${formatDate(cycle.startDate)} — ${formatDate(cycle.endDate)}`;
  elements.cycleDay.textContent = `Dia ${currentDay}`;
  elements.cycleObjective.value = cycle.objective;
}

function renderWeek() {
  const todayKey = toDateKey(new Date());
  elements.weekGrid.innerHTML = "";
  elements.taskDate.innerHTML = "";

  cycleDates(state.activeCycle).forEach((dateKey, index) => {
    const tasks = state.tasks.filter((task) => task.scheduledDate === dateKey);
    const completed = tasks.filter((task) => task.completed).length;
    const date = fromDateKey(dateKey);
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");

    const dayCard = document.createElement("button");
    dayCard.type = "button";
    dayCard.className = "day-card";
    dayCard.classList.toggle("today-card", dateKey === todayKey);
    dayCard.innerHTML = `
      <span>Dia ${index + 1}</span>
      <strong>${weekday}, ${String(date.getDate()).padStart(2, "0")}</strong>
      <small>${completed}/${tasks.length} concluídas</small>
    `;
    dayCard.addEventListener("click", () => openTaskDialog(dateKey));
    elements.weekGrid.append(dayCard);

    const option = document.createElement("option");
    option.value = dateKey;
    option.textContent = `Dia ${index + 1} — ${formatDate(dateKey, { weekday: "long", day: "2-digit", month: "2-digit" })}`;
    elements.taskDate.append(option);
  });
}

function renderCategories() {
  elements.categoryGrid.innerHTML = "";

  Object.entries(categories).forEach(([key, category]) => {
    const tasks = state.tasks.filter((task) => task.category === key);
    const completed = tasks.filter((task) => task.completed).length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const card = document.createElement("article");
    card.className = "category-card";
    card.style.setProperty("--category-color", category.color);
    card.innerHTML = `
      <div class="category-top">
        <span class="category-icon">${category.icon}</span>
        <span class="category-percentage">${progress}%</span>
      </div>
      <h3>${category.label}</h3>
      <p>${category.message}</p>
      <div class="progress-track"><span style="width: ${progress}%"></span></div>
      <small>${completed} de ${tasks.length} tarefas</small>
    `;
    elements.categoryGrid.append(card);
  });
}

function visibleTasks() {
  if (state.filter === "pending") return state.tasks.filter((task) => !task.completed);
  if (state.filter === "completed") return state.tasks.filter((task) => task.completed);
  return state.tasks;
}

function renderTasks() {
  const tasks = visibleTasks().sort((a, b) => {
    return a.scheduledDate.localeCompare(b.scheduledDate) || b.createdAt.localeCompare(a.createdAt);
  });
  elements.taskList.innerHTML = "";
  elements.emptyState.hidden = tasks.length > 0;

  tasks.forEach((task) => {
    const item = elements.taskTemplate.content.firstElementChild.cloneNode(true);
    const check = item.querySelector(".task-check");
    item.dataset.id = task.id;
    item.dataset.category = task.category;
    item.classList.toggle("completed", task.completed);
    item.querySelector("h3").textContent = task.title;
    item.querySelector(".task-category").textContent = `${categories[task.category].label} · ${formatDate(task.scheduledDate, { weekday: "short", day: "2-digit", month: "2-digit" })}`;
    check.textContent = task.completed ? "✓" : "";
    check.setAttribute("aria-label", task.completed ? "Marcar como pendente" : "Marcar como concluída");
    check.addEventListener("click", () => toggleTask(task.id));
    item.querySelector(".delete-task").addEventListener("click", () => deleteTask(task.id));
    elements.taskList.append(item);
  });
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  elements.emptyHistory.hidden = state.history.length > 0;

  state.history.forEach((cycle) => {
    const summary = cycle.summary || { completed: 0, total: 0, percentage: 0 };
    const card = document.createElement("article");
    card.className = "history-card";
    card.innerHTML = `
      <div>
        <span>Ciclo ${cycle.number}</span>
        <strong>${cycle.objective || "Sem objetivo definido"}</strong>
        <small>${formatDate(cycle.startDate)} — ${formatDate(cycle.endDate)}</small>
      </div>
      <div class="history-result"><strong>${summary.percentage}%</strong><span>${summary.completed}/${summary.total}</span></div>
      ${cycle.feedback ? `<p>${cycle.feedback}</p>` : ""}
    `;
    elements.historyList.append(card);
  });
}

function render() {
  const completed = state.tasks.filter((task) => task.completed).length;
  elements.totalCompleted.textContent = completed;
  elements.totalTasks.textContent = state.tasks.length;
  renderCycleHeader();
  renderWeek();
  renderCategories();
  renderTasks();
  renderHistory();
}

// =============================================================
// 5. AÇÕES: OBJETIVO E TAREFAS
// =============================================================

async function saveObjective() {
  state.activeCycle.objective = elements.cycleObjective.value.trim();
  await NextDB.cycles.update(state.activeCycle);
  elements.cycleObjective.blur();
}

function openTaskDialog(selectedDate = state.activeCycle.startDate) {
  elements.taskDate.value = selectedDate;
  elements.taskDialog.showModal();
  requestAnimationFrame(() => elements.taskTitle.focus());
}

async function addTask(event) {
  event.preventDefault();
  const data = new FormData(elements.taskForm);
  const task = {
    cycleId: state.activeCycle.id,
    title: data.get("title").trim(),
    category: data.get("category"),
    scheduledDate: data.get("scheduledDate"),
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  if (!task.title) return;

  task.id = await NextDB.tasks.add(task);
  state.tasks.push(task);
  elements.taskForm.reset();
  elements.taskDialog.close();
  render();
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  await NextDB.tasks.update(task);
  render();
}

async function deleteTask(id) {
  await NextDB.tasks.remove(id);
  state.tasks = state.tasks.filter((task) => task.id !== id);
  render();
}

// =============================================================
// 6. ENCERRAMENTO E HISTÓRICO
// =============================================================

function openCloseCycleDialog() {
  const completed = state.tasks.filter((task) => task.completed).length;
  elements.closeCycleSummary.textContent = `Você concluiu ${completed} de ${state.tasks.length} tarefas neste ciclo.`;
  elements.closeCycleDialog.showModal();
}

async function finishCycle(event) {
  event.preventDefault();
  const completed = state.tasks.filter((task) => task.completed).length;
  const total = state.tasks.length;

  // O resumo fica congelado no ciclo encerrado. Alterações futuras em outras
  // semanas não mudam esse resultado histórico.
  state.activeCycle.status = "completed";
  state.activeCycle.feedback = new FormData(elements.closeCycleForm).get("feedback").trim();
  state.activeCycle.closedAt = new Date().toISOString();
  state.activeCycle.summary = {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
  await NextDB.cycles.update(state.activeCycle);

  state.history.unshift(state.activeCycle);
  state.activeCycle = await createNextCycle([...state.history, state.activeCycle]);
  state.tasks = [];
  elements.closeCycleForm.reset();
  elements.closeCycleDialog.close();
  render();
}

// =============================================================
// 7. EVENTOS E INICIALIZAÇÃO
// =============================================================

document.querySelector("#openTaskForm").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeTaskForm").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#cancelTask").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#saveObjective").addEventListener("click", saveObjective);
document.querySelector("#openCloseCycle").addEventListener("click", openCloseCycleDialog);
document.querySelector("#closeCycleDialogButton").addEventListener("click", () => elements.closeCycleDialog.close());
document.querySelector("#cancelCloseCycle").addEventListener("click", () => elements.closeCycleDialog.close());
elements.taskForm.addEventListener("submit", addTask);
elements.closeCycleForm.addEventListener("submit", finishCycle);

document.querySelector("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter === button));
  renderTasks();
});

async function init() {
  const formattedToday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  }).format(new Date());
  elements.today.textContent = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

  try {
    await loadData();
    render();
  } catch (error) {
    console.error("Não foi possível carregar o Next7.", error);
    elements.emptyState.hidden = false;
    elements.emptyState.querySelector("h3").textContent = "Não foi possível carregar seus dados";
    elements.emptyState.querySelector("p").textContent = "Verifique as permissões do navegador e recarregue a página.";
  }
}

init();

