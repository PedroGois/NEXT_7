// =============================================================
// 1. CONFIGURAÇÕES E ESTADO
// =============================================================

const CYCLE_LENGTH = 7;
const PROGRAM_LENGTH = 12;

const categories = {
  corpo: { label: "Corpo", icon: "fa-dumbbell", message: "Energia e saúde", color: "#ff7557" },
  carreira: { label: "Carreira", icon: "fa-briefcase", message: "Trabalho e crescimento", color: "#8e7dff" },
  vida: { label: "Vida", icon: "fa-house", message: "Rotina e relações", color: "#57c995" },
  mente: { label: "Mente", icon: "fa-brain", message: "Clareza e aprendizado", color: "#f3bc4d" },
};

// O state representa somente o que está sendo exibido agora.
// Os dados permanentes continuam guardados no IndexedDB.
const state = {
  activeCycle: null,
  tasks: [],
  history: [],
  filter: "all",
  categoryFilter: "all",
  selectedDate: null,
  editingTaskId: null,
  detailTaskId: null,
  search: "",
  seriesAction: null,
  editingScope: "one",
};

const elements = {
  today: document.querySelector("#today"),
  cycleNumber: document.querySelector("#cycleNumber"),
  cyclePeriod: document.querySelector("#cyclePeriod"),
  cycleObjective: document.querySelector("#cycleObjective"),
  cycleObjectiveDisplay: document.querySelector("#cycleObjectiveDisplay"),
  cycleSettingsDialog: document.querySelector("#cycleSettingsDialog"),
  cycleSettingsForm: document.querySelector("#cycleSettingsForm"),
  dayNavigation: document.querySelector("#dayNavigation"),
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
  taskDescription: document.querySelector("#taskDescription"),
  reminderEnabled: document.querySelector("#reminderEnabled"),
  reminderTime: document.querySelector("#reminderTime"),
  reminderTimeRow: document.querySelector("#reminderTimeRow"),
  reminderSupportText: document.querySelector("#reminderSupportText"),
  scheduleDays: document.querySelector("#scheduleDays"),
  scheduleDaysGrid: document.querySelector("#scheduleDaysGrid"),
  allDays: document.querySelector("#allDays"),
  allDaysOption: document.querySelector("#allDaysOption"),
  scheduleError: document.querySelector("#scheduleError"),
  closeCycleDialog: document.querySelector("#closeCycleDialog"),
  closeCycleForm: document.querySelector("#closeCycleForm"),
  closeCycleSummary: document.querySelector("#closeCycleSummary"),
  importWeekButton: document.querySelector("#importWeekButton"),
  exportWeekButton: document.querySelector("#exportWeekButton"),
  importWeekFile: document.querySelector("#importWeekFile"),
  importMessage: document.querySelector("#importMessage"),
  taskTemplate: document.querySelector("#taskTemplate"),
  taskDetailDialog: document.querySelector("#taskDetailDialog"),
  cycleProgressBar: document.querySelector("#cycleProgressBar"),
  cycleProgressText: document.querySelector("#cycleProgressText"),
  taskSearch: document.querySelector("#taskSearch"),
  seriesActionDialog: document.querySelector("#seriesActionDialog"),
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

async function createNextCycle(existingCycles, startDate = toDateKey(new Date())) {
  const lastNumber = Math.max(0, ...existingCycles.map((cycle) => cycle.number));
  const cycle = buildCycle(lastNumber + 1, startDate);
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

// Remove exemplos criados por versões anteriores, sem tocar em tarefas reais.
async function removeLegacyDemoTasks() {
  const demoTasks = state.tasks.filter((task) => task.isDemo);
  for (const task of demoTasks) await NextDB.tasks.remove(task.id);
  state.tasks = state.tasks.filter((task) => !task.isDemo);
  localStorage.removeItem("next7-demo-week-v1");
}

// =============================================================
// 4. RENDERIZAÇÃO DO CICLO ATUAL
// =============================================================

function renderCycleHeader() {
  const cycle = state.activeCycle;
  elements.cycleNumber.textContent = `Ciclo ${cycle.number} de ${PROGRAM_LENGTH}`;
  elements.cyclePeriod.textContent = `${formatDate(cycle.startDate)} — ${formatDate(cycle.endDate)}`;
  elements.cycleObjective.value = cycle.objective;
  elements.cycleObjectiveDisplay.textContent = cycle.objective || "Defina o foco deste ciclo.";
  const { completed, percentage } = NextLogic.calculateProgress(state.tasks);
  const todayKey = toDateKey(new Date());
  const remainingDays = Math.max(0, daysBetween(todayKey, cycle.endDate) + 1);
  elements.cycleProgressBar.style.width = `${percentage}%`;
  elements.cycleProgressText.textContent = `${percentage}% · ${completed}/${state.tasks.length} · ${remainingDays} dia(s) restante(s)`;
}

function renderWeek() {
  renderScheduleDayOptions();
}

function renderScheduleDayOptions(selectedDates = [], editing = false) {
  elements.scheduleDaysGrid.innerHTML = "";
  elements.allDaysOption.hidden = editing;
  elements.allDays.checked = false;
  elements.scheduleError.hidden = true;

  cycleDates(state.activeCycle).forEach((dateKey) => {
    const label = document.createElement("label");
    label.className = "schedule-day";
    label.innerHTML = `
      <input type="${editing ? "radio" : "checkbox"}" name="scheduledDates" value="${dateKey}" ${selectedDates.includes(dateKey) ? "checked" : ""}>
      <span>${formatDate(dateKey, { weekday: "short" })}</span>
    `;
    elements.scheduleDaysGrid.append(label);
  });
}

function renderDayNavigation() {
  const todayKey = toDateKey(new Date());
  const cycleDays = cycleDates(state.activeCycle);
  const firstVisibleDay = cycleDays.includes(todayKey) ? todayKey : state.activeCycle.startDate;
  const tomorrowKey = addDays(firstVisibleDay, 1);
  elements.dayNavigation.innerHTML = "";

  const generalButton = document.createElement("button");
  generalButton.type = "button";
  generalButton.className = "day-navigation-button";
  generalButton.classList.toggle("active", state.selectedDate === "all");
  generalButton.textContent = "Geral";
  generalButton.setAttribute("aria-label", "Ver todas as tarefas do ciclo");
  generalButton.addEventListener("click", () => selectDay("all"));
  elements.dayNavigation.append(generalButton);

  cycleDays.filter((dateKey) => dateKey >= firstVisibleDay).forEach((dateKey) => {
    const date = fromDateKey(dateKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-navigation-button";
    button.classList.toggle("active", dateKey === state.selectedDate);
    button.textContent = dateKey === firstVisibleDay
      ? "Hoje"
      : dateKey === tomorrowKey
        ? "Amanhã"
        : new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
    button.setAttribute("aria-label", formatDate(dateKey, { weekday: "long", day: "2-digit", month: "long" }));
    button.addEventListener("click", () => selectDay(dateKey));
    elements.dayNavigation.append(button);
  });
}

// Troca o dia principal da lista sem abrir o formulário automaticamente.
function selectDay(dateKey) {
  state.selectedDate = dateKey;
  renderDayNavigation();
  renderTasks();
}

function renderCategories() {
  elements.categoryGrid.innerHTML = "";
  const scopedTasks = tasksInActiveScope();

  Object.entries(categories).forEach(([key, category]) => {
    const tasks = scopedTasks.filter((task) => task.category === key);
    const completed = tasks.filter((task) => task.completed).length;
    const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
    const card = document.createElement("button");
    card.type = "button";
    card.className = "category-card category-filter";
    card.classList.toggle("active", state.categoryFilter === key);
    card.style.setProperty("--category-color", category.color);
    card.innerHTML = `
      <div class="category-top">
        <i class="category-icon fa-solid ${category.icon}" aria-hidden="true"></i>
        <span class="category-percentage">${tasks.length}</span>
      </div>
      <h3>${category.label}</h3>
      <small>${completed} concluída(s)</small>
    `;
    card.addEventListener("click", () => {
      state.categoryFilter = state.categoryFilter === key ? "all" : key;
      renderCategories();
      renderTasks();
    });
    elements.categoryGrid.append(card);
  });
}

function visibleTasks() {
  let visible = tasksInActiveScope();
  if (state.categoryFilter !== "all") visible = visible.filter((task) => task.category === state.categoryFilter);
  if (state.search) visible = visible.filter((task) =>
    `${task.title} ${task.description || ""}`.toLowerCase().includes(state.search)
  );
  return visible;
}

function tasksInActiveScope() {
  let visible = state.selectedDate === "all"
    ? [...state.tasks]
    : state.tasks.filter((task) => task.scheduledDate === state.selectedDate);
  if (state.filter === "pending") visible = visible.filter((task) => !task.completed);
  if (state.filter === "completed") visible = visible.filter((task) => task.completed);
  return visible;
}

function renderTasks() {
  const activeCategory = categories[state.categoryFilter];
  const isGeneral = state.selectedDate === "all";
  const isToday = state.selectedDate === toDateKey(new Date());
  elements.tasksTitle.textContent = isGeneral ? "Geral" : isToday ? "Hoje" : formatDate(state.selectedDate, { weekday: "long" });
  elements.selectedDateLabel.textContent = activeCategory
    ? `${activeCategory.label} · ${activeCategory.message}`
    : isGeneral ? "Todas as tarefas do ciclo" : formatDate(state.selectedDate, { day: "2-digit", month: "long" });

  const tasks = visibleTasks().sort((a, b) => {
    return a.scheduledDate.localeCompare(b.scheduledDate) || b.createdAt.localeCompare(a.createdAt);
  });
  elements.taskList.innerHTML = "";
  elements.emptyState.hidden = tasks.length > 0;
  elements.emptyState.querySelector("h3").textContent = "Nenhuma tarefa neste filtro";
  elements.emptyState.querySelector("p").textContent = "Ajuste os filtros ou crie uma nova tarefa.";

  tasks.forEach((task) => {
    const item = elements.taskTemplate.content.firstElementChild.cloneNode(true);
    const check = item.querySelector(".task-check");
    item.dataset.id = task.id;
    item.dataset.category = task.category;
    item.classList.toggle("completed", task.completed);
    item.classList.toggle("overdue", !task.completed && task.scheduledDate < toDateKey(new Date()));
    item.querySelector("h3").textContent = task.title;
    const repeatLabel = task.seriesId ? " · tarefa recorrente" : "";
    const dateLabel = ` · ${formatDate(task.scheduledDate, { weekday: "short", day: "2-digit", month: "2-digit" })}`;
    item.querySelector(".task-category").textContent = `${categories[task.category].label}${dateLabel}${repeatLabel}`;
    check.innerHTML = task.completed ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : "";
    check.setAttribute("aria-label", task.completed ? "Marcar como pendente" : "Marcar como concluída");
    check.addEventListener("click", () => toggleTask(task.id));
    item.querySelector(".view-task").addEventListener("click", () => openTaskDetail(task.id));
    item.querySelector(".edit-task").addEventListener("click", () => requestSeriesAction("edit", task.id));
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
  renderCycleHeader();
  renderWeek();
  renderDayNavigation();
  renderCategories();
  renderTasks();
}

// =============================================================
// 5. AÇÕES: OBJETIVO E TAREFAS
// =============================================================

async function saveObjective(event) {
  event.preventDefault();
  state.activeCycle.objective = elements.cycleObjective.value.trim();
  await NextDB.cycles.update(state.activeCycle);
  elements.cycleSettingsDialog.close();
  renderCycleHeader();
}

function openTaskDialog(selectedDate = state.selectedDate) {
  const availableDates = cycleDates(state.activeCycle);
  if (!availableDates.includes(selectedDate)) selectedDate = availableDates[0];
  state.editingTaskId = null;
  state.editingScope = "one";
  elements.taskForm.reset();
  elements.scheduleDays.hidden = false;
  elements.reminderTimeRow.hidden = true;
  elements.taskForm.querySelector(".eyebrow").textContent = "Novo passo";
  elements.taskForm.querySelector("h2").textContent = "Adicionar tarefa";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Adicionar tarefa";
  renderScheduleDayOptions([selectedDate]);
  elements.taskDialog.showModal();
  requestAnimationFrame(() => elements.taskTitle.focus());
}

async function addTask(event) {
  event.preventDefault();
  const data = new FormData(elements.taskForm);
  const title = data.get("title").trim();
  const scheduledDates = [...new Set(data.getAll("scheduledDates"))]
    .sort((a, b) => a.localeCompare(b));
  if (!scheduledDates.length && (state.editingTaskId === null || state.editingScope === "one")) {
    elements.scheduleError.hidden = false;
    return;
  }
  const firstDate = scheduledDates[0] || null;
  const reminderTime = data.get("reminderEnabled") === "on" ? data.get("reminderTime") : null;
  if (!title) return;

  if (state.editingTaskId !== null) {
    const task = state.tasks.find((item) => item.id === state.editingTaskId);
    const affectedTasks = tasksForSeriesScope(task, state.editingScope);
    for (const affectedTask of affectedTasks) {
      affectedTask.title = title;
      affectedTask.description = data.get("description").trim();
      if (state.editingScope === "one") affectedTask.scheduledDate = firstDate;
      affectedTask.category = data.get("category");
      affectedTask.reminderTime = reminderTime;
      affectedTask.reminderSentAt = null;
      await NextDB.tasks.update(affectedTask);
    }
    state.editingTaskId = null;
    elements.taskForm.reset();
    elements.taskDialog.close();
    render();
    return;
  }

  // Uma repetição vira tarefas independentes, uma por dia. Isso deixa cada
  // ocorrência concluível separadamente e mantém o modelo fácil de entender.
  const seriesId = scheduledDates.length > 1
    ? (crypto.randomUUID?.() || `series-${Date.now()}`)
    : null;

  for (const scheduledDate of scheduledDates) {
    const task = {
      cycleId: state.activeCycle.id,
      seriesId,
      title,
      description: data.get("description").trim(),
      category: data.get("category"),
      scheduledDate,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      reminderTime,
      reminderSentAt: null,
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
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  if (task.seriesId) {
    requestSeriesAction("delete", id);
    return;
  }
  if (!confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
  await removeTasks([task]);
  render();
}

function tasksForSeriesScope(task, scope) {
  return NextLogic.selectSeriesTasks(state.tasks, task, scope);
}

async function removeTasks(tasks) {
  for (const task of tasks) await NextDB.tasks.remove(task.id);
  const removedIds = new Set(tasks.map((task) => task.id));
  state.tasks = state.tasks.filter((task) => !removedIds.has(task.id));
}

function requestSeriesAction(action, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task?.seriesId) {
    if (action === "edit") openEditTask(id, "one");
    else deleteTask(id);
    return;
  }
  state.seriesAction = { action, id };
  document.querySelector("#seriesActionTitle").textContent = action === "edit" ? "Editar recorrência" : "Excluir recorrência";
  elements.seriesActionDialog.showModal();
}

async function applySeriesAction(scope) {
  const pending = state.seriesAction;
  elements.seriesActionDialog.close();
  state.seriesAction = null;
  if (!pending) return;
  const task = state.tasks.find((item) => item.id === pending.id);
  if (!task) return;
  if (pending.action === "edit") {
    openEditTask(task.id, scope);
    return;
  }
  if (!confirm("Excluir as ocorrências selecionadas? Essa ação não pode ser desfeita.")) return;
  await removeTasks(tasksForSeriesScope(task, scope));
  render();
}

function openTaskDetail(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.detailTaskId = id;
  document.querySelector("#detailTaskTitle").textContent = task.title;
  document.querySelector("#detailObjective").textContent = state.activeCycle.objective || "Nenhum objetivo definido";
  document.querySelector("#detailDate").textContent = formatDate(task.scheduledDate, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  document.querySelector("#detailCategory").textContent = categories[task.category].label;
  document.querySelector("#detailStatus").textContent = task.completed ? "Concluída" : "Pendente";
  const seriesTasks = task.seriesId ? state.tasks.filter((item) => item.seriesId === task.seriesId) : [];
  document.querySelector("#detailRecurrence").textContent = seriesTasks.length
    ? seriesTasks.map((item) => formatDate(item.scheduledDate, { weekday: "short" })).join(", ")
    : "Não se repete";
  document.querySelector("#detailReminder").textContent = task.reminderTime ? `Às ${task.reminderTime}` : "Sem lembrete";
  document.querySelector("#detailDescription").textContent = task.description || "Sem detalhes adicionais";
  elements.taskDetailDialog.showModal();
}

function openEditTask(id, scope = "one") {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.editingTaskId = id;
  state.editingScope = scope;
  if (elements.taskDetailDialog.open) elements.taskDetailDialog.close();
  elements.taskForm.querySelector(".eyebrow").textContent = "Ajustar passo";
  elements.taskForm.querySelector("h2").textContent = "Editar tarefa";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Salvar alterações";
  elements.taskTitle.value = task.title;
  elements.taskDescription.value = task.description || "";
  elements.scheduleDays.hidden = scope !== "one";
  renderScheduleDayOptions([task.scheduledDate], true);
  elements.reminderEnabled.checked = Boolean(task.reminderTime);
  elements.reminderTime.value = task.reminderTime || "09:00";
  elements.reminderTimeRow.hidden = !task.reminderTime;
  elements.taskForm.querySelector(`[name="category"][value="${task.category}"]`).checked = true;
  elements.taskDialog.showModal();
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
    const description = String(task.description || "").trim().slice(0, 400);
    const reminderTime = NextLogic.isValidReminderTime(task.reminderTime) ? task.reminderTime : null;
    const requestedDays = Array.isArray(task.days) ? task.days.map(Number) : [Number(task.day)];

    if (!title) throw new Error(`A tarefa ${position} está sem título.`);
    if (!categories[category]) throw new Error(`A tarefa ${position} possui uma categoria inválida.`);
    if (!requestedDays.length || requestedDays.some((day) => !Number.isInteger(day) || day < 1 || day > CYCLE_LENGTH)) {
      throw new Error(`A tarefa ${position} precisa usar um dia entre 1 e 7.`);
    }

    return { title, description, category, reminderTime, days: [...new Set(requestedDays)], repeatDaily: task.repeatDaily === true };
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
      const firstIndex = importedTask.days[0] - 1;
      const dates = importedTask.repeatDaily
        ? cycleDates(state.activeCycle).slice(firstIndex)
        : importedTask.days.map((day) => cycleDates(state.activeCycle)[day - 1]);
      const seriesId = dates.length > 1
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
          description: importedTask.description,
          category: importedTask.category,
          scheduledDate,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          reminderTime: importedTask.reminderTime,
          reminderSentAt: null,
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
// Ocorrências com o mesmo seriesId voltam a ser uma única tarefa com vários dias.
function buildWeekExport() {
  const exportedTasks = [];
  const exportedSeries = new Set();
  const sortedTasks = [...state.tasks].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  for (const task of sortedTasks) {
    if (task.seriesId && exportedSeries.has(task.seriesId)) continue;
    if (task.seriesId) exportedSeries.add(task.seriesId);

    exportedTasks.push({
      title: task.title,
      description: task.description || "",
      category: task.category,
      reminderTime: task.reminderTime || null,
      days: task.seriesId
        ? sortedTasks
          .filter((item) => item.seriesId === task.seriesId)
          .map((item) => daysBetween(state.activeCycle.startDate, item.scheduledDate) + 1)
        : [daysBetween(state.activeCycle.startDate, task.scheduledDate) + 1],
    });
  }

  return {
    version: 2,
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
  const review = new FormData(elements.closeCycleForm);
  state.activeCycle.feedback = [
    review.get("wins") && `Funcionou: ${review.get("wins").trim()}`,
    review.get("obstacles") && `Dificultou: ${review.get("obstacles").trim()}`,
    review.get("nextFocus") && `Próximo ciclo: ${review.get("nextFocus").trim()}`,
  ].filter(Boolean).join("\n");
  state.activeCycle.closedAt = new Date().toISOString();
  state.activeCycle.summary = {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
  await NextDB.cycles.update(state.activeCycle);

  state.history.unshift(state.activeCycle);
  const nextStartDate = [addDays(state.activeCycle.endDate, 1), toDateKey(new Date())].sort().at(-1);
  state.activeCycle = await createNextCycle([...state.history, state.activeCycle], nextStartDate);
  state.tasks = [];
  state.selectedDate = state.activeCycle.startDate;
  elements.closeCycleForm.reset();
  elements.closeCycleDialog.close();
  render();
}

// Lembretes locais são verificados enquanto a aplicação está em execução.
// Para entrega garantida com o app fechado, o mesmo modelo pode ser conectado
// a um backend de Web Push, conforme documentado em MELHORIAS.md.
async function requestNotificationPermission() {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    elements.reminderSupportText.textContent = "Este navegador não oferece notificações para esta PWA.";
    return false;
  }
  const permission = await Notification.requestPermission();
  elements.reminderSupportText.textContent = permission === "granted"
    ? "Notificações ativadas. O modo local funciona enquanto o app estiver ativo."
    : "Permissão não concedida. Você pode ativá-la nas configurações do aparelho.";
  return permission === "granted";
}

async function showTaskReminder(task) {
  if (Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Next7 · Hora da tarefa", {
    body: task.title,
    icon: "assets/images/icon.svg",
    badge: "assets/images/icon.svg",
    tag: `task-${task.id}-${task.scheduledDate}`,
    data: { url: `./?task=${task.id}` },
  });
  task.reminderSentAt = new Date().toISOString();
  await NextDB.tasks.update(task);
}

async function checkTaskReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const todayKey = toDateKey(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  for (const task of state.tasks) {
    if (!task.reminderTime || task.reminderSentAt || task.completed || task.scheduledDate !== todayKey) continue;
    const [hours, minutes] = task.reminderTime.split(":").map(Number);
    if (currentMinutes >= hours * 60 + minutes) await showTaskReminder(task);
  }
}

// =============================================================
// 8. EVENTOS E INICIALIZAÇÃO
// =============================================================

document.querySelector("#openTaskForm").addEventListener("click", () => openTaskDialog());
document.querySelector("#closeTaskForm").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#cancelTask").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#closeTaskDetail").addEventListener("click", () => elements.taskDetailDialog.close());
document.querySelector("#detailEditTask").addEventListener("click", () => requestSeriesAction("edit", state.detailTaskId));
document.querySelector("#detailDeleteTask").addEventListener("click", async () => {
  const id = state.detailTaskId;
  elements.taskDetailDialog.close();
  await deleteTask(id);
});
document.querySelector("#openCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.showModal());
document.querySelector("#closeCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.close());
document.querySelector("#cancelCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.close());
elements.importWeekButton.addEventListener("click", () => elements.importWeekFile.click());
elements.exportWeekButton.addEventListener("click", exportWeekPlan);
elements.importWeekFile.addEventListener("change", () => {
  const [file] = elements.importWeekFile.files;
  if (file) importWeekPlan(file);
});
document.querySelector("#openCloseCycle").addEventListener("click", () => {
  elements.cycleSettingsDialog.close();
  openCloseCycleDialog();
});
document.querySelector("#closeCycleDialogButton").addEventListener("click", () => elements.closeCycleDialog.close());
document.querySelector("#cancelCloseCycle").addEventListener("click", () => elements.closeCycleDialog.close());
elements.taskForm.addEventListener("submit", addTask);
elements.allDays.addEventListener("change", () => {
  elements.scheduleDaysGrid.querySelectorAll('input[name="scheduledDates"]').forEach((input) => {
    input.checked = elements.allDays.checked;
  });
  elements.scheduleError.hidden = true;
});
elements.scheduleDaysGrid.addEventListener("change", () => {
  const dayInputs = [...elements.scheduleDaysGrid.querySelectorAll('input[name="scheduledDates"]')];
  elements.allDays.checked = dayInputs.length > 0 && dayInputs.every((input) => input.checked);
  elements.scheduleError.hidden = true;
});
elements.cycleSettingsForm.addEventListener("submit", saveObjective);
elements.closeCycleForm.addEventListener("submit", finishCycle);
elements.reminderEnabled.addEventListener("change", () => {
  elements.reminderTimeRow.hidden = !elements.reminderEnabled.checked;
});
document.querySelector("#enableNotifications").addEventListener("click", requestNotificationPermission);
document.querySelector("#taskTemplates").addEventListener("click", (event) => {
  const button = event.target.closest("[data-template]");
  if (!button) return;
  const [title, category, days] = button.dataset.template.split("|");
  elements.taskTitle.value = title;
  elements.taskForm.querySelector(`[name="category"][value="${category}"]`).checked = true;
  const selectedDays = days === "all" ? cycleDates(state.activeCycle) : days.split(",").map((day) => addDays(state.activeCycle.startDate, Number(day) - 1));
  renderScheduleDayOptions(selectedDays);
  elements.allDays.checked = days === "all";
});
elements.taskSearch.addEventListener("input", () => {
  state.search = elements.taskSearch.value.trim().toLowerCase();
  renderTasks();
});
document.querySelector("#closeSeriesAction").addEventListener("click", () => elements.seriesActionDialog.close());
elements.seriesActionDialog.addEventListener("click", (event) => {
  const button = event.target.closest("[data-series-scope]");
  if (button) applySeriesAction(button.dataset.seriesScope);
});

document.querySelector("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter === button));
  renderCategories();
  renderTasks();
});

async function init() {
  const formattedToday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  }).format(new Date());
  elements.today.textContent = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1);

  try {
    await loadData();
    await removeLegacyDemoTasks();
    render();
    checkTaskReminders();
    setInterval(checkTaskReminders, 30000);
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
