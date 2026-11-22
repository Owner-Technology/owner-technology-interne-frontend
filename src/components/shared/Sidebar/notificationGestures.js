// Ce que le serveur ne sait pas encore (audit du 23/11/2026) : les gestes de la cloche en attente (« Annuler » possible) ou
// partis mais pas encore enregistrés, appliqués à chaque réponse du serveur. Sans cela, une liste lue pendant ce temps
// (passage des 30 s, menu d'une nouvelle page) faisait revenir une notification retirée ou repasser en non lu une lue.
// Module pur : testé par notificationGestures.test.js.
//
// Un geste : { kind: "remove" | "read", ids: [id…] | "all", before?: date } ; « all » avec `before` ne couvre que les
// notifications reçues jusqu'à cette date (celles arrivées pendant le délai restent non lues).

// Date d'une notification en millisecondes ; une date sans fuseau est en UTC (même règle que notificationDate).
export function timeOf(value) {
  if (!value) return NaN;
  const text = String(value);
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`).getTime();
}

export function covers(gesture, n) {
  if (gesture.ids !== "all") return gesture.ids.includes(n.id);
  if (!gesture.before) return true;
  const t = timeOf(n.created_at);
  return !Number.isFinite(t) || t <= timeOf(gesture.before);
}

// La plus récente des notifications connues : la borne de « Tout marquer comme lu », prise dans les dates du serveur
// (pas l'horloge du poste, qui peut avancer ou retarder).
export function newestDate(items) {
  let best = null;
  for (const n of items) {
    const t = timeOf(n.created_at);
    if (Number.isFinite(t) && (best === null || t > timeOf(best))) best = n.created_at;
  }
  return best;
}

// Réponse du serveur → ce qu'il faut afficher, gestes appliqués dans l'ordre.
export function applyGestures(gestures, list, unreadCount, total) {
  let out = list;
  let unread = unreadCount;
  let count = total;
  for (const g of gestures) {
    const hit = out.filter((n) => covers(g, n));
    const hitUnread = hit.filter((n) => !n.read).length;
    if (g.kind === "remove") {
      out = out.filter((n) => !covers(g, n));
      unread -= hitUnread;
      count -= hit.length;
    } else if (g.ids === "all") {
      out = out.map((n) => (covers(g, n) ? { ...n, read: true } : n));
      // Les plus récentes arrivent en tête de liste : les non lues qui restent sont celles reçues après le geste.
      unread = out.filter((n) => !n.read).length;
    } else {
      out = out.map((n) => (covers(g, n) ? { ...n, read: true } : n));
      unread -= hitUnread;
    }
  }
  return { list: out, unreadCount: Math.max(0, unread), total: Math.max(0, count) };
}
