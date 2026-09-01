# Revisão técnica — Next7

## Estrutura

- `index.html`: estrutura da interface e diálogos.
- `assets/css/style.css`: estilos e responsividade.
- `assets/js/db.js`: schema e acesso ao IndexedDB.
- `assets/js/app.js`: ciclos de 7 dias e tarefas.
- `assets/js/finance.js`: módulo mensal de Finanças.

## Dados dos ciclos

Cada ciclo guarda número, período, objetivo, status, criação, encerramento, feedback e um resumo congelado com total, concluídas e percentual.

Ao encerrar, `recurrenceSummary` registra cada série recorrente com `seriesId`, `taskDefinitionId`, título, quantidade de ocorrências e quantidade concluída. Esses números não são recalculados por ciclos futuros.

## Tarefas e recorrência

Uma ocorrência possui `id` numérico. A tarefa conceitual possui `taskDefinitionId`, usado para padronizar nomes entre ocorrências e ciclos. Tarefas recorrentes também possuem `seriesId`, compartilhado apenas pelas ocorrências criadas dentro do mesmo ciclo.

Ao editar o nome de uma tarefa, o app atualiza todas as ocorrências com o mesmo `taskDefinitionId`. Data, categoria, descrição e conclusão continuam específicos de cada ocorrência.

## IndexedDB

O banco `next-personal-growth` está na versão 5. A migração cria o índice `taskDefinitionId` sem apagar stores ou registros existentes. Na primeira abertura, tarefas antigas recebem esse identificador; séries antigas mantêm um ID compartilhado.

## Compatibilidade

O app usa datas no formato `YYYY-MM-DD`, IndexedDB, Service Worker e `viewport-fit=cover`. O cache offline atual é `next7-v9`.
