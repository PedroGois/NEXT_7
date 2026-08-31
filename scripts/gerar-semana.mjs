// Gera um JSON compatível com o botão "Importar semana" do Next7.
// Uso: node scripts/gerar-semana.mjs

import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const terminal = createInterface({ input, output });
const categories = ["corpo", "carreira", "vida", "mente"];
const tasks = [];

console.log("\nNext7 — Gerador de planejamento semanal\n");
console.log("Categorias: corpo, carreira, vida e mente.");
console.log("Depois de cada tarefa, deixe o próximo título vazio para terminar.\n");

const objective = (await terminal.question("Objetivo principal da semana: ")).trim();

while (true) {
  const title = (await terminal.question("\nTítulo da tarefa: ")).trim();
  if (!title) break;

  let category = (await terminal.question("Categoria: ")).trim().toLowerCase();
  while (!categories.includes(category)) {
    category = (await terminal.question("Use corpo, carreira, vida ou mente: ")).trim().toLowerCase();
  }

  let day = Number(await terminal.question("Dia inicial (1 a 7): "));
  while (!Number.isInteger(day) || day < 1 || day > 7) {
    day = Number(await terminal.question("Digite um número entre 1 e 7: "));
  }

  const repeatAnswer = (await terminal.question("Repetir diariamente até o fim do ciclo? (s/n): ")).trim().toLowerCase();
  tasks.push({ title, category, day, repeatDaily: repeatAnswer === "s" });
}

const plan = {
  version: 1,
  objective,
  context: {
    duration: "7 dias",
    categories: {
      corpo: "Saúde, sono, alimentação, exercício e energia",
      carreira: "Trabalho, estudo, projetos e desenvolvimento profissional",
      vida: "Rotina, relações, finanças, lazer e organização pessoal",
      mente: "Aprendizado, reflexão, bem-estar e clareza mental",
    },
  },
  tasks,
};

const outputPath = process.argv[2] || "semana-next7.json";
await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
terminal.close();

console.log(`\nArquivo criado: ${outputPath}`);
console.log("Agora use o botão 'Importar semana' dentro do Next7.\n");
