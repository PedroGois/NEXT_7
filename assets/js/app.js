// CICLOS E TAREFAS

// CONSTANTES E ESTADO

const CYCLE_LENGTH = 7;
const PROGRAM_LENGTH = 12;
const categories = {
  corpo: { label: "Corpo", icon: "fa-dumbbell", message: "Energia e saúde", color: "#ff7557" },
  carreira: { label: "Carreira", icon: "fa-briefcase", message: "Trabalho e crescimento", color: "#8e7dff" },
  vida: { label: "Vida", icon: "fa-house", message: "Rotina e relações", color: "#57c995" },
  mente: { label: "Mente", icon: "fa-brain", message: "Clareza e aprendizado", color: "#f3bc4d" },
};

const state = {
  activeCycle: null,
  tasks: [],
  taskDefinitions: [],
  history: [],
  statusFilters: [],
  categoryFilters: [],
  selectedDate: null,
  editingTaskId: null,
  detailTaskId: null,
};

// ELEMENTOS DA TELA
const elements = {
  cycleNumber: document.querySelector("#cycleNumber"),
  cyclePeriod: document.querySelector("#cyclePeriod"),
  cycleObjective: document.querySelector("#cycleObjective"),
  cycleObjectiveDisplay: document.querySelector("#cycleObjectiveDisplay"),
  cycleSettingsDialog: document.querySelector("#cycleSettingsDialog"),
  cycleSettingsForm: document.querySelector("#cycleSettingsForm"),
  dayNavigation: document.querySelector("#dayNavigation"),
  categoryGrid: document.querySelector("#categoryGrid"),
  clearFilters: document.querySelector("#clearFilters"),
  taskList: document.querySelector("#taskList"),
  tasksTitle: document.querySelector("#tasksTitle"),
  selectedDateLabel: document.querySelector("#selectedDateLabel"),
  emptyState: document.querySelector("#emptyState"),
  taskDialog: document.querySelector("#taskDialog"),
  taskForm: document.querySelector("#taskForm"),
  taskTitle: document.querySelector("#taskTitle"),
  taskDescription: document.querySelector("#taskDescription"),
  taskDate: document.querySelector("#taskDate"),
  repeatDaily: document.querySelector("#repeatDaily"),
  taskIdentity: document.querySelector("#taskIdentity"),
  existingTaskId: document.querySelector("#existingTaskId"),
  closeCycleDialog: document.querySelector("#closeCycleDialog"),
  closeCycleForm: document.querySelector("#closeCycleForm"),
  closeCycleSummary: document.querySelector("#closeCycleSummary"),
  importWeekButton: document.querySelector("#importWeekButton"),
  exportWeekButton: document.querySelector("#exportWeekButton"),
  importWeekFile: document.querySelector("#importWeekFile"),
  importMessage: document.querySelector("#importMessage"),
  taskTemplate: document.querySelector("#taskTemplate"),
  taskDetailDialog: document.querySelector("#taskDetailDialog"),
};

// DATAS

// Mantém datas locais no formato usado pelos inputs e pelo banco.
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

// Identifica a tarefa conceitual; o id numérico da store continua sendo da ocorrência.
function createTaskDefinitionId() {
  return crypto.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildTaskDefinitions(tasks) {
  const definitions = new Map();
  tasks.forEach((task) => {
    const definitionId = task.taskDefinitionId || task.id;
    if (!definitions.has(definitionId)) {
      definitions.set(definitionId, { id: definitionId, title: task.title });
    }
  });
  return [...definitions.values()].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

// CICLOS

// Cria um ciclo de sete dias com dados iniciais consistentes.
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
    recurrenceSummary: [], // séries para relatórios: id, tarefa base, título e progresso.
  };
}

// Inicia o próximo ciclo após o último registro.
async function createNextCycle(existingCycles) {
  const lastNumber = Math.max(0, ...existingCycles.map((cycle) => cycle.number));
  const cycle = buildCycle(lastNumber + 1);
  cycle.id = await NextDB.cycles.add(cycle);
  return cycle;
}

