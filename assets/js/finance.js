// =============================================================
// FINANÇAS — módulo mensal independente dos ciclos de 7 dias.
// =============================================================

const Finance = (() => {
  const categories = ["🏠 Custos fixos", "🏍️ Moto", "🧴 Cuidado pessoal", "🍔 Comida & lazer", "Outros"];
  const paymentOptions = ["Pix", "Dinheiro", "Débito"];
  const state = { month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), tab: "entries", income: [], expenses: [], cards: [], subscriptions: [], installments: [], form: null };
  const el = {
    view: document.querySelector("#financeView"), cycle: document.querySelector("#cycleView"), taskButton: document.querySelector("#openTaskForm"),
    month: document.querySelector("#financeMonthLabel"), summary: document.querySelector("#financeSummary"), content: document.querySelector("#financeContent"),
    dialog: document.querySelector("#financeDialog"), form: document.querySelector("#financeForm"), fields: document.querySelector("#financeFormFields"), title: document.querySelector("#financeFormTitle"), eyebrow: document.querySelector("#financeFormEyebrow"),
  };

  const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const selectedKey = () => monthKey(state.month);
  const money = (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dateLabel = (date) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
  const sum = (items) => items.reduce((total, item) => total + Number(item.amount || item.value || 0), 0);
  const escape = (text) => String(text || "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

  function invoiceMonth(date, card) {
    if (!card) return date.slice(0, 7);
    const [year, month, day] = date.split("-").map(Number);
    return monthKey(new Date(year, month - 1 + (day > Number(card.closingDay) ? 1 : 0), 1));
  }

  function recurringIncomeForMonth(item) {
    if (!item.recurring) return item.date.slice(0, 7) === selectedKey() ? Number(item.amount) : 0;
    return item.date.slice(0, 7) <= selectedKey() ? Number(item.amount) : 0;
  }

  function installmentForMonth(item) {
    const start = item.dueDate.slice(0, 7);
    const elapsed = (state.month.getFullYear() - Number(start.slice(0, 4))) * 12 + (state.month.getMonth() - (Number(start.slice(5, 7)) - 1));
    const current = Number(item.currentInstallment) + elapsed;
    return elapsed >= 0 && current <= Number(item.totalInstallments) ? { ...item, current } : null;
  }

  function subscriptionForMonth(item) {
    if (!item.active || item.startDate.slice(0, 7) > selectedKey()) return null;
    const card = state.cards.find((entry) => entry.id === Number(item.cardId));
    return { ...item, card, invoice: card ? invoiceMonth(`${selectedKey()}-${String(Math.min(Number(item.chargeDay), 28)).padStart(2, "0")}`, card) : selectedKey() };
  }

  async function load() {
    const [income, expenses, cards, subscriptions, installments] = await Promise.all([
      NextDB.income.getAll(), NextDB.expenses.getAll(), NextDB.creditCards.getAll(), NextDB.subscriptions.getAll(), NextDB.installments.getAll(),
    ]);
    Object.assign(state, { income, expenses, cards, subscriptions, installments });
  }

  function totals() {
    const income = state.income.reduce((total, item) => total + recurringIncomeForMonth(item), 0);
    const spent = sum(state.expenses.filter((item) => !item.cardId && item.date.slice(0, 7) === selectedKey()));
    const cardExpenses = state.expenses.filter((item) => item.cardId && invoiceMonth(item.date, state.cards.find((card) => card.id === Number(item.cardId))) === selectedKey());
    const installments = state.installments.map(installmentForMonth).filter(Boolean);
    const subscriptions = state.subscriptions.map(subscriptionForMonth).filter(Boolean);
    const committed = sum(cardExpenses) + sum(installments) + sum(subscriptions);
    return { income, spent, committed, balance: income - spent - committed, cardExpenses, installments, subscriptions };
  }

  function renderSummary() {
    const data = totals();
    const cards = [["Receita do mês", data.income], ["Total comprometido", data.committed], ["Total gasto", data.spent], ["Saldo disponível", data.balance, "balance"]];
    el.summary.innerHTML = cards.map(([label, value, className = ""]) => `<article class="finance-card ${className}"><span>${label}</span><strong>${money(value)}</strong></article>`).join("");
  }

  function listItem(icon, title, detail, value, type = "", remove = "") {
    return `<article class="finance-item"><span class="finance-item-icon"><i class="fa-solid ${icon}"></i></span><div class="finance-item-copy"><strong>${escape(title)}</strong><small>${escape(detail)}</small></div><strong class="finance-item-value ${type}">${money(value)}</strong>${remove}</article>`;
  }
  const removeButton = (store, id) => `<button class="delete-task finance-delete" type="button" data-finance-delete="${store}" data-id="${id}" aria-label="Excluir"><i class="fa-solid fa-trash-can"></i></button>`;

  function renderEntries() {
    const data = totals();
    const incomes = state.income.filter((item) => recurringIncomeForMonth(item));
    const expenses = state.expenses.filter((item) => !item.cardId && item.date.slice(0, 7) === selectedKey());
    const rows = [
      ...incomes.map((item) => listItem("fa-arrow-trend-up", item.description, `${item.source || "Renda"} · ${dateLabel(item.date)}${item.recurring ? " · recorrente" : ""}`, item.amount, "income", removeButton("income", item.id))),
      ...expenses.map((item) => listItem("fa-arrow-trend-down", item.description, `${item.category} · ${item.paymentMethod} · ${dateLabel(item.date)}`, item.amount, "", removeButton("expenses", item.id))),
      ...data.cardExpenses.map((item) => { const card = state.cards.find((entry) => entry.id === Number(item.cardId)); return listItem("fa-credit-card", item.description, `${item.category} · fatura de ${card?.name || "cartão removido"}`, item.amount, "", removeButton("expenses", item.id)); }),
      ...data.installments.map((item) => listItem("fa-calendar-check", item.description, `Parcela ${item.current}/${item.totalInstallments} · ${item.paymentMethod}`, item.amount, "")),
      ...data.subscriptions.map((item) => listItem("fa-repeat", item.name, `Assinatura · ${item.card ? `fatura de ${item.card.name}` : "pagamento direto"}`, item.amount, "")),
    ];
    el.content.innerHTML = rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><i class="fa-solid fa-wallet"></i><p>Nenhum lançamento neste mês.</p></div>`;
  }

  function renderCards() {
    const rows = state.cards.map((card) => listItem("fa-credit-card", card.name, `Fecha dia ${card.closingDay} · vence dia ${card.dueDay}`, 0, "", removeButton("creditCards", card.id)));
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="card" type="button">+ Adicionar cartão</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Cadastre um cartão para enviar compras à fatura certa.</p></div>`}`;
  }
  function renderSubscriptions() {
    const rows = state.subscriptions.map((item) => { const card = state.cards.find((entry) => entry.id === Number(item.cardId)); return listItem("fa-repeat", item.name, `${item.active ? "Ativa" : "Inativa"} · dia ${item.chargeDay}${card ? ` · ${card.name}` : ""}`, item.amount, "", removeButton("subscriptions", item.id)); });
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="subscription" type="button">+ Adicionar assinatura</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Assinaturas ativas entram automaticamente no mês.</p></div>`}`;
  }
  function renderInstallments() {
    const rows = state.installments.map((item) => { const visible = installmentForMonth(item); return listItem("fa-calendar-check", item.description, `${visible ? `Parcela ${visible.current}/${item.totalInstallments}` : `A partir de ${dateLabel(item.dueDate)}`} · ${item.paymentMethod}`, item.amount, "", removeButton("installments", item.id)); });
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="installment" type="button">+ Adicionar compromisso</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Registre parcelas, financiamentos e compromissos mensais.</p></div>`}`;
  }
  function renderReports() { el.content.innerHTML = `<div class="finance-empty"><i class="fa-solid fa-chart-line"></i><h3>Relatórios</h3><p>Os relatórios estarão disponíveis após seu primeiro mês de dados.</p></div>`; }

  function renderContent() { ({ entries: renderEntries, cards: renderCards, subscriptions: renderSubscriptions, installments: renderInstallments, reports: renderReports }[state.tab])(); }
  function render() { el.month.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(state.month); renderSummary(); renderContent(); }

  function paymentSelect(selected = "") { return `<option value="">Forma de pagamento</option>${paymentOptions.map((item) => `<option ${selected === item ? "selected" : ""}>${item}</option>`).join("")}${state.cards.map((card) => `<option value="card:${card.id}">Cartão · ${escape(card.name)}</option>`).join("")}`; }
  function field(label, input, full = false) { return `<label class="${full ? "full" : ""}">${label}${input}</label>`; }

  function openForm(type) {
    state.form = type;
    const today = dateKey(state.month);
    const forms = {
      income: { title: "Adicionar renda", fields: `<div class="finance-form-grid">${field("Fonte", `<select name="source"><option>Salário mensal</option><option>Outra fonte de renda</option></select>`)}${field("Data", `<input name="date" required type="date" value="${today}">`)}${field("Descrição", `<input name="description" required maxlength="100" placeholder="Ex.: Empresa ou trabalho extra">`, true)}${field("Valor", `<input name="amount" required type="number" min="0.01" step="0.01" inputmode="decimal">`, true)}${field("", `<label class="repeat-option"><input name="recurring" type="checkbox"><span><strong>Renda recorrente</strong><small>Será considerada nos próximos meses.</small></span></label>`, true)}</div>` },
      expense: { title: "Adicionar gasto", fields: `<div class="finance-form-grid">${field("Descrição", `<input name="description" required maxlength="100" placeholder="Ex.: Gasolina">`, true)}${field("Valor", `<input name="amount" required type="number" min="0.01" step="0.01" inputmode="decimal">`)}${field("Data", `<input name="date" required type="date" value="${today}">`)}${field("Categoria", `<select name="category" required>${categories.map((item) => `<option>${item}</option>`).join("")}</select>`)}${field("Forma de pagamento", `<select name="paymentMethod" required>${paymentSelect()}</select>`)}</div>` },
      card: { title: "Adicionar cartão", fields: `<div class="finance-form-grid">${field("Nome do cartão", `<input name="name" required maxlength="60" placeholder="Ex.: Nubank" >`, true)}${field("Dia de fechamento", `<input name="closingDay" required type="number" min="1" max="31" inputmode="numeric">`)}${field("Dia de vencimento", `<input name="dueDay" required type="number" min="1" max="31" inputmode="numeric">`)}</div>` },
      subscription: { title: "Adicionar assinatura", fields: `<div class="finance-form-grid">${field("Nome", `<input name="name" required maxlength="100" placeholder="Ex.: Spotify">`, true)}${field("Valor", `<input name="amount" required type="number" min="0.01" step="0.01">`)}${field("Cartão", `<select name="cardId"><option value="">Pagamento direto</option>${state.cards.map((card) => `<option value="${card.id}">${escape(card.name)}</option>`).join("")}</select>`)}${field("Dia da cobrança", `<input name="chargeDay" required type="number" min="1" max="31">`)}${field("Início", `<input name="startDate" required type="date" value="${today}">`)}${field("", `<label class="repeat-option"><input name="active" type="checkbox" checked><span><strong>Assinatura ativa</strong><small>Entra automaticamente nos meses seguintes.</small></span></label>`, true)}</div>` },
      installment: { title: "Adicionar compromisso", fields: `<div class="finance-form-grid">${field("Descrição", `<input name="description" required maxlength="100" placeholder="Ex.: iPhone">`, true)}${field("Valor da parcela", `<input name="amount" required type="number" min="0.01" step="0.01">`)}${field("Total de parcelas", `<input name="totalInstallments" required type="number" min="1">`)}${field("Parcela atual", `<input name="currentInstallment" required type="number" min="1">`)}${field("Vencimento", `<input name="dueDate" required type="date" value="${today}">`)}${field("Forma de pagamento", `<select name="paymentMethod" required>${paymentSelect()}</select>`, true)}</div>` },
    };
    const form = forms[type]; el.title.textContent = form.title; el.eyebrow.textContent = "Finanças"; el.fields.innerHTML = form.fields; el.dialog.showModal();
  }

  async function saveForm(event) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(el.form)); const type = state.form;
    if (type === "expense" && data.paymentMethod.startsWith("card:")) { data.cardId = Number(data.paymentMethod.split(":")[1]); data.paymentMethod = "Cartão"; }
    if (type === "income") data.recurring = data.recurring === "on";
    if (type === "subscription") data.active = data.active === "on";
    const store = { income: "income", expense: "expenses", card: "creditCards", subscription: "subscriptions", installment: "installments" }[type];
    data.amount = data.amount ? Number(data.amount) : 0; data.createdAt = new Date().toISOString();
    await NextDB[store].add(data); el.form.reset(); el.dialog.close(); await load(); render();
  }

  async function remove(store, id) { if (!confirm("Excluir este registro?")) return; await NextDB[store].remove(Number(id)); await load(); render(); }
  function switchView(view) { const finance = view === "finance"; el.view.hidden = !finance; el.cycle.hidden = finance; el.taskButton.hidden = finance; document.querySelectorAll(".app-nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view)); if (finance) render(); }

  function bind() {
    document.querySelectorAll(".app-nav-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    document.querySelector("#previousFinanceMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() - 1); render(); });
    document.querySelector("#nextFinanceMonth").addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + 1); render(); });
    document.querySelector("#openIncomeForm").addEventListener("click", () => openForm("income")); document.querySelector("#openExpenseForm").addEventListener("click", () => openForm("expense"));
    document.querySelector("#closeFinanceForm").addEventListener("click", () => el.dialog.close()); document.querySelector("#cancelFinanceForm").addEventListener("click", () => el.dialog.close()); el.form.addEventListener("submit", saveForm);
    document.querySelector("#financeTabs").addEventListener("click", (event) => { const button = event.target.closest("[data-finance-tab]"); if (!button) return; state.tab = button.dataset.financeTab; document.querySelectorAll(".finance-tab").forEach((tab) => tab.classList.toggle("active", tab === button)); renderContent(); });
    el.content.addEventListener("click", (event) => { const add = event.target.closest("[data-open-finance-form]"); if (add) openForm(add.dataset.openFinanceForm); const removeButton = event.target.closest("[data-finance-delete]"); if (removeButton) remove(removeButton.dataset.financeDelete, removeButton.dataset.id); });
  }
  async function init() { try { await load(); bind(); } catch (error) { console.error("Não foi possível carregar as finanças.", error); } }
  init();
  return { render };
})();
