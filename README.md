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
│       └── db.js
├── index.html
├── manifest.json
├── service-worker.js
└── README.md
```

`assets/` é mantida apenas para separar estilo, lógica, banco local e ícone da aplicação.

## Privacidade

Os dados ficam somente no IndexedDB do navegador. Nenhuma tarefa, objetivo ou feedback é enviado a um servidor.