// Carrega o ciclo ativo, histórico e tarefas já criadas.
async function loadData() {
  const [cycles, allTasks] = await Promise.all([
    NextDB.cycles.getAll(),
    NextDB.tasks.getAll(),
  ]);

  // Encontra ciclo ativo ou cria um novo
  state.activeCycle = cycles.find((cycle) => cycle.status === "active") || await createNextCycle(cycles);
  state.history = cycles
    .filter((cycle) => cycle.status === "completed")
    .sort((a, b) => b.number - a.number);

  // Migração v1→v4: tarefas criadas antes do schema de ciclos.
  // Reatribui ao ciclo ativo para manter consistência.
  const orphanTasks = allTasks.filter((task) => !task.cycleId);
  for (const task of orphanTasks) {
    task.cycleId = state.activeCycle.id;
    task.scheduledDate = state.activeCycle.startDate;
    await NextDB.tasks.update(task);
  }

  // Migração v5: toda tarefa antiga recebe um identificador estável. Séries
  // diárias existentes preservam o mesmo identificador para não perder vínculo.
  const tasksWithoutDefinition = allTasks.filter((task) => !task.taskDefinitionId);
  for (const task of tasksWithoutDefinition) {
    task.taskDefinitionId = task.seriesId || createTaskDefinitionId();
    await NextDB.tasks.update(task);
  }

  // Carrega apenas tarefas do ciclo ativo
  state.tasks = allTasks.filter((task) => task.cycleId === state.activeCycle.id);
  state.taskDefinitions = buildTaskDefinitions(allTasks);

  // Seleciona data padrão: hoje se estiver no intervalo do ciclo, senão dia 1
  const todayKey = toDateKey(new Date());
  state.selectedDate = cycleDates(state.activeCycle).includes(todayKey)
    ? todayKey
    : state.activeCycle.startDate;
}

// RENDERIZAÇÃO

function renderCycleHeader() {
  const cycle = state.activeCycle;
  elements.cycleNumber.textContent = `Ciclo ${cycle.number} de ${PROGRAM_LENGTH}`;
  elements.cyclePeriod.textContent = `${formatDate(cycle.startDate)} — ${formatDate(cycle.endDate)}`;
  elements.cycleObjective.value = cycle.objective;
  elements.cycleObjectiveDisplay.textContent = cycle.objective || "Defina o foco deste ciclo.";
}

function renderWeek() {
  elements.taskDate.innerHTML = "";

  cycleDates(state.activeCycle).forEach((dateKey, index) => {
    const option = document.createElement("option");
    option.value = dateKey;
    option.textContent = `Dia ${index + 1} — ${formatDate(dateKey, { weekday: "long", day: "2-digit", month: "2-digit" })}`;
    elements.taskDate.append(option);
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

function selectDay(dateKey) {
  state.selectedDate = dateKey;
  renderDayNavigation();
  renderCategories();
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
    card.classList.toggle("active", state.categoryFilters.includes(key));
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
      state.categoryFilters = state.categoryFilters.includes(key)
        ? state.categoryFilters.filter((filter) => filter !== key)
        : [...state.categoryFilters, key];
      updateFilterControls();
      renderCategories();
      renderTasks();
    });
    elements.categoryGrid.append(card);
  });

  animateUpdate(elements.categoryGrid);
}

function visibleTasks() {
  let visible = tasksInActiveScope();
  if (state.categoryFilters.length) {
    visible = visible.filter((task) => state.categoryFilters.includes(task.category));
  }
  return visible;
}

// Aplica o status ao dia selecionado antes dos filtros de categoria.
function tasksInActiveScope() {
  let visible = state.selectedDate === "all"
    ? [...state.tasks]
    : state.tasks.filter((task) => task.scheduledDate === state.selectedDate);
  if (state.statusFilters.length === 1) {
    visible = visible.filter((task) => state.statusFilters[0] === "completed" ? task.completed : !task.completed);
  }
  return visible;
}

