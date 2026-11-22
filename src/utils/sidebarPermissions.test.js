// Menu des tableaux de bord par rôle (audit du 22-23/11/2026) : un onglet ne s'affiche que pour un rôle que sa page laisse
// entrer. Mêmes identifiants que navigation/dashboardMenu.jsx (SIDEBAR_TABS).
import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleSections } from "./sidebarPermissions.js";
import { homeRouteFor } from "../navigation/home.js";

const ids = (list) => list.map((id) => ({ id, label: id }));
const SECTIONS = [
  { key: "recent", items: ids(["dashboard", "my_tracking_sheet"]) },
  { key: "human", items: ids(["conges", "variables", "work_hours"]) },
  { key: "acquisition", items: ids(["leads_dashboard", "perf_sales", "lead_quality", "leaderboard", "sales_team", "setters_stats", "acquisition_agenda",
    "sales_recordings", "webinar", "meta_ads", "campaigns", "funnel_leads", "leads_management", "small_leads", "autoassign", "sequences", "bot_ia"]) },
  { key: "finance", items: ids(["dispatch", "financial_analysis"]) },
  { key: "produit", items: ids(["optilex_board", "optilex_automation"]) },
];
const visible = (role) => getVisibleSections(SECTIONS, role).flatMap((s) => s.items.map((it) => it.id));

test("marketing : seulement les pages que leur garde lui ouvre (Webinaire, Meta Ads, Campagnes)", () => {
  assert.deepEqual(visible("marketing"), ["webinar", "meta_ads", "campaigns"]);
});

test("Absence et Heures de travail : direction, admin et RH seulement", () => {
  for (const role of ["ceo", "admin", "hr"]) {
    assert.ok(visible(role).includes("conges"), role);
    assert.ok(visible(role).includes("work_hours"), role);
  }
  for (const role of ["finance_director", "acquisition_director", "head_of_acquisition", "customer_success_manager", "marketing"]) {
    assert.ok(!visible(role).includes("conges"), role);
    assert.ok(!visible(role).includes("work_hours"), role);
  }
});

test("Campagnes : pas pour la direction de l'acquisition (sa page la refuse)", () => {
  assert.ok(!visible("acquisition_director").includes("campaigns"));
  for (const role of ["ceo", "admin", "marketing", "finance_director", "head_of_acquisition"]) assert.ok(visible(role).includes("campaigns"), role);
});

test("Client Success : Leaderboard, Sub Tickets et le board (Funnel Leads est retiré de tous les menus)", () => {
  assert.deepEqual(visible("customer_success_manager").sort(), ["bot_ia", "leaderboard", "optilex_board"]);
  for (const role of ["ceo", "admin", "customer_success_manager", "marketing"]) assert.ok(!visible(role).includes("funnel_leads"), role);
});

test("CEO et admin voient tout le menu, sauf les pages retirées des menus", () => {
  for (const role of ["ceo", "admin"]) {
    const v = visible(role);
    for (const id of ["dashboard", "conges", "work_hours", "campaigns", "meta_ads", "dispatch", "optilex_board", "financial_analysis"]) assert.ok(v.includes(id), `${role} ${id}`);
  }
});

test("une section vidée par le filtre ne s'affiche pas", () => {
  const keys = getVisibleSections(SECTIONS, "marketing").map((s) => s.key);
  assert.deepEqual(keys, ["acquisition"]);
});

test("page d'arrivée de chaque rôle", () => {
  const expected = {
    ceo: "/ceo", finance_director: "/ceo", hr: "/ceo", acquisition_director: "/acquisition-director", head_of_acquisition: "/acquisition-director",
    customer_success_manager: "/ceo/leaderboard", finance_team: "/tracking-finance", optilex: "/optilex-board",
    admin: "/", sales: "/", head_of_sales: "/", head_of_sales_manager: "/", setter: "/", setter_manager: "/", marketing: "/", tech: "/",
  };
  for (const [role, home] of Object.entries(expected)) assert.equal(homeRouteFor(role), home, role);
  assert.equal(homeRouteFor(undefined), "/");
  assert.equal(homeRouteFor("inconnu"), "/");
});
