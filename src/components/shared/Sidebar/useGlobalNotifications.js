// Notifications globales du CRM, pour le menu de gauche (dev 09/11/2026 : la navbar disparaît, ses notifications
// passent dans le menu). Même source et mêmes règles que la navbar : liste lue au montage puis toutes les 30 s,
// poussées en direct par le ws-relay (événement window `global_notification`, filtré par rôle), lecture d'une
// notification ou de toutes côté serveur.
// Gestion (dev 16/11/2026, la direction en a des centaines) : la liste s'allonge (« Voir plus »), l'onglet
// « Non lues » demande au serveur TOUTES les non lues, et on peut retirer des notifications de sa liste en masse.
// Sécurité (dev 22/11/2026, « que l'utilisateur se sente safe ») : retirer et « tout marquer comme lu » se défont pendant
// quelques secondes (« Annuler ») ; rien ne part au serveur avant. Un enregistrement refusé se dit, et la liste revient à
// l'état du serveur. Ce qui est en attente part tout de suite si l'on change de page.
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../../../services/apiClient";

const POLL_MS = 30000;
// Onglet choisi, gardé d'une page à l'autre (21/11/2026) : ouvrir une notification change de page sans fermer la liste.
let lastView = "unread";
export const PAGE = 30;
export const UNDO_MS = 4500;
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const byDate = (a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""));

