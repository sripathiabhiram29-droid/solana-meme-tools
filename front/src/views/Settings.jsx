// File: src/views/Settings.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Save,
  RefreshCw,
  Upload,
  Download,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import Toast from "../components/Toast";
import { useApp } from "../context/AppContext";
import { isTauriEnv, tauriInvoke } from "../lib/tauriClient";
import { derivePublicKey, isHttpUrl, isWsUrl, isHex, pad5 } from "../lib/utils";
import SettingsField from "../components/SettingsField";

const LS_KEY = "mc_settings_v1";

const DEFAULTS = {
  // Endpoints
  rpcUrl: "https://api.mainnet-beta.solana.com",
  wsUrl: "wss://api.mainnet-beta.solana.com",

  // Sensitive
  fundingPk: "", // base58-encoded private key

  // Trading defaults
  slippageBps: 100, // 1%
  tipSol: 0.0005,
  cuPriceMicrolamports: 0,
  maxUnitPriceMicrolamports: 0,

  // Presets (exactly 5)
  buyPresets: [0.1, 0.2, 0.3, 0.5, 1],
  sellPercents: [10, 30, 50, 75, 100],

  // Behavior
  autoRefreshSec: 60,
  targetScope: "selected", // "selected" | "snipers" | "dev"
  maxSnipers: 3,

  // UI
  compactRows: false,
  enableToasts: true,
};

