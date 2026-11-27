// BillingWeeksView.jsx — onglet « Onboardings par semaine » (réunion du 27/11/2026).
//
// Dire à l'avance qui de la facturation prend les onboardings d'une semaine (« semaine du 30/11, seulement A et B »),
// au lieu de bloquer son agenda. Le serveur lit ce réglage pour les créneaux proposés aux sales et l'attribution ; une
// semaine non réglée garde l'existant (tout le monde, dans l'ordre de priorité). Les noms et le droit de régler
// (`can_edit` : la direction financière) viennent du serveur ; les autres lisent.
//
// Source : GET / PUT /optilex/billing-roster.

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, UserCheck, UserPen } from 'lucide-react';

import apiClient from '../../../services/apiClient.js';
import { READ_ONLY_PROPS } from '../../../utils/readOnlyRoles.js';
import { toggleWeekPerson } from '../../../utils/onboardingBilling.js';
import { Card, Empty, Page, RefreshButton, Reveal, TableBox, Tag, Th } from './PageKit.jsx';

const WEEKS = 8;

const weekLabel = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 4);
  const fmt = (date) => date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `Du ${fmt(start)} au ${fmt(end)}`;
};

export default function BillingWeeksView({ readOnly = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(null);

  const load = useCallback(() => {
    setBusy(true); setError('');
    apiClient.get(`/api/v1/optilex/billing-roster?weeks=${WEEKS}`)
      .then((r) => setData(r || null))
      .catch(() => setError('Les semaines n’ont pas pu être chargées.'))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const people = data?.people || [];
  const editable = !!data?.can_edit && !readOnly;

  const toggle = async (week, name) => {
    if (!editable || saving) return;
    const names = toggleWeekPerson(week, people, name);
    if (names === null) return;                       // jamais une semaine sans personne
    setSaving(week.week_start); setError('');
    try {
      const r = await apiClient.put('/api/v1/optilex/billing-roster', { week_start: week.week_start, names });
      setData((d) => ({ ...d, weeks: d.weeks.map((w) => (w.week_start === week.week_start ? r.week : w)) }));
    } catch (e) {
      const d = e?.data?.detail;
      setError(typeof d === 'string' ? d : 'La semaine n’a pas pu être enregistrée.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Page title="Onboardings par semaine" sub="Qui de la facturation prend les onboardings."
      actions={<RefreshButton onClick={load} busy={busy} />}>
      <Reveal amount={0.03}>
      <Card title="Semaines à venir" Icon={CalendarDays}>
        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 12.5, color: '#c5221f' }}>{error}</p>}
        {!data ? (
          <Empty>{busy ? 'Chargement…' : 'Aucune semaine.'}</Empty>
        ) : (
          <TableBox>
            <thead>
              <tr>
                <Th Icon={CalendarDays}>Semaine</Th>
                <Th Icon={UserCheck}>Personnes</Th>
                <Th Icon={UserPen}>Réglée par</Th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((week) => (
                <tr key={week.week_start}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      {weekLabel(week.week_start)}
                      {!week.set && <Tag>Tout le monde</Tag>}
                    </span>
                  </td>
                  <td>
                    <div className="fst-tabs" role="group" aria-label={`Personnes de la semaine ${weekLabel(week.week_start)}`}
                      style={{ display: 'inline-flex' }}>
                      {people.map((name) => {
                        const on = week.names.includes(name);
                        return (
                          <button key={name} type="button" className="fst-tab" aria-pressed={on}
                            disabled={saving === week.week_start} onClick={() => toggle(week, name)}
                            {...(!editable ? READ_ONLY_PROPS : {})}>
                            {on && <span className="fst-tab-bg" />}
                            <span>{name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="fst-cell-muted">{week.set ? (week.updated_by || '–') : '–'}</td>
                </tr>
              ))}
            </tbody>
          </TableBox>
        )}
      </Card>
      </Reveal>
    </Page>
  );
}
