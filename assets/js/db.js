// =============================================================
// BANCO DE DADOS DO NEXT7
// =============================================================
// O IndexedDB funciona como um pequeno banco dentro do navegador.
// Temos duas stores (parecidas com tabelas):
// - cycles: uma linha para cada ciclo de 7 dias;
// - tasks: uma linha para cada tarefa.
//
// O app.js não acessa o IndexedDB diretamente. Ele chama apenas os
// métodos públicos no final deste arquivo: NextDB.tasks e NextDB.cycles.

const NextDB = (() => {
  const DATABASE_NAME = "next-personal-growth";
  const DATABASE_VERSION = 2; // Versão 2 adiciona a store de ciclos.
  const TASK_STORE = "tasks";
  const CYCLE_STORE = "cycles";

  // Abre o banco. Se a versão mudou, onupgradeneeded prepara a estrutura.
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;

        // Mantém compatibilidade com quem abriu a versão 1 do projeto.
        if (!database.objectStoreNames.contains(TASK_STORE)) {
          const taskStore = database.createObjectStore(TASK_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          taskStore.createIndex("category", "category");
          taskStore.createIndex("completed", "completed");
          taskStore.createIndex("createdAt", "createdAt");
        }

        if (!database.objectStoreNames.contains(CYCLE_STORE)) {
          const cycleStore = database.createObjectStore(CYCLE_STORE, {
            keyPath: "id",
            autoIncrement: true,
          });
          cycleStore.createIndex("status", "status");
          cycleStore.createIndex("number", "number", { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Executa uma operação em uma store e devolve uma Promise.
  // mode = "readonly" para leitura ou "readwrite" para alterações.
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

  // CRUD = Create, Read, Update, Delete.
  function createCrud(storeName) {
    return {
      getAll: () => run(storeName, "readonly", (store) => store.getAll()),
      add: (item) => run(storeName, "readwrite", (store) => store.add(item)),
      update: (item) => run(storeName, "readwrite", (store) => store.put(item)),
      remove: (id) => run(storeName, "readwrite", (store) => store.delete(id)),
    };
  }

  // Esta é a pequena API pública do banco.
  return {
    tasks: createCrud(TASK_STORE),
    cycles: createCrud(CYCLE_STORE),
  };
})();

