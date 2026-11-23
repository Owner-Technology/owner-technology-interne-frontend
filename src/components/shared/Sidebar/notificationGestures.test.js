import test from "node:test";
import assert from "node:assert/strict";
import { applyGestures, covers, newestDate, timeOf } from "./notificationGestures.js";

const n = (id, created_at, read = false) => ({ id, created_at, read });
const LIST = [n("c", "2026-11-22T10:05:00"), n("b", "2026-11-22T10:00:00"), n("a", "2026-11-21T09:00:00", true)];

test("sans geste, la réponse du serveur passe telle quelle", () => {
  assert.deepEqual(applyGestures([], LIST, 2, 3), { list: LIST, unreadCount: 2, total: 3 });
});

test("retrait en attente : la notification ne revient pas, compteurs et total suivent", () => {
  const r = applyGestures([{ kind: "remove", ids: ["b"] }], LIST, 2, 3);
  assert.deepEqual(r.list.map((x) => x.id), ["c", "a"]);
  assert.equal(r.unreadCount, 1);
  assert.equal(r.total, 2);
});

test("retrait d'une notification déjà lue : le compteur de non lues ne bouge pas", () => {
  const r = applyGestures([{ kind: "remove", ids: ["a"] }], LIST, 2, 3);
  assert.equal(r.unreadCount, 2);
  assert.equal(r.total, 2);
});

test("lecture en attente : la notification reste affichée, lue", () => {
  const r = applyGestures([{ kind: "read", ids: ["c"] }], LIST, 2, 3);
  assert.equal(r.list.find((x) => x.id === "c").read, true);
  assert.equal(r.unreadCount, 1);
  assert.equal(r.total, 3);
});

test("tout lire : seules les notifications reçues jusqu'à la borne sont lues", () => {
  const late = n("d", "2026-11-22T10:06:00");
  const r = applyGestures([{ kind: "read", ids: "all", before: "2026-11-22T10:05:00" }], [late, ...LIST], 3, 4);
  assert.equal(r.list.find((x) => x.id === "d").read, false);
  assert.equal(r.list.find((x) => x.id === "c").read, true);
  assert.equal(r.unreadCount, 1);
});

test("tout lire sans borne connue : tout est lu", () => {
  const r = applyGestures([{ kind: "read", ids: "all" }], LIST, 2, 3);
  assert.equal(r.unreadCount, 0);
  assert.ok(r.list.every((x) => x.read));
});

test("gestes cumulés : un retrait en route puis une lecture en attente", () => {
  const r = applyGestures([{ kind: "remove", ids: ["c"] }, { kind: "read", ids: ["b"] }], LIST, 2, 3);
  assert.deepEqual(r.list.map((x) => [x.id, x.read]), [["b", true], ["a", true]]);
  assert.equal(r.unreadCount, 0);
  assert.equal(r.total, 2);
});

test("les compteurs ne passent jamais sous zéro", () => {
  const r = applyGestures([{ kind: "remove", ids: ["b", "c"] }], LIST, 1, 1);
  assert.equal(r.unreadCount, 0);
  assert.equal(r.total, 0);
});

test("dates : sans fuseau = UTC, avec fuseau respecté, formats mêlés comparés au temps près", () => {
  assert.equal(timeOf("2026-11-22T10:00:00"), Date.UTC(2026, 10, 22, 10, 0, 0));
  assert.equal(timeOf("2026-11-22T11:00:00+01:00"), Date.UTC(2026, 10, 22, 10, 0, 0));
  assert.ok(covers({ kind: "read", ids: "all", before: "2026-11-22T10:00:00Z" }, n("x", "2026-11-22T11:00:00.000+01:00")));
  assert.ok(!covers({ kind: "read", ids: "all", before: "2026-11-22T10:00:00Z" }, n("x", "2026-11-22T10:00:00.500Z")));
  assert.ok(Number.isNaN(timeOf(null)));
});

test("borne de « Tout marquer comme lu » : la plus récente des dates connues, dans le format du serveur", () => {
  assert.equal(newestDate(LIST), "2026-11-22T10:05:00");
  assert.equal(newestDate([n("x", "2026-11-22T11:30:00+01:00"), n("y", "2026-11-22T10:20:00Z")]), "2026-11-22T11:30:00+01:00");
  assert.equal(newestDate([]), null);
  assert.equal(newestDate([n("x", null)]), null);
});
