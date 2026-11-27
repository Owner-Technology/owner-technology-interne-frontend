import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedInstallment, statementRegularization, regularizationText } from './installmentFollowup.js';
import { formatDateLongFR, formatMonthLabel } from './constants.js';
import { regularizedNote } from '../../utils/boardRegularized.js';
import { matchesLateOnboarding, matchesAnnualRenewal, isRetractedEtat } from './followupFilters.js';
import { installmentSubline } from './installmentLabel.js';

test('a confirmed Owner installment does not settle OptiLex or modify receipts', () => {
  const p = {id: 'p1', expected_owner: 100, received_owner: 0, expected_optilex_ttc: 40, received_optilex_ttc: 0};
  const before = JSON.stringify(p);
  const reviews = [{period_id:'p1', entity:'owner', regularized:true}];
  assert.equal(reviewedInstallment(p, 'owner', reviews), true);
  assert.equal(reviewedInstallment(p, 'global', reviews), false);
  assert.equal(reviewedInstallment(p, 'optilex', reviews), false);
  assert.equal(reviewedInstallment(p, 'owner', [{...reviews[0], regularized:false}]), false);
  assert.equal(reviewedInstallment({...p, received_optilex_ttc:40}, 'global', reviews), true);
  assert.equal(reviewedInstallment({...p, received_optilex_ttc:40}, 'global', reviews, {optilex:10}), false);
  assert.equal(reviewedInstallment({...p, id:'p2'}, 'owner', reviews), false);
  assert.equal(JSON.stringify(p), before);
  assert.match(installmentSubline({status:'regularized', month:'2026-09'}), /régularisation confirmée/);
});
test('late onboarding subfilter partitions past vs upcoming and missing', () => {
  const today = new Date(2026, 9, 9);
  for (const raw of ['2026-10-08','2026-10-09']) {
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'past', today), true);
  }
  for (const raw of ['2026-10-10', null, 'invalide']) {
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'not_past', today), true);
    assert.equal(matchesLateOnboarding({client:{rdv_onboarding:raw}}, 'past', today), false);
  }
});
test('renewal filter respects selected entity and server eligibility', () => {
  const map = new Map([[17, ['optilex']]]);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'owner', map), false);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'optilex', map), true);
  assert.equal(matchesAnnualRenewal({client_id:17}, 'global', map), true);
  assert.equal(matchesAnnualRenewal({client_id:18}, 'global', map), false);
});
test('rétractés, actés ou en cours, reconnus ; les autres états non', () => {
  assert.equal(isRetractedEtat('Rétractation'), true);
  assert.equal(isRetractedEtat('En cours de rétractation'), true);
  for (const etat of ['Signé', 'Résiliation', 'En cours de résiliation', 'Pause', null, undefined]) {
    assert.equal(isRetractedEtat(etat), false);
  }
});

// ── Mois régularisé par les mois suivants (facturation, 27/11/2026) ──────────

const month = (period, extra = {}) => ({ period, unpaid: 0, written_off: [], regularized: null, ...extra });
const march = { owner: [month('2026-03', { regularized: { period: '2026-11', paid_on: '2026-11-15' } })],
  optilex: [month('2026-03')] };

test('mars réglé en novembre : régularisé, avec le jour du règlement', () => {
  assert.deepEqual(statementRegularization(march, 'owner', '2026-03'), { period: '2026-11', paidOn: '2026-11-15' });
  // Vision globale : Opti’Lex ne doit rien sur mars, le mois est régularisé.
  assert.deepEqual(statementRegularization(march, 'global', '2026-03'), { period: '2026-11', paidOn: '2026-11-15' });
  // Opti’Lex seul n’a rien eu à régulariser.
  assert.equal(statementRegularization(march, 'optilex', '2026-03'), null);
});

test('un reste dû, une correction ou un relevé absent : pas de régularisation', () => {
  const owing = { ...march, optilex: [month('2026-03', { unpaid: 30 })] };
  assert.equal(statementRegularization(owing, 'global', '2026-03'), null);
  const erased = { owner: [month('2026-03', { regularized: { period: '2026-11' }, written_off: [{ period: '2026-10', amount: 10 }] })] };
  assert.equal(statementRegularization(erased, 'owner', '2026-03'), null);
  assert.equal(statementRegularization(null, 'owner', '2026-03'), null);
  assert.equal(statementRegularization(march, 'owner', '2026-04'), null);
});

test('la ligne de l’échéancier dit le jour, sinon le mois du règlement ; le geste manuel garde son texte', () => {
  const fmt = { formatDay: formatDateLongFR, formatMonth: formatMonthLabel };
  assert.equal(regularizationText({ period: '2026-11', paidOn: '2026-11-15' }, fmt), `régularisée le ${formatDateLongFR('2026-11-15')}`);
  assert.equal(regularizationText({ period: '2026-11', paidOn: null }, fmt), 'régularisée en novembre 2026');
  const inst = { month: '2026-03', status: 'regularized', regularizedOn: { period: '2026-11', paidOn: null } };
  assert.match(installmentSubline(inst), /régularisée en novembre 2026$/);
  assert.match(installmentSubline({ ...inst, regularizedOn: null }), /régularisation confirmée$/);
});

// Board, frise des créances : même régularisation, avec son jour.
const boardFmt = { day: (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`, monthLabel: () => 'novembre 2026' };

test('la frise du board dit le jour du règlement, sinon son mois, sinon « régularisé »', () => {
  assert.equal(regularizedNote({ state: 'regularized', regularized: { period: '2026-11', paid_on: '2026-11-20' } }, boardFmt), ', régularisé le 20/11/2026');
  assert.equal(regularizedNote({ state: 'regularized', regularized: { period: '2026-11', paid_on: null } }, boardFmt), ', régularisé en novembre 2026');
  assert.equal(regularizedNote({ state: 'regularized' }, boardFmt), ', régularisé');
  assert.equal(regularizedNote({ state: 'partial' }, boardFmt), '');
});
