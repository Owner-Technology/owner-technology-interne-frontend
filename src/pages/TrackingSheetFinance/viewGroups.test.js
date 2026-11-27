import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIEW_GROUPS, ALL_SUB_KEYS, groupOf, defaultChecks, initialSelection, pickGroup, pickSub, toggleSub,
  activeSubs, onlySub, isSubActive, matchesAny, countUnion, METEO_LEVELS, selectViewRows, viewCountsOf,
} from './viewGroups.js';
import { weatherFilter } from '../../utils/weatherCase.js';
import { inOnboardingGrace, matchesLateOnboarding } from './followupFilters.js';
import { isNonAutomated, matchesNonAutomated, onboardingDayKey } from './constants.js';
import { businessDaysAfter, easterSundayKey, isBusinessDayKey } from '../../utils/frenchBusinessDays.js';

// Les vues de la rangée d'avant (Tous, À jour, Retard du mois…) : chacune reste atteignable.
const OLD_VIEWS = {
  a_jour: ['a_jour'], retard_mois: ['retard_mois', 'retard_onboarding'], annual_renewals: ['annual_renewals'],
  creances: ['creances'], trop_percu: ['trop_percu'], onboarding: ['onboarding_past', 'onboarding_upcoming'],
  no_show: ['no_show', 'recale'], non_auto: ['non_auto'], a_verifier: ['a_verifier'], attente_optilex: ['attente_optilex'],
  resilies: ['resilies'], recuperes: ['recuperes'], pause: ['pause'], liquidation: ['liquidation'],
};

test('chaque ancienne vue reste un sous-filtre, une seule fois', () => {
  assert.equal(new Set(ALL_SUB_KEYS).size, ALL_SUB_KEYS.length, 'aucun sous-filtre en double');
  for (const [old, subs] of Object.entries(OLD_VIEWS)) {
    for (const k of subs) assert.ok(ALL_SUB_KEYS.includes(k), `${old} → ${k}`);
  }
  assert.deepEqual(VIEW_GROUPS.map((g) => g.key), ['all', 'a_jour', 'retard', 'onboarding', 'a_regulariser', 'etats']);
  assert.equal(groupOf('creances'), 'retard');
  assert.equal(groupOf('recale'), 'onboarding');
  assert.equal(groupOf('inconnu'), null);
});

test('sous-filtres cochés par défaut : tout, sauf le délai J+5 que la règle met de côté', () => {
  const checks = defaultChecks();
  assert.deepEqual([...checks.retard], ['retard_mois', 'creances', 'annual_renewals']);
  assert.equal(checks.onboarding.size, 5);
  const sel = initialSelection();
  assert.equal(sel.group, 'all');
  assert.deepEqual(activeSubs(sel), [], '« Tous » ne filtre rien');
  assert.deepEqual(activeSubs(pickGroup(sel, 'retard')), ['retard_mois', 'creances', 'annual_renewals']);
});

test('cocher, décocher, et le menu de gauche qui choisit un sous-filtre seul', () => {
  let sel = pickGroup(initialSelection(), 'retard');
  sel = toggleSub(sel, 'retard_onboarding');
  assert.ok(isSubActive(sel, 'retard_onboarding'));
  sel = toggleSub(sel, 'annual_renewals');
  assert.deepEqual(activeSubs(sel), ['retard_mois', 'creances', 'retard_onboarding']);
  // Changer de filtre principal garde les coches de chacun.
  sel = pickGroup(pickGroup(sel, 'etats'), 'retard');
  assert.deepEqual(activeSubs(sel), ['retard_mois', 'creances', 'retard_onboarding']);
  const only = pickSub(sel, 'creances');
  assert.equal(only.group, 'retard');
  assert.equal(onlySub(only), 'creances');
  assert.equal(onlySub(sel), null);
  // Cocher un sous-filtre d'un autre groupe y bascule.
  assert.equal(toggleSub(sel, 'pause').group, 'etats');
});

