# Next7

Next7 é um organizador pessoal de ciclos de 7 dias. Ele reúne tarefas em quatro pilares: **Corpo**, **Carreira**, **Vida** e **Mente**.

## O que a versão atual faz

- Cria e organiza tarefas por dia e pilar;
- Abre em **Hoje** e permite navegar pelos próximos dias;
- Oferece a visão **Geral** para todo o ciclo;
- Filtra por pilar e por status (todas, pendentes ou concluídas);
- Atualiza os totais dos pilares conforme o dia e status selecionados;
- Salva os dados no navegador com IndexedDB;
- Importa e exporta planejamentos em JSON;
- Fecha o ciclo, registra um feedback e inicia o próximo;
- Inclui Finanças mensal com receitas, gastos, cartões, assinaturas e parcelas;
- Pode ser instalada como PWA e usada offline após a primeira abertura.

## Como usar

1. Abra o app em um servidor local.
2. Defina o objetivo pelo ícone de ajustes no card do ciclo.
3. Crie tarefas e escolha dia, pilar e repetição opcional.
4. Navegue por **Hoje**, **Amanhã** e os próximos dias; use **Geral** para ver o ciclo inteiro.
5. Use os pilares e o filtro de status para refinar a lista.

## Executar localmente

Abra a pasta com uma extensão como Live Server ou execute:

```bash
python -m http.server 4173
```

Depois, acesse `http://localhost:4173`.

## Estrutura

```text
NEXT_7/
├── assets/
│   ├── css/style.css
│   ├── images/icon.svg
│   └── js/
│       ├── app.js
│       ├── db.js
│       └── finance.js
├── index.html
├── manifest.json
├── service-worker.js
└── README.md
```

`assets/` é mantida apenas para separar estilo, lógica, banco local e ícone da aplicação.

## Privacidade

Os dados ficam somente no IndexedDB do navegador. Nenhuma tarefa, objetivo ou feedback é enviado a um servidor.

## Arquitetura e carregamento

O projeto é estático: não há backend, login, API nem dependências de instalação. `index.html` concentra a interface e carrega os scripts nesta ordem:

```text
assets/js/db.js → assets/js/app.js → assets/js/finance.js
```

A ordem importa. `db.js` cria o objeto global `NextDB`, que os módulos de Ciclo e Finanças usam para ler e gravar dados. Cada módulo carrega seus dados ao iniciar, mantém estado em memória, salva pelo `NextDB` e renderiza sua parte da tela.

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | estrutura HTML, diálogos e navegação |
| `assets/css/style.css` | aparência e responsividade |
| `assets/js/db.js` | banco local e operações CRUD |
| `assets/js/app.js` | ciclos, tarefas, filtros, importação e histórico |
| `assets/js/finance.js` | receitas, gastos, cartões, assinaturas e parcelas |
| `manifest.json` | dados de instalação da PWA |
| `service-worker.js` | cache e uso offline |

## Dados locais

O banco IndexedDB chama-se `next-personal-growth` e está na versão `6`. O app **não usa localStorage**.

| Store | Conteúdo |
| --- | --- |
| `tasks` | tarefas dos ciclos |
| `cycles` | ciclos ativos e encerrados |
| `income` | receitas |
| `expenses` | gastos, diretos ou no cartão |
| `creditCards` | cartões e valores de fatura |
| `subscriptions` | assinaturas recorrentes |
| `installments` | parcelas e compromissos mensais |

As tarefas são indexadas por categoria, conclusão, criação, série, ciclo e definição; os ciclos, por status e número. Na migração para a versão 6, o código limpa somente os dados financeiros de bancos anteriores. Ciclos e tarefas são preservados. Não altere a versão do banco, stores ou migrações em `db.js` sem testar com dados já existentes.

## Módulo Ciclo

O código está em `assets/js/app.js`.

