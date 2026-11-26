import React from 'react';
// eslint-disable-next-line no-unused-vars -- motion used via JSX (false positive)
import { motion } from 'framer-motion';
import { ITEM } from '../../../components/perfSales/motion.jsx';

/**
 * Reusable white card with consistent radius / shadow / padding —
 * mirrors the SaaS dashboard refs (rounded 18-20px, generous padding,
 * soft shadow). Supports an optional header with title + subtitle +
 * right-aligned action node.
 */
export default function Card({
  title,
  subtitle,
  action,
  children,
  C,
  noPadding = false,
  delay = 0,
  hoverable = false,
  style = {},
}) {
  // Page Webinar (palette Owner, `C.owner`) : carte du kit Finance. Elle arrive dans la cascade de sa section (ITEM),
  // trait fin sans ombre, rayon 22, titre en 500 et indice gris, sans filet sous l'en-tête. Les autres pages qui
  // utilisent cette carte (Funnel Leads) gardent le rendu d'origine ci-dessous.
  if (C.owner) {
    return (
      <motion.section
        variants={ITEM}
        className="wb-card"
        style={{ background: C.surface, borderColor: C.border, ...style }}
      >
        {(title || action) && (
          <header className={`wb-card-head${noPadding ? ' is-flush' : ''}`}>
            <div style={{ minWidth: 0 }}>
              {title && <h3 className="wb-card-title" style={{ color: C.text }}>{title}</h3>}
              {subtitle && <p className="wb-card-hint" style={{ color: C.muted }}>{subtitle}</p>}
            </div>
            {action && <div className="wb-card-action">{action}</div>}
          </header>
        )}
        <div className={noPadding ? undefined : 'wb-card-body'}>{children}</div>
      </motion.section>
    );
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.hairline}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        ...style,
      }}
      whileHover={hoverable ? { y: -2 } : undefined}
    >
      {(title || action) && (
        <header style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: noPadding ? 'none' : `1px solid ${C.hairline}`,
        }}>
          <div>
            {title && (
              <h3 style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
                letterSpacing: '-0.01em',
              }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{
                margin: '4px 0 0',
                fontSize: 12,
                color: C.muted,
                fontWeight: 500,
              }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <div style={{ padding: noPadding ? 0 : 24 }}>{children}</div>
    </motion.section>
  );
}