function renderTasks() {
  const activeCategories = state.categoryFilters.map((key) => categories[key]);
  const isGeneral = state.selectedDate === "all";
  const isToday = state.selectedDate === toDateKey(new Date());
  elements.tasksTitle.textContent = isGeneral ? "Geral" : isToday ? "Hoje" : formatDate(state.selectedDate, { weekday: "long" });
  elements.selectedDateLabel.textContent = activeCategories.length
    ? activeCategories.map((category) => category.label).join(" · ")
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
    item.querySelector("h3").textContent = task.title;
    const repeatLabel = task.seriesId ? " · repete diariamente" : "";
    const dateLabel = ` · ${formatDate(task.scheduledDate, { weekday: "short", day: "2-digit", month: "2-digit" })}`;
    item.querySelector(".task-category").textContent = `${categories[task.category].label}${dateLabel}${repeatLabel}`;
    check.innerHTML = task.completed ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : "";
    check.setAttribute("aria-label", task.completed ? "Marcar como pendente" : "Marcar como concluída");
    check.addEventListener("click", () => toggleTask(task.id));
    item.querySelector(".view-task").addEventListener("click", () => openTaskDetail(task.id));
    item.querySelector(".edit-task").addEventListener("click", () => openEditTask(task.id));
    item.querySelector(".delete-task").addEventListener("click", () => deleteTask(task.id));
    elements.taskList.append(item);
  });

  animateUpdate(elements.taskList);
}

function updateFilterControls() {
  const hasFilters = state.categoryFilters.length || state.statusFilters.length;
  document.querySelectorAll(".filter").forEach((button) => {
    const filter = button.dataset.filter;
    button.classList.toggle("active", filter === "all" ? !state.statusFilters.length : state.statusFilters.includes(filter));
  });
  elements.clearFilters.hidden = !hasFilters;
}

function animateUpdate(element) {
  element.classList.remove("fade-update");
  void element.offsetWidth;
  element.classList.add("fade-update");
}

function render() {
  renderCycleHeader();
  renderWeek();
  renderDayNavigation();
  renderCategories();
  renderTasks();
}

// AÇÕES DE CICLO E TAREFAS

async function saveObjective(event) {
  event.preventDefault();
  state.activeCycle.objective = elements.cycleObjective.value.trim();
  await NextDB.cycles.update(state.activeCycle);
  elements.cycleSettingsDialog.close();
  renderCycleHeader();
}

function openTaskDialog(selectedDate = state.selectedDate) {
  state.editingTaskId = null;
  elements.taskForm.reset();
  elements.repeatDaily.closest(".repeat-option").hidden = false;
  elements.taskIdentity.hidden = false;
  renderTaskDefinitionOptions();
  syncTaskDefinitionSelection();
  elements.taskForm.querySelector(".eyebrow").textContent = "Novo passo";
  elements.taskForm.querySelector("h2").textContent = "Adicionar tarefa";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Adicionar tarefa";
  elements.taskDate.value = selectedDate;
  elements.taskDialog.showModal();
  requestAnimationFrame(() => elements.taskTitle.focus());
}

function renderTaskDefinitionOptions() {
  elements.existingTaskId.innerHTML = '<option value="">Selecione uma tarefa já criada</option>';
  state.taskDefinitions.forEach((definition) => {
    const option = document.createElement("option");
    option.value = definition.id;
    option.textContent = definition.title;
    elements.existingTaskId.append(option);
  });
}

function syncTaskDefinitionSelection() {
  const definition = state.taskDefinitions.find((item) => item.id === elements.existingTaskId.value);
  const usingExisting = Boolean(definition);
  elements.taskTitle.readOnly = usingExisting;
  elements.taskTitle.classList.toggle("is-readonly", usingExisting);
  if (!definition) {
    elements.taskTitle.placeholder = "Ex.: Não fumar";
    return;
  }

  elements.taskTitle.value = definition.title;
  elements.taskTitle.placeholder = "";
}

async function renameTaskDefinition(taskDefinitionId, title) {
  const allTasks = await NextDB.tasks.getAll();
  const relatedTasks = allTasks.filter((task) => task.taskDefinitionId === taskDefinitionId);
  await Promise.all(relatedTasks.map((task) => {
    task.title = title;
    return NextDB.tasks.update(task);
  }));

  state.tasks.forEach((task) => {
    if (task.taskDefinitionId === taskDefinitionId) task.title = title;
  });
  state.taskDefinitions = buildTaskDefinitions(allTasks);

  // Atualiza somente o título nos resumos históricos, mantendo números congelados.
  const cycles = await NextDB.cycles.getAll();
  await Promise.all(cycles.map((cycle) => {
    const summaries = cycle.recurrenceSummary || [];
    let changed = false;
    summaries.forEach((summary) => {
      if (summary.taskDefinitionId === taskDefinitionId) {
        summary.title = title;
        changed = true;
      }
    });
    return changed ? NextDB.cycles.update(cycle) : Promise.resolve();
  }));
}