1. `loadData()` busca ciclos e tarefas. Sem ciclo ativo, `createNextCycle()` cria o primeiro.
2. Todo ciclo dura sete dias (`CYCLE_LENGTH = 7`) a partir de `startDate`.
3. `addTask()` cria uma tarefa no dia escolhido. Se ela for recorrente, cria uma ocorrência por dia até o fim do ciclo.
4. Concluir uma tarefa altera somente aquela ocorrência.
5. `finishCycle()` grava feedback, totais e resumo de recorrências; depois cria o próximo ciclo ativo.

Regras que devem ser preservadas:

- Toda tarefa pertence a um `cycleId`.
- `taskDefinitionId` representa a mesma tarefa entre ciclos. Ao renomeá-la, `renameTaskDefinition()` atualiza tarefas relacionadas e títulos nos resumos históricos.
- `seriesId` agrupa as ocorrências de uma recorrência no mesmo ciclo. Cada ocorrência continua podendo ser concluída separadamente.
- O resumo de recorrência é congelado ao encerrar o ciclo; não deve ser recalculado no histórico.
- Editar uma ocorrência não recria nem altera a recorrência original.
- Os filtros de pilar e status são combinados. A visão Geral considera o ciclo inteiro; as demais consideram o dia selecionado.

### Importação e exportação

`buildWeekExport()` gera um JSON de planejamento; o progresso não é exportado. `validateWeekPlan()` aceita o formato abaixo:

```json
{
  "version": 1,
  "objective": "Caminhar todos os dias",
  "tasks": [
    {
      "title": "Caminhar 30 minutos",
      "category": "corpo",
      "day": 1,
      "repeatDaily": true
    }
  ]
}
```

`title` é obrigatório; `day` deve ser um inteiro entre 1 e 7; `category` deve ser um dos pilares aceitos pela interface. Ao importar, ocorrências com mesmo título, categoria e data são ignoradas para evitar duplicatas. Uma importação cria uma nova definição de tarefa.

## Módulo Finanças

O código está em `assets/js/finance.js`; seus dados não dependem do ciclo de sete dias.

- Receita avulsa entra somente no mês da data; receita recorrente entra a partir do mês inicial.
- Gasto direto entra no mês da data.
- Gasto no cartão entra na fatura definida pela data de fechamento.
- Parcela entra do mês de vencimento até alcançar `totalInstallments`.
- Assinatura ativa entra a partir da data inicial. Quando ligada a cartão, entra na fatura correspondente.

`totals()` centraliza os cálculos: o saldo é `receitas - gastos diretos - total comprometido`. O comprometido soma compras de cartão, parcelas, assinaturas projetadas e faturas já registradas, evitando descontar a mesma compra duas vezes.

Ao mudar regras de cobrança, revise junto `invoiceMonth()`, `installmentForMonth()`, `subscriptionForMonth()` e `totals()`. Teste compras antes e depois do fechamento, assinatura com e sem cartão, fatura registrada e virada de ano.

### Mapeamento: marcar pagamento como pago (implementado)

Este é o menor ajuste compatível com a estrutura atual. Ele não cria stores, tabelas, índices ou migrações: reutiliza os objetos já gravados nas stores financeiras e os CRUDs existentes de `NextDB`. A pequena função local `paymentButton()` apenas gera o botão que já é tratado pelo listener delegado existente.

#### Arquivos e pontos reais a alterar

