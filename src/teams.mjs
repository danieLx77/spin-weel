import { reorderOptions } from "./list-order.mjs";
import { csvCell } from "./results.mjs";

export function generateTeams(options, mode, amount, fill) {
  const participants = options.filter((option) => !option.disabled);
  if (participants.length < 2)
    throw new RangeError("Ative pelo menos duas opções para gerar equipes.");
  if (mode !== "teams" && mode !== "size")
    throw new RangeError("Escolha como dividir os participantes.");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > participants.length)
    throw new RangeError(`Escolha um número inteiro entre 1 e ${participants.length}.`);
  const count = mode === "teams" ? amount : Math.ceil(participants.length / amount);
  const teams = Array.from({ length: count }, () => []);
  reorderOptions(participants, "shuffle", fill).forEach((participant, index) => {
    teams[index % count].push({ id: participant.id, label: participant.label });
  });
  return teams;
}

export function teamsText(name, teams) {
  return `${name}\n\n${teams.map((team, index) => `Equipe ${index + 1}\n${team.map((p) => p.label).join("\n")}`).join("\n\n")}`;
}

export function teamsCSV(name, teams) {
  const rows = [["Roleta", "Equipe", "Participante"], ...teams.flatMap((team, index) =>
    team.map((participant) => [name, `Equipe ${index + 1}`, participant.label]))];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

// Reconstruct the shuffled draw order, distributing one person per team in turn.
export function teamAssignments(teams) {
  const assignments = [];
  const rounds = Math.max(0, ...teams.map((team) => team.length));
  for (let row = 0; row < rounds; row++) {
    teams.forEach((team, teamIndex) => {
      if (team[row]) assignments.push({ participant: team[row], teamIndex });
    });
  }
  return assignments;
}

export async function animateTeams({ options, teams, spin, onAssignment, shouldStop }) {
  let pool = options.filter((option) => !option.disabled).map((option) => ({ ...option, weight: 1 }));
  const completed = [];
  for (const assignment of teamAssignments(teams)) {
    if (shouldStop()) break;
    const index = pool.findIndex((option) => option.id === assignment.participant.id);
    if (index < 0) throw new Error("Participante não encontrado. Gere as equipes novamente.");
    if (!(await spin([...pool], index))) break;
    completed.push(assignment);
    onAssignment(assignment);
    pool = pool.filter((option) => option.id !== assignment.participant.id);
  }
  return completed;
}
