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
  selectedDate: null,
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
  tasksTitle: document.querySelector("#tasksTitle"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  emptyState: document.querySelector("#emptyState"),
  historyList: document.querySelector("#historyList"),
  emptyHistory: document.querySelector("#emptyHistory"),
  totalCompleted: document.querySelector("#totalCompleted"),
  totalTasks: document.querySelector("#totalTasks"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskDate: document.querySelector("#taskDate"),
  repeatDaily: document.querySelector("#repeatDaily"),
  closeCycleDialog: document.querySelector("#closeCycleDialog"),
  closeCycleForm: document.querySelector("#closeCycleForm"),
  closeCycleSummary: document.querySelector("#closeCycleSummary"),
  importWeekButton: document.querySelector("#importWeekButton"),
  exportWeekButton: document.querySelector("#exportWeekButton"),
  importWeekFile: document.querySelector("#importWeekFile"),
  importMessage: document.querySelector("#importMessage"),
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

  // A tela abre no dia de hoje. Se o ciclo estiver fora da data atual,
  // usa o primeiro dia do ciclo como seleção segura.
  const todayKey = toDateKey(new Date());
  state.selectedDate = cycleDates(state.activeCycle).includes(todayKey)
    ? todayKey
    : state.activeCycle.startDate;
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
    dayCard.classList.toggle("selected-day", dateKey === state.selectedDate);
    dayCard.innerHTML = `
      <span>Dia ${index + 1}</span>
      <strong>${weekday}, ${String(date.getDate()).padStart(2, "0")}</strong>
      <small>${completed}/${tasks.length} concluídas</small>
    `;
    dayCard.addEventListener("click", () => selectDay(dateKey));
    elements.weekGrid.append(dayCard);

    const option = document.createElement("option");
    option.value = dateKey;
    option.textContent = `Dia ${index + 1} — ${formatDate(dateKey, { weekday: "long", day: "2-digit", month: "2-digit" })}`;
    elements.taskDate.append(option);
  });
}

// Troca o dia principal da lista sem abrir o formulário automaticamente.
function selectDay(dateKey) {
  state.selectedDate = dateKey;
  renderWeek();
  renderTasks();
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
  const tasksFromSelectedDay = state.tasks.filter((task) => task.scheduledDate === state.selectedDate);
  if (state.filter === "pending") return tasksFromSelectedDay.filter((task) => !task.completed);
  if (state.filter === "completed") return tasksFromSelectedDay.filter((task) => task.completed);
  return tasksFromSelectedDay;
}

