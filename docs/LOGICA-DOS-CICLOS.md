# Lógica dos ciclos do Next7

Este documento explica a implementação atual sem esconder os detalhes importantes. A ideia é servir como mapa enquanto você lê os comentários de `db.js` e `app.js`.

## 1. Os dois tipos de dados

O IndexedDB possui duas *object stores*, equivalentes a tabelas:

### `cycles`

Cada registro representa uma semana:

```js
{
  id: 1,
  number: 1,
  startDate: "2026-08-30",
  endDate: "2026-09-05",
  objective: "Treinar e estudar com consistência",
  status: "active", // ou "completed"
  feedback: "",
  createdAt: "...",
  closedAt: null,
  summary: null
}
```

Somente um ciclo deve possuir `status: "active"`. Os ciclos encerrados recebem `status: "completed"` e aparecem no histórico.

### `tasks`

Cada tarefa aponta para um ciclo através de `cycleId`:

```js
{
  id: 10,
  cycleId: 1,
  title: "Treinar por 30 minutos",
  category: "corpo",
  scheduledDate: "2026-08-31",
  completed: false,
  completedAt: null,
  createdAt: "..."
}
```

O `cycleId` é a ligação entre as duas stores. Mesmo após encerrar a semana, suas tarefas continuam no banco ligadas ao ciclo antigo.

## 2. O que acontece ao abrir o app

A função `init()` chama `loadData()`:

1. Busca todos os ciclos e todas as tarefas;
2. Procura um ciclo com status `active`;
3. Se não encontrar, cria o primeiro ou o próximo ciclo;
4. Move tarefas antigas sem `cycleId` para o ciclo atual;
5. Coloca no estado somente as tarefas do ciclo ativo;
6. Renderiza período, dias, categorias, tarefas e histórico.

Essa migração evita perder tarefas salvas na primeira versão do projeto.

## 3. Como os sete dias são calculados

O início é salvo como `YYYY-MM-DD`. O final é calculado adicionando seis dias:

```js
endDate: addDays(startDate, CYCLE_LENGTH - 1)
```

Como o primeiro dia já conta, `início + 6` produz exatamente sete datas. `cycleDates()` cria a lista usada nos cards e no campo de data da tarefa.

As datas são montadas no horário local, sem `new Date("YYYY-MM-DD")`, porque essa forma pode sofrer alteração de dia por causa do fuso horário.

## 4. Como uma tarefa entra no ciclo

Ao salvar o formulário, `addTask()` registra:

- `cycleId`: id do ciclo ativo;
- `scheduledDate`: dia escolhido dentro dos sete dias;
- `category`: Corpo, Carreira, Vida ou Mente;
- `completed`: começa como `false`.

A tarefa é salva no IndexedDB, adicionada ao estado da tela e então `render()` recalcula todos os indicadores.

## 5. Como a conclusão é registrada

`toggleTask()` inverte `completed`. Quando a tarefa é concluída, também salva a data e a hora em `completedAt`. Se ela voltar a ser pendente, `completedAt` volta para `null`.

Isso permitirá calcular análises mais detalhadas no futuro sem alterar o formato básico dos dados.

## 6. Como um ciclo é encerrado

O encerramento é manual para que você possa escrever o feedback. `finishCycle()` executa esta sequência:

1. Conta todas as tarefas e as concluídas;
2. Calcula o percentual;
3. Salva o feedback;
4. Muda o status para `completed`;
5. Salva `closedAt` e congela o `summary`;
6. Atualiza o ciclo no IndexedDB;
7. Cria um novo ciclo ativo, começando no dia do encerramento;
8. Limpa as tarefas exibidas, sem apagar as tarefas antigas;
9. Renderiza a nova semana e o histórico.

O resumo é “congelado” para que o resultado daquela semana não seja recalculado ou alterado por tarefas de ciclos futuros.

## 7. O que o histórico mostra

Cada cartão exibe:

- Número do ciclo;
- Objetivo definido;
- Período de sete dias;
- Quantidade concluída e total;
- Percentual final;
- Feedback, quando preenchido.

As tarefas antigas continuam armazenadas. A interface atual exibe apenas o resumo; uma tela futura poderá abrir os detalhes completos de cada ciclo.

## 8. Decisões da primeira versão

- O ciclo não fecha sozinho quando chega ao sétimo dia: o fechamento manual garante o feedback;
- É possível encerrar antes do sétimo dia para facilitar o uso e os testes;
- O próximo ciclo começa no dia em que o anterior é encerrado;
- “12 semanas” é a meta visual do programa, não um bloqueio: o banco aceita ciclos posteriores;
- Tudo permanece somente no navegador atual.

## 9. Ordem sugerida para estudar o código

1. Leia `db.js` para entender as duas stores e o CRUD;
2. Em `app.js`, leia as funções de data;
3. Passe por `buildCycle()`, `createNextCycle()` e `loadData()`;
4. Veja `addTask()` e `toggleTask()`;
5. Termine em `finishCycle()`;
6. Só depois analise as funções `render...`, que cuidam principalmente do HTML.

