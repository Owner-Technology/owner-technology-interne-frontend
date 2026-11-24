// Leads webinaire : règles pures de la page (dev 23/11/2026), testées par model.test.js.
//
// Les dates des RDV du CRM sont en heure murale de Paris, enregistrées sans conversion : « 14:00Z » veut dire 14 h à
// Paris. On lit donc le jour et l'heure tels quels dans la chaîne, sans passer par un objet Date.

const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Jour ISO et heure « HH:MM » d'un R1, ou null.
export function slotOf(value) {
  const text = String(value || '');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return match ? { date: match[1], time: match[2] } : null;
}

export const slotKey = (slot) => (slot ? `${slot.date} ${slot.time}` : '');

const utcDay = (iso) => new Date(`${iso}T12:00:00Z`);
export const addDays = (iso, n) => {
  const d = utcDay(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// « 14 h », « 9 h 30 ».
export const hourLabel = (time) => {
  const [h, m] = String(time || '').split(':');
  return m && m !== '00' ? `${Number(h)} h ${m}` : `${Number(h)} h`;
};

// « jeu. 26/11 ».
export const dayLabel = (iso) => {
  const d = utcDay(iso);
  return `${DAYS[d.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

// « jeu. 26/11 à 14 h ».
export const slotLabel = (slot) => (slot ? `${dayLabel(slot.date)} à ${hourLabel(slot.time)}` : '');

// « 23/11/2026 » pour une date de réception.
export const receivedLabel = (value) => {
  const text = String(value || '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}` : '–';
};

// Lundi de la semaine d'un jour ISO.
export const mondayOf = (iso) => {
  const day = utcDay(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
};

// « Semaine du 23 nov. ».
export const weekLabel = (monday) => {
  const d = utcDay(monday);
  return `Semaine du ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};

// Jours affichés d'une semaine : du lundi au vendredi, et le samedi seulement si le sales y a des créneaux.
export function weekDays(monday, agenda) {
  const days = [0, 1, 2, 3, 4].map((n) => addDays(monday, n));
  const saturday = addDays(monday, 5);
  if ((agenda?.days || []).some((d) => d.date === saturday && d.slots.length)) days.push(saturday);
  return days;
}

// Heures (lignes) de la grille : celles où le sales a un créneau dans la semaine, plus celles des repères.
export function weekRows(days, agenda, extra = []) {
  const shown = new Set(days);
  const times = new Set(extra.filter((s) => s && shown.has(s.date)).map((s) => s.time));
  for (const day of agenda?.days || []) if (shown.has(day.date)) day.slots.forEach((t) => times.add(t));
  return [...times].sort();
}

// Créneaux libres d'un sales, en clés « jour heure ».
export const freeKeys = (agenda) => new Set((agenda?.days || []).flatMap((d) => d.slots.map((t) => `${d.date} ${t}`)));

// Le sales n'est plus libre sur ce créneau (il vient d'y recevoir un R1) : retiré tout de suite, avant la relecture.
export function withoutSlot(agenda, slot) {
  if (!agenda || !slot) return agenda;
  return { ...agenda, days: agenda.days.map((d) => (d.date === slot.date ? { ...d, slots: d.slots.filter((t) => t !== slot.time) } : d)) };
}

// Origines présentes, dans l'ordre du nombre de leads.
export function originsOf(leads) {
  const counts = new Map();
  for (const lead of leads) {
    const origin = String(lead.origin || '').trim() || 'Sans origine';
    counts.set(origin, (counts.get(origin) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([origin, count]) => ({ origin, count }));
}

// Le RDV à placer d'un lead (dev 24/11/2026) : son R1 posé par un setter, ou son R2 réservé sur un lien du webinaire.
export const rdvOf = (lead) => lead?.r1_date || lead?.r2_date || null;
export const kindOf = (lead) => (lead?.r1_date ? 'R1' : lead?.r2_date ? 'R2' : 'RDV');

// RDV au plus tard demain (heure de Paris) : les premiers à affecter.
export const isSoon = (lead, today) => {
  const slot = slotOf(rdvOf(lead));
  return Boolean(slot) && slot.date <= addDays(today, 1);
};

// Filtre de la liste : vue (tous, d'ici demain, personne de libre), origine, recherche.
export function visibleLeads(leads, { view = 'all', origin = 'all', query = '', today, freeByLead = null }) {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  return leads.filter((lead) => {
    if (view === 'soon' && !isSoon(lead, today)) return false;
    if (view === 'none' && (!freeByLead || (freeByLead[String(lead.id)] || []).length > 0)) return false;
    if (origin !== 'all' && (String(lead.origin || '').trim() || 'Sans origine') !== origin) return false;
    if (!q) return true;
    return [lead.full_name, lead.email, lead.origin, lead.company].some((v) => String(v || '').toLowerCase().includes(q))
      || (digits.length >= 3 && String(lead.phone || '').replace(/\D/g, '').includes(digits));
  });
}

// Les sales d'un créneau : libres d'abord, puis les autres, chacun par nom.
export function salesForSlot(agendas, freeEmails) {
  const free = new Set(freeEmails || []);
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  return {
    free: agendas.filter((a) => free.has(a.email)).sort(byName),
    busy: agendas.filter((a) => !free.has(a.email)).sort(byName),
  };
}