export default function Settings({ onSave }) {
  const { groups = [], activeGroupName, setActiveGroup } = useApp?.() || {};
  // Endpoints
  const [rpcUrl, setRpcUrl] = useState(DEFAULTS.rpcUrl);
  const [wsUrl, setWsUrl] = useState(DEFAULTS.wsUrl);

  // Sensitive
  const [fundingPk, setFundingPk] = useState(DEFAULTS.fundingPk);
  const [revealPk, setRevealPk] = useState(false);

  // Trading defaults
  const [slippageBps, setSlippageBps] = useState(DEFAULTS.slippageBps);
  const [tipSol, setTipSol] = useState(DEFAULTS.tipSol);
  const [cuPriceMicrolamports, setCuPrice] = useState(
    DEFAULTS.cuPriceMicrolamports
  );
  const [maxUnitPriceMicrolamports, setMaxUnitPrice] = useState(
    DEFAULTS.maxUnitPriceMicrolamports
  );

  // Presets (5 editable buttons each)
  // buy/sell presets are now managed per-wallet-group in Wallets view

  // Behavior
  const [autoRefreshSec, setAutoRefreshSec] = useState(DEFAULTS.autoRefreshSec);
  const [targetScope, setTargetScope] = useState(DEFAULTS.targetScope);
  const [maxSnipers, setMaxSnipers] = useState(DEFAULTS.maxSnipers);

  // UI
  const [compactRows, setCompactRows] = useState(DEFAULTS.compactRows);
  const [enableToasts, setEnableToasts] = useState(DEFAULTS.enableToasts);

  // Toast
  const [toast, setToast] = useState(null);

  // Refund wallet balance
  const [fundingBalance, setFundingBalance] = useState(null);
  const [fundingBalanceLoading, setFundingBalanceLoading] = useState(false);
  const tauriAvailable = isTauriEnv();

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      if (!tauriAvailable) return;
      if (!fundingPk) {
        setFundingBalance(null);
        return;
      }
      setFundingBalanceLoading(true);
      try {
        const walletPub = derivePublicKey(fundingPk);
        if (!walletPub)
          throw new Error("Could not derive public key from provided input");
        const balanceLamports = await tauriInvoke("get_sol_balance", {
          wallet: walletPub,
        });
        const balance =
          typeof balanceLamports === "number" && balanceLamports > 1e9
            ? balanceLamports / 1_000_000_000
            : Number(balanceLamports) || 0;
        if (mounted) setFundingBalance(balance);
      } catch (e) {
        console.error("Failed to load funding balance", e);
        if (mounted) setFundingBalance(null);
      } finally {
        if (mounted) setFundingBalanceLoading(false);
      }
    };
    refresh();
    return () => {
      mounted = false;
    };
  }, [fundingPk, tauriAvailable]);

  // Helpers imported from ../lib/utils

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);

      if (s.rpcUrl) setRpcUrl(s.rpcUrl);
      if (s.wsUrl) setWsUrl(s.wsUrl);
      if (typeof s.fundingPk === "string") setFundingPk(s.fundingPk);

      if (Number.isFinite(s.slippageBps)) setSlippageBps(s.slippageBps);
      if (Number.isFinite(s.tipSol)) setTipSol(s.tipSol);
      if (Number.isFinite(s.cuPriceMicrolamports))
        setCuPrice(s.cuPriceMicrolamports);
      if (Number.isFinite(s.maxUnitPriceMicrolamports))
        setMaxUnitPrice(s.maxUnitPriceMicrolamports);

      // buy/sell presets intentionally ignored here (managed per-group)

      if (Number.isFinite(s.autoRefreshSec))
        setAutoRefreshSec(s.autoRefreshSec);
      if (typeof s.targetScope === "string") setTargetScope(s.targetScope);
      if (Number.isFinite(s.maxSnipers)) setMaxSnipers(s.maxSnipers);

      if (typeof s.compactRows === "boolean") setCompactRows(s.compactRows);
      if (typeof s.enableToasts === "boolean") setEnableToasts(s.enableToasts);
    } catch {
      // ignore
    }
  }, []);

  // Validation
  const errors = useMemo(() => {
    const e = {};
    if (!isHttpUrl(rpcUrl)) e.rpcUrl = "Invalid HTTP RPC URL.";
    if (!isWsUrl(wsUrl)) e.wsUrl = "Invalid WebSocket URL.";
    // if (fundingPk && !isHex(fundingPk))
    //   e.fundingPk = "Private key must be hex.";
    if (slippageBps < 0) e.slippageBps = "Must be ≥ 0.";
    if (tipSol < 0) e.tipSol = "Must be ≥ 0.";
    if (cuPriceMicrolamports < 0) e.cuPriceMicrolamports = "Must be ≥ 0.";
    if (maxUnitPriceMicrolamports < 0)
      e.maxUnitPriceMicrolamports = "Must be ≥ 0.";
    if (autoRefreshSec < 0) e.autoRefreshSec = "Must be ≥ 0.";
    if (!["selected", "snipers", "dev"].includes(targetScope))
      e.targetScope = "Invalid scope.";
    if (maxSnipers < 0) e.maxSnipers = "Must be ≥ 0.";
    // buy/sell presets validation moved to per-group editor
    return e;
  }, [
    rpcUrl,
    wsUrl,
    fundingPk,
    slippageBps,
    tipSol,
    cuPriceMicrolamports,
    maxUnitPriceMicrolamports,
    autoRefreshSec,
    targetScope,
    maxSnipers,
  ]);

  const hasErrors = Object.keys(errors).length > 0;

  // Actions
  const handleSave = () => {
    const payload = {
      rpcUrl: rpcUrl.trim(),
      wsUrl: wsUrl.trim(),
      fundingPk: fundingPk.trim(),
      slippageBps: Number(slippageBps) || 0,
      tipSol: Number(tipSol) || 0,
      cuPriceMicrolamports: Number(cuPriceMicrolamports) || 0,
      maxUnitPriceMicrolamports: Number(maxUnitPriceMicrolamports) || 0,
      // buy/sell presets are intentionally excluded (managed per-group)
      autoRefreshSec: Number(autoRefreshSec) || 0,
      targetScope,
      maxSnipers: Number(maxSnipers) || 0,
      compactRows: !!compactRows,
      enableToasts: !!enableToasts,
    };

    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
      setToast("Settings saved ✓");
      onSave?.(payload);
      window.dispatchEvent(new Event("settings:changed"));
    } catch {
      setToast("Failed to save settings");
    }
  };

  const handleReset = () => {
    setRpcUrl(DEFAULTS.rpcUrl);
    setWsUrl(DEFAULTS.wsUrl);
    setFundingPk(DEFAULTS.fundingPk);
    setSlippageBps(DEFAULTS.slippageBps);
    setTipSol(DEFAULTS.tipSol);
    setCuPrice(DEFAULTS.cuPriceMicrolamports);
    setMaxUnitPrice(DEFAULTS.maxUnitPriceMicrolamports);
    // buy/sell presets removed from global settings
    // buy/sell presets removed from global settings
    setAutoRefreshSec(DEFAULTS.autoRefreshSec);
    setTargetScope(DEFAULTS.targetScope);
    setMaxSnipers(DEFAULTS.maxSnipers);
    setCompactRows(DEFAULTS.compactRows);
    setEnableToasts(DEFAULTS.enableToasts);
    setToast("Defaults restored");
  };

  const handleResetAllData = () => {
    if (
      !confirm(
        "Reset ALL application data to defaults? This will clear settings, group presets, groups, wallets, and last mint selection."
      )
    ) {
      return;
    }

    try {
      // Reset main settings
      localStorage.removeItem("mc_settings_v1");

      // Reset group presets
      localStorage.removeItem("mc_group_presets_v1");

      // Reset groups and wallets
      localStorage.removeItem("mc_groups_v1");
      localStorage.removeItem("mc_active_group_v1");

      // Reset last mint selection
      localStorage.removeItem("mc_last_mint_v1");

      // Reset form to defaults
      handleReset();

      // Notify other components
      window.dispatchEvent(new Event("settings:changed"));
      window.dispatchEvent(new Event("group_presets:changed"));

      setToast("All application data reset to defaults ✓");
    } catch (e) {
      console.error("Error resetting data:", e);
      setToast("Error resetting data");
    }
  };

  const handleResetSettings = () => {
    if (!confirm("Reset settings to defaults?")) return;

    try {
      localStorage.removeItem("mc_settings_v1");
      handleReset();
      window.dispatchEvent(new Event("settings:changed"));
      setToast("Settings reset to defaults ✓");
    } catch (e) {
      console.error("Error resetting settings:", e);
      setToast("Error resetting settings");
    }
  };

  const handleResetGroupPresets = () => {
    if (!confirm("Reset all group buy/sell presets to defaults?")) return;

    try {
      localStorage.removeItem("mc_group_presets_v1");
      window.dispatchEvent(new Event("group_presets:changed"));
      setToast("Group presets reset to defaults ✓");
    } catch (e) {
      console.error("Error resetting group presets:", e);
      setToast("Error resetting group presets");
    }
  };

  const handleResetGroups = () => {
    if (
      !confirm(
        "Reset all groups and wallets to defaults? This will remove all custom groups and wallets."
      )
    )
      return;

    try {
      localStorage.removeItem("mc_groups_v1");
      localStorage.removeItem("mc_active_group_v1");
      // Force page refresh to reload default groups from AppContext
      window.location.reload();
    } catch (e) {
      console.error("Error resetting groups:", e);
      setToast("Error resetting groups");
    }
  };

  const handleResetMintSelection = () => {
    if (!confirm("Clear last token mint selection?")) return;

    try {
      localStorage.removeItem("mc_last_mint_v1");
      setToast("Mint selection cleared ✓");
    } catch (e) {
      console.error("Error clearing mint selection:", e);
      setToast("Error clearing mint selection");
    }
  };

  const handleExport = () => {
    const raw =
      localStorage.getItem(LS_KEY) ?? JSON.stringify(DEFAULTS, null, 2);
    const blob = new Blob([raw], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "memecore_settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const text = prompt("Paste settings JSON:");
    if (!text) return;
    try {
      const s = JSON.parse(text);
      localStorage.setItem(LS_KEY, JSON.stringify(s));
      setToast("Settings imported ✓");

      setRpcUrl(s.rpcUrl ?? DEFAULTS.rpcUrl);
      setWsUrl(s.wsUrl ?? DEFAULTS.wsUrl);
      setFundingPk(s.fundingPk ?? DEFAULTS.fundingPk);
      setSlippageBps(
        Number.isFinite(s.slippageBps) ? s.slippageBps : DEFAULTS.slippageBps
      );
      setTipSol(Number.isFinite(s.tipSol) ? s.tipSol : DEFAULTS.tipSol);
      setCuPrice(
        Number.isFinite(s.cuPriceMicrolamports)
          ? s.cuPriceMicrolamports
          : DEFAULTS.cuPriceMicrolamports
      );
      setMaxUnitPrice(
        Number.isFinite(s.maxUnitPriceMicrolamports)
          ? s.maxUnitPriceMicrolamports
          : DEFAULTS.maxUnitPriceMicrolamports
      );

      setBuyPresets(
        pad5(
          (s.buyPresets ?? DEFAULTS.buyPresets)
            .map(Number)
            .filter((n) => Number.isFinite(n) && n >= 0),
          0
        )
      );
      setSellPercents(
        pad5(
          (s.sellPercents ?? DEFAULTS.sellPercents)
            .map((n) => parseInt(n, 10))
            .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100),
          0
        )
      );
      // buy/sell presets ignored on import (managed per-group)

      setAutoRefreshSec(
        Number.isFinite(s.autoRefreshSec)
          ? s.autoRefreshSec
          : DEFAULTS.autoRefreshSec
      );
      setTargetScope(
        typeof s.targetScope === "string" ? s.targetScope : DEFAULTS.targetScope
      );
      setMaxSnipers(
        Number.isFinite(s.maxSnipers) ? s.maxSnipers : DEFAULTS.maxSnipers
      );
      setCompactRows(
        typeof s.compactRows === "boolean"
          ? s.compactRows
          : DEFAULTS.compactRows
      );
      setEnableToasts(
        typeof s.enableToasts === "boolean"
          ? s.enableToasts
          : DEFAULTS.enableToasts
      );
    } catch {
      setToast("Invalid JSON");
    }
  };

  const Field = SettingsField;

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400/70 placeholder-white/30 text-sm";

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0B0A13] text-white">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            Settings
          </h2>
          <p className="text-sm text-white/60">
            Configure RPC endpoints, funding wallet, and trading defaults.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
            title="Import settings JSON"
          >
            <Upload size={14} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
            title="Export settings JSON"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
            title="Restore defaults"
          >
            <RefreshCw size={14} />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={hasErrors}
            className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg font-semibold transition ${
              hasErrors
                ? "bg-lime-600/50 text-black/70 cursor-not-allowed"
                : "bg-lime-500 text-black hover:bg-lime-400"
            }`}
            title={hasErrors ? "Fix errors before saving" : "Save settings"}
          >
            <Save size={14} />
            Save
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* RPC endpoints */}
        <section className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">RPC endpoints</h3>
          <Field
            label="HTTP RPC URL"
            error={errors.rpcUrl}
            hint="E.g., https://api.mainnet-beta.solana.com"
          >
            <input
              className={inputClass}
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://…"
              spellCheck={false}
            />
          </Field>
          <Field
            label="WebSocket RPC URL"
            error={errors.wsUrl}
            hint="E.g., wss://api.mainnet-beta.solana.com"
          >
            <input
              className={inputClass}
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="wss://…"
              spellCheck={false}
            />
          </Field>
          <div className="text-xs text-white/50 flex items-center gap-2">
            <Info size={14} />
            You can override these in a .env if you prefer; UI values take
            precedence client-side.
          </div>
        </section>

        {/* Refund wallet */}
        <section className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">Refund wallet</h3>
          <Field
            label="Private key (base58)"
            error={errors.fundingPk}
            hint="Base58-encoded secret key. Stored locally (browser storage)."
          >
            <div className="flex items-center gap-2">
              <input
                className={inputClass + " font-mono"}
                type={revealPk ? "text" : "password"}
                value={fundingPk}
                onChange={(e) => setFundingPk(e.target.value.trim())}
                placeholder="(base58)"
                spellCheck={false}
              />
              <button
                onClick={() => setRevealPk((v) => !v)}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
                title={revealPk ? "Hide" : "Show"}
                type="button"
              >
                {revealPk ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="text-sm italic text-lime-400">
                {fundingBalance !== null ? (
                  <>
                    Balance:{" "}
                    {Number(fundingBalance).toLocaleString(undefined, {
                      maximumFractionDigits: 9,
                    })}{" "}
                    SOL
                  </>
                ) : fundingBalanceLoading ? (
                  <>Fetching balance…</>
                ) : fundingPk ? (
                  <>Balance: unavailable</>
                ) : (
                  <>—</>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  // trigger a manual refresh by toggling pk state to same value
                  if (!fundingPk || !tauriAvailable) return;
                  try {
                    // reuse the effect by briefly setting loading state and re-deriving
                    const walletPub = derivePublicKey(fundingPk);
                    if (!walletPub) return;
                    setFundingBalanceLoading(true);
                    const balanceLamports = await tauriInvoke(
                      "get_sol_balance",
                      { wallet: walletPub }
                    );
                    const balance =
                      typeof balanceLamports === "number" &&
                      balanceLamports > 1e9
                        ? balanceLamports / 1_000_000_000
                        : Number(balanceLamports) || 0;
                    setFundingBalance(balance);
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setFundingBalanceLoading(false);
                  }
                }}
                disabled={
                  !tauriAvailable || !fundingPk || fundingBalanceLoading
                }
                className="inline-flex items-center gap-2 px-2 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh refund wallet balance"
              >
                <RefreshCw
                  size={14}
                  className={fundingBalanceLoading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </Field>
        </section>

        {/* Active group selection (UX: placed under refund balance refresh) */}
        {/* <section className="lg:col-span-6 -mt-3 space-y-3">
          <Field label="Active group">
            <select
              className={inputClass}
              value={activeGroupName}
              onChange={(e) => setActiveGroup?.(e.target.value)}
            >
              {(groups || []).map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        </section> */}

        {/* Trading defaults */}
        <section className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">
            Trading defaults
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Slippage (bps)" error={errors.slippageBps}>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={slippageBps}
                onChange={(e) => setSlippageBps(Number(e.target.value))}
              />
            </Field>

            <Field label="Tip (SOL)" error={errors.tipSol}>
              <input
                type="number"
                min={0}
                step="0.0001"
                className={inputClass}
                value={tipSol}
                onChange={(e) => setTipSol(Number(e.target.value))}
              />
            </Field>
          </div>

          {/* CU price + Max unit price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="CU price (microlamports)"
              error={errors.cuPriceMicrolamports}
            >
              <input
                type="number"
                min={0}
                step={100}
                className={inputClass}
                value={cuPriceMicrolamports}
                onChange={(e) => setCuPrice(Number(e.target.value))}
              />
            </Field>
            <Field
              label="Max unit price (microlamports)"
              error={errors.maxUnitPriceMicrolamports}
            >
              <input
                type="number"
                min={0}
                step={100}
                className={inputClass}
                value={maxUnitPriceMicrolamports}
                onChange={(e) => setMaxUnitPrice(Number(e.target.value))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Auto-refresh (sec)" error={errors.autoRefreshSec}>
              <input
                type="number"
                min={0}
                step={1}
                className={inputClass}
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              />
            </Field>

            <Field label="Default target scope" error={errors.targetScope}>
              <select
                className={inputClass}
                value={targetScope}
                onChange={(e) => setTargetScope(e.target.value)}
              >
                <option value="selected">Selected</option>
                <option value="snipers">All non-DEV (snipers)</option>
                <option value="dev">DEV only</option>
              </select>
            </Field>
          </div>

          <Field label="Max snipers" error={errors.maxSnipers}>
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={maxSnipers}
              onChange={(e) => setMaxSnipers(Number(e.target.value))}
            />
          </Field>

          {/* Buy/Sell presets moved to Wallets (per-group). */}
        </section>

        {/* Reset Options */}
        <section className="lg:col-span-12 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">Reset Options</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Settings</div>
              <div className="text-white/60 text-xs mb-3">
                Reset RPC endpoints, trading defaults, and behavior settings to
                factory defaults.
              </div>
              <button
                onClick={handleResetSettings}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 transition w-full justify-center"
              >
                <RefreshCw size={14} />
                Reset Settings
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Group Presets</div>
              <div className="text-white/60 text-xs mb-3">
                Reset all group-specific buy/sell presets to default values for
                all wallet groups.
              </div>
              <button
                onClick={handleResetGroupPresets}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 transition w-full justify-center"
              >
                <RefreshCw size={14} />
                Reset Presets
              </button>
            </div>
          </div>
        </section>
        <section className="lg:col-span-12 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Groups & Wallets</div>
              <div className="text-white/60 text-xs mb-3">
                Reset all wallet groups and their wallets to defaults (dev,
                sniper, 1).
              </div>
              <button
                onClick={handleResetGroups}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 transition w-full justify-center"
              >
                <RefreshCw size={14} />
                Reset Groups
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm font-medium mb-2">Token Selection</div>
              <div className="text-white/60 text-xs mb-3">
                Clear the last selected token mint address from memory.
              </div>
              <button
                onClick={handleResetMintSelection}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400/30 transition w-full justify-center"
              >
                <RefreshCw size={14} />
                Clear Selection
              </button>
            </div>

            {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"> */}
          </div>
        </section>
        <section className="lg:col-span-12 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            <div className="bg-white/5 border border-red-400/30 rounded-xl p-4">
              <div className="text-sm font-medium mb-2 text-red-400">
                Reset All Data
              </div>
              <div className="text-white/60 text-xs mb-3">
                Reset ALL application data including settings, presets, groups,
                and selections. Use with caution.
              </div>
              <button
                onClick={handleResetAllData}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 transition w-full justify-center"
              >
                <RefreshCw size={14} />
                Reset All
              </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-12 space-y-3">
          <div className="text-xs text-white/50 flex items-center gap-2">
            <Info size={14} />
            All reset operations will ask for confirmation before proceeding.
            Settings marked with * affect the entire application.
          </div>
        </section>

        {/* UI / Behavior */}
        {/* <section className="lg:col-span-6 space-y-3">
          <h3 className="text-sm font-semibold text-white/80">UI & Behavior</h3>

          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Compact rows</div>
              <div className="text-white/60 text-xs">
                Denser tables for more data per screen.
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={compactRows}
                onChange={(e) => setCompactRows(e.target.checked)}
              />
              <span className="text-sm">Enable</span>
            </label>
          </div>

          <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2">
            <div className="text-sm">
              <div className="font-medium">Toasts</div>
              <div className="text-white/60 text-xs">
                Show toast notifications for actions.
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={enableToasts}
                onChange={(e) => setEnableToasts(e.target.checked)}
              />
              <span className="text-sm">Enable</span>
            </label>
          </div>
        </section> */}
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