| Arquivo | Ponto atual | Alteração mínima necessária |
| --- | --- | --- |
| `assets/js/finance.js` | `totals()` (linhas 78–90) | Incluir os gastos diretos do mês em `committed`, para que ele represente todas as obrigações, e recalcular `spent` exclusivamente a partir dos itens quitados. Passar a retornar os subconjuntos/valores pagos de que as telas precisarem. O novo saldo será `income - spent`; ele não deverá mais subtrair `committed`. |
| `assets/js/finance.js` | `renderSummary()` (linhas 94–97) | Continuar exibindo os quatro cards, mas usar o novo `spent` como **Total gasto** (somente pago) e o novo `balance` como **Saldo disponível** (receitas menos somente o pago). |
| `assets/js/finance.js` | `renderEntries()`, `renderCards()`, `renderSubscriptions()` e `renderInstallments()` (linhas 106–140) | Exibir o status pago/pendente e o controle de marcar/desmarcar nos itens que podem ser quitados. Os lançamentos de cartão devem aparecer sem esse controle individual; a ação fica somente na fatura do cartão. |
| `assets/js/finance.js` | `actions()` (linha 104) e o listener delegado de `el.content` em `bind()` (linhas 220–228) | Acrescentar ao conjunto de ações existente um botão com `data-finance-paid`; no mesmo listener, localizar o registro já carregado, alternar seu campo `pago`, chamar o `NextDB[store].update(...)` existente e então executar o mesmo `load()` e `render()` já usados por `saveForm()` e `remove()`. Não é necessário criar outro manipulador global nem outra função de persistência. |
| `assets/js/finance.js` | `saveForm()` (linhas 184–205) | Não exigir checkbox de pagamento nos formulários. O `record = { ...state.editing, ...data, ... }` já preserva `pago` ao editar; em cadastros novos, apenas inicializar o campo como pendente no objeto salvo. |
| `assets/js/db.js` | `createCrud()` (linhas 91–98) e stores financeiras existentes | Nenhuma alteração. `put()` em `NextDB[store].update()` já persiste campos adicionais dos objetos, e `getAll()` já os devolve. Não mudar `DATABASE_VERSION` (`6`), `FINANCE_STORES`, stores ou índices. |
| `index.html` | `#financeContent` (linha 83) | Nenhuma alteração estrutural: o conteúdo financeiro, inclusive os botões, já é criado por `finance.js`. |
| `assets/css/style.css` | `.finance-item-actions` e `.finance-item-actions .delete-task` (linhas 73–74 e 251–252) | Reutilizar essas regras no novo botão de status/ícone. Só ajustar CSS se for necessário diferenciar visualmente pago de pendente; não há necessidade para o funcionamento. |

#### Onde os valores são calculados hoje

Tudo está concentrado em `totals()` de `assets/js/finance.js`:

- `income` (linha 81) soma as receitas usando `recurringIncomeForMonth()`.
- `spent` (linha 82) hoje soma **todos** os gastos diretos do mês, mesmo sem confirmação de pagamento.
- `cardExpenses` (linha 83) reúne gastos vinculados a cartão pela fatura definida por `invoiceMonth()`.
- `installments` (linha 84) é formado por `installmentForMonth()`; a função calcula a parcela aplicável ao mês selecionado.
- `subscriptions` (linha 85) é formado por `subscriptionForMonth()`; essa função decide a fatura, a data de cobrança e se a cobrança ainda é projetada.
- `cardInvoices` (linha 86) lê a fatura mensal por `cardInvoiceForMonth()`, que usa `creditCards[].invoices[YYYY-MM]` e ainda aceita o formato anterior `currentInvoice`/`currentInvoiceMonth`.
- `committed` (linha 88) hoje soma compras no cartão, parcelas, assinaturas projetadas e faturas registradas; ainda não inclui os gastos diretos porque eles são tratados automaticamente como gastos.
- `balance` (linha 89) hoje é `income - spent - committed`; é este o único ponto que precisa trocar para `income - spent`.

`renderSummary()` apenas mostra o resultado de `totals()`; portanto não deve reproduzir nenhuma regra de pagamento. As listas de lançamentos, cartões, assinaturas e compromissos são renderizadas respectivamente por `renderEntries()`, `renderCards()`, `renderSubscriptions()` e `renderInstallments()`.

#### Estado `pago` e persistência mínima

Usar o campo `pago` dentro dos próprios registros, com a forma adequada ao ciclo de cada tipo. O campo não precisa de índice porque a tela já carrega as coleções completas em `load()` e filtra em memória.