test('le compteur d’un filtre principal compte des clients distincts, pas la somme des sous-filtres', () => {
  const rows = [{ id: 1, tags: ['retard_mois', 'annual_renewals'] }, { id: 2, tags: ['creances'] }, { id: 3, tags: [] }];
  const match = (r, k) => r.tags.includes(k);
  assert.equal(countUnion(rows, ['retard_mois', 'creances', 'annual_renewals'], match), 2);
  assert.equal(countUnion(rows, [], match), 0);
  assert.equal(matchesAny(rows[0], ['creances'], match), false);
});

test('jours ouvrés : week-ends et fériés français, comme le back', () => {
  assert.equal(easterSundayKey(2026), '2026-04-05');
  assert.equal(easterSundayKey(2027), '2027-03-28');
  assert.equal(isBusinessDayKey('2026-04-06'), false, 'lundi de Pâques');
  assert.equal(isBusinessDayKey('2026-05-14'), false, 'Ascension');
  assert.equal(isBusinessDayKey('2026-11-11'), false, 'Armistice');
  assert.equal(isBusinessDayKey('2026-11-28'), false, 'samedi');
  assert.equal(isBusinessDayKey('2026-11-27'), true);
  assert.equal(businessDaysAfter('2026-11-23', '2026-11-23'), 0);
  assert.equal(businessDaysAfter('2026-11-27', '2026-11-30'), 1, 'vendredi → lundi');
  assert.equal(businessDaysAfter('2026-11-30', '2026-11-27'), 0);
});

test('délai J+5 : hors retard du mois jusqu’au 5e jour ouvré après l’onboarding', () => {
  const row = (rdv) => ({ client: { rdv_onboarding: rdv } });
  const on = (y, m, d) => new Date(y, m - 1, d, 15, 0);
  // Lundi 23/11/2026 : en délai du lundi au lundi suivant exclu.
  for (const d of [23, 24, 25, 26, 27, 28, 29]) assert.equal(inOnboardingGrace(row('2026-11-23'), on(2026, 11, d)), true, `le ${d}`);
  assert.equal(inOnboardingGrace(row('2026-11-23'), on(2026, 11, 30)), false, 'J+5 ouvré : vrai retard');
  // Le 11 novembre ne compte pas : lundi 9 → mardi 17.
  assert.equal(inOnboardingGrace(row('09/11/2026'), on(2026, 11, 16)), true);
  assert.equal(inOnboardingGrace(row('09/11/2026'), on(2026, 11, 17)), false);
  // Onboarding à venir ou sans date : pas de délai, la règle du retard reste celle d'avant.
  assert.equal(inOnboardingGrace(row('2026-12-01'), on(2026, 11, 27)), false);
  assert.equal(inOnboardingGrace(row(null), on(2026, 11, 27)), false);
  assert.equal(inOnboardingGrace(row('invalide'), on(2026, 11, 27)), false);
  assert.equal(onboardingDayKey(row('2026-11-23T10:00:00')), '2026-11-23');
});

test('« Retard du mois » et « Délai J+5 » se partagent l’ancien retard du mois, sans perte ni doublon', () => {
  const today = new Date(2026, 10, 27, 12, 0);
  const late = ['2026-11-23', '2026-11-02', '2026-12-04', null].map((rdv, i) => ({ id: i, client: { rdv_onboarding: rdv } }));
  const kept = late.filter((r) => !inOnboardingGrace(r, today));
  const grace = late.filter((r) => inOnboardingGrace(r, today));
  assert.equal(kept.length + grace.length, late.length);
  assert.deepEqual(grace.map((r) => r.id), [0]);
  // Le réglage « onboarding passé » range le délai J+5 avec les onboardings passés.
  assert.ok(grace.every((r) => matchesLateOnboarding(r, 'past', today)));
});

