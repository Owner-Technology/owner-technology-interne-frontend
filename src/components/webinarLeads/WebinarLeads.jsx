// Leads webinaire (dev 23/11/2026) : les R1 webinaire posés par les setters et encore sans sales, au style de la page
// Finance. « Il faut qu'il puisse voir les agendas des sales… voir quels sales sont disponibles sur les créneaux du
// rendez-vous et choisir ces sales-là. »
//
// Données : GET /leads/webinar-awaiting (la liste) et GET /leads/webinar-awaiting/agendas (créneaux libres de chaque
// sales, règle de l'agenda unique des setters, et les sales libres sur chaque R1). L'affectation est celle de la
// Gestion des leads (POST /leads/{id}/assign) : une fiche affectée quitte la liste.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  AlertCircle, CalendarCheck, CalendarDays, CalendarX, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Inbox,
  LoaderCircle, Search, UserRound, UsersRound,
} from 'lucide-react';
import apiClient from '../../services/apiClient';
import {
  Avatar, Card, Collapse, Empty, Page, Reveal, Segmented, Stat, Stats, TableBox, Tag, Th, Who,
} from '../../pages/TrackingSheetFinance/components/PageKit.jsx';
import { EASE } from '../perfSales/motion.jsx';
import {
  addDays, dayLabel, freeKeys, hourLabel, isSoon, mondayOf, originsOf, receivedLabel, salesForSlot, slotKey, slotLabel,
  slotOf, visibleLeads, weekDays, weekLabel, weekRows, withoutSlot,
} from './model.js';
import './webinarLeads.css';

const LIST_URL = '/api/v1/leads/webinar-awaiting';
const AGENDAS_URL = '/api/v1/leads/webinar-awaiting/agendas';
const TONES = ['lilac', 'cyan', 'lime', 'peach', 'blue', 'yellow'];
// Actualisation automatique (dev 23/11/2026 : « l'actualisation devrait être automatique ») : toutes les minutes tant que
// l'onglet est visible, et au retour sur l'onglet. Sans clignotement : la liste reste affichée pendant la relecture.
const REFRESH_MS = 60_000;
// Dev 23/11/2026 : « on comprend pas vraiment qui on a sélectionné ». Après une affectation, la ligne reste un instant
// en vert avec le nom du sales choisi, puis s'en va : on voit ce qui s'est passé, et pour qui.
const DONE_MS = 1100;
const firstName = (name) => String(name || '').split(' ')[0];
const parisToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const errorText = (e, fallback) => (e?.message && !/^HTTP \d+/.test(e.message) ? e.message : fallback);

function useRemote(url) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ loading: false, data: await apiClient.get(url), error: null });
    } catch (e) {
      // Une relecture silencieuse ratée garde l'écran tel quel ; la suivante réessaie.
      if (!silent) setState((s) => ({ ...s, loading: false, error: errorText(e, 'La lecture a échoué.') }));
    }
  }, [url]);
  useEffect(() => {
    load();
    const tick = () => { if (!document.hidden) load(true); };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load]);
  return [state, setState, load];
}

// ── Les sales libres d'une ligne : pastilles qui se chevauchent, puis le nombre ─────────────────────────────────
function FreeStack({ sales, loading }) {
  if (loading) return <span className="wl-skel" aria-hidden="true" />;
  if (!sales.length) return <Tag tone="red">Personne</Tag>;
  return (
    <span className="wl-stack" title={sales.map((s) => s.name).join(', ')}>
      <span className="wl-stack-faces">
        {sales.slice(0, 4).map((s, i) => <span key={s.email} style={{ zIndex: 4 - i }}><Avatar name={s.name} /></span>)}
      </span>
      <span className="wl-stack-count">{sales.length} {sales.length > 1 ? 'libres' : 'libre'}</span>
    </span>
  );
}