| Registro existente | Campo a gravar | Chave/valor | Quando entra em **Total gasto** |
| --- | --- | --- | --- |
| `expenses` sem `cardId` | `pago` | booleano | `item.pago === true` e a data pertence ao mês selecionado. |
| `installments` sem cartão (`paymentMethod` não inicia com `card:`) | `pago` | objeto por mês, por exemplo `{ "2026-09": true }` | A parcela retornada por `installmentForMonth()` entra somente se `item.pago?.[selectedKey()] === true`. |
| `subscriptions` sem `cardId` | `pago` | objeto por mês, por exemplo `{ "2026-09": true }` | A ocorrência retornada por `subscriptionForMonth()` entra somente se `item.pago?.[selectedKey()] === true`. |
| `creditCards` | `pago` | objeto por fatura/mês, por exemplo `{ "2026-09": true }` | Apenas `cardInvoiceForMonth(card)` entra se `card.pago?.[selectedKey()] === true`. |
| `expenses` com `cardId`, `installments` com `paymentMethod` `card:<id>` e `subscriptions` com `cardId` | nenhum estado individual de quitação | — | Nunca entram individualmente em **Total gasto**; continuam apenas em **Total comprometido**. A quitação vem da fatura do cartão. |

Para manter a alteração pequena, o botão de uma fatura deve alternar `creditCards[].pago[selectedKey()]`, sem modificar `invoices`. O valor descontado é o valor da fatura que já existe em `cardInvoiceForMonth()`. Assim, antes de quitá-la, o usuário mantém o valor da fatura mensal no formulário atual do cartão; o pagamento não tenta reconstruir ou alterar seus itens. Isso também preserva a compatibilidade com `currentInvoice`/`currentInvoiceMonth` já tratada por essa função.

Em novo gasto direto, inicializar `pago: false`. Para compromissos, assinaturas e cartões, inicializar `pago: {}`. Ao desmarcar, trocar/remover apenas a chave do mês selecionado; manter as demais chaves para não desfazer pagamentos de outros meses. Em todos os casos, usar o `update()` já disponível em `NextDB`, que executa `put()` no IndexedDB.

#### Regra final para os totais

1. **Total comprometido:** somar todas as obrigações do mês, pagas ou pendentes: os gastos diretos do mês mais os componentes já existentes de `committed` (compras no cartão, parcelas, assinaturas projetadas e faturas registradas).
2. **Total gasto:** somar somente gasto direto pago, parcela direta paga no mês, assinatura direta paga no mês e fatura de cartão paga no mês.
3. **Saldo disponível:** `receitas - total gasto`. Um compromisso pendente reduz o comprometido, mas não reduz o saldo disponível.
4. **Antiduplicidade do cartão:** jamais somar em `spent` uma compra, parcela ou assinatura vinculada ao cartão. Só a fatura marcada como paga é somada, uma única vez, pelo valor retornado por `cardInvoiceForMonth()`.

Esse desenho deixa explícito um limite do modelo atual: o valor quitado da fatura é o valor mensal salvo em `creditCards[].invoices` (ou no legado `currentInvoice`), não a soma automática dos lançamentos do cartão. Não alterar essa regra neste ajuste; apenas exigir que a fatura tenha seu valor registrado no formulário atual antes de marcá-la como paga.

#### Compatibilidade com dados existentes

Registros antigos não terão `pago`. A leitura deve tratá-los como pendentes sem gravar uma migração em massa:

- gasto direto antigo: `item.pago === true` é falso se o campo não existe;
- assinatura, compromisso e cartão antigos: `item.pago?.[selectedKey()] === true` também é falso se o mapa não existe;
- ao marcar pela primeira vez, criar o booleano ou o objeto no próprio registro e salvar por `update()`.

Logo, nenhum dado passado é apagado, nenhum pagamento histórico é presumido e a versão do IndexedDB permanece `6`.

#### Interface e comportamento de marcar/desmarcar

