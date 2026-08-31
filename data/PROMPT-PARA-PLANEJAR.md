# Prompt para planejar uma semana com IA

Copie o texto abaixo e complete o contexto. A resposta poderá ser salva como `.json` e importada no Next7.

```text
Quero planejar meu próximo ciclo de 7 dias no Next7.

Meu contexto desta semana:
- Objetivo principal:
- Compromissos com dia marcado:
- Hábitos que quero repetir diariamente:
- Prioridades de Corpo:
- Prioridades de Carreira:
- Prioridades de Vida:
- Prioridades de Mente:
- Limites de tempo ou energia:

Organize um plano realista, sem sobrecarregar nenhum dia. Use somente as categorias corpo, carreira, vida e mente.

Devolva apenas um JSON válido neste formato, sem bloco Markdown e sem explicações fora do JSON:
{
  "version": 1,
  "objective": "Objetivo curto do ciclo",
  "context": {
    "duration": "7 dias",
    "notes": "Resumo breve do raciocínio usado para equilibrar a semana"
  },
  "tasks": [
    {
      "title": "Descrição clara da tarefa",
      "category": "corpo",
      "day": 1,
      "repeatDaily": false
    }
  ]
}

Regras:
- day deve ser um número inteiro de 1 a 7;
- repeatDaily deve ser true apenas para tarefas que se repetem desde o dia escolhido até o Dia 7;
- cada tarefa deve ser pequena, concreta e possível de concluir;
- distribua as quatro áreas de forma realista, não necessariamente igual;
- não invente compromissos que eu não mencionei.
```
