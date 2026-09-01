// FINANÇAS
// Dados mensais independentes dos ciclos de 7 dias.


const Finance = (() => {
  // ESTADO E ELEMENTOS
  const categories = ["🏠 Custos fixos", "🏍️ Moto", "🧴 Cuidado pessoal", "🍔 Comida & lazer", "Outros"];
  const paymentOptions = ["Pix", "Dinheiro", "Débito"];
  const state = { month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), tab: "entries", income: [], expenses: [], cards: [], subscriptions: [], installments: [], form: null, editing: null };
  const el = {
    view: document.querySelector("#financeView"), cycle: document.querySelector("#cycleView"), taskButton: document.querySelector("#openTaskForm"),
    month: document.querySelector("#financeMonthLabel"), summary: document.querySelector("#financeSummary"), content: document.querySelector("#financeContent"),
    dialog: document.querySelector("#financeDialog"), form: document.querySelector("#financeForm"), fields: document.querySelector("#financeFormFields"), title: document.querySelector("#financeFormTitle"), eyebrow: document.querySelector("#financeFormEyebrow"),
    navigation: document.querySelectorAll(".app-nav-button"), tabs: document.querySelector("#financeTabs"), tabButtons: document.querySelectorAll(".finance-tab"),
    previousMonth: document.querySelector("#previousFinanceMonth"), nextMonth: document.querySelector("#nextFinanceMonth"), openIncome: document.querySelector("#openIncomeForm"), openExpense: document.querySelector("#openExpenseForm"), closeForm: document.querySelector("#closeFinanceForm"), cancelForm: document.querySelector("#cancelFinanceForm"),
  };

  // DATAS E REGRAS MENSAIS

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

  function monthDate(month, day) {
    return dateKey(new Date(month.getFullYear(), month.getMonth(), Math.min(Number(day), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate())));
  }

  function currentInvoiceMonth(card) {
    return invoiceMonth(dateKey(), card);
  }

  function cardInvoiceForMonth(card) {
    return card.currentInvoiceMonth === selectedKey() ? Number(card.currentInvoice || 0) : 0;
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
    if (!card) return { ...item, card: null, invoice: selectedKey(), chargeDate: monthDate(state.month, item.chargeDay), projected: true };
    const previousMonth = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
    const chargeDate = [monthDate(previousMonth, item.chargeDay), monthDate(state.month, item.chargeDay)]
      .find((date) => date >= item.startDate && invoiceMonth(date, card) === selectedKey());
    if (!chargeDate) return null;
    const alreadyInCurrentInvoice = selectedKey() === currentInvoiceMonth(card)
      && chargeDate.slice(0, 7) === dateKey().slice(0, 7)
      && Number(chargeDate.slice(8, 10)) <= new Date().getDate();
    return { ...item, card, invoice: selectedKey(), chargeDate, projected: !alreadyInCurrentInvoice };
  }

  // DADOS E TOTAIS

  async function load() {
    const [income, expenses, cards, subscriptions, installments] = await Promise.all([
      NextDB.income.getAll(), NextDB.expenses.getAll(), NextDB.creditCards.getAll(), NextDB.subscriptions.getAll(), NextDB.installments.getAll(),
    ]);
    Object.assign(state, { income, expenses, cards, subscriptions, installments });
  }

  function totals() {
    // Um gasto direto é pago no mês; cartão, assinatura e parcela são compromisso.
    // Assim o saldo não desconta a mesma compra duas vezes.
    const income = state.income.reduce((total, item) => total + recurringIncomeForMonth(item), 0);
    const spent = sum(state.expenses.filter((item) => !item.cardId && item.date.slice(0, 7) === selectedKey()));
    const cardExpenses = state.expenses.filter((item) => item.cardId && invoiceMonth(item.date, state.cards.find((card) => card.id === Number(item.cardId))) === selectedKey());
    const installments = state.installments.map(installmentForMonth).filter(Boolean);
    const subscriptions = state.subscriptions.map(subscriptionForMonth).filter(Boolean);
    const cardInvoices = state.cards.map((card) => ({ card, current: cardInvoiceForMonth(card) }));
    const projectedSubscriptions = subscriptions.filter((item) => item.projected);
    const committed = sum(cardExpenses) + sum(installments) + sum(projectedSubscriptions) + cardInvoices.reduce((total, item) => total + item.current, 0);
    return { income, spent, committed, balance: income - spent - committed, cardExpenses, installments, subscriptions, projectedSubscriptions, cardInvoices };
  }

  // RENDERIZAÇÃO

  function renderSummary(data) {
    const cards = [["Receita do mês", data.income], ["Total comprometido", data.committed], ["Total gasto", data.spent], ["Saldo disponível", data.balance, "balance"]];
    el.summary.innerHTML = cards.map(([label, value, className = ""]) => `<article class="finance-card ${className}"><span>${label}</span><strong>${money(value)}</strong></article>`).join("");
  }

  function listItem(icon, title, detail, value, type = "", remove = "") {
    return `<article class="finance-item"><span class="finance-item-icon"><i class="fa-solid ${icon}"></i></span><div class="finance-item-copy"><strong>${escape(title)}</strong><small>${escape(detail)}</small></div><strong class="finance-item-value ${type}">${money(value)}</strong>${remove}</article>`;
  }
  const editButton = (type, id) => `<button class="delete-task finance-delete" type="button" data-finance-edit="${type}" data-id="${id}" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>`;
  const removeButton = (store, id) => `<button class="delete-task finance-delete" type="button" data-finance-delete="${store}" data-id="${id}" aria-label="Excluir"><i class="fa-solid fa-trash-can"></i></button>`;
  const actions = (type, store, id) => `<div class="finance-item-actions">${editButton(type, id)}${removeButton(store, id)}</div>`;

  function renderEntries(data = totals()) {
    const incomes = state.income.filter((item) => recurringIncomeForMonth(item));
    const expenses = state.expenses.filter((item) => !item.cardId && item.date.slice(0, 7) === selectedKey());
    const rows = [
      ...incomes.map((item) => listItem("fa-arrow-trend-up", item.description, `${item.source || "Renda"} · ${dateLabel(item.date)}${item.recurring ? " · recorrente" : ""}`, item.amount, "income", actions("income", "income", item.id))),
      ...expenses.map((item) => listItem("fa-arrow-trend-down", item.description, `${item.category} · ${item.paymentMethod} · ${dateLabel(item.date)}`, item.amount, "", actions("expense", "expenses", item.id))),
      ...data.cardExpenses.map((item) => { const card = state.cards.find((entry) => entry.id === Number(item.cardId)); return listItem("fa-credit-card", item.description, `${item.category} · fatura de ${card?.name || "cartão removido"}`, item.amount, "", actions("expense", "expenses", item.id)); }),
      ...data.installments.map((item) => listItem("fa-calendar-check", item.description, `Parcela ${item.current}/${item.totalInstallments} · ${item.paymentMethod}`, item.amount, "", actions("installment", "installments", item.id))),
      ...data.subscriptions.map((item) => listItem("fa-repeat", item.name, `Assinatura · ${item.card ? `${item.projected ? "prevista para" : "já na"} fatura de ${item.card.name}` : "pagamento direto"}`, item.amount, "", actions("subscription", "subscriptions", item.id))),
    ];
    el.content.innerHTML = rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><i class="fa-solid fa-wallet"></i><p>Nenhum lançamento neste mês.</p></div>`;
  }

  function renderCards(data = totals()) {
    const rows = state.cards.map((card) => {
      const current = data.cardInvoices.find((item) => item.card.id === card.id)?.current || 0;
      const projected = sum(data.projectedSubscriptions.filter((item) => Number(item.cardId) === card.id));
      return listItem("fa-credit-card", card.name, `Fecha dia ${card.closingDay} · vence dia ${card.dueDay} · atual ${money(current)} · previsto ${money(projected)} · projetada ${money(current + projected)}`, current + projected, "", actions("card", "creditCards", card.id));
    });
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="card" type="button">+ Adicionar cartão</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Cadastre um cartão para enviar compras à fatura certa.</p></div>`}`;
  }
  function renderSubscriptions() {
    const rows = state.subscriptions.map((item) => { const card = state.cards.find((entry) => entry.id === Number(item.cardId)); return listItem("fa-repeat", item.name, `${item.active ? "Ativa" : "Inativa"} · dia ${item.chargeDay}${card ? ` · ${card.name}` : ""}`, item.amount, "", actions("subscription", "subscriptions", item.id)); });
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="subscription" type="button">+ Adicionar assinatura</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Assinaturas ativas entram automaticamente no mês.</p></div>`}`;
  }
  function renderInstallments() {
    const rows = state.installments.map((item) => { const visible = installmentForMonth(item); return listItem("fa-calendar-check", item.description, `${visible ? `Parcela ${visible.current}/${item.totalInstallments}` : `A partir de ${dateLabel(item.dueDate)}`} · ${item.paymentMethod}`, item.amount, "", actions("installment", "installments", item.id)); });
    el.content.innerHTML = `<button class="finance-add-row" data-open-finance-form="installment" type="button">+ Adicionar compromisso</button>${rows.length ? `<div class="finance-list">${rows.join("")}</div>` : `<div class="finance-empty"><p>Registre parcelas, financiamentos e compromissos mensais.</p></div>`}`;
  }
  function renderReports() { el.content.innerHTML = `<div class="finance-empty"><i class="fa-solid fa-chart-line"></i><h3>Relatórios</h3><p>Os relatórios estarão disponíveis após seu primeiro mês de dados.</p></div>`; }

  function renderContent(data) { ({ entries: renderEntries, cards: renderCards, subscriptions: renderSubscriptions, installments: renderInstallments, reports: renderReports }[state.tab])(data); }
  function render() { const data = totals(); el.month.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(state.month); renderSummary(data); renderContent(data); }

  function paymentSelect(selected = "") {
    return `<option value="">Forma de pagamento</option>${paymentOptions.map((item) => `<option ${selected === item ? "selected" : ""}>${item}</option>`).join("")}${state.cards.map((card) => `<option value="card:${card.id}">Cartão · ${escape(card.name)}</option>`).join("")}`;
  }

  function field(label, control, full = false, helper = "") {
    return `<label class="finance-field ${full ? "full" : ""}"><span>${label}</span>${control}${helper ? `<small class="field-helper">${helper}</small>` : ""}</label>`;
  }

  function toggleField(name, title, description, checked = false) {
    return `<label class="repeat-option full"><input name="${name}" type="checkbox" ${checked ? "checked" : ""}><span><strong>${title}</strong><small>${description}</small></span></label>`;
  }

  // FORMULÁRIOS

  function openForm(type, item = null) {
    state.form = type;
    state.editing = item;
    const today = dateKey(state.month);
    const value = (name, fallback = "") => escape(item?.[name] ?? fallback);
    const selected = (name, option) => String(item?.[name] ?? "") === String(option) ? "selected" : "";
    const checked = (name, fallback = false) => item ? Boolean(item[name]) : fallback;
    const forms = {
      income: {
        title: item ? "Editar renda" : "Adicionar renda",
        fields: `<div class="finance-form-grid">${field("Tipo de renda", `<select name="source" required><option value="Salário mensal" ${selected("source", "Salário mensal")}>Salário mensal</option><option value="Outra fonte de renda" ${selected("source", "Outra fonte de renda")}>Outra fonte de renda</option></select>`, true)}${field("Descrição", `<input name="description" required maxlength="100" value="${value("description")}" placeholder="Ex.: Salário ou trabalho extra">`, true)}${field("Valor", `<input name="amount" required type="number" min="0.01" step="0.01" inputmode="decimal" value="${value("amount")}" placeholder="0,00">`)}${field("Data", `<input name="date" required type="date" value="${value("date", today)}">`)}${toggleField("recurring", "Renda recorrente", "Será considerada nos próximos meses.", checked("recurring"))}</div>`,
      },
      expense: {
        title: item ? "Editar gasto" : "Adicionar gasto",
        fields: `<div class="finance-form-grid">${field("Descrição", `<input name="description" required maxlength="100" value="${value("description")}" placeholder="Ex.: Gasolina ou almoço">`, true)}${field("Valor", `<input name="amount" required type="number" min="0.01" step="0.01" inputmode="decimal" value="${value("amount")}" placeholder="0,00">`)}${field("Data", `<input name="date" required type="date" value="${value("date", today)}">`)}${field("Categoria", `<select name="category" required>${categories.map((entry) => `<option ${selected("category", entry)}>${entry}</option>`).join("")}</select>`, true)}${field("Forma de pagamento", `<select name="paymentMethod" required>${paymentSelect(item?.cardId ? `card:${item.cardId}` : item?.paymentMethod)}</select>`, true)}</div>`,
      },
      card: { title: item ? "Editar cartão" : "Adicionar cartão", fields: `<div class="finance-form-grid">${field("Nome do cartão", `<input name="name" required maxlength="60" value="${value("name")}" placeholder="Ex.: Nubank ou Itaú">`, true)}${field("Dia de fechamento", `<input name="closingDay" required type="number" min="1" max="31" inputmode="numeric" value="${value("closingDay")}" placeholder="Ex.: 15">`)}${field("Dia de vencimento", `<input name="dueDay" required type="number" min="1" max="31" inputmode="numeric" value="${value("dueDay")}" placeholder="Ex.: 22">`)}${field("Fatura atual", `<input name="currentInvoice" required type="number" min="0" step="0.01" inputmode="decimal" value="${value("currentInvoice", 0)}" placeholder="0,00">`, true, "Valor já acumulado na fatura atual. Cobranças futuras serão mostradas separadamente.")}</div>` },
      subscription: { title: item ? "Editar assinatura" : "Adicionar assinatura", fields: `<div class="finance-form-grid">${field("Nome", `<input name="name" required maxlength="100" value="${value("name")}" placeholder="Ex.: Spotify ou Netflix">`, true)}${field("Valor mensal", `<input name="amount" required type="number" min="0.01" step="0.01" value="${value("amount")}" placeholder="0,00">`)}${field("Dia da cobrança", `<input name="chargeDay" required type="number" min="1" max="31" inputmode="numeric" value="${value("chargeDay")}" placeholder="Ex.: 15">`)}${field("Cartão", `<select name="cardId"><option value="">Pagamento direto</option>${state.cards.map((card) => `<option value="${card.id}" ${selected("cardId", card.id)}>${escape(card.name)}</option>`).join("")}</select>`, true)}${field("Início", `<input name="startDate" required type="date" value="${value("startDate", today)}">`)}${toggleField("active", "Assinatura ativa", "Entra automaticamente nos próximos meses.", checked("active", true))}</div>` },
      installment: { title: item ? "Editar compromisso" : "Adicionar compromisso", fields: `<div class="finance-form-grid">${field("Descrição", `<input name="description" required maxlength="100" value="${value("description")}" placeholder="Ex.: iPhone ou eletrônicos">`, true)}${field("Valor da parcela", `<input name="amount" required type="number" min="0.01" step="0.01" value="${value("amount")}" placeholder="0,00">`)}${field("Total de parcelas", `<input name="totalInstallments" required type="number" min="1" value="${value("totalInstallments")}" placeholder="Ex.: 12">`)}${field("Parcela atual", `<input name="currentInstallment" required type="number" min="1" value="${value("currentInstallment")}" placeholder="Ex.: 1">`, true)}${field("Vencimento", `<input name="dueDate" required type="date" value="${value("dueDate", today)}">`)}${field("Forma de pagamento", `<select name="paymentMethod" required>${paymentSelect(item?.paymentMethod)}</select>`, true)}</div>` },
    };
    const form = forms[type]; el.title.textContent = form.title; el.eyebrow.textContent = "Finanças"; el.fields.innerHTML = form.fields; el.dialog.showModal();
  }

  async function saveForm(event) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(el.form)); const type = state.form;
    if (type === "expense" && data.paymentMethod.startsWith("card:")) { data.cardId = Number(data.paymentMethod.split(":")[1]); data.paymentMethod = "Cartão"; }
    if (type === "expense" && data.paymentMethod !== "Cartão") delete data.cardId;
    if (type === "income") data.recurring = data.recurring === "on";
    if (type === "subscription") data.active = data.active === "on";
    const store = { income: "income", expense: "expenses", card: "creditCards", subscription: "subscriptions", installment: "installments" }[type];
    data.amount = data.amount ? Number(data.amount) : 0;
    if (!state.editing) data.createdAt = new Date().toISOString();
    if (type === "card") {
      data.currentInvoice = Number(data.currentInvoice || 0);
      data.currentInvoiceMonth = invoiceMonth(dateKey(), data);
    }
    if (type === "subscription" && data.cardId) data.cardId = Number(data.cardId);
    const record = state.editing ? { ...state.editing, ...data, id: state.editing.id } : data;
    if (state.editing) await NextDB[store].update(record); else await NextDB[store].add(record);
    state.editing = null; el.form.reset(); el.dialog.close(); await load(); render();
  }

  async function remove(store, id) { if (!confirm("Excluir este registro?")) return; await NextDB[store].remove(Number(id)); await load(); render(); }
  function switchView(view) { const finance = view === "finance"; el.view.hidden = !finance; el.cycle.hidden = finance; el.taskButton.hidden = finance; el.navigation.forEach((button) => button.classList.toggle("active", button.dataset.view === view)); if (finance) render(); }

  // EVENTOS

  function bind() {
    el.navigation.forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
    el.previousMonth.addEventListener("click", () => { state.month.setMonth(state.month.getMonth() - 1); render(); });
    el.nextMonth.addEventListener("click", () => { state.month.setMonth(state.month.getMonth() + 1); render(); });
    el.openIncome.addEventListener("click", () => openForm("income")); el.openExpense.addEventListener("click", () => openForm("expense"));
    el.closeForm.addEventListener("click", () => el.dialog.close()); el.cancelForm.addEventListener("click", () => el.dialog.close()); el.form.addEventListener("submit", saveForm);
    el.tabs.addEventListener("click", (event) => { const button = event.target.closest("[data-finance-tab]"); if (!button) return; state.tab = button.dataset.financeTab; el.tabButtons.forEach((tab) => tab.classList.toggle("active", tab === button)); renderContent(); });
    el.content.addEventListener("click", (event) => {
      const add = event.target.closest("[data-open-finance-form]"); if (add) openForm(add.dataset.openFinanceForm);
      const edit = event.target.closest("[data-finance-edit]");
      if (edit) {
        const collection = { income: state.income, expense: state.expenses, card: state.cards, subscription: state.subscriptions, installment: state.installments }[edit.dataset.financeEdit];
        openForm(edit.dataset.financeEdit, collection.find((item) => item.id === Number(edit.dataset.id)));
      }
      const removeButton = event.target.closest("[data-finance-delete]"); if (removeButton) remove(removeButton.dataset.financeDelete, removeButton.dataset.id);
    });
  }
  async function init() { try { await load(); bind(); } catch (error) { console.error("Não foi possível carregar as finanças.", error); } }
  init();
  return { render };
})();
