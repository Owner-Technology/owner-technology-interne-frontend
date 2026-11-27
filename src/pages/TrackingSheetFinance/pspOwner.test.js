// pspOwner.test.js — deux PSP sur un même encaissement Owner (facturation, 27/11/2026).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';

import { pspList, pspLabel, ownerPspPatch, toggleValue, MAX_OWNER_PSP, PSP_COLORS } from './constants.js';
import { matchesSavedFilter } from './savedFilters.js';
import { describeAction } from './actionLabel.js';
import { receiptPspLabel, receiptPspKnown } from './receipts.js';

const row = { psp_owner: 'Learnypay', psp_owner_2: 'Owner Pay', psp_optilex: 'IFX' };

test('la ligne lit ses PSP dans la vision active, Opti’Lex n’en a qu’un', () => {
  assert.deepEqual(pspList(row, 'owner'), ['Learnypay', 'Owner Pay']);
  assert.deepEqual(pspList(row, 'global'), ['Learnypay', 'Owner Pay']);
  assert.deepEqual(pspList(row, 'optilex'), ['IFX']);
  assert.deepEqual(pspList({ psp_owner: 'IFX' }, 'owner'), ['IFX']);
  assert.deepEqual(pspList({}, 'owner'), []);
  assert.equal(pspLabel(pspList(row, 'owner')), 'Learnypay + Owner Pay');
});

test('deux PSP au plus : cocher, décocher, liste pleine', () => {
  assert.equal(MAX_OWNER_PSP, 2);
  assert.deepEqual(toggleValue([], 'Learnypay'), ['Learnypay']);
  assert.deepEqual(toggleValue(['Learnypay'], 'IFX'), ['Learnypay', 'IFX']);
  const full = ['Learnypay', 'IFX'];
  assert.equal(toggleValue(full, 'whop'), full);
  assert.deepEqual(toggleValue(full, 'Learnypay'), ['IFX']);
});

test('le PATCH envoie toujours les deux colonnes, le premier PSP d’abord', () => {
  assert.deepEqual(ownerPspPatch(['Learnypay', 'whop']), { psp_owner: 'Learnypay', psp_owner_2: 'whop' });
  // Le premier décoché : le second devient le premier, jamais orphelin.
  assert.deepEqual(ownerPspPatch(['whop']), { psp_owner: 'whop', psp_owner_2: null });
  assert.deepEqual(ownerPspPatch([]), { psp_owner: null, psp_owner_2: null });
});

test('un filtre « Check (PSP) = Learnypay » garde Learnypay + Owner Pay', () => {
  const is = (value, op = 'eq') => ({ match: 'all', conditions: [{ field: 'psp', op, value }] });
  assert.equal(matchesSavedFilter(row, is('Learnypay'), { scope: 'owner' }), true);
  assert.equal(matchesSavedFilter(row, is('Owner Pay'), { scope: 'owner' }), true);
  assert.equal(matchesSavedFilter(row, is('IFX'), { scope: 'owner' }), false);
  assert.equal(matchesSavedFilter(row, is('IFX'), { scope: 'optilex' }), true);
  assert.equal(matchesSavedFilter(row, is('Owner Pay', 'neq'), { scope: 'owner' }), false);
  assert.equal(matchesSavedFilter({}, is(null, 'empty'), { scope: 'owner' }), true);
  assert.equal(matchesSavedFilter(row, is(null, 'nempty'), { scope: 'owner' }), true);
});

test('le journal dit le second PSP', () => {
  assert.match(describeAction({ field: 'psp_owner_2', from: null, to: 'IFX', period: '2026-11' }), /IFX comme second PSP Owner/);
  assert.match(describeAction({ field: 'psp_owner_2', from: 'IFX', to: null, period: '2026-11' }), /décoché le second PSP Owner/);
});

test('les reçus se regroupent sous les deux PSP, une ligne Opti’Lex reste seule', () => {
  assert.equal(receiptPspLabel({ psp: 'Learnypay', psp_2: 'IFX' }), 'Learnypay + IFX');
  assert.equal(receiptPspLabel({ psp: 'IFX', psp_2: null }), 'IFX');
  assert.equal(receiptPspLabel({ psp: null }), '');
  assert.equal(receiptPspKnown({ psp: 'Learnypay', psp_2: 'Owner Pay' }, PSP_COLORS), true);
  assert.equal(receiptPspKnown({ psp: 'Learnypay', psp_2: 'Stripe' }, PSP_COLORS), false);
});
