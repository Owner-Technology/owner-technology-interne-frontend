import React from 'react';
import { motion as Motion } from 'framer-motion';
import { Building2, CalendarCheck, MailOpen, MousePointerClick, Receipt, Timer, Video, Wallet } from 'lucide-react';
import { fmtInt, fmtEur, fmtPct, fmtDuration } from '../theme';
import { ITEM, useCountUp, useRevealed } from '../../../components/perfSales/motion.jsx';
import { Stat } from '../../TrackingSheetFinance/components/PageKit.jsx';
import Skeleton from './Skeleton';

/**
 * Vue d'ensemble de la page Webinar (refonte du 26/11/2026, langage de Finance → Statistiques) :
 *  - à gauche, la carte de la cohorte (anthracite, seul aplat sombre de la page) : titre, source, inscrits totaux dont
 *    le chiffre défile, et les signés ;
 *  - au centre et à droite, le classement des sales et les RDV par source (panneaux passés par le parent) ;
 *  - dessous, les huit chiffres clés en tuiles du kit, chacune avec son picto et sa note.
 * Les calculs des tuiles sont ceux d'avant la refonte, inchangés ; seule la présentation a changé.
 */

const fmtCount = (n) => fmtInt(Math.round(n));

// Chiffre qui défile jusqu'à sa valeur quand la rubrique entre à l'écran.
function CountTo({ value, format }) {
  const revealed = useRevealed();
  const shown = useCountUp(revealed && Number.isFinite(value) ? value : 0, { duration: 1000 });
  return <>{format(shown)}</>;
}

function HeroCard({ webinar, summary, realtimeLeads }) {
  const leadsDb = summary?.leadsDb ?? 0;
  const signedCount = realtimeLeads?.signed ?? 0;
  const signedPct = leadsDb > 0 ? (signedCount / leadsDb) * 100 : null;
  return (
    <Motion.div variants={ITEM} className="wb-hero">
      <div>
        <span className="wb-hero-tag"><i aria-hidden="true" />{webinar?.source || 'Landing webinaire'}</span>
        <h3 className="wb-hero-title">{webinar?.title || 'Webinaire'}</h3>
        <p className="wb-hero-sub">Performance landing & pipeline prospects</p>
      </div>
      <div>
        <div className="wb-hero-big fst-num"><CountTo value={leadsDb} format={fmtCount} /></div>
        <div className="wb-hero-label">Inscrits totaux (DB)</div>
        {signedPct !== null && (
          <span className="wb-hero-pill">{fmtInt(signedCount)} signés ({fmtPct(signedPct)})</span>
        )}
      </div>
    </Motion.div>
  );
}

