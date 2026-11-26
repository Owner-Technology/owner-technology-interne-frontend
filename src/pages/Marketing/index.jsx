import { WEBINAR_CAMPAIGNS, acquisitionPeriod, withAcquisition } from './acquisition';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { EASE, ITEM, Reveal, reducedMotion } from '../../components/perfSales/motion.jsx';
import { RefreshButton } from '../TrackingSheetFinance/components/PageKit.jsx';
import './webinar.css';
import apiClient from '../../services/apiClient';
import { homeRouteFor } from '../../navigation/home.js';
import SharedNavbar from '../../components/SharedNavbar.jsx';

import { buildOwnerTheme, fmtInt, fmtPct } from './theme';
import DateRangePicker from './components/DateRangePicker';
import SourceFilter from './components/SourceFilter';
import PartialDataBanner from './components/PartialDataBanner';
import HeroKpiStrip from './components/HeroKpiStrip';
import SourceBreakdown from './components/SourceBreakdown';
import TrafficChart from './components/TrafficChart';
import EmailEngagement from './components/EmailEngagement';
import CampaignCard from './components/CampaignCard';
import NurtureTable from './components/NurtureTable';
import LeadsPipeline from './components/LeadsPipeline';
import SatisfactionGauge from './components/SatisfactionGauge';
import Heatmap from './components/Heatmap';
import BudgetEditor from './components/BudgetEditor';
import { READ_ONLY_DIRECTION_ROLES } from '../../utils/readOnlyRoles.js';
import BudgetByDayChart from './components/BudgetByDayChart';
import SalesWebinarRanking from './components/SalesWebinarRanking';
import SalesWebinarRankingCompact from './components/SalesWebinarRankingCompact';
import RdvBySourceDonut from './components/RdvBySourceDonut';
import LiveQualitySection from './components/LiveQualitySection';
import WebinarLiveReplay from './components/WebinarLiveReplay';
import { WEBINAR_REPLAY } from './data/webinarReplay';

// Les rôles en lecture seule (RH) consultent la page ; les budgets leur restent en lecture (ROLES_WITH_BUDGET_EDIT).
const ALLOWED_ROLES = ['admin', 'ceo', 'marketing', 'acquisition_director', 'head_of_acquisition', 'finance_director', ...READ_ONLY_DIRECTION_ROLES];
// Édition des budgets réservée à Timothy (marketing) + admin (debug/safety).
// CEO/AcqDir/head_of_acquisition voient le BudgetEditor en lecture seule.
const ROLES_WITH_BUDGET_EDIT = ['admin', 'marketing'];

// Slug par défaut quand l'URL ne précise pas `?webinar=` — c'est la cohorte
// historique 26 mai, dont les chiffres sont figés. Le dropdown header
// expose maintenant les autres cohortes (multi-webinaire 2026-06-04).
const DEFAULT_WEBINAR_ID = 'webinar-2026-05-26';

// Cohorte qui possède les campagnes one-shot SPÉCIFIQUES 26 mai (post-missed,
// postponement, broad) côté landing. Ces endpoints ne sont PAS paramétrés par
// webinaire : sur une autre cohorte ils retourneraient quand même la data
// 26 mai sous un header différent = trompeur. On les garde donc 26-mai-only.
const COHORT_WITH_CAMPAIGNS = 'webinar-2026-05-26';

// Cohortes qui possèdent une séquence post-webinaire (NurtureTable). Contrairement
// aux one-shots ci-dessus, l'endpoint post-nurture est cohorte-aware côté landing :
// chaque cohorte de ce set renvoie ses propres chiffres. On y ajoute une cohorte
// dès que sa séquence est déployée côté landing.
const COHORTS_WITH_NURTURE = new Set([
  'webinar-2026-05-26',
  'webinar-2026-06-22',
  'webinar-2026-07-20',
  'webinar-2026-09-07',
  'webinar-2026-09-21',
  'webinar-2026-10-22',
  'webinar-2026-11-24',
]);

// Webinaires déplacés : l'ancien identifiant (liens enregistrés, onglet resté ouvert) mène à la cohorte qui le remplace.
const MOVED_WEBINARS = {
  'webinar-2026-11-17': 'webinar-2026-11-24',
};

