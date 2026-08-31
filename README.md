# Next7

App pessoal para acompanhar minha evolução durante ciclos de 7 dias.

## Objetivo

Planejar os próximos 7 dias, registrar tarefas, acompanhar o que foi concluído e guardar esse histórico para analisar minha evolução ao longo de 12 semanas.

O acompanhamento é dividido em quatro áreas:

- **Corpo:** saúde, exercícios, alimentação, sono e energia;
- **Carreira:** trabalho, estudos, projetos e desenvolvimento profissional;
- **Vida:** rotina, relações, finanças, lazer e organização pessoal;
- **Mente:** aprendizado, reflexão, bem-estar e clareza mental.

## Tecnologias

- HTML;
- CSS;
- JavaScript;
- IndexedDB;
- PWA *(planejado)*.

## Estrutura inicial

- Objetivo da semana;
- Próximos 7 dias;
- Categorias de tarefas;
- Registro de tarefas concluídas;
- Feedback semanal;
- Histórico local.

## Funcionalidades da primeira versão

- Criar tarefas e associá-las a uma das quatro categorias;
- Marcar tarefas como concluídas ou pendentes;
- Filtrar tarefas por status;
- Acompanhar o progresso geral e por categoria;
- Manter os dados salvos localmente com IndexedDB;
- Usar a interface tanto no computador quanto no celular.

## O que já funciona hoje

- Criação automática de um ciclo com início, término e 7 dias;
- Objetivo editável para o ciclo atual;
- Tarefas vinculadas ao ciclo, a uma data e a uma categoria;
- Progresso diário, geral e por categoria;
- Encerramento manual com feedback semanal;
- Resumo congelado com total, concluídas e percentual;
- Histórico local dos ciclos encerrados;
- Criação automática do próximo ciclo;
- Migração das tarefas criadas antes da implementação dos ciclos.

Uma explicação detalhada do fluxo e dos dados está em [`docs/LOGICA-DOS-CICLOS.md`](docs/LOGICA-DOS-CICLOS.md).

## Estrutura do projeto

```text
NEXT_7/
├── assets/
│   ├── css/
│   │   └── style.css
│   ├── images/
│   └── js/
│       ├── app.js
│       └── db.js
├── docs/
│   └── LOGICA-DOS-CICLOS.md
├── .gitignore
├── index.html
└── README.md
```

- `index.html`: estrutura e conteúdo da interface;
- `assets/css/style.css`: identidade visual e responsividade;
- `assets/js/app.js`: estado, interações e renderização;
- `assets/js/db.js`: comunicação com o IndexedDB.

## Como executar

Abra o projeto usando um servidor local. No VS Code, você pode utilizar a extensão **Live Server**. Outra opção é executar:

```bash
npx serve .
```

Depois, acesse o endereço exibido no terminal. Os dados ficam armazenados somente no navegador utilizado.

## Próximas etapas

- [x] Criar a estrutura inicial em HTML, CSS e JavaScript;
- [x] Implementar o armazenamento local de tarefas;
- [x] Organizar tarefas em Corpo, Carreira, Vida e Mente;
- [x] Definir o objetivo de cada ciclo;
- [x] Distribuir tarefas entre os próximos 7 dias;
- [x] Criar o fechamento e o feedback semanal;
- [x] Guardar e consultar o histórico local dos ciclos;
- [ ] Adicionar gráficos de evolução;
- [ ] Adicionar manifest e service worker;
- [ ] Disponibilizar a instalação como PWA no iPhone.

## Privacidade

Nesta etapa, nenhuma informação é enviada para servidores externos. Todos os registros permanecem no IndexedDB do navegador e podem ser removidos ao limpar os dados locais do site.

## Status

🚧 Em desenvolvimento.

Primeira versão focada em funcionar de forma simples no PC e depois como PWA no iPhone.
