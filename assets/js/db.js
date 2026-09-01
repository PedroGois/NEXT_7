// BANCO DE DADOS
// Mantém ciclos, tarefas e finanças em stores independentes.

const NextDB = (() => {
  const DATABASE_NAME = "next-personal-growth";
  const DATABASE_VERSION = 5;
  const TASK_STORE = "tasks";
  const CYCLE_STORE = "cycles";
  const FINANCE_STORES = ["income", "expenses", "creditCards", "subscriptions", "installments"];

  // Abre o banco e cria apenas stores ou índices ausentes.
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;
          // Stores novas recebem todos os índices necessários.
        if (!database.objectStoreNames.contains(TASK_STORE)) {
          const taskStore = database.createObjectStore(TASK_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          taskStore.createIndex("category", "category");
          taskStore.createIndex("completed", "completed");
          taskStore.createIndex("createdAt", "createdAt");
          taskStore.createIndex("seriesId", "seriesId");
          taskStore.createIndex("cycleId", "cycleId");
          taskStore.createIndex("taskDefinitionId", "taskDefinitionId");
        } else {
          // Migração segura para bancos já existentes.
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

        // Finanças não compartilham dados com os ciclos.
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

  // Executa uma operação e fecha a conexão ao concluir.
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

  // Mantém o acesso às stores uniforme.
  function createCrud(storeName) {
    return {
      getAll: () => run(storeName, "readonly", (store) => store.getAll()),
      add: (item) => run(storeName, "readwrite", (store) => store.add(item)),
      update: (item) => run(storeName, "readwrite", (store) => store.put(item)),
      remove: (id) => run(storeName, "readwrite", (store) => store.delete(id)),
    };
  }

  // API PÚBLICA
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

