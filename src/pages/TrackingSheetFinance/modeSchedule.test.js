import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDatedMode, modeAtMonth, optilexKeptMode } from './modeSchedule.js';

// Client passé le 22/11 : mensuel d'origine, annuel Owner dès octobre 2026, Opti'Lex qui suit Owner.
const switched = {
  follows_owner: true,
  entities: {
    owner: { in_force: 'YEARLY', timeline: [
      { id: 15, mode: 'MONTHLY', effective_from: null },
      { id: 16, mode: 'YEARLY', effective_from: '2026-10-01' },
    ] },
    optilex: { in_force: 'YEARLY', timeline: [] },
  },
};

test('la puce suit le calendrier daté, pas la ligne du mois', () => {
  assert.equal(modeAtMonth(switched, 'owner', '2026-09'), 'MONTHLY');
  assert.equal(modeAtMonth(switched, 'owner', '2026-11'), 'YEARLY');
  assert.equal(modeAtMonth(switched, 'optilex', '2026-11'), 'YEARLY');   // Opti'Lex suit Owner
});

test('sans changement daté, rien ne change à l’affichage', () => {
  const plain = { follows_owner: true, entities: { owner: { timeline: [{ id: null, mode: 'YEARLY', effective_from: null }] } } };
  assert.equal(hasDatedMode(plain, 'owner'), false);
  assert.equal(modeAtMonth(plain, 'owner', '2026-11'), null);
  assert.equal(modeAtMonth(null, 'owner', '2026-11'), null);
});

test('passer Owner en annuel propose de garder Opti’Lex au mois quand il suit Owner', () => {
  const monthly = { follows_owner: true, entities: { owner: { in_force: 'MONTHLY' }, optilex: { in_force: 'MONTHLY' } } };
  assert.equal(optilexKeptMode(monthly, 'payment_mode', 'YEARLY'), 'MONTHLY');
  assert.equal(optilexKeptMode(monthly, 'payment_mode', 'MONTHLY'), null);
  assert.equal(optilexKeptMode(monthly, 'payment_mode_optilex', 'YEARLY'), null);
  assert.equal(optilexKeptMode({ ...monthly, follows_owner: false }, 'payment_mode', 'YEARLY'), null);
});