export default function useGlobalNotifications() {
  const [items, setItems] = useState([]);
  // Compteurs du serveur : toutes les non lues visibles, et combien la liste demandée en contient en tout.
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState(() => lastView);   // "all" | "unread" — la liste s'ouvre sur les non lues (dev 21/11/2026)
  const [limit, setLimit] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const alive = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;
  // Une réponse partie avant une écriture locale (lu, retiré) est jetée : elle remettrait l'ancien état.
  const seq = useRef(0);
  // Geste en attente d'envoi ({ kind: "remove" | "read", ids | "all", commit, restore, timer }) et message affiché sous la
  // liste ({ key, tone: "info" | "error", text, undo? }).
  const pending = useRef(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const say = useCallback((next) => {
    clearTimeout(toastTimer.current);
    setToast(next);
    if (next && !next.undo) toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  // Ce que le serveur ne sait pas encore : un passage du serveur ne doit pas faire réapparaître ce qui vient d'être retiré,
  // ni repasser en non lu ce qui vient d'être lu.
  const overlay = useCallback((list, unreadCount) => {
    const p = pending.current;
    if (!p) return { list, unreadCount };
    if (p.kind === "remove") {
      const kept = list.filter((n) => !p.ids.includes(n.id));
      return { list: kept, unreadCount: Math.max(0, unreadCount - list.filter((n) => p.ids.includes(n.id) && !n.read).length) };
    }
    if (p.ids === "all") return { list: list.map((n) => ({ ...n, read: true })), unreadCount: 0 };
    return { list: list.map((n) => (p.ids.includes(n.id) ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, unreadCount - list.filter((n) => p.ids.includes(n.id) && !n.read).length) };
  }, []);

  const load = useCallback(async () => {
    if (!apiClient.getToken()) return;
    const mine = seq.current;
    try {
      const data = await apiClient.get(`/api/v1/notifications/global?limit=${limit}${view === "unread" ? "&unread_only=true" : ""}`);
      if (!alive.current || mine !== seq.current || !Array.isArray(data?.notifications)) return;
      const fromServer = Number.isFinite(data.unread_count) ? data.unread_count : data.notifications.filter((n) => !n.read).length;
      const shown = overlay(data.notifications, fromServer);
      setItems(shown.list);
      setUnread(shown.unreadCount);
      setTotal(Number.isFinite(data.total_count) ? data.total_count : data.notifications.length);
    } catch { /* réseau : on garde la liste affichée, le prochain passage réessaie */ }
    finally { if (alive.current) setLoading(false); }
  }, [limit, view, overlay]);

  useEffect(() => {
    alive.current = true;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive.current = false; clearInterval(timer); };
  }, [load]);

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

  const changeView = useCallback((next) => { lastView = next; setView(next); setLimit(PAGE); setLoading(true); }, []);
  const showMore = useCallback(() => { setLimit((l) => l + PAGE); setLoading(true); }, []);

  // Refus du serveur : on le dit, et la liste revient à ce que le serveur sait.
  const fail = useCallback((text) => {
    say({ key: Date.now(), tone: "error", text });
    seq.current += 1;
    load();
  }, [say, load]);

  // Un geste qui se défait : appliqué tout de suite à l'écran, envoyé au serveur après UNDO_MS (ou au geste suivant, ou en
  // quittant la page). « Annuler » remet l'écran comme avant, sans rien avoir envoyé.
  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    p.commit();
  }, []);
  const offerUndo = useCallback((entry, text) => {
    flush();
    pending.current = entry;
    entry.timer = setTimeout(() => {
      if (pending.current !== entry) return;
      pending.current = null;
      setToast((t) => (t?.entry === entry ? null : t));
      entry.commit();
    }, UNDO_MS);
    say({ key: Date.now(), tone: "info", text, entry, undo: () => {
      if (pending.current !== entry) return;
      clearTimeout(entry.timer);
      pending.current = null;
      seq.current += 1;
      setToast(null);
      entry.restore();
    } });
  }, [flush, say]);
  useEffect(() => () => { clearTimeout(toastTimer.current); flush(); }, [flush]);

  // Lu d'un geste léger (ouvrir, « Lire la suite », le point vert) : sans « Annuler » ; `undo` : la sélection « Lu ».
  const markRead = useCallback(async (ids, { undo = false } = {}) => {
    if (!ids.length) return;
    seq.current += 1;
    const before = itemsRef.current.filter((n) => ids.includes(n.id) && !n.read).map((n) => n.id);
    setUnread((u) => Math.max(0, u - before.length));
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    const commit = () => apiClient.post("/api/v1/notifications/global/read", { ids })
      .catch(() => fail("La lecture n’a pas été enregistrée. La liste a été rechargée."));
    if (!undo) { await commit(); return; }
    offerUndo({ kind: "read", ids, commit, restore: () => {
      setItems((prev) => prev.map((n) => (before.includes(n.id) ? { ...n, read: false } : n)));
      setUnread((u) => u + before.length);
    } }, `${plural(before.length || ids.length, "notification marquée", "notifications marquées")} comme lue${(before.length || ids.length) > 1 ? "s" : ""}`);
  }, [fail, offerUndo]);

  const markAllRead = useCallback(async () => {
    seq.current += 1;
    const wasUnread = new Set(itemsRef.current.filter((n) => !n.read).map((n) => n.id));
    const count = unreadRef.current;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    offerUndo({ kind: "read", ids: "all",
      commit: () => apiClient.post("/api/v1/notifications/global/read-all")
        .catch(() => fail("« Tout marquer comme lu » n’a pas été enregistré. La liste a été rechargée.")),
      restore: () => {
        setItems((prev) => prev.map((n) => (wasUnread.has(n.id) ? { ...n, read: false } : n)));
        setUnread(count);
      } }, `${plural(count, "notification marquée", "notifications marquées")} comme lue${count > 1 ? "s" : ""}`);
  }, [fail, offerUndo]);

  // Retirer de SA liste (les autres destinataires la gardent) ; le serveur la compte aussi comme lue.
  const dismiss = useCallback(async (ids) => {
    if (!ids.length) return false;
    seq.current += 1;
    const gone = itemsRef.current.filter((n) => ids.includes(n.id));
    const goneUnread = gone.filter((n) => !n.read).length;
    setUnread((u) => Math.max(0, u - goneUnread));
    setTotal((t) => Math.max(0, t - gone.length));
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    offerUndo({ kind: "remove", ids,
      commit: () => apiClient.post("/api/v1/notifications/global/dismiss", { ids })
        .catch(() => fail("Le retrait n’a pas été enregistré. La liste a été rechargée.")),
      restore: () => {
        setItems((prev) => [...prev, ...gone.filter((g) => !prev.some((n) => n.id === g.id))].sort(byDate));
        setUnread((u) => u + goneUnread);
        setTotal((t) => t + gone.length);
      } }, `${plural(gone.length || ids.length, "notification retirée", "notifications retirées")}`);
    return true;
  }, [fail, offerUndo]);

  return { items, unreadCount: unread, total, view, setView: changeView, showMore, loading, markRead, markAllRead, dismiss, toast };
}
