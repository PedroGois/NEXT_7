// =============================================================
// BANCO DE DADOS DO NEXT7 — IndexedDB com schema v5
// =============================================================
// Armazena ciclos, tarefas, dados financeiros e históricos para análise futura.
// Sem dependências externas, compatível com offline-first e PWA.
//
// SCHEMA (version 5):
// ┌─ cycles (para cada ciclo de 7 dias)
// │  id, number, startDate, endDate, objective, feedback, status,
// │  createdAt, closedAt, summary { total, completed, percentage },
// │  recurrenceSummary [ { seriesId, taskDefinitionId, title, count, completed } ]
// ├─ tasks (uma linha por ocorrência de tarefa)
// │  id, taskDefinitionId (identificador estável), cycleId, seriesId (se recorrente), title, description,
// │  category, scheduledDate, completed, completedAt, createdAt
// └─ income, expenses, creditCards, subscriptions, installments (financeiro)
//
// API pública: NextDB.tasks, NextDB.cycles, NextDB.income, etc.
// app.js não acessa IndexedDB diretamente.

const NextDB = (() => {
  const DATABASE_NAME = "next-personal-growth";
  const DATABASE_VERSION = 5;  // v5: adiciona índice taskDefinitionId para padronizar tarefas.
  const TASK_STORE = "tasks";
  const CYCLE_STORE = "cycles";
  const FINANCE_STORES = ["income", "expenses", "creditCards", "subscriptions", "installments"];

  /**
   * Abre ou cria o banco de dados com schema migrado.
   * onupgradeneeded garante compatibilidade entre versões.
   */
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;
        // v1 → v4: Criar stores se não existem
        if (!database.objectStoreNames.contains(TASK_STORE)) {
          const taskStore = database.createObjectStore(TASK_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          taskStore.createIndex("category", "category");
          taskStore.createIndex("completed", "completed");
          taskStore.createIndex("createdAt", "createdAt");
          // v4: novo índice para buscar todas as tarefas de uma série
          taskStore.createIndex("seriesId", "seriesId");
          taskStore.createIndex("cycleId", "cycleId");
          taskStore.createIndex("taskDefinitionId", "taskDefinitionId");
        } else {
          // Migra índices sem tocar em registros já existentes.
          const transaction = event.target.transaction;
          const taskStore = transaction.objectStore(TASK_STORE);
          if (!taskStore.indexNames.contains("seriesId")) {
            taskStore.createIndex("seriesId", "seriesId");
          }
          if (!taskStore.indexNames.contains("cycleId")) {
            taskStore.createIndex("cycleId", "cycleId");
          }
          if (!taskStore.indexNames.contains("taskDefinitionId")) {
            taskStore.createIndex("taskDefinitionId", "taskDefinitionId");
          }
        }

        if (!database.objectStoreNames.contains(CYCLE_STORE)) {
          const cycleStore = database.createObjectStore(CYCLE_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          cycleStore.createIndex("status", "status");
          cycleStore.createIndex("number", "number", { unique: true });
        }

        // Dados financeiros: independentes de ciclos, com competência mensal
        FINANCE_STORES.forEach((storeName) => {
          if (!database.objectStoreNames.contains(storeName)) {
            const store = database.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
            store.createIndex("date", "date", { unique: false });
          }
        });
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Executa uma operação de leitura/escrita dentro de uma transação.
   * @param {string} storeName - nome da store
   * @param {string} mode - "readonly" ou "readwrite"
   * @param {Function} operation - função que recebe a store
   * @returns {Promise} resultado da operação
   */
  async function run(storeName, mode, operation) {
    const database = await open();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Cria interface CRUD (Create, Read, Update, Delete) para uma store.
   */
  function createCrud(storeName) {
    return {
      getAll: () => run(storeName, "readonly", (store) => store.getAll()),
      add: (item) => run(storeName, "readwrite", (store) => store.add(item)),
      update: (item) => run(storeName, "readwrite", (store) => store.put(item)),
      remove: (id) => run(storeName, "readwrite", (store) => store.delete(id)),
    };
  }

  // API pública: expõe apenas métodos CRUD, nunca a conexão direta
  return {
    tasks: createCrud(TASK_STORE),
    cycles: createCrud(CYCLE_STORE),
    income: createCrud("income"),
    expenses: createCrud("expenses"),
    creditCards: createCrud("creditCards"),
    subscriptions: createCrud("subscriptions"),
    installments: createCrud("installments"),
  };
})();

