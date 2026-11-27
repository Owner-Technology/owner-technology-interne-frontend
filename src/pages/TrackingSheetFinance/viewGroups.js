// Filtres de la liste Finance, regroupés (réunion du 27/11/2026) : quelques filtres principaux, chacun avec ses
// sous-filtres à cocher, comme un filtre Excel. Cocher plusieurs sous-filtres = leur union ; un client compte une
// seule fois. Chaque ancienne vue reste un sous-filtre : rien n'a disparu.
//
// Module sans JSX : les règles se testent avec node (viewGroups.test.js). Le prédicat de chaque sous-filtre vit
// dans index.jsx (`matchesView`), il ne change pas ici.

export const VIEW_GROUPS = [
  { key: 'all', label: 'Tous', subs: [] },
  { key: 'a_jour', label: 'À jour', subs: [{ key: 'a_jour', label: 'À jour' }] },
  {
    key: 'retard', label: 'En retard',
    subs: [
      { key: 'retard_mois', label: 'Retard du mois' },
      { key: 'creances', label: 'Créances antérieures' },
      { key: 'annual_renewals', label: 'Renouvellements annuels du mois' },
      // Sortis du retard du mois par le délai J+5 : décoché par défaut, la règle les met de côté.
      { key: 'retard_onboarding', label: 'Délai J+5 après onboarding', off: true,
        hint: 'Onboarding il y a moins de 5 jours ouvrés : le premier prélèvement n’est pas encore saisi' },
    ],
  },
  {
    key: 'onboarding', label: 'Onboarding',
    subs: [
      { key: 'attente_optilex', label: "Attente Opti'Lex" },
      { key: 'onboarding_upcoming', label: 'Onboarding à venir' },
      { key: 'onboarding_past', label: 'Onboarding passé' },
      { key: 'no_show', label: 'No show' },
      { key: 'recale', label: 'Recalés' },
    ],
  },
  {
    key: 'a_regulariser', label: 'À régulariser',
    subs: [
      { key: 'trop_percu', label: 'Trop-perçu' },
      { key: 'a_verifier', label: 'À vérifier' },
      { key: 'non_auto', label: 'Non automatisé' },
    ],
  },
  {
    key: 'etats', label: 'États',
    subs: [
      { key: 'pause', label: 'En pause' },
      { key: 'resilies', label: 'Résiliés / Rétractés' },
      { key: 'liquidation', label: 'Liquidations' },
      { key: 'recuperes', label: 'Clients récupérés' },
    ],
  },
];

const GROUP_BY_KEY = new Map(VIEW_GROUPS.map((g) => [g.key, g]));
const GROUP_OF_SUB = new Map(VIEW_GROUPS.flatMap((g) => g.subs.map((s) => [s.key, g.key])));

export const ALL_SUB_KEYS = VIEW_GROUPS.flatMap((g) => g.subs.map((s) => s.key));
export const groupOf = (subKey) => GROUP_OF_SUB.get(subKey) || null;
export const subsOf = (groupKey) => GROUP_BY_KEY.get(groupKey)?.subs || [];

// Sous-filtres cochés à l'ouverture de chaque filtre principal.
export function defaultChecks() {
  return Object.fromEntries(VIEW_GROUPS.map((g) => [g.key, new Set(g.subs.filter((s) => !s.off).map((s) => s.key))]));
}

// Sélection = un filtre principal + ses sous-filtres cochés.
export const initialSelection = () => ({ group: 'all', checks: defaultChecks() });

export const pickGroup = (sel, group) => ({ ...sel, group });

// Depuis le menu de gauche : un sous-filtre seul, dans son filtre principal.
export function pickSub(sel, subKey) {
  const group = groupOf(subKey);
  if (!group) return sel;
  return { group, checks: { ...sel.checks, [group]: new Set([subKey]) } };
}

export function toggleSub(sel, subKey) {
  const group = groupOf(subKey);
  if (!group) return sel;
  const next = new Set(sel.checks[group]);
  if (next.has(subKey)) next.delete(subKey); else next.add(subKey);
  return { group, checks: { ...sel.checks, [group]: next } };
}

// Sous-filtres actifs, dans l'ordre du groupe. « Tous » : aucun (pas de filtre).
export function activeSubs(sel) {
  if (sel.group === 'all') return [];
  const checked = sel.checks[sel.group] || new Set();
  return subsOf(sel.group).map((s) => s.key).filter((k) => checked.has(k));
}

export const isSubActive = (sel, subKey) => activeSubs(sel).includes(subKey);

// La sélection se résume-t-elle à ce seul sous-filtre ? (bandeau propre aux créances, à l'attente Opti'Lex, menu
// de gauche).
export function onlySub(sel) {
  const subs = activeSubs(sel);
  return subs.length === 1 ? subs[0] : null;
}

// Une ligne est retenue si au moins un des sous-filtres cochés la retient (union).
export const matchesAny = (row, subs, matchSub) => subs.some((k) => matchSub(row, k));

// Clients distincts retenus par l'union des sous-filtres : jamais la somme des compteurs, un client pouvant être à
// la fois en renouvellement annuel et en retard du mois.
export const countUnion = (rows, subs, matchSub) =>
  (subs.length ? rows.filter((r) => matchesAny(r, subs, matchSub)).length : 0);

// Météo client : les niveaux du board (utils/weatherCase.js, `weatherFilter`), du plus content au plus fâché, puis
// « Non noté ».
export const METEO_LEVELS = ['5', '4', '3', '2', '1', 'none'];

// Lignes retenues par la sélection, avant le menu Filtre et la météo. « Tous » : les contrats sans numéro client
// (lignes synthétiques du board) en tête, puis tout le mois. Ailleurs, ces contrats n'entrent qu'avec « Attente
// Opti'Lex » coché (`pendingInPhase` : ceux du sous-filtre RDV d'intégration). `matchSub(row, key, hide)`.
export function selectViewRows({ sel, rows, pendingRows = [], pendingInPhase = [], matchSub, hide = true }) {
  if (sel.group === 'all') return [...pendingRows, ...rows];
  const subs = activeSubs(sel);
  const pending = subs.includes('attente_optilex') ? pendingInPhase : [];
  return [...pending, ...rows.filter((r) => subs.some((k) => matchSub(r, k, hide)))];
}

// Compteurs affichés : chaque filtre principal (ses sous-filtres cochés, clients distincts) et chaque sous-filtre.
// Ils disent exactement ce que la liste montre en choisissant ce filtre (hors recherche, menu Filtre et météo).
export function viewCountsOf({ sel, rows, pendingRows = [], pendingInPhase = [], matchSub }) {
  const groups = {};
  const subs = {};
  for (const g of VIEW_GROUPS) {
    groups[g.key] = selectViewRows({ sel: { ...sel, group: g.key }, rows, pendingRows, pendingInPhase, matchSub }).length;
    for (const { key } of g.subs) {
      subs[key] = rows.filter((r) => matchSub(r, key, true)).length + (key === 'attente_optilex' ? pendingInPhase.length : 0);
    }
  }
  return { groups, subs };
}