function renderTasks() {
  const todayKey = toDateKey(new Date());
  const selectedDayNumber = daysBetween(state.activeCycle.startDate, state.selectedDate) + 1;
  const isToday = state.selectedDate === todayKey;
  elements.tasksTitle.textContent = isToday ? "Hoje" : `Dia ${selectedDayNumber}`;
  elements.selectedDateLabel.textContent = formatDate(state.selectedDate, {
    weekday: "long", day: "2-digit", month: "long",
  });

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
    const repeatLabel = task.seriesId ? " · repete diariamente" : "";
    item.querySelector(".task-category").textContent = `${categories[task.category].label}${repeatLabel}`;
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

function openTaskDialog(selectedDate = state.selectedDate) {
  elements.taskDate.value = selectedDate;
  elements.taskDialog.showModal();
  requestAnimationFrame(() => elements.taskTitle.focus());
}

async function addTask(event) {
  event.preventDefault();
  const data = new FormData(elements.taskForm);
  const title = data.get("title").trim();
  const firstDate = data.get("scheduledDate");
  const shouldRepeat = data.get("repeatDaily") === "on";
  if (!title) return;

  // Uma repetição vira tarefas independentes, uma por dia. Isso deixa cada
  // ocorrência concluível separadamente e mantém o modelo fácil de entender.
  const dates = cycleDates(state.activeCycle);
  const scheduledDates = shouldRepeat
    ? dates.slice(dates.indexOf(firstDate))
    : [firstDate];
  const seriesId = shouldRepeat
    ? (crypto.randomUUID?.() || `series-${Date.now()}`)
    : null;

  for (const scheduledDate of scheduledDates) {
    const task = {
      cycleId: state.activeCycle.id,
      seriesId,
      title,
      category: data.get("category"),
      scheduledDate,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    task.id = await NextDB.tasks.add(task);
    state.tasks.push(task);
  }

  state.selectedDate = firstDate;
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
// 6. IMPORTAÇÃO DE UM PLANEJAMENTO SEMANAL
// =============================================================

function showImportMessage(message, isError = false) {
  elements.importMessage.textContent = message;
  elements.importMessage.classList.toggle("error", isError);
  elements.importMessage.hidden = false;
}

// Valida antes de tocar no banco. Assim um arquivo incompleto não deixa
// metade das tarefas importada e metade de fora.
function validateWeekPlan(plan) {
  if (!plan || typeof plan !== "object") throw new Error("O arquivo não contém um planejamento válido.");
  if (!Array.isArray(plan.tasks)) throw new Error("O campo tasks precisa ser uma lista.");

  return plan.tasks.map((task, index) => {
    const position = index + 1;
    const title = String(task.title || "").trim();
    const category = String(task.category || "").toLowerCase();
    const day = Number(task.day);

    if (!title) throw new Error(`A tarefa ${position} está sem título.`);
    if (!categories[category]) throw new Error(`A tarefa ${position} possui uma categoria inválida.`);
    if (!Number.isInteger(day) || day < 1 || day > CYCLE_LENGTH) {
      throw new Error(`A tarefa ${position} precisa usar um dia entre 1 e 7.`);
    }

    return { title, category, day, repeatDaily: task.repeatDaily === true };
  });
}

async function importWeekPlan(file) {
  try {
    const plan = JSON.parse(await file.text());
    const importedTasks = validateWeekPlan(plan);
    let created = 0;
    let ignored = 0;

    if (typeof plan.objective === "string" && plan.objective.trim()) {
      state.activeCycle.objective = plan.objective.trim().slice(0, 140);
      await NextDB.cycles.update(state.activeCycle);
    }

    for (const importedTask of importedTasks) {
      const firstIndex = importedTask.day - 1;
      const dates = importedTask.repeatDaily
        ? cycleDates(state.activeCycle).slice(firstIndex)
        : [cycleDates(state.activeCycle)[firstIndex]];
      const seriesId = importedTask.repeatDaily
        ? (crypto.randomUUID?.() || `series-${Date.now()}-${created}`)
        : null;

      for (const scheduledDate of dates) {
        // Reimportar o mesmo arquivo não duplica a mesma tarefa no mesmo dia.
        const alreadyExists = state.tasks.some((task) =>
          task.title.toLowerCase() === importedTask.title.toLowerCase()
          && task.category === importedTask.category
          && task.scheduledDate === scheduledDate
        );
        if (alreadyExists) {
          ignored += 1;
          continue;
        }

        const task = {
          cycleId: state.activeCycle.id,
          seriesId,
          title: importedTask.title,
          category: importedTask.category,
          scheduledDate,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
        };
        task.id = await NextDB.tasks.add(task);
        state.tasks.push(task);
        created += 1;
      }
    }

    render();
    const ignoredText = ignored ? ` ${ignored} ocorrência(s) duplicada(s) foram ignoradas.` : "";
    showImportMessage(`Semana importada: ${created} ocorrência(s) criada(s).${ignoredText}`);
  } catch (error) {
    showImportMessage(`Não foi possível importar: ${error.message}`, true);
  } finally {
    // Permite escolher novamente o mesmo arquivo depois de corrigi-lo.
    elements.importWeekFile.value = "";
  }
}

// Converte o ciclo atual para o mesmo formato aceito pela importação.
// Ocorrências com o mesmo seriesId voltam a ser uma única tarefa diária.
function buildWeekExport() {
  const exportedTasks = [];
  const exportedSeries = new Set();
  const sortedTasks = [...state.tasks].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  for (const task of sortedTasks) {
    if (task.seriesId && exportedSeries.has(task.seriesId)) continue;
    if (task.seriesId) exportedSeries.add(task.seriesId);

    exportedTasks.push({
      title: task.title,
      category: task.category,
      day: daysBetween(state.activeCycle.startDate, task.scheduledDate) + 1,
      repeatDaily: Boolean(task.seriesId),
    });
  }

  return {
    version: 1,
    objective: state.activeCycle.objective,
    context: {
      duration: "7 dias",
      exportedAt: new Date().toISOString(),
      note: "Arquivo de planejamento. O progresso das tarefas não é incluído.",
    },
    tasks: exportedTasks,
  };
}

function exportWeekPlan() {
  const plan = buildWeekExport();
  const content = JSON.stringify(plan, null, 2);
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cycleNumber = String(state.activeCycle.number).padStart(2, "0");

  link.href = url;
  link.download = `next7-ciclo-${cycleNumber}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // O pequeno atraso dá tempo para Safari e navegadores móveis iniciarem
  // o download antes que o endereço temporário seja liberado.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showImportMessage(`Ciclo ${state.activeCycle.number} exportado com ${plan.tasks.length} tarefa(s) planejada(s).`);
}

// =============================================================
// 7. ENCERRAMENTO E HISTÓRICO
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
  state.selectedDate = state.activeCycle.startDate;
  elements.closeCycleForm.reset();
  elements.closeCycleDialog.close();
  render();
}

// =============================================================
// 8. EVENTOS E INICIALIZAÇÃO
// =============================================================

document.querySelector("#openTaskForm").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeTaskForm").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#cancelTask").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#saveObjective").addEventListener("click", saveObjective);
elements.importWeekButton.addEventListener("click", () => elements.importWeekFile.click());
elements.exportWeekButton.addEventListener("click", exportWeekPlan);
elements.importWeekFile.addEventListener("change", () => {
  const [file] = elements.importWeekFile.files;
  if (file) importWeekPlan(file);
});
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

// Registra o service worker somente quando o navegador oferece suporte.
// Ele permite abrir os arquivos principais mesmo sem conexão.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .catch((error) => console.error("Falha ao registrar o modo offline.", error));
  });
}