- Em `renderEntries()`, adicionar um botão acessível **Marcar como pago** ou **Desmarcar pagamento** aos gastos diretos, às parcelas diretas visíveis no mês e às assinaturas diretas visíveis no mês. Exibir também um texto curto `Pago`/`Pendente` no detalhe do item.
- Em `renderCards()`, adicionar o mesmo botão na linha do cartão para a fatura do `selectedKey()`, com rótulo que deixe claro que a ação quita a fatura mensal. A ação deve estar disponível mesmo que a lista de lançamentos mostre compras daquele cartão.
- Em `renderEntries()`, os gastos no cartão devem continuar apenas como referência da fatura e não receber botão de quitação. Assinaturas com `cardId` e compromissos cujo `paymentMethod` é `card:<id>` seguem a mesma regra, inclusive nas abas próprias.
- Em `renderSubscriptions()` e `renderInstallments()`, mostrar o controle somente para o item aplicável ao mês selecionado e pago diretamente; para os vinculados a cartão, informar que o pagamento ocorre na fatura, sem ação individual.
- O clique usa a delegação já existente em `el.content`; depois da gravação, `load()` e `render()` atualizam imediatamente o rótulo, os cards de resumo e o saldo. O mesmo botão, ao clicar em um item pago, desfaz somente seu pagamento (ou somente a chave daquele mês).

#### Roteiro de validação

1. Criar um gasto direto pendente: ele aparece em comprometido, não em gasto, e não reduz o saldo; marcar/desmarcar deve alternar somente gasto e saldo.
2. Criar compromisso e assinatura sem cartão, navegar entre dois meses e marcar apenas um deles: a quitação não pode afetar o outro mês.
3. Criar compra, compromisso e assinatura no mesmo cartão: marcá-los individualmente não deve ser possível; marcar/desmarcar a fatura deve alterar gasto e saldo uma única vez.
4. Registrar fatura em `invoices[YYYY-MM]`, inclusive após o fechamento e na virada de ano; confirmar que `cardInvoiceForMonth()` e a chave de `pago` usam o mesmo mês.
5. Recarregar o navegador e conferir que o status continua no IndexedDB; conferir também que registros antigos sem `pago` aparecem como pendentes e continuam editáveis.

### Mapeamento: cor do Total comprometido (implementado)

Esta alteração é somente visual. Não requer IndexedDB, `db.js`, `index.html`, novo estado ou mudança em `totals()`: `renderSummary()` já recebe `income` e `committed` calculados para o mês selecionado.

| Arquivo | Ponto real | Alteração mínima |
| --- | --- | --- |
| `assets/js/finance.js` | `renderSummary(data)` (linhas 97–100) | Definir, no próprio `renderSummary()`, uma classe adicional para o card **Total comprometido** antes de montar o array `cards`. Aplicar essa classe somente a esse card; os demais continuam com a aparência atual. |
| `assets/css/style.css` | `.finance-card` e `.finance-card.balance` (linhas 62–64) | Criar três variações de `.finance-card` que reutilizem a borda e o fundo translúcido/gradiente de `.balance`, em vermelho, amarelo e azul. Não modificar o verde já aplicado a `.balance`. |

#### Regra exata de classificação

Considerar `income` como receita do mês e `committed` como total comprometido, ambos vindos de `totals()`:

| Condição | Classe sugerida | Cor |
| --- | --- | --- |
| `committed > income` | `committed-danger` | Vermelho translúcido: o comprometido ultrapassou a receita. |
| `income > 0`, `committed <= income` e `(income - committed) / income < 0.10` | `committed-warning` | Amarelo translúcido: sobra menor que 10% da receita. Inclui receita e comprometido iguais. |
| `income > 0` e `(income - committed) / income >= 0.10` | `committed-goal` | Azul translúcido: sobra de 10% ou mais da receita, a meta. |
| `income === 0` e `committed === 0` | nenhuma classe nova | Mantém o visual neutro; não existe percentual de diferença para classificar. |

O limite de 10% é inclusivo para azul: exatamente 10% de sobra já é meta. Valores negativos entram primeiro no vermelho, evitando divisão ou percentual ambíguo.

#### Forma mínima dentro de `renderSummary()`

Sem alterar `totals()`, calcular a classe do comprometido uma vez e usá-la no segundo item do array que já forma os cards. A estrutura passa conceitualmente de `['Total comprometido', data.committed]` para `['Total comprometido', data.committed, committedClass]`. O `map()` existente já aplica o terceiro valor como classe no `<article>`.

