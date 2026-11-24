import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SECTOR_OPTIONS, GENERIC_SECTOR, SECTOR_EDIT_ROLES, secteurLabel, canEditSector, autoSector, effectiveSector, isManualSector, sectorTargets, sectorBulkLine, sectorBulkFailure } from './boardSector.js';

test('la liste compte 15 secteurs, sans doublon, « Générales » (le défaut) en dernier', () => {
  assert.equal(SECTOR_OPTIONS.length, 15);
  assert.equal(new Set(SECTOR_OPTIONS).size, 15);
  assert.equal(SECTOR_OPTIONS.at(-1), GENERIC_SECTOR);
});

test('chaque secteur de la liste a son icône dessinée dans le board (sinon il retomberait sur l’immeuble « Générales »)', () => {
  const source = readFileSync(new URL('../pages/OptilexBoard.jsx', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('const SECTEUR_ICONS = {'), source.indexOf('export function SectorIcon'));
  for (const name of SECTOR_OPTIONS) assert.ok(block.includes(`"${name}": (`), `icône manquante : ${name}`);
});

test('seuls le Client Success, l’admin et le CEO précisent le secteur', () => {
  assert.deepEqual(SECTOR_EDIT_ROLES, ['customer_success_manager', 'admin', 'ceo']);
  for (const role of SECTOR_EDIT_ROLES) assert.equal(canEditSector(role, { numero: '12' }), true, role);
  for (const role of ['finance_team', 'finance_director', 'optilex', 'hr', 'marketing', 'sales', undefined]) assert.equal(canEditSector(role, { numero: '12' }), false, String(role));
});

test('pas de modification en lecture seule ni sans numéro client', () => {
  assert.equal(canEditSector('customer_success_manager', { numero: '12', readOnly: true }), false);
  assert.equal(canEditSector('customer_success_manager', { numero: null }), false);
  assert.equal(canEditSector('customer_success_manager'), false);
});

test('le secteur affiché : la valeur posée à la main prime sur la détection', () => {
  assert.equal(effectiveSector({ secteur_activite: 'Tech' }), 'Tech');
  assert.equal(effectiveSector({ secteur_activite: 'Générales', secteur_ovr: 'Dentiste' }), 'Dentiste');
  assert.equal(effectiveSector({ secteur_activite: 'Dentiste', secteur_auto: 'Générales', secteur_ovr: 'Dentiste' }), 'Dentiste');
  assert.equal(effectiveSector({ secteur_ovr: null, secteur_auto: 'BTP', secteur_activite: 'Dentiste' }), 'BTP', '« Automatique » : retour à la détection, même si secteur_activite est resté sur l’ancienne valeur');
  assert.equal(effectiveSector({}), '');
  assert.equal(effectiveSector(null), '');
});

test('le secteur détecté : secteur_auto quand le serveur le donne, sinon secteur_activite', () => {
  assert.equal(autoSector({ secteur_auto: 'Tech', secteur_activite: 'Dentiste' }), 'Tech');
  assert.equal(autoSector({ secteur_activite: 'Tech' }), 'Tech');
  assert.equal(autoSector({}), '');
});

test('« posé à la main » ne dépend que de la colonne secteur_ovr', () => {
  assert.equal(isManualSector({ secteur_ovr: 'Tech' }), true);
  assert.equal(isManualSector({ secteur_ovr: null, secteur_activite: 'Tech' }), false);
  assert.equal(isManualSector({ secteur_ovr: '' }), false);
});

test('l’orthographe de « Micro créche » est corrigée à l’affichage seulement', () => {
  assert.equal(secteurLabel('Micro créche'), 'Micro-crèche');
  assert.equal(secteurLabel('Tech'), 'Tech');
});

test('multi-sélection : changer un client coché change tous les cochés', () => {
  assert.deepEqual(sectorTargets('2', ['1', '2', '3']), ['1', '2', '3']);
  assert.deepEqual(sectorTargets('1', ['1', '2', '3']), ['1', '2', '3']);
});

test('multi-sélection : un client hors sélection ne change que lui', () => {
  assert.deepEqual(sectorTargets('9', ['1', '2', '3']), ['9']);
});

test('sans sélection, ou avec un seul coché, rien ne change : le client seul', () => {
  assert.deepEqual(sectorTargets('1', []), ['1']);
  assert.deepEqual(sectorTargets('1'), ['1']);
  assert.deepEqual(sectorTargets('1', ['1']), ['1']);
});

test('pendant une attribution de CSM (sélection figée), le client seul', () => {
  assert.deepEqual(sectorTargets('1', ['1', '2'], false), ['1']);
});

test('la sélection est dédoublonnée', () => {
  assert.deepEqual(sectorTargets('1', ['1', '2', '2', '1']), ['1', '2']);
});

test('textes du mode multi-sélection', () => {
  assert.equal(sectorBulkLine(4), 'S’applique aux 4 clients sélectionnés');
  assert.match(sectorBulkFailure(3, 3), /aucun des 3 clients/);
  assert.match(sectorBulkFailure(1, 4), /1 client sur 4 n’a pas pu/);
  assert.match(sectorBulkFailure(2, 4), /2 clients sur 4 n’ont pas pu/);
});
