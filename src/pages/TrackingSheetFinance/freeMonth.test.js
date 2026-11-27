// freeMonth.test.js — le mois offert pour parrainage (dev 2026-11-19).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { freeMonthBody, freeMonthChoices, freeMonthsFromOps } from './freeMonth.js';

const row = (period, eo, ex, ro = null, rx = null, mode = null) => ({
  period, expected_owner: eo, expected_optilex_ttc: ex, received_owner: ro, received_optilex_ttc: rx, payment_mode: mode,
});

test('propose les échéances à venir attendues, payées ou non, dans l’ordre, avec ce qui est déjà payé', () => {
  const periods = [
    row('2027-01-01', 198, 96),
    row('2026-10-01', 198, 96),            // passé
    row('2026-11-01', 198, 96, 198, 96),   // déjà payé : proposé
    row('2026-12-01', 198, 96, null, 96),  // seul l'Opti'Lex payé
    row('2027-02-01', 0, 0),               // rien d'attendu
  ];
  assert.deepEqual(freeMonthChoices(periods, { nowKey: '2026-11' }), [
    { key: '2026-11', owner: 198, paid: 198 },
    { key: '2026-12', owner: 198, paid: 0 },   // seul l'Opti'Lex est payé : rien à rendre côté Owner
    { key: '2027-01', owner: 198, paid: 0 },
  ]);
});

test('jamais d’échéance annuelle ou trimestrielle', () => {
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 5760, 1728)], { clientMode: 'Annuel', nowKey: '2026-11' }), []);
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 5760, 1728, null, null, 'YEARLY')], { nowKey: '2026-11' }), []);
});

test('au plus douze échéances proposées', () => {
  const periods = Array.from({ length: 15 }, (_, i) => row(`2027-${String((i % 12) + 1).padStart(2, '0')}-0${1 + Math.floor(i / 12)}`, 198, 96));
  assert.equal(freeMonthChoices(periods, { nowKey: '2026-11' }).length, 12);
});

test('le geste envoyé : le mois, et avance par défaut', () => {
  assert.deepEqual(freeMonthBody('2026-12'), { period: '2026-12', settle: 'advance' });
  assert.deepEqual(freeMonthBody('2026-12', 'refund'), { period: '2026-12', settle: 'refund' });
  assert.deepEqual(freeMonthBody('2026-12', 'autre'), { period: '2026-12', settle: 'advance' });
});

test('le parrainage n’offre que l’Owner : l’Opti’Lex, mensuel ou annuel, reste dû et hors de ce qui est rendu', () => {
  const monthly = [row('2026-12-01', 198, 96, 198, 96)];
  assert.deepEqual(freeMonthChoices(monthly, { nowKey: '2026-11' }), [{ key: '2026-12', owner: 198, paid: 198 }]);
  const yearly = [{ ...row('2026-12-01', 198, 1152, 198, 1152), payment_mode_optilex: 'YEARLY' }];
  assert.deepEqual(freeMonthChoices(yearly, { nowKey: '2026-11' }), [{ key: '2026-12', owner: 198, paid: 198 }]);
});

test('un Owner trimestriel n’a pas de mois offert', () => {
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 594, 96)], { clientMode: 'QUARTERLY', nowKey: '2026-11' }), []);
  assert.deepEqual(freeMonthChoices([row('2027-01-01', 594, 96, null, null, 'QUARTERLY')], { nowKey: '2026-11' }), []);
});

test('un mois avec une demande en attente n’est pas proposé deux fois', () => {
  const periods = [row('2026-12-01', 198, 96), row('2027-01-01', 198, 96)];
  assert.deepEqual(freeMonthChoices(periods, { pendingMonths: ['2026-12'], nowKey: '2026-11' }).map((c) => c.key), ['2027-01']);
});

test('les mois offerts se lisent dans le journal, sans les gestes annulés ni les autres réductions', () => {
  const ops = [
    { kind: 'discount', label: 'a appliqué la réduction « Mois offert (parrainage) » (−100 %)', periods: ['2026-12-01'] },
    { kind: 'discount', label: 'a appliqué la réduction « Mois offert (parrainage) » (−100 %)', periods: ['2027-01-01'], reverted_at: '2026-11-20' },
    { kind: 'discount', label: 'a appliqué la réduction « Fidélité » (−20 %)', periods: ['2027-02-01'] },
    { kind: 'expected', label: 'a fixé l’attendu', periods: ['2027-03-01'] },
  ];
  assert.deepEqual([...freeMonthsFromOps(ops)], ['2026-12']);
});
