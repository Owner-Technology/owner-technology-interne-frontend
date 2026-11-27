// Facturation d'un onboarding, sur la fiche Finance et sur le billet du board (réunion du 27/11/2026) : qui la mène
// (les CSM le voient), et la passer à une collègue au dernier moment (la finance). Le serveur décide de tout : les noms,
// qui peut changer, et le geste lui-même (`/optilex/board-transfer-billing` : même horaire, même lien de réunion).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion as Motion } from "framer-motion";
import apiClient from "../services/apiClient";
import { READ_ONLY_PROPS } from "../utils/readOnlyRoles.js";
import { billingLeader, billingTargets } from "../utils/onboardingBilling.js";

const INK = "#1c1b19";
const MUTED = "#8b867e";
const BORDER = "#e8e4de";
const CARD = "#ffffff";
const CHARCOAL = "#2b2927";
const RED = "#c5221f";

export function useOnboardingBilling(numeroClient, enabled = true, version = 0) {
  const [info, setInfo] = useState(null);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (!enabled || !numeroClient) { setInfo(null); return undefined; }
    let alive = true;
    apiClient.get(`/api/v1/optilex/board-onboarding-billing?numero_client=${encodeURIComponent(numeroClient)}`)
      .then((r) => { if (alive) setInfo(r || null); })
      .catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [numeroClient, enabled, version, bump]);
  return [info, () => setBump((v) => v + 1)];
}

function TransferBillingModal({ numeroClient, label, target, current, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const confirm = async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      await apiClient.post("/api/v1/optilex/board-transfer-billing", { numero_client: numeroClient, name: target.name });
      onDone();
    } catch (e) {
      const d = e?.data?.detail;
      setError(typeof d === "string" ? d : "La facturation n’a pas pu être passée. Rien n’a changé.");
      setSaving(false);
    }
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Passer la facturation à ${target.name}`}
      style={{ position: "fixed", inset: 0, zIndex: 10080, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif" }}>
      <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => { if (!saving) onClose(); }}
        style={{ position: "absolute", inset: 0, background: "rgba(28,27,25,.22)" }} />
      <Motion.div initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: "relative", width: "min(420px, 100%)", background: CARD, borderRadius: 22, border: `1px solid ${BORDER}`,
          boxShadow: "0 24px 60px rgba(28,27,25,.14)", padding: "20px 22px" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: INK }}>Passer la facturation à {target.name}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}{current ? ` · ${current}` : ""}{target.offWeek ? " · hors de sa semaine" : ""}
        </div>
        {error && <div role="alert" style={{ marginTop: 10, fontSize: 12, color: RED, lineHeight: 1.5 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" disabled={saving} onClick={onClose}
            style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${BORDER}`, background: CARD, color: INK, fontSize: 13,
              fontWeight: 500, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>Annuler</button>
          <Motion.button type="button" whileTap={{ scale: 0.97 }} disabled={saving} onClick={confirm}
            style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: CHARCOAL, color: "#fff", fontSize: 13, fontWeight: 500,
              cursor: saving ? "default" : "pointer", fontFamily: "inherit", opacity: saving ? 0.75 : 1 }}>
            {saving ? "Enregistrement…" : "Confirmer"}
          </Motion.button>
        </div>
      </Motion.div>
    </div>,
    document.body,
  );
}

// La ligne « Facturation menée par » et, pour la finance, une pastille par collègue. `readOnly` : pastilles visibles,
// désactivées. `onChanged` : après un passage réussi (la fiche ou le billet se relisent).
export default function OnboardingBilling({ numeroClient, label, info, onChanged, readOnly = false, style }) {
  const [target, setTarget] = useState(null);
  const leader = billingLeader(info);
  if (!leader) return null;
  const targets = billingTargets(info);
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, ...style }}>
      <span style={{ fontSize: 12, color: MUTED }}>Facturation menée par</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: info?.name ? INK : RED }}>{leader}</span>
      {targets.map((t) => (
        <button key={t.name} type="button" onClick={() => setTarget(t)} title={t.offWeek ? "Hors de sa semaine" : undefined}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${BORDER}`, background: CARD, borderRadius: 999,
            padding: "3px 10px", fontSize: 12, fontWeight: 500, color: t.offWeek ? MUTED : INK, cursor: "pointer", fontFamily: "inherit" }}
          {...(readOnly ? READ_ONLY_PROPS : {})}>
          Passer à {t.name}
        </button>
      ))}
      {target && !readOnly && (
        <TransferBillingModal numeroClient={numeroClient} label={label} target={target} current={info?.name}
          onClose={() => setTarget(null)} onDone={() => { setTarget(null); onChanged?.(); }} />
      )}
    </div>
  );
}
