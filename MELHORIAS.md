# Melhorias do Next7

## Entregue nesta versão

- [x] Seleção simplificada dos sete dias e opção “Todos os dias”.
- [x] Edição e exclusão recorrente com escopo: esta, próximas ou série inteira.
- [x] Horário opcional de lembrete em cada tarefa.
- [x] Notificação local pelo service worker enquanto a PWA estiver ativa.
- [x] Progresso geral, tarefas concluídas e dias restantes no ciclo.
- [x] Identificação de tarefas atrasadas.
- [x] Busca por título ou descrição.
- [x] Modelos rápidos de treino, leitura e revisão semanal.
- [x] Revisão guiada ao encerrar o ciclo.
- [x] Próximo ciclo iniciado depois do fim do ciclo anterior.
- [x] Aviso e remoção das tarefas de exemplo.
- [x] Dados e backup identificados nas configurações.
- [x] Descrição e lembrete preservados na importação e exportação.
- [x] Alvos de toque maiores nas ações das tarefas.
- [x] Regras centrais extraídas e cobertas por testes automatizados.
- [x] `id` definido no manifesto da PWA e clique em notificações tratado.

## Próxima etapa: Web Push com o app fechado

- [ ] Criar backend autenticado para armazenar as inscrições de Web Push.
- [ ] Gerar e proteger as chaves VAPID no servidor.
- [ ] Enviar a inscrição do aparelho somente após consentimento explícito.
- [ ] Agendar cada ocorrência considerando o fuso horário do usuário.
- [ ] Processar envios, novas tentativas e inscrições expiradas.
- [ ] Oferecer cancelamento da inscrição e exclusão dos dados do aparelho.
- [ ] Publicar o app em HTTPS e testar em Android e iPhone reais.

## Como funcionam os lembretes atuais

O horário já fica salvo em cada ocorrência e o app verifica os lembretes enquanto está em execução. Isso permite validar toda a experiência sem transmitir dados para terceiros.

Uma PWA não pode manter um temporizador JavaScript confiável quando o sistema encerra ou suspende o app. Para a notificação chegar com o Next7 fechado, um servidor precisa disparar uma mensagem Web Push no horário definido. No iPhone, o site deve estar instalado na Tela de Início e a permissão precisa ser solicitada depois de um toque do usuário.

## Comandos de verificação

```powershell
node --test tests/logic.test.js
node --check assets/js/app.js
node --check service-worker.js
```