function readWebinarFromUrl() {
  try {
    const v = new URLSearchParams(window.location.search).get('webinar');
    return v && /^webinar-\d{4}-\d{2}-\d{2}$/.test(v) ? (MOVED_WEBINARS[v] || v) : DEFAULT_WEBINAR_ID;
  } catch {
    return DEFAULT_WEBINAR_ID;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function sevenDaysAgoIso() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Marketing dashboard — mirrors `https://webinaire.ownertechnology.com/admin`
 * for the internal CRM. Renders inside the existing SharedNavbar layout,
 * gates auth at `admin | ceo | marketing` roles, polls the 4 campaign
 * endpoints, gracefully handles `_partial: true` from the overview
 * aggregator.
 *
 * Visual references : src/assets/marketing/*.jpg (5 SaaS dashboard mockups).
 */
export default function Marketing() {
  const navigate = useNavigate();

  // ── Embed mode (rendered inside a Ceo* wrapper sidebar shell) ────
  // Quand `?embed=true` est posé dans l'URL (par CeoWebinarView via
  // history.replaceState), on masque le SharedNavbar interne et on
  // réduit le padding-top, le wrapper se chargeant déjà du chrome.
  const embedMode = useMemo(
    () => new URLSearchParams(window.location.search).get('embed') === 'true',
    []
  );

  // ── Webinar selection (multi-cohorte 2026-06-04) ─────────────────
  // L'URL `?webinar=<slug>` détermine la cohorte affichée. Fallback sur
  // webinar-2026-05-26 si pas de param (rétro-compat avec les bookmarks
  // existants). Switch via dropdown header → URL replaceState (préserve
  // `?embed=true`) + refetch overview/realtimeLeads.
  const [webinarId, setWebinarId] = useState(readWebinarFromUrl);
  const handleWebinarChange = useCallback((nextId) => {
    if (!nextId || nextId === webinarId) return;
    setWebinarId(nextId);
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('webinar', nextId);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // history API indisponible → state-only update, deep-link perdu
      // mais l'UI fonctionne.
    }
  }, [webinarId]);

  // ── Dark mode (kept consistent with the rest of the app) ─────────
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.classList.toggle('dark-mode', darkMode);
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);
  const C = useMemo(() => buildOwnerTheme(darkMode), [darkMode]);

  // ── Auth + role gate ─────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    // Aligné sur le pattern CeoDashboard et autres pages du CRM : on check
    // uniquement la présence du user et son role. L'apiClient gère lui-même
    // les 401 sur les requêtes (refresh token, redirect login si nécessaire).
    const user = apiClient.getUser();
    // Audit du 23/11/2026 : un rôle que cette page refuse revient à sa page d'arrivée (l'écran de connexion faisait croire à une déconnexion).
    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      navigate(user ? homeRouteFor(user.role) : '/login', { replace: true });
      return;
    }
    setUserRole(user.role);
    setSession({
      user: {
        email: user.email,
        user_metadata: { name: user.name, avatar_url: user.avatar_url || null },
      },
    });
    setAuthReady(true);
  }, [navigate]);

  // ── Filters ──────────────────────────────────────────────────────
  // Default = 'all' (vue globale depuis le début de la campagne webinaire).
  // Le webinaire 26 mai est terminé : ouvrir la page avec un range étroit
  // (7j glissant) montrerait surtout du vide. La vue globale donne d'emblée
  // les chiffres totaux (315 inscrits, 942 emails J-day, etc.).
  const [preset, setPreset] = useState('all');
  const [customFrom, setCustomFrom] = useState(sevenDaysAgoIso());
  const [customTo, setCustomTo] = useState(todayIso());
  const [source, setSource] = useState('all');

  // ── Webinar meta (multi-cohorte) ─────────────────────────────────
  // Déclaré ICI (avant queryString) car `queryString` lit `webinar.date_start`
  // pour calculer la fenêtre du preset "Webinaire complet". Bouger
  // ce bloc plus bas → ReferenceError TDZ sur la dep `webinar` de queryString.
  const [webinarsList, setWebinarsList] = useState([]);
  const webinar = useMemo(
    () => webinarsList.find((w) => w.id === webinarId) || webinarsList[0] || null,
    [webinarsList, webinarId]
  );

  // Borne basse historique de la vue "Global" si jamais le webinaire courant
  // n'a pas de `date_start` exposé (ancien backend ou cohorte non encore
  // référencée dans `_STATIC_WEBINARS`). À jour, chaque webinaire fournit
  // ses propres dates → séparation cohorte propre côté budgets/CPL.
  const GLOBAL_FROM_FALLBACK = '2026-04-01';

  const queryString = useCallback(() => {
    const parts = [];
    if (preset === 'custom') {
      parts.push(`from=${encodeURIComponent(customFrom)}`);
      parts.push(`to=${encodeURIComponent(customTo)}`);
    } else if (preset === 'all') {
      // 'Webinaire complet' = on couvre la fenêtre d'activité de la cohorte
      // sélectionnée. Si la cohorte expose `date_start/date_end` (via
      // `_STATIC_WEBINARS`), on les utilise → vue 22 juin = budgets 5 juin-
      // 6 juillet, vue 26 mai = budgets 1 avr-4 juin, zéro chevauchement.
      // Fallback sur GLOBAL_FROM_FALLBACK → today pour rétrocompat.
      const from = webinar?.date_start || GLOBAL_FROM_FALLBACK;
      // Clamp `to` à `today` pour ne pas demander des dates futures (la
      // landing n'a pas de budget côté demain).
      const today = todayIso();
      const to = webinar?.date_end && webinar.date_end < today ? webinar.date_end : today;
      parts.push(`from=${encodeURIComponent(from)}`);
      parts.push(`to=${encodeURIComponent(to)}`);
    } else {
      parts.push(`range=${preset}`);
    }
    if (source !== 'all') parts.push(`source=${source}`);
    return parts.join('&');
  }, [preset, customFrom, customTo, source, webinar]);

  // ── Overview fetch (aggregator) ──────────────────────────────────
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  // Ref pointant toujours sur le `webinarId` courant. Sert de garde
  // anti-stale : si on change vite de webinaire, une réponse en vol pour
  // l'ancien webinaire ne doit pas écraser la data du nouveau.
  const webinarIdRef = useRef(webinarId);
  useEffect(() => { webinarIdRef.current = webinarId; }, [webinarId]);

  const overviewRequestRef = useRef(0);
  // `quiet` : le rafraîchissement automatique de 60 s ne grise pas la page (refonte du 26/11/2026) ; un changement de
  // filtre, de cohorte ou « Actualiser » montre le chargement.
  const loadOverview = useCallback(async ({ quiet = false } = {}) => {
    const requestId = ++overviewRequestRef.current;
    const requestedWebinarId = webinarId;
    if (!quiet) setOverviewLoading(true);
    try {
      const qs = queryString();
      const json = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/overview?${qs}`);
      // Ignore une réponse obsolète : l'utilisateur a déjà switché de
      // webinaire entre le départ du fetch et son retour.
      if (webinarIdRef.current !== requestedWebinarId || overviewRequestRef.current !== requestId) return;
      let enriched = json;
      if (WEBINAR_CAMPAIGNS[requestedWebinarId] && json?.stats?.summary) {
        const period = acquisitionPeriod(json.stats, webinar);
        let meta = null;
        try {
          if (period && period.since <= period.until) {
            const params = new URLSearchParams({ level: 'campaign', ...period });
            meta = await apiClient.get(`/api/v1/marketing/meta-ads?${params}`);
          } else if (period) {
            meta = { ...period, rows: [] };
          }
        } catch {
          // Keep the rest of the dashboard usable; unavailable is not zero.
        }
        enriched = { ...json, stats: withAcquisition(json.stats, requestedWebinarId, period, meta) };
      }
      if (webinarIdRef.current !== requestedWebinarId || overviewRequestRef.current !== requestId) return;
      setOverview(enriched);
      setOverviewError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      if (webinarIdRef.current !== requestedWebinarId || overviewRequestRef.current !== requestId) return;
      setOverviewError(e?.message || 'Erreur de chargement');
    } finally {
      if (webinarIdRef.current === requestedWebinarId && overviewRequestRef.current === requestId) setOverviewLoading(false);
    }
  }, [queryString, webinarId, webinar]);

  // Premier fetch + refetch sur changement de filtres / webinarId.
  // Garde anti-race : on attend que `webinarsList` soit chargée pour que
  // `webinar.date_start/date_end` (utilisés par queryString) soient résolus.
  // Sans cette garde, le 1er fetch part avec `GLOBAL_FROM_FALLBACK` =
  // 2026-04-01 → la landing retourne le budget 26 mai sur la vue 22 juin
  // (budgets côté landing filtrent par date pas par cohorte).
  useEffect(() => {
    if (!authReady) return;
    if (webinarsList.length === 0) return;
    void loadOverview();
  }, [authReady, loadOverview, webinarsList.length]);

  // Polling auto 60s pour suivre l'arrivée des leads en live (cohorte en
  // cours type 22 juin). Pause quand l'onglet n'est pas visible pour
  // économiser les appels (pattern aligné sur useCampaignPolling).
  // Ref stockant la dernière `loadOverview` (closure stable indépendante
  // du intervalle, évite re-bind à chaque re-render).
  const loadOverviewRef = useRef(loadOverview);
  useEffect(() => { loadOverviewRef.current = loadOverview; }, [loadOverview]);
  useEffect(() => {
    if (!authReady) return undefined;
    // Idem garde anti-race : ne démarrer le polling qu'après webinarsList
    // chargée (sinon polling fetch avec mauvaise fenêtre date).
    if (webinarsList.length === 0) return undefined;
    let timer = null;
    const start = () => {
      if (timer || document.hidden) return;
      timer = setInterval(() => { void loadOverviewRef.current({ quiet: true }); }, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [authReady, webinarsList.length]);

  // ── Realtime leads (Supabase leads_realtime) ─────────────────────
  // Source pour les tiles "Présents au live" + "Rendez-vous pris" + le
  // composant "Classement sales webinaire". Refetch à chaque mount /
  // changement de filtres pertinents — la donnée est cachée 60s côté
  // backend, donc plusieurs onglets ouverts ne flood pas Supabase.
  const [realtimeLeads, setRealtimeLeads] = useState(null);
  const fetchRealtimeLeads = useCallback(async () => {
    const requestedWebinarId = webinarId;
    try {
      const json = await apiClient.get(`/api/v1/marketing/webinars/${webinarId}/realtime-leads`);
      // Garde anti-stale alignée sur loadOverview : ne pas repeupler le
      // hero avec la data realtime d'un webinaire qu'on a déjà quitté.
      if (webinarIdRef.current !== requestedWebinarId) return;
      setRealtimeLeads(json);
    } catch {
      // Silencieux — les tiles tomberont sur leur fallback "—"
    }
  }, [webinarId]);

  // Refetch immédiat au mount et sur changement de webinarId.
  useEffect(() => {
    if (!authReady) return;
    void fetchRealtimeLeads();
  }, [authReady, fetchRealtimeLeads]);

  // Polling auto 60s — aligné sur TTL_REALTIME_LEADS backend = 60s. Pause
  // si l'onglet n'est pas visible. Mêmes garde-fous que loadOverview.
  const fetchRealtimeRef = useRef(fetchRealtimeLeads);
  useEffect(() => { fetchRealtimeRef.current = fetchRealtimeLeads; }, [fetchRealtimeLeads]);
  useEffect(() => {
    if (!authReady) return undefined;
    let timer = null;
    const start = () => {
      if (timer || document.hidden) return;
      timer = setInterval(() => { void fetchRealtimeRef.current(); }, 60000);
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
    };
    const onVis = () => { document.hidden ? stop() : start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [authReady]);

  // ── Webinar list fetch (état déclaré plus haut près de `webinar`) ──
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await apiClient.get('/api/v1/marketing/webinars');
        const list = Array.isArray(json?.webinars) ? json.webinars : (Array.isArray(json) ? json : []);
        if (!cancelled) setWebinarsList(list);
      } catch {
        // Non-blocking — the hero card falls back to defaults
      }
    })();
    return () => { cancelled = true; };
  }, [authReady]);

  // ── Reset data on webinar switch (skeleton replay) ───────────────
  // Quand l'utilisateur change de cohorte via le sélecteur, `overview` et
  // `realtimeLeads` contiennent encore la data du webinaire précédent →
  // `initialLoading` resterait `false` et on verrait brièvement les
  // chiffres de l'ancien webinaire sous le nouveau titre. On remet donc
  // les deux à `null` AU SEUL changement de `webinarId` : `initialLoading`
  // redevient `true` le temps que la nouvelle data arrive (skeleton), puis
  // le crossfade existant prend le relais.
  //
  // ⚠️ Cet effet dépend UNIQUEMENT de `webinarId` : il ne se déclenche
  // jamais sur le poll 60s (qui ne touche pas `webinarId`) ni sur un
  // changement de filtre date/source (idem) → aucun clignotement de
  // skeleton sur le refresh périodique. On skip le tout premier run (mount)
  // via une ref : `overview`/`realtimeLeads` sont déjà `null` à ce stade,
  // un reset y serait inutile et le fetch initial gère déjà le skeleton.
  const didMountWebinarReset = useRef(false);
  useEffect(() => {
    if (!didMountWebinarReset.current) {
      didMountWebinarReset.current = true;
      return;
    }
    setOverview(null);
    setRealtimeLeads(null);
  }, [webinarId]);

  // ── Initial-load flag (skeletons) ────────────────────────────────
  // `initialLoading` n'est vrai QUE tant qu'aucun overview n'a jamais été
  // chargé ET qu'un fetch est en cours. Dès que `overview` est peuplé une
  // 1re fois, `!overview` devient false définitivement → les refetch du
  // poll 60s gardent `initialLoading` à false : ils n'affichent JAMAIS de
  // skeleton plein écran, le contenu réel reste visible pendant le refresh
  // (seul l'indicateur d'opacité existant sur les tiles du hero bouge).
  // C'est la garde centrale qui distingue "1er chargement" de "refetch".
  const initialLoading = !overview && overviewLoading;

  // ── Derived data ─────────────────────────────────────────────────
  const stats = overview?.stats || null;
  const leads = overview?.leads?.leads || [];
  const scoresByLeadId = useMemo(() => {
    // Built fresh from the overview payload — wrapping the source in
    // the memo callback avoids the "new array reference every render"
    // dependency trap that ESLint flags.
    const list = overview?.leadScores?.scores || [];
    const m = new Map();
    for (const s of list) m.set(s.lead_id, s);
    return m;
  }, [overview?.leadScores?.scores]);

  const summary = stats?.summary;
  const pageviews = stats?.timeseries?.pageviews || [];
  const leadsByDay = stats?.timeseries?.leadsByDay || [];
  const budgetByDay = stats?.timeseries?.budgetByDay || [];
  const emailEngagement = stats?.emailEngagement || [];

  // Partial errors flag
  const partialErrors = overview?._partial ? (overview?._errors || []) : [];

  // Filtered leads when source changes — we always pass `source` to the
  // backend so the leads array is already filtered. The SourceFilter
  // below just triggers a refetch.
  const filteredLeads = leads;

  // ── Source filter handler — triggers refetch via queryString change ──
  const handleSourceChange = (next) => {
    setSource(next);
    // useEffect above re-runs loadOverview when queryString deps change
  };

  // ── Render ───────────────────────────────────────────────────────
  // Refonte du 26/11/2026 sur le langage de Finance → Statistiques (docs/STYLE-OWNER.md) : un en-tête avec la cohorte
  // et la période, une barre de sections collée en haut, puis six rubriques dans l'ordre de lecture d'un webinaire
  // (vue d'ensemble, live, acquisition, e-mails, sales, prospects). Mêmes données, mêmes appels, mêmes règles d'affichage.
  if (!authReady) {
    return (
      <div className="wb-boot" style={{ background: C.backdrop, color: C.muted }}>
        Chargement…
      </div>
    );
  }

  const canEditBudgets = ROLES_WITH_BUDGET_EDIT.includes(userRole) || userRole === 'admin';
  const hasLive = Boolean(realtimeLeads?.live_quality?.available || WEBINAR_REPLAY[webinarId]);
  const sections = SECTIONS.filter((section) => section.key !== 'live' || hasLive);
  // Un changement de filtre ou de cohorte garde les chiffres précédents à l'écran, estompés, le temps de la réponse.
  const refreshing = overviewLoading && Boolean(overview);
  const presetLabel = PRESET_LABELS[preset] || '';
  const periodText = preset === 'custom' ? `${fmtDay(customFrom)} → ${fmtDay(customTo)}` : presetLabel;

  return (
    <MotionConfig reducedMotion="user">
      <div className={`wb-root fst-root fst-embed${C.dark ? ' is-dark' : ''}`} style={{ background: C.backdrop, color: C.text }}>
        {!embedMode && (
          <SharedNavbar session={session} darkMode={darkMode} setDarkMode={setDarkMode} />
        )}

        <div className="wb-wrap" style={{ paddingTop: embedMode ? 10 : 84 }}>
          {/* ── EN-TÊTE ── */}
          <motion.header
            className="wb-head"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <div className="wb-head-top">
              <div style={{ minWidth: 0 }}>
                <span className="fst-micro">Marketing · Owner Technology</span>
                <h1 className="wb-title">Performance webinaire</h1>
                <p className="wb-sub">KPIs landing, séquence emailing et pipeline prospects, cohorte par cohorte.</p>
              </div>
              <div className="wb-head-actions">
                {webinarsList.length > 1 && (
                  <WebinarSelector webinars={webinarsList} value={webinarId} onChange={handleWebinarChange} />
                )}
                <RefreshButton
                  busy={overviewLoading}
                  onClick={() => { void loadOverview(); void fetchRealtimeLeads(); }}
                />
              </div>
            </div>
            <div className="wb-head-bottom">
              <DateRangePicker
                preset={preset}
                customFrom={customFrom}
                customTo={customTo}
                onChange={(next) => {
                  setPreset(next.preset);
                  setCustomFrom(next.customFrom);
                  setCustomTo(next.customTo);
                }}
                C={C}
              />
              <LiveStatus updatedAt={updatedAt} busy={overviewLoading} error={Boolean(overviewError)} />
            </div>
          </motion.header>

          {/* ── SECTIONS (collée en haut) ── */}
          <SectionNav sections={sections} context={`${webinar?.title || 'Webinaire'} · ${periodText}`} busy={overviewLoading} />

          {/* ── DONNÉES PARTIELLES ── */}
          <AnimatePresence initial={false}>
            {partialErrors.length > 0 && (
              <motion.div key="partial" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: 'hidden' }}>
                <PartialDataBanner errors={partialErrors} C={C} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── ÉCHEC COMPLET ── */}
          {overviewError && !overview && (
            <div className="fst-error wb-fail" role="alert">
              <span><b>Les chiffres de la landing n'ont pas pu être chargés.</b> {overviewError}</span>
              <button type="button" onClick={() => loadOverview()}>Réessayer</button>
            </div>
          )}

          {/* ── VUE D'ENSEMBLE ── */}
          <Section id="overview" title="Vue d'ensemble" hint="Les inscrits de la cohorte, ce qu'ils deviennent, et les chiffres qui comptent." stale={refreshing}>
            <HeroKpiStrip
              webinar={webinar}
              summary={summary}
              realtimeLeads={realtimeLeads}
              rankingPanel={<SalesWebinarRankingCompact data={realtimeLeads} C={C} webinarId={webinarId} />}
              donutPanel={<RdvBySourceDonut data={realtimeLeads} C={C} />}
              C={C}
              loading={overviewLoading && !summary}
            />
          </Section>

          {/* ── LIVE : qualité de présence (rapport Zoom) et analyse du replay ── */}
          {hasLive && (
            <Section id="live" title="Le live" hint="Qui est resté, combien de temps, et ce qui s'est dit pendant le webinaire.">
              {realtimeLeads?.live_quality?.available && <LiveQualitySection realtimeLeads={realtimeLeads} C={C} />}
              {WEBINAR_REPLAY[webinarId] && <WebinarLiveReplay data={WEBINAR_REPLAY[webinarId]} C={C} />}
            </Section>
          )}

          {/* ── ACQUISITION ── */}
          <Section id="acquisition" title="Acquisition" hint="D'où viennent les inscrits, jour par jour, et ce qu'ils coûtent." stale={refreshing}>
            {(summary || initialLoading) && <SourceBreakdown summary={summary} C={C} loading={initialLoading} />}
            <TrafficChart
              pageviews={pageviews}
              leadsByDay={leadsByDay}
              budgetByDay={budgetByDay}
              budgetAvailable={stats?.metaDailyBudgetAvailable !== false}
              C={C}
              darkMode={darkMode}
              loading={initialLoading}
            />
            <div className={`wb-grid is-heat${stats?.metaDailyBudgetAvailable !== false ? '' : ' is-single'}`}>
              {stats?.metaDailyBudgetAvailable !== false && <BudgetByDayChart budgetByDay={budgetByDay} C={C} darkMode={darkMode} loading={initialLoading} />}
              <Heatmap leads={leads} C={C} loading={initialLoading} />
            </div>
            {/* Saisie manuelle uniquement pour les cohortes sans dépenses Meta. */}
            {summary?.budgetSource !== 'meta' && (
              <BudgetEditor
                webinarId={webinarId}
                C={C}
                onChange={loadOverview}
                readOnly={!canEditBudgets}
                dateFrom={webinar?.date_start}
                dateTo={webinar?.date_end}
              />
            )}
          </Section>

          {/* ── E-MAILS ── */}
          <Section id="emails" title="E-mails" hint="La séquence avant le live, puis les relances, e-mail par e-mail." stale={refreshing}>
            <div className="wb-grid is-mail">
              <SatisfactionGauge score={summary?.globalOpenRatePct} C={C} loading={initialLoading} />
              <EmailEngagement rows={emailEngagement} C={C} loading={initialLoading} />
            </div>

            {/* Campagnes ciblées : masquées hors cohorte 26 mai — leurs 4 endpoints côté landing ne sont PAS paramétrés
                par webinaire et retourneraient les chiffres du 26 mai sous un autre titre. */}
            {webinarId === COHORT_WITH_CAMPAIGNS && (
              <>
                <SubHead title="Campagnes ciblées" />
                <CampaignCard
                  webinarId={webinarId}
                  kind="post-missed"
                  title="Relance post-webinaire · pas venus + pas de RDV"
                  subtitle="Séquence 4 jours pour les inscrits qui n'ont pas pris de RDV"
                  intervalMs={15000}
                  progressColor={C.heroEmerald}
                  C={C}
                />
                <CampaignCard
                  webinarId={webinarId}
                  kind="postponement"
                  title="Campagne décalage 26 mai · notification one-shot"
                  subtitle="Email envoyé à tous les inscrits pour annoncer le décalage"
                  intervalMs={15000}
                  progressColor={C.heroEmerald}
                  C={C}
                />
                <CampaignCard
                  webinarId={webinarId}
                  kind="broad"
                  title="Campagne Broad invite · cold outreach (CSV)"
                  subtitle="Invitation aux anciens prospects via /broad"
                  intervalMs={30000}
                  progressColor={C.amber.strong}
                  C={C}
                  // Cold outreach Resend sans pixel → pas de tracking ouverture/clic ni feedback bounce/plainte
                  // exploitable. On garde uniquement Délivrés + Inscrits via /broad.
                  excludeTiles={['opened', 'clicked', 'bounced', 'complained']}
                  // Campagne one-shot massive : drain horaire pas exploitable.
                  hideSentByHour
                  extraTiles={(data, T) => [
                    <BroadInscritsTile key="inscrits" data={data} C={T} />,
                  ]}
                />
              </>
            )}

            {/* Séquences post-webinaire : l'endpoint post-nurture est cohorte-aware côté landing. */}
            {COHORTS_WITH_NURTURE.has(webinarId) && (
              <>
                <SubHead title="Séquences post-webinaire" />
                <NurtureTable webinarId={webinarId} C={C} />
              </>
            )}
          </Section>

          {/* ── SALES ── */}
          <Section id="sales" title="Sales" hint="Ce que chaque sales a fait des rendez-vous de la cohorte.">
            <SalesWebinarRanking data={realtimeLeads} C={C} />
          </Section>

          {/* ── PROSPECTS ── */}
          <Section id="prospects" title="Prospects" hint="Chaque inscrit, sa source, son engagement et où il en est de la séquence." stale={refreshing}>
            <LeadsPipeline
              leads={filteredLeads}
              scoresByLeadId={scoresByLeadId}
              C={C}
              loading={initialLoading}
              sourceFilter={<SourceFilter value={source} onChange={handleSourceChange} C={C} />}
            />
          </Section>

          <footer className="wb-foot">
            Owner Technology · Marketing interne · Données Plausible + Postgres via api-owner
          </footer>
        </div>
      </div>
    </MotionConfig>
  );
}

// Rubriques de la page, dans l'ordre de lecture ; « Le live » n'apparaît que si la cohorte a un rapport Zoom ou un replay.
const SECTIONS = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'live', label: 'Live' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'emails', label: 'E-mails' },
  { key: 'sales', label: 'Sales' },
  { key: 'prospects', label: 'Prospects' },
];
const PRESET_LABELS = { all: 'Webinaire complet', day: 'Jour', '7d': '7 jours', '30d': '30 jours', month: 'Ce mois', custom: 'Personnalisé' };
const fmtDay = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

/** Une rubrique : titre, phrase d'indice, puis ses cartes qui arrivent en cascade à l'entrée dans l'écran. Pendant un
 *  changement de filtre, ses chiffres restent visibles mais estompés (`stale`). */
function Section({ id, title, hint, stale = false, children }) {
  return (
    <section id={`wb-${id}`} className="wb-section" data-stale={stale || undefined} aria-busy={stale || undefined}>
      <header className="wb-section-head">
        <h2 className="wb-section-title">{title}</h2>
        {hint && <p className="wb-section-hint">{hint}</p>}
      </header>
      <Reveal className="wb-section-body" stagger={0.06} amount={0.04}>
        {children}
      </Reveal>
    </section>
  );
}

/** Intertitre à l'intérieur d'une rubrique, avec le repère « suivi en direct » des envois. */
function SubHead({ title }) {
  return (
    <motion.div variants={ITEM} className="wb-subhead">
      <h3>{title}</h3>
      <span className="wb-live-chip"><i aria-hidden="true" />Suivi en direct</span>
    </motion.div>
  );
}

/** Barre des rubriques, collée en haut : le pouce suit la rubrique lue ; un clic y descend en douceur. À droite, la
 *  cohorte et la période en cours restent lisibles pendant la lecture, avec un filet qui file pendant un chargement. */
function SectionNav({ sections, context, busy }) {
  const [active, setActive] = useState(sections[0]?.key);
  const keys = sections.map((section) => section.key).join(',');
  useEffect(() => {
    const ids = keys.split(',');
    const pick = () => {
      // La rubrique lue est la dernière dont le haut a passé la barre (172 px depuis le haut de la fenêtre).
      let current = ids[0];
      for (const key of ids) {
        const el = document.getElementById(`wb-${key}`);
        if (el && el.getBoundingClientRect().top <= 172) current = key;
      }
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActive(atEnd ? ids[ids.length - 1] : current);
    };
    pick();
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);
    return () => { window.removeEventListener('scroll', pick); window.removeEventListener('resize', pick); };
  }, [keys]);
  const go = (key) => {
    const el = document.getElementById(`wb-${key}`);
    if (!el) return;
    setActive(key);
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  return (
    <nav className="wb-nav" aria-label="Rubriques de la page">
      <div className="wb-nav-inner">
        <div className="wb-nav-tabs" role="list">
          {sections.map((section) => (
            <button key={section.key} type="button" role="listitem" className="wb-nav-tab"
              aria-current={active === section.key ? 'true' : undefined} onClick={() => go(section.key)}>
              {active === section.key && <motion.span layoutId="wb-nav-thumb" className="wb-nav-thumb" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <span>{section.label}</span>
            </button>
          ))}
        </div>
        <span className="wb-nav-context" title={context}>{context}</span>
      </div>
      <span className="wb-progress" data-on={busy || undefined} aria-hidden="true" />
    </nav>
  );
}

/** État de fraîcheur : point vert qui respire quand les chiffres sont à jour (rafraîchis toutes les 60 s). */
function LiveStatus({ updatedAt, busy, error }) {
  const time = updatedAt ? updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
  const text = busy ? 'Mise à jour…' : error ? 'Dernière mise à jour en échec' : time ? `À jour à ${time} · toutes les minutes` : 'Chargement…';
  return (
    <span className="wb-status" data-state={busy ? 'busy' : error ? 'error' : time ? 'ok' : 'busy'} aria-live="polite">
      <i aria-hidden="true" />{text}
    </span>
  );
}

/** Sélecteur de cohorte webinaire — select natif (clavier, lecteur d'écran) habillé comme les champs du kit Finance.
 *  Apparaît dès qu'il y a 2+ webinaires dans `/marketing/webinars`. Change la cohorte via state + URL `?webinar=`. */
function WebinarSelector({ webinars, value, onChange }) {
  return (
    <label className="wb-select">
      <span>Webinaire</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Webinaire affiché">
        {webinars.map((w) => (
          <option key={w.id} value={w.id}>{w.title || w.id}</option>
        ))}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

/** Extra tile for the broad campaign — "Inscrits via /broad" + conversion %. */
function BroadInscritsTile({ data, C }) {
  const value = data.engagement?.broadSignups ?? 0;
  const conv = data.rates?.conversionRatePct;
  return (
    <div style={{
      background: C.emerald.bg,
      borderRadius: 12,
      padding: '12px 14px',
      border: `1px solid ${C.emerald.bg}`,
    }}>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: C.emerald.fg,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}>
        Inscrits via /broad
      </div>
      <div style={{
        marginTop: 6,
        fontSize: 22,
        fontWeight: 700,
        color: C.emerald.fg,
        letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}>
        {fmtInt(value)}
      </div>
      <div style={{
        marginTop: 4,
        fontSize: 11,
        color: C.emerald.fg,
        fontWeight: 600,
      }}>
        {fmtPct(conv)} de conversion
      </div>
    </div>
  );
}
