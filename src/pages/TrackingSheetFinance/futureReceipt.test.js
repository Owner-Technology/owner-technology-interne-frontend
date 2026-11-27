// futureReceipt.test.js — pas d'encaissement sur un mois futur (facturation, 27/11/2026).
//
// Lancement : `npm test` (cité dans le script `test` de package.json).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isFutureMonth, lastPaymentDay, receiptEditable, paymentDateEditable, futureReceiptError,
} from './futureReceipt.js';

const NOW = '2026-11';

test('ne regarde que le mois, par rapport au mois courant', () => {
  assert.equal(isFutureMonth('2026-12-01', NOW), true);
  assert.equal(isFutureMonth('2027-01', NOW), true);
  assert.equal(isFutureMonth('2026-11-01', NOW), false);
  assert.equal(isFutureMonth('2026-03-01', NOW), false);
  assert.equal(isFutureMonth(null, NOW), false);
});

test('propose au plus tard le dernier jour du mois courant', () => {
  assert.equal(lastPaymentDay('2026-11'), '2026-11-30');
  assert.equal(lastPaymentDay('2028-02'), '2028-02-29');
  assert.equal(lastPaymentDay('2026-12'), '2026-12-31');
});

test('ferme le reçu d’un mois futur vide, garde ouvert un mois futur déjà saisi pour l’effacer', () => {
  assert.equal(receiptEditable('2026-12-01', null, NOW), false);
  assert.equal(receiptEditable('2026-12-01', 0, NOW), false);
  assert.equal(receiptEditable('2026-12-01', 120, NOW), true);
  assert.equal(receiptEditable('2026-11-01', null, NOW), true);
  assert.equal(receiptEditable('2025-10-01', null, NOW), true);
});

test('ferme la date de paiement d’un mois futur vide', () => {
  assert.equal(paymentDateEditable('2026-12-01', null, NOW), false);
  assert.equal(paymentDateEditable('2026-12-01', '2026-12-03', NOW), true);
  assert.equal(paymentDateEditable('2026-11-01', null, NOW), true);
});

test('refuse un montant ou une date dans un mois futur, laisse passer un effacement', () => {
  assert.match(futureReceiptError({ period: '2026-12-01', amount: 50 }, NOW), /mois futur/);
  assert.match(futureReceiptError({ period: '2026-11-01', paidOn: '2026-12-02' }, NOW), /date de paiement/);
  assert.match(futureReceiptError({ period: '2026-12-01', paidOn: '2026-11-20' }, NOW), /date de paiement/);
  assert.equal(futureReceiptError({ period: '2026-12-01', amount: 0, paidOn: null }, NOW), null);
  assert.equal(futureReceiptError({ period: '2026-11-01', amount: 50, paidOn: '2026-11-30' }, NOW), null);
});
