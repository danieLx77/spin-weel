export const MAX_DRAW_RESULTS = 5000;
export const MAX_DRAW_PARTICIPANTS = 10000;
export function validateDrawSessions(raw = []) {
  if (!Array.isArray(raw) || raw.length > 20) throw Error("Use até 20 sessões de sorteio por roleta.");
  const text = (v, max) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  const date = (v) => typeof v === "string" && v.length <= 40 && Number.isFinite(Date.parse(v));
  return raw.map((session) => {
    if (!session || !text(session.name, 80) || !date(session.startedAt) ||
      (session.endedAt != null && !date(session.endedAt)) ||
      !Array.isArray(session.participants) || session.participants.length > 500 ||
      !Array.isArray(session.results) || session.results.length > MAX_DRAW_RESULTS)
      throw Error("Sessão de sorteio inválida.");
    const participants = session.participants.map((p) => {
      if (!p || !text(p.id, 200) || !text(p.label, 100) || !Number.isSafeInteger(p.weight) || p.weight < 1 || p.weight > 1000)
        throw Error("Participante inválido na sessão de sorteio.");
      return { id: p.id, label: p.label, weight: p.weight };
    });
    if (new Set(participants.map((p) => p.id)).size !== participants.length) throw Error("Participantes duplicados na sessão.");
    const ids = new Set(participants.map((p) => p.id));
    const results = session.results.map((r) => {
      if (!r || !ids.has(r.id) || !text(r.label, 100) || !date(r.date)) throw Error("Resultado inválido na sessão de sorteio.");
      return { id: r.id, label: r.label, date: new Date(r.date).toISOString() };
    });
    return { id: crypto.randomUUID(), name: session.name.trim(), startedAt: new Date(session.startedAt).toISOString(), endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null, participants, results };
  });
}
export function archiveBudget(wheels) {
  return wheels.reduce((sum, w) => {
    for (const session of w.drawSessions || []) {
      sum.results += session.results.length;
      sum.participants += session.participants.length;
    }
    return sum;
  }, { results: 0, participants: 0 });
}
