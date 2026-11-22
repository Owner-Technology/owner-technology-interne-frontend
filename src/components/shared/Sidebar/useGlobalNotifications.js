// Notifications globales du CRM, pour le menu de gauche (dev 09/11/2026 : la navbar disparaît, ses notifications
// passent dans le menu). Même source et mêmes règles que la navbar : liste lue au montage puis toutes les 30 s,
// poussées en direct par le ws-relay (événement window `global_notification`, filtré par rôle), lecture d'une
// notification ou de toutes côté serveur.
// Gestion (dev 16/11/2026, la direction en a des centaines) : la liste s'allonge (« Voir plus »), l'onglet
// « Non lues » demande au serveur TOUTES les non lues, et on peut retirer des notifications de sa liste en masse.
// Sécurité (dev 22/11/2026, « que l'utilisateur se sente safe ») : retirer et « tout marquer comme lu » se défont pendant
// quelques secondes (« Annuler ») ; rien ne part au serveur avant. Un enregistrement refusé se dit, et la liste revient à
// l'état du serveur.
// Audit du 23/11/2026 : le geste en attente, ceux en route et le message vivent au niveau du module, partagés par les menus
// de chaque page (le menu remonte à chaque page) : changer de page ne coupe plus le délai, « Annuler » reste proposé, un
// refus arrivé après le changement de page se dit sur la nouvelle page, et une liste lue pendant l'envoi ne fait rien
// revenir. Fermer ou recharger l'onglet envoie le geste en attente (requête `keepalive`) au lieu de le perdre.
// « Tout marquer comme lu » ne couvre que les notifications reçues jusqu'au clic (borne `before`).
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../../services/apiClient";
import { applyGestures, covers, newestDate } from "./notificationGestures.js";

const POLL_MS = 30000;
// Onglet choisi, gardé d'une page à l'autre (21/11/2026) : ouvrir une notification change de page sans fermer la liste.
let lastView = "unread";
export const PAGE = 30;
export const UNDO_MS = 4500;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const byDate = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));
// Dernière liste connue, gardée d'une page à l'autre (audit du 22/11/2026) : le menu remonte à chaque page et repart de
// là, au lieu d'une liste vide qui affichait « Tout est lu. » le temps du chargement.
const cache = { key: null, items: [], unread: 0, total: 0 };

// Gestes et message partagés par tous les menus de l'onglet.
// pending : le geste qu'« Annuler » peut encore défaire ; inflight : envoyés, pas encore enregistrés ; version : change à
// chaque envoi terminé (une lecture partie avant est relue) ; toast : { key, tone, text, entry?, undo? }.
const store = { pending: null, inflight: new Set(), version: 0, toast: null, toastTimer: null,
  listeners: new Set(), restorers: new Set(), reloaders: new Set() };