test('« Non automatisé seulement » reprend la règle de la vue « Non automatisé », sans la condition d’attendu', () => {
  const row = (auto, expected = 100) => ({ auto_debit: auto, expected_owner: expected, expected_optilex_ttc: expected });
  assert.equal(isNonAutomated(row('NON'), 'owner'), true);
  assert.equal(isNonAutomated(row('OUI'), 'owner'), false);
  assert.equal(isNonAutomated(row('Partiellement Owner'), 'owner'), false);
  assert.equal(isNonAutomated(row('Partiellement Owner'), 'optilex'), true);
  assert.equal(isNonAutomated(row('Partiellement Owner'), 'global'), false);
  assert.equal(matchesNonAutomated(row('NON'), 'owner'), true);
  assert.equal(matchesNonAutomated(row('NON', 0), 'owner'), false, 'la vue garde sa condition d’attendu');
});

test('le filtre Météo couvre tous les niveaux du board, anciens comme nouveaux', () => {
  for (const score of [null, 1, 2, 3, 4, 5]) {
    for (const context of [null, { version: 2 }]) {
      assert.ok(METEO_LEVELS.includes(weatherFilter(score, context)), `${score} / ${context?.version}`);
    }
  }
});

// Un mois type : des clients étiquetés par sous-filtre ; `liq` = liquidation, masquée dans les créances antérieures.
const MONTH = [
  { id: 'a', tags: ['retard_mois', 'annual_renewals'] },
  { id: 'b', tags: ['creances'], liq: true },
  { id: 'c', tags: ['creances', 'annual_renewals'], liq: true },
  { id: 'd', tags: ['retard_onboarding'] },
  { id: 'e', tags: ['attente_optilex'] },
  { id: 'f', tags: ['a_jour'] },
];
const PENDING = [{ id: 'p1', pending: true }, { id: 'p2', pending: true }];
const matchSub = (r, k, hide = true) => r.tags.includes(k) && !(hide && k === 'creances' && r.liq);
const ctx = (sel) => ({ sel, rows: MONTH, pendingRows: PENDING, pendingInPhase: PENDING.slice(0, 1), matchSub });

test('« Tous » garde les contrats sans numéro en tête ; ailleurs, seulement avec « Attente Opti’Lex » coché', () => {
  const sel = initialSelection();
  assert.deepEqual(selectViewRows(ctx(sel)).map((r) => r.id), ['p1', 'p2', 'a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(selectViewRows(ctx(pickGroup(sel, 'onboarding'))).map((r) => r.id), ['p1', 'e']);
  assert.deepEqual(selectViewRows(ctx(toggleSub(pickGroup(sel, 'onboarding'), 'attente_optilex'))).map((r) => r.id), []);
  assert.deepEqual(selectViewRows(ctx(pickGroup(sel, 'retard'))).map((r) => r.id), ['a', 'c'],
    'le délai J+5 est décoché ; la liquidation b, seulement en créances, est masquée ; c reste par son renouvellement');
  assert.deepEqual(selectViewRows({ ...ctx(pickGroup(sel, 'retard')), hide: false }).map((r) => r.id), ['a', 'b', 'c']);
});

test('les compteurs disent exactement ce que la liste montre', () => {
  let sel = initialSelection();
  sel = toggleSub(pickGroup(sel, 'retard'), 'retard_onboarding');
  const { groups, subs } = viewCountsOf(ctx(sel));
  for (const g of VIEW_GROUPS) {
    assert.equal(groups[g.key], selectViewRows(ctx(pickGroup(sel, g.key))).length, g.key);
  }
  assert.equal(groups.all, MONTH.length + PENDING.length);
  assert.equal(groups.retard, 3, 'a, c, d : chacun une fois');
  assert.equal(subs.retard_mois + subs.creances + subs.annual_renewals + subs.retard_onboarding, 4, 'la somme compterait a deux fois');
  assert.equal(subs.creances, 0, 'les liquidations masquées ne comptent pas');
  assert.equal(subs.attente_optilex, 2, 'le client du board + le contrat sans numéro du sous-filtre');
  assert.equal(groups.a_jour, 1);
});