// ── Où en est l'affectation d'un lead : en cours vers un sales, puis faite ─────────────────────────────────────────
function AssignStatus({ pending }) {
  return (
    <Motion.span className="wl-status" data-phase={pending.phase} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}>
      {pending.phase === 'done' ? <Check size={14} strokeWidth={2.6} /> : <LoaderCircle size={14} className="wl-spin" />}
      {pending.phase === 'done' ? `Affecté à ${firstName(pending.name)}` : `Vers ${firstName(pending.name)}…`}
    </Motion.span>
  );
}

// ── Menu « Affecter » d'une ligne : libres sur le créneau d'abord ─────────────────────────────────────────────────
function AssignMenu({ lead, groups, pending, onAssign, onAgenda }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const row = (sales, free) => (
    <button key={sales.email} type="button" role="menuitem" className="wl-menu-item" data-free={free || undefined}
      onClick={() => { setOpen(false); onAssign(lead, sales); }}>
      <Avatar name={sales.name} />
      <span className="wl-menu-name">{sales.name}</span>
      {free ? <span className="wl-free-dot">Libre</span> : <span className="wl-menu-note">{sales.readable ? 'Pas libre' : 'Agenda illisible'}</span>}
    </button>
  );
  return (
    <div className="wl-assign" ref={ref} onClick={(e) => e.stopPropagation()}>
      {pending ? <AssignStatus pending={pending} /> : (
        <button type="button" className="wl-assign-btn" aria-haspopup="menu" aria-expanded={open}
          onClick={() => { setOpen((v) => !v); onAgenda(lead); }}>
          Affecter<ChevronDown size={14} />
        </button>
      )}
      <AnimatePresence>
        {open && (
          <Motion.div role="menu" className="wl-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }} transition={{ duration: 0.18, ease: EASE }}>
            <p className="wl-menu-title">Libres {slotLabel(slotOf(lead.r1_date))}</p>
            {groups.free.length ? groups.free.map((s) => row(s, true)) : <p className="wl-menu-empty">Personne n’est libre sur ce créneau.</p>}
            {groups.busy.length > 0 && <p className="wl-menu-title">Les autres sales</p>}
            {groups.busy.map((s) => row(s, false))}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Agenda d'un sales sur une semaine ─────────────────────────────────────────────────────────────────────────────
function WeekAgenda({ agenda, monday, target, markers }) {
  const days = weekDays(monday, agenda);
  const rows = weekRows(days, agenda, [target, ...markers.keys].map((k) => (typeof k === 'string' ? { date: k.slice(0, 10), time: k.slice(11) } : k)));
  const free = freeKeys(agenda);
  const targetKey = slotKey(target);
  if (!agenda.readable) return <Empty boxed>L’agenda Google de {agenda.name} n’a pas pu être lu : ses créneaux ne sont pas affichés.</Empty>;
  if (!rows.length) return <Empty boxed>Aucun créneau libre cette semaine.</Empty>;
  return (
    <Motion.div key={`${agenda.email}-${monday}`} className="wl-week" style={{ '--cols': days.length }}
      initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.32, ease: EASE }}>
      <span className="wl-week-corner" />
      {days.map((d) => <span key={d} className="wl-week-day">{dayLabel(d)}</span>)}
      {rows.map((time, r) => (
        <div key={time} className="wl-week-row" style={{ '--r': r }}>
          <span className="wl-week-hour">{hourLabel(time)}</span>
          {days.map((d) => {
            const key = `${d} ${time}`;
            const isTarget = key === targetKey;
            const isFree = free.has(key);
            const count = markers.counts.get(key) || 0;
            return (
              <span key={key} className="wl-cell" data-free={isFree || undefined} data-target={isTarget || undefined}
                title={`${dayLabel(d)} à ${hourLabel(time)} : ${isFree ? 'libre' : 'pas libre'}${count ? ` · ${count} R1 à placer` : ''}`}>
                {isTarget ? (isFree ? 'Libre · R1' : 'Pris · R1') : isFree ? 'Libre' : ''}
                {count > 0 && !isTarget && <span className="wl-cell-mark">{count}</span>}
              </span>
            );
          })}
        </div>
      ))}
    </Motion.div>
  );
}

// ── Un sales dans la carte de droite : son agenda s'affiche au clic, « Affecter » répond à l'endroit cliqué ────────────
function PersonRow({ person, free, active, pending, onShow, onAssign }) {
  const mine = pending && pending.email === person.email;
  return (
    <div className="wl-person" data-active={active || undefined} data-dim={(pending && !mine) || undefined}>
      {active && <Motion.span layoutId="wl-person-hl" className="wl-person-hl" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
      <button type="button" className="wl-person-who" onClick={onShow} aria-pressed={active} title="Voir son agenda">
        <Who name={person.name} />
        {free ? <span className="wl-free-dot">Libre</span> : <span className="wl-menu-note">{person.readable ? 'Pas libre' : 'Agenda illisible'}</span>}
      </button>
      {mine ? <AssignStatus pending={pending} /> : (
        <button type="button" className={`fst-btn is-small${free ? ' is-dark' : ''}`} disabled={Boolean(pending)} onClick={onAssign}>
          {free ? 'Affecter' : 'Affecter quand même'}
        </button>
      )}
    </div>
  );
}

export default function WebinarLeads() {
  const today = parisToday();
  const [list, setList, reloadList] = useRemote(LIST_URL);
  const [agendas, setAgendas, reloadAgendas] = useRemote(AGENDAS_URL);
  const [view, setView] = useState('all');
  const [origin, setOrigin] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [salesEmail, setSalesEmail] = useState(null);
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [pending, setPending] = useState({});
  const agendaRef = useRef(null);
  const [notice, setNotice] = useState(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const leads = useMemo(() => {
    const rows = list.data?.leads || [];
    return [...rows].sort((a, b) => String(a.r1_date).localeCompare(String(b.r1_date)));
  }, [list.data]);
  const sales = useMemo(() => agendas.data?.sales || [], [agendas.data]);
  const freeByLead = agendas.data?.free_by_lead || null;
  const byEmail = useMemo(() => new Map(sales.map((s) => [s.email, s])), [sales]);
  const freeOf = useCallback((lead) => (freeByLead?.[String(lead.id)] || []).map((e) => byEmail.get(e)).filter(Boolean), [freeByLead, byEmail]);
  const origins = useMemo(() => originsOf(leads), [leads]);
  const toneOf = useMemo(() => new Map(origins.map((o, i) => [o.origin, TONES[i % TONES.length]])), [origins]);
  const shown = useMemo(() => visibleLeads(leads, { view, origin, query, today, freeByLead }), [leads, view, origin, query, today, freeByLead]);

  const selected = leads.find((l) => l.id === selectedId) || null;
  const target = selected ? slotOf(selected.r1_date) : null;
  const groups = useMemo(() => salesForSlot(sales, selected ? freeByLead?.[String(selected.id)] : []), [sales, selected, freeByLead]);
  const agenda = byEmail.get(salesEmail) || groups.free[0] || sales[0] || null;
  // Les R1 encore à placer, posés en repères dans l'agenda : on voit où tombent les rendez-vous de la page.
  const markers = useMemo(() => {
    const counts = new Map();
    for (const lead of leads) {
      const key = slotKey(slotOf(lead.r1_date));
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return { counts, keys: [...counts.keys()] };
  }, [leads]);
  const lastDay = useMemo(() => sales.flatMap((s) => s.days.map((d) => d.date)).sort().pop() || addDays(today, 41), [sales, today]);

  const soon = leads.filter((l) => isSoon(l, today)).length;
  const nobody = freeByLead ? leads.filter((l) => !(freeByLead[String(l.id)] || []).length).length : null;
  const readable = sales.filter((s) => s.readable).length;

  const select = useCallback((lead) => {
    setSelectedId(lead.id);
    setOthersOpen(false);
    const slot = slotOf(lead.r1_date);
    if (slot) setMonday(mondayOf(slot.date));
    const first = (freeByLead?.[String(lead.id)] || [])[0];
    setSalesEmail((current) => ((freeByLead?.[String(lead.id)] || []).includes(current) ? current : first || current));
  }, [freeByLead]);

  const assign = useCallback(async (lead, person) => {
    const slot = slotOf(lead.r1_date);
    const mark = (phase) => setPending((p) => {
      const next = { ...p };
      if (phase) next[lead.id] = { email: person.email, name: person.name, phase };
      else delete next[lead.id];
      return next;
    });
    mark('sending');
    setNotice(null);
    try {
      await apiClient.assignLead(lead.id, person.email);
      mark('done');
      await new Promise((resolve) => { setTimeout(resolve, DONE_MS); });
      setList((s) => ({ ...s, data: s.data ? { ...s.data, leads: s.data.leads.filter((l) => l.id !== lead.id) } : s.data }));
      setAgendas((s) => (s.data ? {
        ...s,
        data: {
          ...s.data,
          sales: s.data.sales.map((a) => (a.email === person.email ? withoutSlot(a, slot) : a)),
          free_by_lead: Object.fromEntries(Object.entries(s.data.free_by_lead || {}).map(([id, emails]) => {
            const other = leads.find((l) => String(l.id) === id);
            const same = other && slotKey(slotOf(other.r1_date)) === slotKey(slot);
            return [id, same ? emails.filter((e) => e !== person.email) : emails];
          })),
        },
      } : s));
      if (selectedId === lead.id) setSelectedId(null);
      setNotice({ tone: 'green', text: `${lead.full_name || 'Le lead'} est affecté à ${person.name} (R1 ${slotLabel(slot)}).` });
      reloadAgendas(true);
    } catch (e) {
      setNotice({ tone: 'red', text: errorText(e, `${lead.full_name || 'Le lead'} n’a pas pu être affecté à ${person.name}. Réessayez.`) });
    } finally {
      mark(null);
    }
  }, [leads, reloadAgendas, selectedId, setAgendas, setList]);

  // Voir l'agenda d'un sales : l'agenda vient sous les yeux s'il est plus bas.
  const showAgenda = useCallback((email) => {
    setSalesEmail(email);
    requestAnimationFrame(() => agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }, []);

  const listState = { ...list, data: list.data ? leads : null, retry: () => reloadList() };

  return (
    <div className="wl-page">
      <Page title="Leads webinaire">
        <div className="wl-kpis">
          <Stats>
            <Stat label="À affecter" value={leads.length} Icon={Inbox} title="R1 sans sales" onClick={() => setView('all')} pressed={view === 'all'} />
            <Stat label="R1 d’ici demain" value={soon} Icon={Clock3} title="Les premiers à affecter" tone={soon ? 'amber' : undefined}
              onClick={() => setView(view === 'soon' ? 'all' : 'soon')} pressed={view === 'soon'} />
            <Stat label="Personne de libre" value={nobody ?? 0} Icon={CalendarX} title="Aucun sales libre sur le créneau"
              tone={nobody ? 'red' : undefined} onClick={() => setView(view === 'none' ? 'all' : 'none')} pressed={view === 'none'} />
            <Stat label="Agendas lus" text={agendas.data ? `${readable}/${sales.length}` : '–'} Icon={CalendarCheck}
              title="Google, RDV du CRM, absences" />
          </Stats>
        </div>

        <AnimatePresence>
          {notice && (
            <Motion.div className="wl-notice" data-tone={notice.tone} role="status" initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }}>
              <span className="wl-notice-in">{notice.tone === 'green' ? <Check size={15} /> : <AlertCircle size={15} />}{notice.text}
                <button type="button" onClick={() => setNotice(null)}>Fermer</button></span>
            </Motion.div>
          )}
        </AnimatePresence>

        <Reveal className="fst-grid wl-grid">
          <Card title="À affecter" Icon={UsersRound} state={listState} skeleton={360}
            hint="Cliquez une ligne pour voir qui est libre sur son R1 et ouvrir son agenda."
            actions={(
              <label className="fst-search wl-search">
                <Search size={14} />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" aria-label="Rechercher un lead" />
              </label>
            )}>
            {origins.length > 1 && (
              <div className="wl-origins">
                <Segmented small value={origin} onChange={setOrigin} label="Origine"
                  options={[{ key: 'all', label: `Toutes · ${leads.length}` }, ...origins.map((o) => ({ key: o.origin, label: `${o.origin} · ${o.count}` }))]} />
              </div>
            )}
            {shown.length ? (
              <TableBox>
                <thead>
                  <tr>
                    <Th Icon={UsersRound}>Origine</Th>
                    <Th Icon={CalendarDays}>Reçu le</Th>
                    <Th Icon={UserRound}>Nom et R1</Th>
                    <Th num>Salariés</Th>
                    <Th num>CA</Th>
                    <Th Icon={CalendarCheck}>Libres sur le R1</Th>
                    <Th>Sales</Th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {shown.map((lead, i) => {
                      const slot = slotOf(lead.r1_date);
                      const free = freeOf(lead);
                      const leadGroups = salesForSlot(sales, freeByLead?.[String(lead.id)]);
                      return (
                        <Motion.tr key={lead.id} layout="position" style={{ '--i': i }} data-open="true"
                          data-selected={lead.id === selectedId || undefined} data-phase={pending[lead.id]?.phase} onClick={() => select(lead)}
                          exit={{ opacity: 0, x: 28, transition: { duration: 0.32, ease: EASE } }}>
                          <td className="wl-first">
                            {lead.id === selectedId && <Motion.span layoutId="wl-row-mark" className="wl-row-mark" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                            <Tag tone={toneOf.get(String(lead.origin || '').trim() || 'Sans origine')}>{lead.origin || 'Sans origine'}</Tag></td>
                          <td className="fst-cell-muted fst-num">{receivedLabel(lead.created_at)}</td>
                          <td>
                            <div className="wl-name">{lead.full_name || '–'}
                              <AnimatePresence>{lead.id === selectedId && (
                                <Motion.span className="wl-picked" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                                  transition={{ duration: 0.2, ease: EASE }}>Sélectionné</Motion.span>
                              )}</AnimatePresence>
                            </div>
                            {slot && <span className="wl-r1" data-soon={isSoon(lead, today) || undefined}>R1 {slotLabel(slot)}</span>}
                          </td>
                          <td className="is-num fst-num">{lead.headcount || '–'}</td>
                          <td className="is-num fst-num">{lead.revenue || '–'}</td>
                          <td><FreeStack sales={free} loading={!agendas.data} /></td>
                          <td>
                            <AssignMenu lead={lead} groups={leadGroups} pending={pending[lead.id]} onAssign={assign} onAgenda={select} />
                          </td>
                        </Motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </TableBox>
            ) : (
              <Empty boxed>{leads.length ? 'Aucun lead ne correspond à ce filtre.' : 'Tous les R1 webinaire ont un sales. Rien à affecter.'}</Empty>
            )}
          </Card>

          <Card title="Agenda des sales" Icon={CalendarDays} className="wl-side"
            state={{ ...agendas, retry: () => reloadAgendas() }} skeleton={420}
            hint="Créneaux libres de chaque sales : horaires de RDV, RDV du CRM, absences et agenda Google.">
            <AnimatePresence mode="wait" initial={false}>
              {selected ? (
                <Motion.div key={selected.id} className="wl-slot" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}>
                  <p className="fst-micro">R1 sélectionné</p>
                  <div className="wl-slot-head wl-pulse">
                    <span className="wl-slot-name">{selected.full_name}</span>
                    <span className="wl-r1" data-soon={isSoon(selected, today) || undefined}>{slotLabel(target)}</span>
                  </div>
                  <p className="wl-slot-count">
                    {groups.free.length ? `${groups.free.length} sales ${groups.free.length > 1 ? 'sont libres' : 'est libre'} sur ce créneau.` : 'Personne n’est libre sur ce créneau.'}
                  </p>
                  <div className="wl-people">
                    {groups.free.map((s) => (
                      <PersonRow key={s.email} person={s} free active={agenda?.email === s.email} pending={pending[selected.id]}
                        onShow={() => showAgenda(s.email)} onAssign={() => assign(selected, s)} />
                    ))}
                  </div>
                  {groups.busy.length > 0 && (
                    <>
                      <button type="button" className="wl-more" aria-expanded={othersOpen} onClick={() => setOthersOpen((v) => !v)}>
                        <ChevronDown size={14} />Les autres sales ({groups.busy.length})
                      </button>
                      <Collapse open={othersOpen}>
                        <div className="wl-people is-muted">
                          {groups.busy.map((s) => (
                            <PersonRow key={s.email} person={s} active={agenda?.email === s.email} pending={pending[selected.id]}
                              onShow={() => showAgenda(s.email)} onAssign={() => assign(selected, s)} />
                          ))}
                        </div>
                      </Collapse>
                    </>
                  )}
                </Motion.div>
              ) : (
                <Motion.p key="none" className="wl-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Choisissez une ligne : ses sales libres s’affichent ici, et leur agenda dessous.
                </Motion.p>
              )}
            </AnimatePresence>

            {agenda && (
              <div className="wl-agenda" ref={agendaRef}>
                <div className="wl-agenda-title">
                  <span className="fst-micro">Agenda de</span>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <Motion.span key={agenda.email} className="wl-agenda-name" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24, ease: EASE }}>
                      <Who name={agenda.name} />
                      {target && (groups.free.some((g) => g.email === agenda.email)
                        ? <span className="wl-free-dot">Libre sur le R1</span>
                        : <span className="wl-menu-note">Pas libre sur le R1</span>)}
                    </Motion.span>
                  </AnimatePresence>
                </div>
                <div className="wl-agenda-head">
                  <select className="fst-select wl-agenda-select" value={agenda.email} onChange={(e) => showAgenda(e.target.value)} aria-label="Changer de sales">
                    {groups.free.length > 0 && (
                      <optgroup label="Libres sur le R1">
                        {groups.free.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}
                      </optgroup>
                    )}
                    <optgroup label={groups.free.length ? 'Les autres sales' : 'Sales'}>
                      {groups.busy.map((s) => <option key={s.email} value={s.email}>{s.name}</option>)}
                    </optgroup>
                  </select>
                  <div className="fst-nav">
                    <button type="button" className="fst-nav-btn" aria-label="Semaine précédente" disabled={monday <= mondayOf(today)}
                      onClick={() => setMonday((m) => addDays(m, -7))}><ChevronLeft size={16} /></button>
                    <span className="fst-nav-label wl-nav-label">{weekLabel(monday)}</span>
                    <button type="button" className="fst-nav-btn" aria-label="Semaine suivante" disabled={addDays(monday, 7) > lastDay}
                      onClick={() => setMonday((m) => addDays(m, 7))}><ChevronRight size={16} /></button>
                  </div>
                </div>
                <WeekAgenda agenda={agenda} monday={monday} target={target} markers={markers} />
                <p className="wl-legend">
                  <span><i className="wl-key is-free" />Libre</span>
                  <span><i className="wl-key is-target" />R1 sélectionné</span>
                  <span><i className="wl-key is-mark">2</i>R1 de la page sur ce créneau</span>
                </p>
              </div>
            )}
          </Card>
        </Reveal>
      </Page>
    </div>
  );
}
