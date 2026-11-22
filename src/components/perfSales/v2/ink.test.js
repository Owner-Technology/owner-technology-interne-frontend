import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA, INKS, OWNER, contrast, inkFor, luminance, mixHex, owner, parseColor, tokenHex } from './ink.js';
import { SOURCES } from './model.js';

// Encre des cases teintées (audit de lisibilité du 23/11/2026) : sur chaque teinte de canal, mélangée à la carte comme
// le fait la page, le chiffre reste à 4,5:1 au moins, en clair comme en sombre.

test('chaque canal, à 50, 70 et 90 % sur la carte, en clair et en sombre : encre à 4,5:1 au moins', () => {
  for (const dark of [false, true]) {
    for (const alpha of [0.5, 0.7, 0.9]) {
      for (const s of SOURCES) {
        const bg = mixHex(s.color, alpha, owner(dark).card);
        const ink = inkFor(bg);
        assert.ok(contrast(ink, bg) >= AA, `${s.key} ${alpha} ${dark ? 'sombre' : 'clair'} : ${ink} sur ${bg} = ${contrast(ink, bg).toFixed(2)}`);
      }
    }
  }
});

test('les cases réelles de la page : canaux de 16 à 90 %, anthracite de 10 à 90 %', () => {
  for (const dark of [false, true]) {
    const { card, navy } = owner(dark);
    for (let a = 10; a <= 90; a += 1) {
      for (const color of [navy, ...SOURCES.map((s) => s.color)]) {
        const bg = mixHex(color, a / 100, card);
        assert.ok(contrast(inkFor(bg), bg) >= AA, `${color} ${a} % ${dark ? 'sombre' : 'clair'}`);
      }
    }
  }
});

test('encre foncée sur blanc, encre claire sur la carte sombre', () => {
  assert.equal(inkFor('#ffffff'), INKS[0]);
  assert.equal(inkFor('#1f1f1f'), INKS[1]);
  assert.equal(inkFor('rgb(43, 41, 39)'), INKS[1]);
  // Encres propres à une page (Perf Setter en sombre) : la meilleure des deux.
  assert.equal(inkFor('#ededed', ['#141414', '#f2f2f2']), '#141414');
  // Fond moyen où aucune encre Owner n'atteint 4,5 : noir ou blanc pur.
  const mid = mixHex('#dedad3', 0.5, '#1f1f1f');
  assert.ok(INKS.every((ink) => contrast(ink, mid) < AA));
  assert.equal(inkFor(mid), '#000000');
});

test('mixHex suit color-mix(in srgb)', () => {
  assert.equal(mixHex('#000000', 0.5, '#ffffff'), '#808080');
  assert.equal(mixHex('#8fbdf3', 1, '#1f1f1f'), '#8fbdf3');
  assert.equal(mixHex('#8fbdf3', 0, '#1f1f1f'), '#1f1f1f');
  // 0,3 × (43, 41, 39) + 0,7 × 255 = (191,4 ; 190,8 ; 190,2) → bf bf be
  assert.equal(mixHex('#2b2927', 0.3, '#ffffff'), '#bfbfbe');
  assert.equal(mixHex('#fff', 0.25, '#000'), '#404040');
});

test('lecture des couleurs et contraste WCAG', () => {
  assert.deepEqual(parseColor('#abc'), [170, 187, 204]);
  assert.deepEqual(parseColor('rgb(217, 84, 77)'), [217, 84, 77]);
  assert.equal(parseColor('var(--navy)'), null);
  assert.equal(luminance('#ffffff'), 1);
  assert.equal(luminance('#000000'), 0);
  assert.equal(Number(contrast('#000000', '#ffffff').toFixed(2)), 21);
  assert.equal(contrast('#777777', '#ffffff'), contrast('#ffffff', '#777777'));
});

test('tokenHex : jetons résolus selon le mode, couleurs en clair inchangées', () => {
  assert.equal(tokenHex('var(--navy)', false), '#2b2927');
  assert.equal(tokenHex('var(--navy)', true), '#ededed');
  assert.equal(tokenHex('#1f9d57', true), '#1f9d57');
});

// Les valeurs de ink.js recopient owner.css : une retouche des jetons d'un côté sans l'autre fait échouer ce test.
test('OWNER et INKS suivent les jetons de owner.css', () => {
  const css = readFileSync(new URL('./owner.css', import.meta.url), 'utf8');
  const block = (selector) => css.slice(css.indexOf(`${selector} {`), css.indexOf('}', css.indexOf(`${selector} {`)));
  const token = (text, name) => new RegExp(`${name}:\\s*(#[0-9a-f]{3,6})`, 'i').exec(text)?.[1].toLowerCase();
  const light = block('body:has(.ps2-owner) .ps2'), dark = block('body:has(.ps2-owner) .ps2.is-dark');
  assert.equal(token(light, '--card'), OWNER.light.card);
  assert.equal(token(light, '--navy'), OWNER.light.navy);
  assert.equal(token(dark, '--card'), OWNER.dark.card);
  assert.equal(token(dark, '--navy'), OWNER.dark.navy);
  assert.equal(token(light, '--ink'), INKS[0]);
});

test('fond illisible (jeton CSS, couleur absente) : pas d’encre imposée, pas d’erreur', () => {
  assert.equal(inkFor('var(--navy)'), undefined);
  assert.equal(inkFor(undefined), undefined);
  assert.equal(mixHex('var(--navy)', 0.5, '#ffffff'), 'var(--navy)');
});