As regras de CSS devem seguir o padrão visual já usado pelo saldo disponível: borda com transparência e `linear-gradient` suave sobre `var(--surface)`. Sugestão de tons: vermelho `rgba(255, 117, 87, ...)`, amarelo `rgba(245, 196, 70, ...)` e azul `rgba(99, 179, 237, ...)`. Assim o card parece selecionado sem reduzir legibilidade.

#### Validação quando for implementado

1. Receita 1.000 e comprometido 1.001: vermelho.
2. Receita 1.000 e comprometido 1.000, ou 950: amarelo.
3. Receita 1.000 e comprometido 900: azul; é exatamente 10% de sobra.
4. Receita 1.000 e comprometido 899: azul.
5. Receita 0 e comprometido 0: neutro; receita 0 e comprometido maior que zero: vermelho.
6. Trocar o mês e confirmar que a cor acompanha os valores daquele mês, sem gravar nem alterar dados.

### Mapeamento: indicador de sobra ou falta no Total comprometido (implementado)

Esta é outra alteração somente de apresentação. Ela reutiliza `data.income`, `data.committed` e `money()` já disponíveis em `renderSummary()`; não altera `totals()`, dados salvos ou o IndexedDB.

| Arquivo | Ponto real | Alteração mínima |
| --- | --- | --- |
| `assets/js/finance.js` | `renderSummary(data)` (linhas 97–103) | Calcular `difference = data.income - data.committed` no mesmo bloco que já decide `committedClass`. Montar um pequeno HTML de indicador somente para o card **Total comprometido** e incluí-lo no `<article>` gerado pelo `map()` atual. |
| `assets/css/style.css` | `.finance-card` (linha 62) | Definir o card como referência de posicionamento e posicionar o indicador no canto superior direito. Criar somente os estilos do indicador de falta e de sobra. |

#### Regra do indicador

| Condição | Texto/valor | Ícone | Estilo |
| --- | --- | --- | --- |
| `data.committed > data.income` | `Falta ${money(data.committed - data.income)}` | `fa-arrow-trend-up` | vermelho, indicando que as obrigações ultrapassam a receita. |
| `data.committed < data.income` | `Sobra ${money(data.income - data.committed)}` | `fa-arrow-trend-down` | verde, indicando valor ainda livre depois do comprometido. |
| `data.committed === data.income` | não exibir indicador | — | não há sobra nem falta. |

O indicador deve ser uma tag compacta no canto superior direito do card, separada do título e do valor principal. Sugestão de marcação: um `span.finance-card-indicator` com um ícone Font Awesome e o valor; `finance-card-indicator danger` para falta e `finance-card-indicator success` para sobra. Os ícones já estão disponíveis em `index.html` pela biblioteca Font Awesome carregada pelo projeto.

Para a inclusão sem refatorar a estrutura, ampliar os itens do array de `renderSummary()` com um quarto valor opcional, por exemplo `indicator`, e renderizá-lo dentro do `<article>` apenas quando existir. O segundo item — **Total comprometido** — é o único que recebe esse quarto valor; os outros cards seguem iguais.

No CSS, usar `position: relative` em `.finance-card` e `position: absolute; top: ...; right: ...` no indicador. Aplicar fundo/borda transparentes em vermelho para `.danger` e em verde para `.success`, no mesmo estilo suave dos cards coloridos já existentes. Garantir espaço à direita no título do card para a tag não sobrepor o texto em telas pequenas.

#### Validação quando for implementado

1. Receita 1.000 e comprometido 1.200: tag vermelha com seta para cima e `Falta R$ 200,00`.
2. Receita 1.000 e comprometido 800: tag verde com seta para baixo e `Sobra R$ 200,00`.
3. Receita e comprometido em 1.000: nenhuma tag.
4. Alternar de mês e conferir que tanto a tag quanto a cor do card acompanham os valores mensais.

### Mapeamento: mover a tag de sobra/falta para abaixo do valor (implementado)