// Agrupa as ocorrências para congelar o progresso no histórico.
function calculateRecurrenceSummary() {
  const seriesMap = new Map();

  state.tasks.forEach((task) => {
    if (!task.seriesId) return;

    if (!seriesMap.has(task.seriesId)) {
      seriesMap.set(task.seriesId, { taskDefinitionId: task.taskDefinitionId, title: task.title, count: 0, completed: 0 });
    }

    const series = seriesMap.get(task.seriesId);
    series.count += 1;
    if (task.completed) series.completed += 1;
  });

  return Array.from(seriesMap.entries()).map(([seriesId, data]) => ({
    seriesId,
    taskDefinitionId: data.taskDefinitionId,
    ...data,
  }));
}

// Recorrências usam a mesma série, mas cada dia é concluído separadamente.
async function addTask(event) {
  event.preventDefault();
  const data = new FormData(elements.taskForm);
  const selectedDefinition = state.taskDefinitions.find((item) => item.id === data.get("existingTaskId"));
  const title = selectedDefinition?.title || data.get("title").trim();
  const firstDate = data.get("scheduledDate");
  const shouldRepeat = data.get("repeatDaily") === "on";
  if (!title) return;

  const sameNameDefinition = state.taskDefinitions.find((item) => item.title.localeCompare(title, "pt-BR", { sensitivity: "accent" }) === 0);
  if (state.editingTaskId === null && !selectedDefinition && sameNameDefinition) {
    alert("Essa tarefa já existe. Selecione-a acima para manter o histórico padronizado.");
    return;
  }

  // Modo edição: atualiza a tarefa existente
  if (state.editingTaskId !== null) {
    const task = state.tasks.find((item) => item.id === state.editingTaskId);
    await renameTaskDefinition(task.taskDefinitionId, title);
    task.description = data.get("description").trim();
    task.scheduledDate = firstDate;
    task.category = data.get("category");
    await NextDB.tasks.update(task);
    state.editingTaskId = null;
    elements.taskForm.reset();
    elements.taskDialog.close();
    render();
    return;
  }

  // Modo criação com recorrência: uma tarefa por dia, todas com mesmo seriesId
  // Permite concluir cada ocorrência independentemente e rastrear progresso.
  const dates = cycleDates(state.activeCycle);
  const scheduledDates = shouldRepeat
    ? dates.slice(dates.indexOf(firstDate))  // A partir do dia selecionado até o fim do ciclo
    : [firstDate];

  // taskDefinitionId padroniza o nome mesmo entre ocorrências e ciclos.
  const taskDefinitionId = selectedDefinition
    ? selectedDefinition.id
    : createTaskDefinitionId();

  // seriesId identifica ocorrências relacionadas de uma mesma tarefa recorrente
  // Se o navegador não suporta crypto.randomUUID, usa timestamp como fallback
  const seriesId = shouldRepeat
    ? (crypto.randomUUID?.() || `series-${Date.now()}`)
    : null;

  for (const scheduledDate of scheduledDates) {
    const task = {
      cycleId: state.activeCycle.id,
      taskDefinitionId,
      seriesId,
      title,
      description: data.get("description").trim(),
      category: data.get("category"),
      scheduledDate,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    task.id = await NextDB.tasks.add(task);
    state.tasks.push(task);
  }

  state.taskDefinitions = buildTaskDefinitions([...state.taskDefinitions, { taskDefinitionId, title }]);

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
  if (!confirm("Excluir esta tarefa? Essa ação não pode ser desfeita.")) return;
  await NextDB.tasks.remove(id);
  state.tasks = state.tasks.filter((task) => task.id !== id);
  render();
}

function openTaskDetail(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.detailTaskId = id;
  document.querySelector("#detailTaskTitle").textContent = task.title;
  document.querySelector("#detailObjective").textContent = state.activeCycle.objective || "Nenhum objetivo definido";
  document.querySelector("#detailTaskDefinitionId").textContent = task.taskDefinitionId;
  document.querySelector("#detailDate").textContent = formatDate(task.scheduledDate, { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  document.querySelector("#detailCategory").textContent = categories[task.category].label;
  document.querySelector("#detailStatus").textContent = task.completed ? "Concluída" : "Pendente";
  document.querySelector("#detailDescription").textContent = task.description || "Sem detalhes adicionais";
  elements.taskDetailDialog.showModal();
}

// A edição mantém a recorrência original e atualiza o nome da definição.
function openEditTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  state.editingTaskId = id;
  if (elements.taskDetailDialog.open) elements.taskDetailDialog.close();
  elements.taskForm.querySelector(".eyebrow").textContent = "Ajustar passo";
  elements.taskForm.querySelector("h2").textContent = "Editar tarefa";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Salvar alterações";
  elements.taskTitle.value = task.title;
  elements.taskTitle.readOnly = false;
  elements.taskTitle.classList.remove("is-readonly");
  elements.taskDescription.value = task.description || "";
  elements.taskDate.value = task.scheduledDate;
  elements.repeatDaily.checked = false;
  elements.repeatDaily.closest(".repeat-option").hidden = true;
  elements.taskIdentity.hidden = true;
  elements.existingTaskId.value = "";
  elements.taskForm.querySelector(`[name="category"][value="${task.category}"]`).checked = true;
  elements.taskDialog.showModal();
}

// IMPORTAÇÃO E EXPORTAÇÃO

function showImportMessage(message, isError = false) {
  elements.importMessage.textContent = message;
  elements.importMessage.classList.toggle("error", isError);
  elements.importMessage.hidden = false;
}

// Valida o arquivo antes de alterar o ciclo atual.
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

// Ignora uma ocorrência se ela já existir no mesmo dia e categoria.
async function importWeekPlan(file) {
  try {
    const plan = JSON.parse(await file.text());
    const importedTasks = validateWeekPlan(plan);
    let created = 0;
    let ignored = 0;

    // Atualiza objetivo se fornecido no arquivo
    if (typeof plan.objective === "string" && plan.objective.trim()) {
      state.activeCycle.objective = plan.objective.trim().slice(0, 140);
      await NextDB.cycles.update(state.activeCycle);
    }

    // Cria cada tarefa, respeitando recorrência e evitando duplicatas
    for (const importedTask of importedTasks) {
      const firstIndex = importedTask.day - 1;
      const dates = importedTask.repeatDaily
        ? cycleDates(state.activeCycle).slice(firstIndex)
        : [cycleDates(state.activeCycle)[firstIndex]];
      const seriesId = importedTask.repeatDaily
        ? (crypto.randomUUID?.() || `series-${Date.now()}-${created}`)
        : null;
      const taskDefinitionId = createTaskDefinitionId();
      let createdForTask = false;

      for (const scheduledDate of dates) {
        // Verifica se a mesma tarefa no mesmo dia já existe (idempotência)
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
          taskDefinitionId,
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
        createdForTask = true;
      }

      if (createdForTask) {
        state.taskDefinitions = buildTaskDefinitions([...state.taskDefinitions, { taskDefinitionId, title: importedTask.title }]);
      }
    }

    render();
    const ignoredText = ignored ? ` ${ignored} ocorrência(s) duplicada(s) foram ignoradas.` : "";
    showImportMessage(`Semana importada: ${created} ocorrência(s) criada(s).${ignoredText}`);
  } catch (error) {
    showImportMessage(`Não foi possível importar: ${error.message}`, true);
  } finally {
    elements.importWeekFile.value = "";
  }
}

// Exporta o planejamento sem alterar o progresso salvo.
function buildWeekExport() {
  const exportedTasks = [];
  const exportedSeries = new Set();
  const sortedTasks = [...state.tasks].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  // Evita exportar múltiplas vezes a mesma série
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

  // Pequeno atraso para permitir que o navegador inicie o download
  // antes de revogar o URL (importante em Safari/iOS)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showImportMessage(`Ciclo ${state.activeCycle.number} exportado com ${plan.tasks.length} tarefa(s) planejada(s).`);
}

// ENCERRAMENTO E HISTÓRICO

function openCloseCycleDialog() {
  const completed = state.tasks.filter((task) => task.completed).length;
  elements.closeCycleSummary.textContent = `Você concluiu ${completed} de ${state.tasks.length} tarefas neste ciclo.`;
  elements.closeCycleDialog.showModal();
}

// Congela o resultado e as recorrências antes de criar o próximo ciclo.
async function finishCycle(event) {
  event.preventDefault();
  const completed = state.tasks.filter((task) => task.completed).length;
  const total = state.tasks.length;

  // Calcula dados de recorrências para armazenar no ciclo encerrado
  const recurrenceSummary = calculateRecurrenceSummary();

  // Congela o resumo: não muda mais, fica no histórico
  state.activeCycle.status = "completed";
  state.activeCycle.feedback = new FormData(elements.closeCycleForm).get("feedback").trim();
  state.activeCycle.closedAt = new Date().toISOString();
  state.activeCycle.summary = {
    total,
    completed,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
  state.activeCycle.recurrenceSummary = recurrenceSummary;

  await NextDB.cycles.update(state.activeCycle);

  // Move para histórico e cria novo ciclo ativo
  state.history.unshift(state.activeCycle);
  state.activeCycle = await createNextCycle([...state.history, state.activeCycle]);
  state.tasks = [];
  state.selectedDate = state.activeCycle.startDate;
  elements.closeCycleForm.reset();
  elements.closeCycleDialog.close();
  render();
}

// EVENTOS
document.querySelector("#openTaskForm").addEventListener("click", () => openTaskDialog());
elements.existingTaskId.addEventListener("change", syncTaskDefinitionSelection);
document.querySelector("#closeTaskForm").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#cancelTask").addEventListener("click", () => elements.taskDialog.close());
document.querySelector("#closeTaskDetail").addEventListener("click", () => elements.taskDetailDialog.close());
document.querySelector("#detailEditTask").addEventListener("click", () => openEditTask(state.detailTaskId));
document.querySelector("#detailDeleteTask").addEventListener("click", async () => {
  const id = state.detailTaskId;
  elements.taskDetailDialog.close();
  await deleteTask(id);
});

document.querySelector("#openCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.showModal());
document.querySelector("#closeCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.close());
document.querySelector("#cancelCycleSettings").addEventListener("click", () => elements.cycleSettingsDialog.close());
document.querySelector("#openCloseCycle").addEventListener("click", () => {
  elements.cycleSettingsDialog.close();
  openCloseCycleDialog();
});
document.querySelector("#closeCycleDialogButton").addEventListener("click", () => elements.closeCycleDialog.close());
document.querySelector("#cancelCloseCycle").addEventListener("click", () => elements.closeCycleDialog.close());

elements.importWeekButton.addEventListener("click", () => elements.importWeekFile.click());
elements.exportWeekButton.addEventListener("click", exportWeekPlan);
elements.importWeekFile.addEventListener("change", () => {
  const [file] = elements.importWeekFile.files;
  if (file) importWeekPlan(file);
});

elements.taskForm.addEventListener("submit", addTask);
elements.cycleSettingsForm.addEventListener("submit", saveObjective);
elements.closeCycleForm.addEventListener("submit", finishCycle);

document.querySelector("#filters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  const filter = button.dataset.filter;
  state.statusFilters = filter === "all"
    ? []
    : state.statusFilters.includes(filter)
      ? state.statusFilters.filter((item) => item !== filter)
      : [...state.statusFilters, filter];
  updateFilterControls();
  renderCategories();
  renderTasks();
});

elements.clearFilters.addEventListener("click", () => {
  state.statusFilters = [];
  state.categoryFilters = [];
  updateFilterControls();
  renderCategories();
  renderTasks();
});

// INICIALIZAÇÃO
async function init() {
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

// Mantém o PWA disponível offline quando o navegador permitir.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      // Força a verificação da nova versão quando a PWA é aberta no iPhone.
      .then((registration) => registration.update())
      .catch((error) => console.error("Falha ao registrar o modo offline.", error));
  });
}
