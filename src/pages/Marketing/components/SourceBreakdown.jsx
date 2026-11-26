import React, { useState } from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import { ITEM } from '../../../components/perfSales/motion.jsx';
import { fmtInt, fmtPct } from '../theme';

/**
 * Inscrits par source d'acquisition — Landing, Meta Ads, Broad (refonte du 26/11/2026) : une carte du kit Finance,
 * une barre empilée qui donne la part de chacune d'un coup d'œil, puis une tuile par source avec son chiffre, sa
 * part, son détail et ses réserves. Survoler une tuile éclaire sa part dans la barre.
 */
export default function SourceBreakdown({ summary, C, loading }) {
  const [focus, setFocus] = useState(null);
  if (!summary) return loading ? <div className="fst-skel" style={{ height: 246, borderRadius: 22 }} aria-hidden="true" /> : null;
  const bySrc = summary.leadsBySource || { landing: 0, meta: 0, broad: 0 };
  // La LP `/v2` (A/B déployé le 02/07) remonte en source `landing-v2`, exposée
  // par l'API sous `landingV2`. Elle capte aujourd'hui la quasi-totalité du
  // trafic LP : l'ignorer affichait 1 inscrit au lieu de 15, et faussait aussi
  // le dénominateur, donc TOUS les pourcentages de la ligne.
  const landingAll = (bySrc.landing || 0) + (bySrc.landingV2 || 0);
  const total = landingAll + (bySrc.meta || 0) + (bySrc.broad || 0);
  const share = (n) => total > 0 ? (n / total) * 100 : null;

  const cards = [
    {
      key: 'landing',
      title: 'Landing',
      value: landingAll,
      pct: share(landingAll),
      tag: 'webinaire.ownertechnology.com',
      sub: bySrc.landingV2
        ? `${fmtInt(summary.visitors)} visiteurs · dont ${fmtInt(bySrc.landingV2)} via /v2`
        : `${fmtInt(summary.visitors)} visiteurs uniques`,
      color: C.blue.strong,
      tagTone: 'blue',
    },
    {
      key: 'meta',
      title: 'Meta Ads',
      value: bySrc.meta || 0,
      pct: share(bySrc.meta || 0),
      tag: 'Lead Form → n8n',
      sub: 'Ingestion webhook',
      color: C.fuchsia.strong,
      tagTone: 'lilac',
    },
    {
      key: 'broad',
      title: 'Broad',
      value: bySrc.broad || 0,
      pct: share(bySrc.broad || 0),
      tag: '/broad · cold outreach',
      sub: 'Anciens prospects relancés',
      color: C.amber.strong,
      tagTone: 'yellow',
    },
  ];

  const known = cards.filter((card) => card.value > 0);
  return (
    <motion.section variants={ITEM} className="wb-card" style={{ background: C.surface, borderColor: C.border }}>
      <header className="wb-card-head">
        <div>
          <h3 className="wb-card-title">Inscrits par source</h3>
          <p className="wb-card-hint" style={{ color: C.muted }}>{fmtInt(total)} inscrits sur la fenêtre, répartis entre la landing, Meta Ads et Broad.</p>
        </div>
      </header>
      <div className="wb-card-body">
        <div className="wb-src-stack" role="img" aria-label={cards.map((card) => `${card.title} ${fmtPct(card.pct)}`).join(', ')}
          data-focus={focus || undefined}>
          {known.map((card) => (
            <i key={card.key} data-on={focus === card.key || undefined} style={{ flexGrow: card.value, background: card.color }} />
          ))}
        </div>
        <div className="wb-src-grid">
          {cards.map((card) => (
            <div key={card.key} className="wb-src" onMouseEnter={() => setFocus(card.key)} onMouseLeave={() => setFocus(null)}>
              <div className="wb-src-head">
                <span className="wb-src-name"><i style={{ background: card.color }} aria-hidden="true" />{card.title}</span>
                <span className="fst-tag" data-tone={card.tagTone} title={card.tag}>{card.tag}</span>
              </div>
              <div className="wb-src-value">
                <b className="fst-num">{fmtInt(card.value)}</b>
                <span>{fmtPct(card.pct)} des inscrits</span>
              </div>
              <div className="wb-src-sub">{card.sub}</div>
              {card.key === 'landing' && summary.budgetSource === 'meta' && (
                <div className="wb-src-note">
                  Budget et CPL LP : non isolables. Les dépenses de campagne ne sont pas ventilées entre formulaires Meta, LP et LP V2.
                </div>
              )}
              {card.key === 'meta' && summary.metaBudgetStatus === 'available' && (
                <div className="wb-src-note">
                  {fmtInt(summary.metaLeads)} leads déclarés par Meta, toutes destinations confondues. Attribution et déduplication peuvent différer des inscriptions reçues.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
