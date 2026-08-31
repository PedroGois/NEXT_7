const NextLogic = (() => {
  function calculateProgress(tasks) {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    return { total, completed, percentage: total ? Math.round((completed / total) * 100) : 0 };
  }

  function selectSeriesTasks(tasks, target, scope) {
    if (!target.seriesId || scope === "one") return [target];
    return tasks.filter((task) => task.seriesId === target.seriesId
      && (scope === "all" || task.scheduledDate >= target.scheduledDate));
  }

  function isValidReminderTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
  }

  return { calculateProgress, selectSeriesTasks, isValidReminderTime };
})();

if (typeof module !== "undefined") module.exports = NextLogic;
