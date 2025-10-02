// File: src/components/modals/ConfigureAutoBuyModal.jsx
import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Play, Square } from "lucide-react";
import { isTauriEnv } from "../../lib/tauriClient";

export default function ConfigureAutoBuyModal({
  isOpen,
  onClose,
  wallets = [],
  groupName = "",
  initialConfig, // { scope, amountSol, slippageBps, tipSol, intervalSec, maxPerTick }
  onSave, // (cfg) => void
  onStart, // (cfg) => void
  onStop, // ()  => void
}) {
  const tauriAvailable = isTauriEnv();

  const DEFAULT = {
    scope: "snipers", // "snipers" | "dev" | "all"
    amountSol: 0.1,
    slippageBps: 100,
    tipSol: 0.0002,
    intervalSec: 5,
    maxPerTick: 3,
  };

  const [cfg, setCfg] = useState(initialConfig || DEFAULT);
  const [running, setRunning] = useState(false);

  // reset form when opened or initialConfig changes
  useEffect(() => {
    if (isOpen) setCfg({ ...DEFAULT, ...(initialConfig || {}) });
  }, [isOpen, initialConfig]);

  // derive targets
  const targets = useMemo(() => {
    if (!wallets?.length) return [];
    if (cfg.scope === "dev") return wallets[0] ? [wallets[0]] : [];
    if (cfg.scope === "all") return wallets;
    return wallets.slice(1); // snipers
  }, [wallets, cfg.scope]);

  // validation
  const errors = useMemo(() => {
    const e = {};
    if (cfg.amountSol < 0) e.amountSol = "Must be ≥ 0.";
    if (cfg.slippageBps < 0) e.slippageBps = "Must be ≥ 0.";
    if (cfg.tipSol < 0) e.tipSol = "Must be ≥ 0.";
    if (cfg.intervalSec <= 0) e.intervalSec = "Must be > 0.";
    if (cfg.maxPerTick <= 0) e.maxPerTick = "Must be > 0.";
    if (!["snipers", "dev", "all"].includes(cfg.scope))
      e.scope = "Invalid scope.";
    return e;
  }, [cfg]);

  const hasErrors = Object.keys(errors).length > 0;

  // handlers
  const save = () => {
    onSave?.(cfg);
    onClose?.();
  };

  const start = () => {
    if (!tauriAvailable) return;
    if (hasErrors) return;
    if (targets.length === 0) return;
    setRunning(true);
    onStart?.(cfg);
  };

  const stop = () => {
    setRunning(false);
    onStop?.();
  };

  const Field = ({ label, error, hint, children }) => (
    <div className="space-y-1">
      <label className="text-xs text-white/70">{label}</label>
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-white/50">{hint}</p>
      ) : null}
    </div>
  );

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400/70 placeholder-white/30 text-sm";

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        {/* Overlay */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" />
        </Transition.Child>

        {/* Panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="transition-all duration-200 ease-out"
            enterFrom="opacity-0 translate-y-2 scale-95"
            enterTo="opacity-100 translate-y-0 scale-100"
            leave="transition-all duration-150 ease-in"
            leaveFrom="opacity-100 translate-y-0 scale-100"
            leaveTo="opacity-0 translate-y-2 scale-95"
          >
            <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-[#1B1435] text-white shadow-2xl border border-white/10">
              {/* Header */}
              <div className="px-6 pt-6 pb-3 border-b border-white/10">
                <Dialog.Title className="text-xl font-bold">
                  Auto Buy —{" "}
                  <span className="text-white/90">{groupName || "Group"}</span>
                </Dialog.Title>
                <p className="mt-1 text-sm text-white/60">
                  Configure automated buys for the wallets listed below.{" "}
                  <span className="text-white/70">Targets:</span>{" "}
                  <span className="font-semibold">{targets.length}</span>
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                  <div className="sm:col-span-2">
                    <Field label="Scope" error={errors.scope}>
                      <select
                        className={inputClass}
                        value={cfg.scope}
                        onChange={(e) =>
                          setCfg((c) => ({ ...c, scope: e.target.value }))
                        }
                      >
                        <option value="snipers">Snipers (non-DEV)</option>
                        <option value="dev">DEV only</option>
                        <option value="all">All wallets</option>
                      </select>
                    </Field>
                  </div>

                  <div>
                    <Field label="Amount (SOL)" error={errors.amountSol}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputClass}
                        value={cfg.amountSol}
                        onChange={(e) =>
                          setCfg((c) => ({
                            ...c,
                            amountSol: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div>
                    <Field label="Slippage (bps)" error={errors.slippageBps}>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className={inputClass}
                        value={cfg.slippageBps}
                        onChange={(e) =>
                          setCfg((c) => ({
                            ...c,
                            slippageBps: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div>
                    <Field label="Tip (SOL)" error={errors.tipSol}>
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        className={inputClass}
                        value={cfg.tipSol}
                        onChange={(e) =>
                          setCfg((c) => ({
                            ...c,
                            tipSol: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div>
                    <Field label="Interval (sec)" error={errors.intervalSec}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputClass}
                        value={cfg.intervalSec}
                        onChange={(e) =>
                          setCfg((c) => ({
                            ...c,
                            intervalSec: Number(e.target.value) || 1,
                          }))
                        }
                      />
                    </Field>
                  </div>

                  <div>
                    <Field label="Max per tick" error={errors.maxPerTick}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputClass}
                        value={cfg.maxPerTick}
                        onChange={(e) =>
                          setCfg((c) => ({
                            ...c,
                            maxPerTick: Number(e.target.value) || 1,
                          }))
                        }
                      />
                    </Field>
                  </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <div className="text-white/60">Targets</div>
                    <div className="text-white font-semibold">
                      {targets.length}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <div className="text-white/60">Orders per tick</div>
                    <div className="text-white font-semibold">
                      ≤ {Math.min(cfg.maxPerTick || 0, targets.length)}
                    </div>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                    <div className="text-white/60">Status</div>
                    <div
                      className={`font-semibold ${
                        running ? "text-lime-400" : "text-white/70"
                      }`}
                    >
                      {running ? "Running" : "Stopped"}
                    </div>
                  </div>
                </div>

                {!tauriAvailable && (
                  <p className="text-xs text-amber-300">
                    Tauri IPC not available — open the app via{" "}
                    <span className="font-semibold">tauri dev</span> to enable
                    automation.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={start}
                    disabled={
                      !tauriAvailable ||
                      hasErrors ||
                      targets.length === 0 ||
                      running
                    }
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition
                      ${
                        !tauriAvailable ||
                        hasErrors ||
                        targets.length === 0 ||
                        running
                          ? "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                          : "bg-lime-500 text-black hover:bg-lime-400 border-lime-400/60"
                      }`}
                  >
                    <Play size={14} />
                    Start
                  </button>

                  <button
                    type="button"
                    onClick={stop}
                    disabled={!running}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition
                      ${
                        !running
                          ? "bg-white/5 border-white/10 opacity-50 cursor-not-allowed"
                          : "bg-rose-500/90 text-white hover:bg-rose-400 border-rose-400/60"
                      }`}
                  >
                    <Square size={14} />
                    Stop
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 border border-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={hasErrors}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition
                      ${
                        hasErrors
                          ? "bg-lime-600/50 text-black/70 cursor-not-allowed"
                          : "bg-lime-500 text-black hover:bg-lime-400"
                      }`}
                    title={
                      hasErrors
                        ? "Fix errors before saving"
                        : "Save configuration"
                    }
                  >
                    Save configuration
                  </button>
                </div>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