export default function HeroKpiStrip({ webinar, summary, realtimeLeads, rankingPanel, donutPanel, loading }) {
  if (!summary) {
    // Premier chargement : squelettes à l'emprise exacte du contenu (carte de 236 px, tuiles de 104 px).
    return (
      <div style={{ display: 'grid', gap: 18 }} aria-busy="true">
        <div className="wb-top">
          <Skeleton height={236} radius={22} />
          <Skeleton height={236} radius={22} />
          <Skeleton height={236} radius={22} />
        </div>
        <div className="wb-stats">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={104} radius={18} />)}
        </div>
      </div>
    );
  }

  const tiles = [
    {
      label: 'Présents au live',
      Icon: Video,
      num: realtimeLeads?.live_attendees,
      fmt: fmtCount,
      value: realtimeLeads?.live_attendees !== undefined
        ? fmtInt(realtimeLeads.live_attendees)
        : '—',
      hint: (realtimeLeads?.live_attendees > 0 && summary.leadsDb > 0)
        ? `${fmtPct((realtimeLeads.live_attendees / summary.leadsDb) * 100)} des inscrits · clic sur lien Zoom`
        : 'Cliquent sur leur lien unique Zoom',
      tone: realtimeLeads?.live_attendees > 0 ? 'emerald' : undefined,
    },
    {
      label: 'Rendez-vous pris',
      Icon: CalendarCheck,
      num: realtimeLeads?.rdv_taken,
      fmt: fmtCount,
      value: realtimeLeads?.rdv_taken !== undefined
        ? fmtInt(realtimeLeads.rdv_taken)
        : '—',
      hint: realtimeLeads?.total_leads
        ? `${fmtPct((realtimeLeads.rdv_taken / realtimeLeads.total_leads) * 100)} des inscrits`
        : 'Leads avec R2 planifié',
      tone: realtimeLeads?.rdv_taken > 0 ? 'emerald' : undefined,
    },
    (() => {
      // L'effectif est une donnée optionnelle, parfois absente de toute une
      // cohorte (formulaire Meta du 21/09 : 0 inscrit renseigné). Un « 1 »
      // nu se lit alors comme un chiffre faux : on dit sur combien
      // d'inscrits la donnée existe, et « non collecté » quand elle manque
      // (retour dev 2026-09-23). `leadsHeadcountKnown` vient de la landing.
      const known = summary.leadsHeadcountKnown;
      const total = summary.leadsDb || 0;
      const label = 'Prospects 4+ salariés';
      const Icon = Building2;
      if (known === 0) {
        return { label, Icon, value: '—', tone: 'amber',
          hint: total > 0 ? `Effectif non collecté sur les ${fmtInt(total)} inscrits` : 'Effectif non collecté' };
      }
      if (known == null) {
        // Landing pas encore à jour : lecture historique, sans dénominateur.
        return { label, Icon, value: fmtInt(summary.leadsLargeCompany), num: summary.leadsLargeCompany, fmt: fmtCount,
          hint: total > 0 ? `${fmtPct((summary.leadsLargeCompany / total) * 100)} des inscrits` : undefined,
          tone: summary.leadsLargeCompany > 0 ? 'emerald' : undefined };
      }
      const unknown = Math.max(total - known, 0);
      return { label, Icon, value: fmtInt(summary.leadsLargeCompany), num: summary.leadsLargeCompany, fmt: fmtCount,
        hint: `${fmtPct((summary.leadsLargeCompany / known) * 100)} des ${fmtInt(known)} effectifs renseignés`
          + (unknown > 0 ? ` · ${fmtInt(unknown)} non renseignés` : ''),
        tone: unknown > known ? 'amber' : summary.leadsLargeCompany > 0 ? 'emerald' : undefined };
    })(),
    (() => {
      // Séparation A/B des deux landing pages (cohorte 20 juillet+) :
      // `summary.lpComparison` vient de la landing (/api/admin/stats) et
      // transite tel quel via le proxy marketing — leads ÷ visiteurs DE
      // CHAQUE page (Plausible event:page), donc dénominateurs corrects,
      // contrairement au conversionPct historique (visiteurs site-wide,
      // pollué depuis le lancement de /v2). Fallback : cohortes sans
      // trafic v2 (26 mai, 22 juin) → tuile historique inchangée.
      // Gate par COHORTE (pas par trafic) : la LP v2 n'existe que depuis la
      // cohorte du 20 juillet — Plausible n'ayant pas de notion de cohorte,
      // ses visites /v2 débordent dans les fenêtres des cohortes antérieures
      // qui chevauchent (retour dev 06/07). Slugs webinar-YYYY-MM-DD →
      // comparaison lexicographique = chronologique (couvre les futures).
      const isV2Cohort = (webinar?.id || '') >= 'webinar-2026-07-20';
      // Une seule page d'inscription pour la cohorte (TPE/PME : /tpe-pme, déclarée par la
      // landing) : sa conversion, inscrits de la page ÷ visiteurs de la page.
      if (isV2Cohort && summary.lpComparison?.length === 1) {
        const lp = summary.lpComparison[0];
        return {
          label: 'Taux conversion LP',
          Icon: MousePointerClick,
          num: lp.conversionPct,
          fmt: fmtPct,
          value: fmtPct(lp.conversionPct),
          hint: `${lp.path} : ${fmtInt(lp.leadsDb)} inscrits / ${fmtInt(lp.visitors)} visiteurs`,
          tone: lp.conversionPct >= 10 ? 'emerald' : undefined,
        };
      }
      const lp1 = summary.lpComparison?.find((l) => l.key === 'landing');
      const lp2 = summary.lpComparison?.find((l) => l.key === 'landing-v2');
      if (!isV2Cohort || !lp1 || !lp2) {
        return {
          label: 'Taux conversion LP',
          Icon: MousePointerClick,
          num: summary.conversionPct,
          fmt: fmtPct,
          value: fmtPct(summary.conversionPct),
          hint: 'Inscrits landing ÷ Visiteurs (hors Meta/Broad)',
          tone: summary.conversionPct >= 10 ? 'emerald' : undefined,
        };
      }
      const tag = (t) => <span className="wb-stat-tag">{t}</span>;
      return {
        label: 'Taux conversion LP · V1 vs V2',
        Icon: MousePointerClick,
        value: (
          <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span>{fmtPct(lp1.conversionPct)}{tag('LP')}</span>
            <span className="wb-stat-sep">·</span>
            <span>{fmtPct(lp2.conversionPct)}{tag('V2')}</span>
          </span>
        ),
        hint: `LP ${fmtInt(lp1.leadsDb)}/${fmtInt(lp1.visitors)} · V2 ${fmtInt(lp2.leadsDb)}/${fmtInt(lp2.visitors)} (inscrits/visiteurs)`,
        tone: (lp1.conversionPct >= 10 || lp2.conversionPct >= 10) ? 'emerald' : undefined,
      };
    })(),
    {
      label: summary.budgetSource === 'meta' ? 'Budget engagé · Meta' : 'Budget engagé',
      Icon: Wallet,
      num: summary.budgetEur,
      fmt: (n) => fmtEur(n, { decimals: 2 }),
      value: fmtEur(summary.budgetEur, { decimals: 2 }),
      hint: summary.budgetSource === 'meta'
        ? summary.metaBudgetStatus === 'available' ? 'Dépenses réelles · période sélectionnée · actualisation 20 min' : 'Dépenses Meta indisponibles pour le moment'
        : 'Budget saisi par le marketing',
    },
    {
      label: summary.budgetSource === 'meta' ? 'Coût par lead · Meta' : 'Coût par lead',
      Icon: Receipt,
      num: summary.cplEur,
      fmt: (n) => fmtEur(n, { decimals: 2 }),
      value: fmtEur(summary.cplEur, { decimals: 2 }),
      hint: summary.budgetSource === 'meta'
        ? summary.metaBudgetStatus === 'available'
          ? `${fmtInt(summary.metaLeads)} leads Meta · ${fmtEur(summary.costPerSignupEur, { decimals: 2 })} / inscrit reçu`
          : 'Indisponible · aucun coût estimé'
        : 'Budget ÷ Inscrits',
    },
    {
      label: "Taux d'ouverture",
      Icon: MailOpen,
      num: summary.globalOpenRatePct,
      fmt: fmtPct,
      value: fmtPct(summary.globalOpenRatePct),
      hint: summary.globalClickRatePct !== null && summary.globalClickRatePct !== undefined
        ? `${fmtPct(summary.globalClickRatePct)} de clic`
        : 'Tous emails confondus',
      tone: summary.globalOpenRatePct >= 30 ? 'emerald' : undefined,
    },
    {
      label: 'Durée moy. visite',
      Icon: Timer,
      value: fmtDuration(summary.visitDurationSeconds),
      hint: summary.bounceRatePct !== null && summary.bounceRatePct !== undefined
        ? `${fmtPct(summary.bounceRatePct)} de rebond`
        : undefined,
    },
  ];


  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="wb-top">
        <HeroCard webinar={webinar} summary={summary} realtimeLeads={realtimeLeads} />
        {rankingPanel}
        {donutPanel}
      </div>
      <Motion.div variants={ITEM} className="wb-stats" style={{ opacity: loading ? 0.7 : 1 }}>
        {tiles.map((t) => (
          <Stat
            key={t.label}
            Icon={t.Icon}
            label={t.label}
            text={Number.isFinite(t.num) ? <CountTo value={t.num} format={t.fmt} /> : t.value}
            note={t.hint}
            tone={TONES[t.tone]}
          />
        ))}
      </Motion.div>
    </div>
  );
}

// Tons des tuiles d'avant la refonte → tons du kit (valeur verte, jaune ou rouge).
const TONES = { emerald: 'green', amber: 'amber', rose: 'red' };
