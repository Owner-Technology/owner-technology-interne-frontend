import test from 'node:test';
import assert from 'node:assert/strict';
import { billingLeader, billingTargets, mondayOf, toggleWeekPerson, transferLeftCalendarsPending, weekMoveInfo } from './onboardingBilling.js';
import { canRescheduleOnboarding } from './boardIntegration.js';

const PEOPLE = ['A', 'B', 'C'];

test('the billing leader is the name served, or « À attribuer », or nothing without billing', () => {
    assert.equal(billingLeader({ state: 'assigned', name: 'B' }), 'B');
    assert.equal(billingLeader({ state: 'unassigned', name: null }), 'À attribuer');
    assert.equal(billingLeader({ state: 'none', name: null }), null);
    assert.equal(billingLeader(null), null);
    // Réservé avant la répartition, ou à recaler : rien de faux (pas de « À attribuer » rouge), le bloc est masqué.
    assert.equal(billingLeader({ state: 'unmanaged', name: null }), null);
    assert.equal(billingLeader({ state: 'inactive', name: null }), null);
});

test('the colleagues offered are everyone but the current one, only when the server allows the change', () => {
    const info = { name: 'A', can_change: true, options: [{ name: 'A', this_week: true }, { name: 'B', this_week: true }, { name: 'C', this_week: false }] };
    assert.deepEqual(billingTargets(info), [{ name: 'B', offWeek: false, sameTime: false }, { name: 'C', offWeek: true, sameTime: false }]);
    // Déjà un onboarding à cette heure : signalé, toujours proposé (rien ne bloque).
    const busy = { ...info, options: info.options.map((o) => (o.name === 'B' ? { ...o, same_time: true } : o)) };
    assert.deepEqual(billingTargets(busy).map((t) => [t.name, t.sameTime]), [['B', true], ['C', false]]);
    assert.deepEqual(billingTargets({ ...info, can_change: false }), []);           // CSM, rendez-vous passé : lecture seule
    assert.deepEqual(billingTargets({ ...info, name: null }).map((t) => t.name), PEOPLE);   // à attribuer : tout le monde
});

test('a week starts on Monday', () => {
    assert.equal(mondayOf('2026-11-30'), '2026-11-30');
    assert.equal(mondayOf('2026-12-06'), '2026-11-30');
    assert.equal(mondayOf('2026-12-03T10:00:00'), '2026-11-30');
});

test('a week is set by clicking people, back to everyone means back to the default', () => {
    const unset = { set: false, names: PEOPLE };
    assert.deepEqual(toggleWeekPerson(unset, PEOPLE, 'C'), ['A', 'B']);            // « seulement A et B »
    const ab = { set: true, names: ['A', 'B'] };
    assert.deepEqual(toggleWeekPerson(ab, PEOPLE, 'C'), []);                       // les trois : l'existant
    assert.deepEqual(toggleWeekPerson(ab, PEOPLE, 'A'), ['B']);
    assert.equal(toggleWeekPerson({ set: true, names: ['B'] }, PEOPLE, 'B'), null); // jamais une semaine sans personne
});

test('an onboarding can be rescheduled until it is done, no show and to reschedule included', () => {
    const base = { numero_client: 'n°12', rdv_onboarding_done: false };
    assert.equal(canRescheduleOnboarding({ ...base, rdv_onboarding_date: '2026-11-20T10:00:00' }), true);  // passé, no show
    assert.equal(canRescheduleOnboarding({ ...base, rdv_onboarding_date_manual: '2026-11-20' }), true);
    assert.equal(canRescheduleOnboarding({ ...base, onboarding_reschedule_pending: true }), true);         // à recaler, sans date
    assert.equal(canRescheduleOnboarding({ ...base, no_show: { day: '2026-11-20', by: 'x' } }), true);      // no show sans date
    assert.equal(canRescheduleOnboarding({ ...base }), false);                                              // jamais daté
    assert.equal(canRescheduleOnboarding({ ...base, rdv_onboarding_date: '2026-11-20', rdv_onboarding_done: true }), false);
    assert.equal(canRescheduleOnboarding({ rdv_onboarding_date: '2026-11-20' }), false);
    assert.equal(canRescheduleOnboarding(null), false);
});

test('a transfer whose calendars are not done yet says so in one line', () => {
    assert.equal(transferLeftCalendarsPending({ sync: 'assigned', calendars_done: true }), false);
    assert.equal(transferLeftCalendarsPending({ sync: 'error', calendars_done: false }), true);
    assert.equal(transferLeftCalendarsPending({ sync: 'assigned', calendars_done: false }), true);   // ancienne copie restée
    assert.equal(transferLeftCalendarsPending({ name: 'B', changed: false, copy: true }), false);     // même personne
});

test('an onboarding still at a removed person offers the colleagues of the week', () => {
    const week = { names: ['A', 'B'] };
    const info = weekMoveInfo({ numero_client: 'n°1', name: 'C' }, week, PEOPLE, true);
    assert.equal(billingLeader(info), 'C');
    assert.deepEqual(billingTargets(info), [{ name: 'A', offWeek: false, sameTime: false }, { name: 'B', offWeek: false, sameTime: false }]);
    assert.deepEqual(billingTargets(weekMoveInfo({ numero_client: 'n°1', name: 'C' }, week, PEOPLE, false)), []);  // lecture
    assert.deepEqual(billingTargets(weekMoveInfo({ numero_client: null, name: 'C' }, week, PEOPLE, true)), []);    // sans fiche
});
