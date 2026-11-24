import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dayLabel, freeKeys, hourLabel, isSoon, kindOf, mondayOf, rdvOf, originsOf, salesForSlot, slotLabel, slotOf, visibleLeads, weekDays,
  weekRows, withoutSlot,
} from './model.js';

test('le R1 se lit tel quel, sans conversion de fuseau', () => {
  assert.deepEqual(slotOf('2026-11-26T14:00:00Z'), { date: '2026-11-26', time: '14:00' });
  assert.deepEqual(slotOf('2026-11-24T09:30:00+00:00'), { date: '2026-11-24', time: '09:30' });
  assert.equal(slotOf(null), null);
  assert.equal(slotLabel(slotOf('2026-11-26T14:00:00Z')), 'jeu. 26/11 à 14 h');
  assert.equal(hourLabel('09:30'), '9 h 30');
  assert.equal(dayLabel('2026-11-24'), 'mar. 24/11');
});

test('la semaine part du lundi et ajoute le samedi seulement s’il a des créneaux', () => {
  assert.equal(mondayOf('2026-11-26'), '2026-11-23');
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
  assert.deepEqual(weekDays('2026-11-23', { days: [] }), ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
  assert.equal(weekDays('2026-11-23', { days: [{ date: '2026-11-28', slots: ['10:00'] }] }).length, 6);
});

test('les lignes de la grille sont les heures libres de la semaine et celles des repères', () => {
  const agenda = { days: [{ date: '2026-11-24', slots: ['10:00', '09:00'] }, { date: '2026-12-01', slots: ['08:00'] }] };
  const days = weekDays('2026-11-23', agenda);
  assert.deepEqual(weekRows(days, agenda, [{ date: '2026-11-26', time: '14:00' }, { date: '2026-12-02', time: '07:00' }]),
    ['09:00', '10:00', '14:00']);
  assert.ok(freeKeys(agenda).has('2026-11-24 10:00'));
  assert.ok(!freeKeys(withoutSlot(agenda, { date: '2026-11-24', time: '10:00' })).has('2026-11-24 10:00'));
});

test('la liste se filtre par vue, origine et recherche', () => {
  const leads = [
    { id: 1, full_name: 'Prospect Alpha', origin: 'Webinaire A', phone: '+33 6 00 22 33 00', r1_date: '2026-11-24T14:00:00Z' },
    { id: 2, full_name: 'Prospect Beta', origin: 'Webinaire B', r1_date: '2026-11-26T15:00:00Z' },
    { id: 3, full_name: 'Prospect Gamma', origin: 'Webinaire B', r1_date: '2026-11-25T16:00:00Z' },
  ];
  const free = { 1: ['a@x'], 2: [], 3: ['b@x'] };
  const ids = (opts) => visibleLeads(leads, { today: '2026-11-23', freeByLead: free, ...opts }).map((l) => l.id);
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ view: 'soon' }), [1]);
  assert.deepEqual(ids({ view: 'none' }), [2]);
  assert.deepEqual(ids({ origin: 'Webinaire B' }), [2, 3]);
  assert.deepEqual(ids({ query: 'alpha' }), [1]);
  assert.deepEqual(ids({ query: '22 33' }), [1]);
  assert.equal(isSoon(leads[1], '2026-11-23'), false);
  assert.deepEqual(originsOf(leads), [{ origin: 'Webinaire B', count: 2 }, { origin: 'Webinaire A', count: 1 }]);
});

test('les sales libres sur le créneau passent devant', () => {
  const agendas = [{ email: 'b@x', name: 'Bruno' }, { email: 'a@x', name: 'Alice' }, { email: 'c@x', name: 'Chloé' }];
  const { free, busy } = salesForSlot(agendas, ['c@x', 'b@x']);
  assert.deepEqual(free.map((a) => a.name), ['Bruno', 'Chloé']);
  assert.deepEqual(busy.map((a) => a.name), ['Alice']);
});

test('un R2 du webinaire se lit sur sa date de R2', () => {
  const r2 = { id: 9, r1_date: null, r2_date: '2026-11-24T14:00:00Z' };
  assert.equal(rdvOf(r2), '2026-11-24T14:00:00Z');
  assert.equal(kindOf(r2), 'R2');
  assert.equal(kindOf({ r1_date: '2026-11-25T10:00:00Z', r2_date: null }), 'R1');
  assert.equal(isSoon(r2, '2026-11-24'), true);
  assert.equal(isSoon({ r2_date: '2026-12-02T09:00:00Z' }, '2026-11-24'), false);
});