const emit = () => store.listeners.forEach((f) => f());
const gestures = () => [...store.inflight, ...(store.pending ? [store.pending] : [])];
function showToast(next) {
  clearTimeout(store.toastTimer);
  store.toast = next;
  if (next && !next.undo) store.toastTimer = setTimeout(() => { store.toast = null; emit(); }, 5000);
  emit();
}
// Requête qui survit à la fermeture de l'onglet ; le jeton est celui du moment du geste (une déconnexion l'efface).
function postKeepalive(entry) {
  const token = entry.token || apiClient.getToken();
  return fetch(`${apiClient.baseUrl}${entry.path}`, { method: "POST", keepalive: true,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(entry.body || {}) })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res; });
}
function send(entry, { keepalive = false } = {}) {
  store.inflight.add(entry);
  const settle = (ok) => {
    store.inflight.delete(entry);
    store.version += 1;
    if (!ok) showToast({ key: Date.now(), tone: "error", text: entry.failText });
    // Refus : la liste revient à ce que le serveur sait. Réussite : les lectures parties avant l'envoi sont relues.
    store.reloaders.forEach((reload) => reload());
  };
  return (keepalive ? postKeepalive(entry) : apiClient.post(entry.path, entry.body)).then(() => settle(true), () => settle(false));
}
function commitPending({ keepalive = false } = {}) {
  const p = store.pending;
  if (!p) return;
  clearTimeout(p.timer);
  store.pending = null;
  if (store.toast?.entry === p) { store.toast = null; emit(); }
  send(p, { keepalive });
}
function offerUndo(entry, text) {
  commitPending();   // un nouveau geste envoie le précédent
  entry.token = apiClient.getToken();
  store.pending = entry;
  entry.timer = setTimeout(() => { if (store.pending === entry) commitPending(); }, UNDO_MS);
  showToast({ key: Date.now(), tone: "info", text, entry, undo: () => {
    if (store.pending !== entry) return;
    clearTimeout(entry.timer);
    store.pending = null;
    store.toast = null;
    store.restorers.forEach((restore) => restore(entry));
    emit();
  } });
}
if (typeof window !== "undefined") {
  // Onglet fermé, rechargé, déconnexion : le geste en attente part quand même.
  window.addEventListener("pagehide", () => commitPending({ keepalive: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") commitPending({ keepalive: true }); });
}

export default function useGlobalNotifications() {
  const sameAsCache = cache.key === `${lastView}|${PAGE}`;
  const [items, setItems] = useState(() => (sameAsCache ? cache.items : []));
  // Compteurs du serveur : toutes les non lues visibles, et combien la liste demandée en contient en tout.
  const [unread, setUnread] = useState(() => cache.unread);
  const [total, setTotal] = useState(() => (sameAsCache ? cache.total : 0));
  const [view, setView] = useState(() => lastView);   // "all" | "unread" — la liste s'ouvre sur les non lues (dev 21/11/2026)
  const [limit, setLimit] = useState(PAGE);
  // En chargement tant qu'aucune liste n'est connue pour cet onglet ; `failed` : le premier chargement a échoué.
  const [loading, setLoading] = useState(() => !sameAsCache);
  const [failed, setFailed] = useState(false);
  const [toast, setToast] = useState(() => store.toast);
  const alive = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;
  // Une réponse partie avant une écriture locale (lu, retiré, changement d'onglet) est jetée : elle remettrait l'ancien état.
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!apiClient.getToken()) return;
    const mine = seq.current;
    const version = store.version;
    try {
      const data = await apiClient.get(`/api/v1/notifications/global?limit=${limit}${view === "unread" ? "&unread_only=true" : ""}`);
      if (!alive.current || mine !== seq.current || !Array.isArray(data?.notifications)) return;
      // Un envoi s'est terminé pendant la lecture : la réponse date d'avant ; la relecture qu'il a demandée fait foi.
      if (version !== store.version) return;
      const fromServer = Number.isFinite(data.unread_count) ? data.unread_count : data.notifications.filter((n) => !n.read).length;
      const shown = applyGestures(gestures(), data.notifications, fromServer, Number.isFinite(data.total_count) ? data.total_count : data.notifications.length);
      setItems(shown.list);
      setUnread(shown.unreadCount);
      setTotal(shown.total);
      setFailed(false);
    } catch {
      // Réseau : la liste affichée reste ; sans liste du tout, l'échec se dit (« Réessayer ») au lieu de « Tout est lu. ».
      if (alive.current && !itemsRef.current.length) setFailed(true);
    }
    finally { if (alive.current) setLoading(false); }
  }, [limit, view]);

  // La liste du moment, pour la page suivante.
  useEffect(() => { Object.assign(cache, { key: `${view}|${limit}`, items, unread, total }); }, [view, limit, items, unread, total]);
  const retry = useCallback(() => { setFailed(false); setLoading(true); load(); }, [load]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, POLL_MS);
    const reload = () => { seq.current += 1; load(); };
    store.reloaders.add(reload);
    return () => { alive.current = false; clearInterval(timer); store.reloaders.delete(reload); };
  }, [load]);

  // Le message partagé, et « Annuler » appliqué à la liste de ce menu (même si le geste a été fait sur la page d'avant).
  useEffect(() => {
    const onChange = () => setToast(store.toast);
    const restore = (entry) => { seq.current += 1; entry.restore({ setItems, setUnread, setTotal }); };
    store.listeners.add(onChange);
    store.restorers.add(restore);
    onChange();
    return () => { store.listeners.delete(onChange); store.restorers.delete(restore); };
  }, []);

  useEffect(() => {
    const onPush = (e) => {
      const notif = e.detail;
      if (!notif?.id) return;
      const me = apiClient.getUser();
      // Seconde barrière derrière le back (fuite d'avant le 08/10) : jamais la notification d'une autre personne,
      // jamais celle d'un autre rôle.
      if (notif.target_user_id && String(notif.target_user_id) !== String(me?.id)) return;
      if (notif.target_roles && !notif.target_roles.includes(me?.role)) return;
      if (itemsRef.current.some((p) => p.id === notif.id)) return;
      // Arrivée en direct : marquée « fresh », la carte s'éclaire un instant pour qu'on la voie arriver.
      setItems((prev) => (prev.some((p) => p.id === notif.id) ? prev : [{ ...notif, fresh: true }, ...prev]));
      setUnread((u) => u + 1);
      setTotal((t) => t + 1);
    };
    window.addEventListener("global_notification", onPush);
    return () => window.removeEventListener("global_notification", onPush);
  }, []);

  // Lues ailleurs dans la page (les Échanges d'une fiche Finance, dev 17/11/2026) : déjà envoyées au serveur, la cloche
  // les marque lues tout de suite au lieu d'attendre le prochain passage.
  useEffect(() => {
    const onRead = (e) => {
      const ids = e.detail?.ids || [];
      if (!ids.length) return;
      seq.current += 1;
      const fresh = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).length;
      setUnread((u) => Math.max(0, u - fresh));
      setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    };
    window.addEventListener("global_notifications_read", onRead);
    return () => window.removeEventListener("global_notifications_read", onRead);
  }, []);

  // Changer d'onglet ou allonger la liste : une réponse encore en route pour l'ancienne demande est jetée.
  const changeView = useCallback((next) => { seq.current += 1; lastView = next; setView(next); setLimit(PAGE); setLoading(true); }, []);
  const showMore = useCallback(() => { seq.current += 1; setLimit((l) => l + PAGE); setLoading(true); }, []);

  // Lu d'un geste léger (ouvrir, « Lire la suite », le point vert) : sans « Annuler » ; `undo` : la sélection « Lu ».
  const markRead = useCallback(async (ids, { undo = false } = {}) => {
    if (!ids.length) return;
    seq.current += 1;
    const before = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).map((n) => n.id);
    setUnread((u) => Math.max(0, u - before.length));
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    const entry = { kind: "read", ids, path: "/api/v1/notifications/global/read", body: { ids },
      failText: "La lecture n’a pas été enregistrée. La liste a été rechargée.",
      restore: ({ setItems: set, setUnread: count }) => {
        set((prev) => prev.map((n) => (before.includes(n.id) ? { ...n, read: false } : n)));
        count((u) => u + before.length);
      } };
    if (!undo) { await send(entry); return; }
    offerUndo(entry, `${plural(before.length || ids.length, "notification marquée", "notifications marquées")} comme lue${(before.length || ids.length) > 1 ? "s" : ""}`);
  }, []);

  const markAllRead = useCallback(async () => {
    seq.current += 1;
    // Borne : la plus récente des notifications vues ; une notification arrivée pendant le délai reste non lue.
    const known = itemsRef.current;
    const gesture = { kind: "read", ids: "all", before: newestDate(known) };
    const wasUnread = new Set(known.filter((n) => !n.read && covers(gesture, n)).map((n) => n.id));
    const count = unreadRef.current;
    setItems((prev) => prev.map((n) => (covers(gesture, n) ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - count));
    offerUndo({ ...gesture, path: "/api/v1/notifications/global/read-all", body: gesture.before ? { before: gesture.before } : {},
      failText: "« Tout marquer comme lu » n’a pas été enregistré. La liste a été rechargée.",
      restore: ({ setItems: set, setUnread: countSet }) => {
        set((prev) => prev.map((n) => (wasUnread.has(n.id) ? { ...n, read: false } : n)));
        // Ajouté, pas remplacé : une notification arrivée pendant le délai reste comptée.
        countSet((u) => u + count);
      } }, `${plural(count, "notification marquée", "notifications marquées")} comme lue${count > 1 ? "s" : ""}`);
  }, []);

  // Retirer de SA liste (les autres destinataires la gardent) ; le serveur la compte aussi comme lue.
  const dismiss = useCallback(async (ids) => {
    if (!ids.length) return false;
    seq.current += 1;
    const gone = itemsRef.current.filter((n) => ids.includes(n.id));
    const goneUnread = gone.filter((n) => !n.read).length;
    setUnread((u) => Math.max(0, u - goneUnread));
    setTotal((t) => Math.max(0, t - gone.length));
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    offerUndo({ kind: "remove", ids, path: "/api/v1/notifications/global/dismiss", body: { ids },
      failText: "Le retrait n’a pas été enregistré. La liste a été rechargée.",
      restore: ({ setItems: set, setUnread: count, setTotal: totalSet }) => {
        set((prev) => [...prev, ...gone.filter((g) => !prev.some((n) => n.id === g.id))].sort(byDate));
        count((u) => u + goneUnread);
        totalSet((t) => t + gone.length);
      } }, `${plural(gone.length || ids.length, "notification retirée", "notifications retirées")}`);
    return true;
  }, []);

  return { items, unreadCount: unread, total, view, setView: changeView, showMore, loading, failed, retry, markRead, markAllRead, dismiss, toast };
}
