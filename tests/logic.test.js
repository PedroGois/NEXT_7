const test = require("node:test");
const assert = require("node:assert/strict");
const NextLogic = require("../assets/js/logic.js");

test("calcula o progresso do ciclo", () => {
  assert.deepEqual(NextLogic.calculateProgress([
    { completed: true }, { completed: false }, { completed: true },
  ]), { total: 3, completed: 2, percentage: 67 });
});

test("seleciona esta e as próximas ocorrências", () => {
  const tasks = [
    { id: 1, seriesId: "a", scheduledDate: "2026-08-31" },
    { id: 2, seriesId: "a", scheduledDate: "2026-09-02" },
    { id: 3, seriesId: "a", scheduledDate: "2026-09-04" },
    { id: 4, seriesId: "b", scheduledDate: "2026-09-04" },
  ];
  assert.deepEqual(NextLogic.selectSeriesTasks(tasks, tasks[1], "future").map((task) => task.id), [2, 3]);
});

test("valida horários de lembrete", () => {
  assert.equal(NextLogic.isValidReminderTime("09:30"), true);
  assert.equal(NextLogic.isValidReminderTime("25:00"), false);
});