O indicador atual é `committedIndicator`, montado em `renderSummary()` de `assets/js/finance.js`, e usa `.finance-card-indicator` em `assets/css/style.css`. Esta alteração muda somente sua posição visual; a regra de falta/sobra, cores, ícones, cálculo da diferença e cache de dados permanecem iguais.

| Arquivo | Ponto real | Alteração mínima |
| --- | --- | --- |
| `assets/js/finance.js` | `renderSummary(data)` (linhas 97–111) | Na string do `map()` que monta o `<article>`, mover `${indicator}` para depois de `<strong>${money(value)}</strong>`. Assim a ordem interna do card comprometido fica: título, valor principal, tag. |
| `assets/css/style.css` | `.finance-card.committed > span:not(.finance-card-indicator)` e `.finance-card-indicator` (linhas 64 e 70) | Remover o espaço reservado à direita do título e retirar o posicionamento absoluto (`position`, `top`, `right`) da tag. Tornar a tag um elemento normal em fluxo, com margem superior pequena, para aparecer abaixo do valor. |

#### Resultado esperado

```text
Total comprometido
R$ 800,00
↓ Sobra R$ 200,00
```

ou, em situação de falta:

```text
Total comprometido
R$ 1.200,00
↑ Falta R$ 200,00
```

A tag deve continuar compacta, alinhada à esquerda abaixo do valor e sem ocupar espaço lateral do título. Em telas pequenas, o card mantém sua altura natural e a distribuição fica vertical, evitando sobreposição.

#### Validação quando for implementado

1. Confirmar que sobra e falta continuam usando os mesmos ícones, textos e cores atuais.
2. Conferir que a tag aparece abaixo do número principal, nunca sobre o título.
3. Em empate entre receita e comprometido, confirmar que a tag continua ausente e que não fica espaço vazio adicional.
4. Verificar a visualização no layout de duas colunas para celular.

## Como implementar uma alteração pontual

1. Localize o elemento pelo `id` ou `data-*` em `index.html`.
2. Encontre no módulo o seletor, evento e a função que salva e renderiza o dado.
3. Para novo dado persistente, adicione o campo ao objeto salvo e trate registros antigos que não o possuem.
4. Se for necessário novo armazenamento, altere `db.js` de forma compatível antes de usar a store no módulo.
5. Atualize esta documentação quando mudar regras, stores ou contratos de importação.

Atalhos por tipo de alteração:

- Novo campo, botão, diálogo ou seção: `index.html` e o módulo correspondente.
- Aparência, layout ou responsividade: `assets/css/style.css`.
- Persistência, store, índice ou migração: `assets/js/db.js`.
- Tarefas, ciclos, filtros e histórico: `assets/js/app.js`.
- Cálculos e formulários financeiros: `assets/js/finance.js`.
- Instalação, nome ou ícone: `manifest.json`.
- Recursos offline: `service-worker.js`.

Para adicionar um pilar, atualize a definição de categorias em `app.js`, as opções da interface e os estilos. A validação de importação também depende dessas categorias. Para criar novo tipo financeiro, crie store e CRUD em `db.js`, depois integre leitura, formulário, cálculo e renderização em `finance.js`.

## PWA e cache offline

O `service-worker.js` guarda os arquivos principais em cache e usa a rede quando disponível. Ao mudar arquivos que precisam chegar a instalações existentes, atualize `APP_FILES` se necessário e altere `CACHE_NAME`. Sem uma nova chave de cache, a PWA pode continuar exibindo arquivos antigos.

## Validação manual

Não há testes automatizados. Antes de entregar uma mudança:

1. Abra o app por servidor local e confira o console do navegador.
2. Crie tarefa simples e recorrente; conclua, edite e exclua ocorrências.
3. Exporte um ciclo, importe-o e importe de novo para conferir duplicatas.
4. Feche um ciclo e confira o histórico e a criação do próximo.
5. Em Finanças, teste receita, gasto direto, cartão, assinatura e parcela no mês atual e seguinte.
6. Recarregue a página e confira a persistência no IndexedDB.
7. Para mudanças na PWA, faça recarga forçada ou remova o service worker e teste offline depois de uma abertura conectada.
