// File: src/components/modals/ConfigureBundlerModal.jsx
import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  ClipboardCopy,
  ListChecks,
  SplitSquareVertical,
  Trash2,
} from "lucide-react";

export default function ConfigureBundlerModal({
  isOpen,
  onClose,
  wallets = [],
  groupName = "Active Group",
  onSave, // optional: (config) => void
}) {
  // --- Section DEV (wallet index 0)
  const [devSolAmount, setDevSolAmount] = useState(0.01);
  const [creationTip, setCreationTip] = useState(0.0005);

  // --- Section Snipers (wallets index >= 1)
  // amountsByWallet: { [walletAddress: string]: number }
  const [amountsByWallet, setAmountsByWallet] = useState({});
  const [sniperTip, setSniperTip] = useState(0.0002); // tip per sniper tx (optional)
  const [maxSnipers, setMaxSnipers] = useState(3); // soft cap visual/helper

  // Init / reset when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = {};
      wallets.slice(1).forEach((w) => (initial[w.wallet] = 0));
      setAmountsByWallet(initial);
    }
  }, [isOpen, wallets]);

  // Derived lists
  const devWallet = wallets[0]?.wallet || null;
  const sniperWallets = useMemo(() => wallets.slice(1), [wallets]);

  // --- Helpers
  const fmt = (n) =>
    Number.isFinite(n) ? (n % 1 === 0 ? n.toString() : n.toFixed(6)) : "0";

  const totalSnipersSol = useMemo(
    () =>
      sniperWallets.reduce(
        (acc, w) => acc + (Number(amountsByWallet[w.wallet]) || 0),
        0
      ),
    [sniperWallets, amountsByWallet]
  );

  const totalSnipersTips = useMemo(
    () =>
      sniperWallets.reduce(
        (acc, w) =>
          acc + ((Number(amountsByWallet[w.wallet]) || 0) > 0 ? sniperTip : 0),
        0
      ),
    [sniperWallets, amountsByWallet, sniperTip]
  );

  const grandTotal = useMemo(
    () =>
      (Number(devSolAmount) || 0) +
      (Number(creationTip) || 0) +
      totalSnipersSol +
      totalSnipersTips,
    [devSolAmount, creationTip, totalSnipersSol, totalSnipersTips]
  );

  // --- Validation
  const errors = useMemo(() => {
    const e = {};
    if (devSolAmount < 0) e.devSolAmount = "Must be ≥ 0.";
    if (creationTip < 0) e.creationTip = "Must be ≥ 0.";
    if (sniperTip < 0) e.sniperTip = "Must be ≥ 0.";
    const countPositive = sniperWallets.filter(
      (w) => (Number(amountsByWallet[w.wallet]) || 0) > 0
    ).length;
    if (countPositive > maxSnipers) {
      e.snipers = `You set ${countPositive} snipers, but max is ${maxSnipers}.`;
    }
    return e;
  }, [
    devSolAmount,
    creationTip,
    sniperTip,
    sniperWallets,
    amountsByWallet,
    maxSnipers,
  ]);

  const isSubmitDisabled = Object.keys(errors).length > 0;

  // --- Bulk ops
  const distributeEqually = (total = 0.3) => {
    const n = sniperWallets.length || 1;
    const per = Number((total / n).toFixed(6));
    const next = {};
    sniperWallets.forEach((w) => (next[w.wallet] = per));
    setAmountsByWallet(next);
  };

  const setAll = (value = 0) => {
    const next = {};
    sniperWallets.forEach((w) => (next[w.wallet] = Number(value) || 0));
    setAmountsByWallet(next);
  };

  const copyAddresses = async () => {
    const lines = sniperWallets.map((w) => w.wallet).join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      alert("Sniper addresses copied to clipboard");
    } catch {
      alert("Clipboard permission denied");
    }
  };

  // --- Submit
  const handleSave = () => {
    const payload = {
      groupName,
      dev: {
        wallet: devWallet,
        devSolAmount: Number(devSolAmount) || 0,
        creationTip: Number(creationTip) || 0,
      },
      snipers: sniperWallets.map((w) => ({
        wallet: w.wallet,
        amount: Number(amountsByWallet[w.wallet]) || 0,
        tip:
          (Number(amountsByWallet[w.wallet]) || 0) > 0
            ? Number(sniperTip) || 0
            : 0,
      })),
      totals: {
        totalSnipersSol,
        totalSnipersTips,
        grandTotal,
      },
      constraints: {
        maxSnipers,
      },
    };

    if (onSave) onSave(payload);
    console.log("[ConfigureBundlerModal] Save:", payload);
    onClose?.();
  };

  const numberInputClass =
    "w-full px-3 py-2 rounded-lg bg-[#2A2346] text-white border border-white/10 " +
    "focus:outline-none focus:ring-2 focus:ring-lime-400/70 placeholder-white/30 text-sm";

  const Section = ({ title, children, right }) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );

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

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
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
                  Configure Bundler for{" "}
                  <span className="text-white/90">{groupName}</span>
                </Dialog.Title>
                <p className="mt-1 text-sm text-white/60">
                  Set creation budget for the DEV wallet and distribute SOL
                  across sniper wallets.
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-8 max-h-[70vh] overflow-y-auto">
                {/* DEV Section */}
                <Section title="Dev wallet (index 0)">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="Dev wallet address" hint="Read-only">
                      <input
                        type="text"
                        value={devWallet || "—"}
                        disabled
                        className="w-full px-3 py-2 rounded-lg bg-[#251C46] text-white/80 border border-white/10 text-sm"
                      />
                    </Field>
                    <Field
                      label="Dev SOL amount"
                      error={errors.devSolAmount}
                      hint="Amount allocated for creation."
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={devSolAmount}
                        onChange={(e) =>
                          setDevSolAmount(Number(e.target.value))
                        }
                        className={numberInputClass}
                        placeholder="0.01"
                      />
                    </Field>
                    <Field
                      label="Creation tip (SOL)"
                      error={errors.creationTip}
                      hint="Optional inclusion tip."
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={creationTip}
                        onChange={(e) => setCreationTip(Number(e.target.value))}
                        className={numberInputClass}
                        placeholder="0.0005"
                      />
                    </Field>
                  </div>
                </Section>

                {/* Snipers Section */}
                <Section
                  title="Sniper wallets (index ≥ 1)"
                  right={
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => distributeEqually(0.3)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
                        title="Distribute 0.3 SOL equally"
                      >
                        <SplitSquareVertical size={14} /> Equal split 0.3
                      </button>
                      <button
                        onClick={() => setAll(0)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
                        title="Set all sniper amounts to 0"
                      >
                        <Trash2 size={14} /> Clear all
                      </button>
                      <button
                        onClick={copyAddresses}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10"
                        title="Copy all sniper addresses"
                      >
                        <ClipboardCopy size={14} /> Copy addrs
                      </button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <Field label="Max snipers (soft cap)">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={maxSnipers}
                        onChange={(e) =>
                          setMaxSnipers(Number(e.target.value) || 0)
                        }
                        className={numberInputClass}
                      />
                    </Field>
                    <Field
                      label="Tip per sniper (SOL)"
                      error={errors.sniperTip}
                    >
                      <input
                        type="number"
                        min={0}
                        step="0.0001"
                        value={sniperTip}
                        onChange={(e) => setSniperTip(Number(e.target.value))}
                        className={numberInputClass}
                        placeholder="0.0002"
                      />
                    </Field>
                    <div className="flex items-end text-sm text-white/70">
                      <div className="w-full px-3 py-2 rounded-lg bg-[#251C46] border border-white/10">
                        Active snipers:{" "}
                        <strong>
                          {
                            sniperWallets.filter(
                              (w) =>
                                (Number(amountsByWallet[w.wallet]) || 0) > 0
                            ).length
                          }
                        </strong>{" "}
                        / {sniperWallets.length}
                      </div>
                    </div>
                  </div>

                  {/* Sniper editable list */}
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-white/5 text-gray-300 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Address</th>
                          <th className="px-4 py-3 text-left">Amount (SOL)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sniperWallets.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-6 text-center text-white/70"
                            >
                              No sniper wallets. Generate more wallets in this
                              group.
                            </td>
                          </tr>
                        ) : (
                          sniperWallets.map((w, i) => (
                            <tr
                              key={w.wallet}
                              className="border-t border-white/5 odd:bg-white/[0.02] hover:bg-white/[0.06] transition"
                            >
                              <td className="px-4 py-3">{i + 1}</td>
                              <td className="px-4 py-3 font-mono">
                                <span className="hidden md:inline">
                                  {w.wallet}
                                </span>
                                <span className="md:hidden">
                                  {w.wallet.slice(0, 4)}...{w.wallet.slice(-4)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.0001"
                                  value={amountsByWallet[w.wallet] ?? 0}
                                  onChange={(e) =>
                                    setAmountsByWallet((prev) => ({
                                      ...prev,
                                      [w.wallet]: Number(e.target.value) || 0,
                                    }))
                                  }
                                  className={numberInputClass}
                                  placeholder="0.1"
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {errors.snipers && (
                    <p className="mt-2 text-xs text-red-400">
                      {errors.snipers}
                    </p>
                  )}

                  {/* Totals */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="px-3 py-2 rounded-lg bg-[#251C46] border border-white/10 text-sm">
                      <div className="text-white/60">Snipers SOL</div>
                      <div className="text-white font-semibold">
                        {fmt(totalSnipersSol)} SOL
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[#251C46] border border-white/10 text-sm">
                      <div className="text-white/60">Snipers tips</div>
                      <div className="text-white font-semibold">
                        {fmt(totalSnipersTips)} SOL
                      </div>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-[#251C46] border border-white/10 text-sm">
                      <div className="text-white/60">Grand total</div>
                      <div className="text-white font-semibold">
                        {fmt(grandTotal)} SOL
                      </div>
                    </div>
                  </div>
                </Section>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 border border-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitDisabled}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition
                    ${
                      isSubmitDisabled
                        ? "bg-yellow-600/50 text-black/70 cursor-not-allowed"
                        : "bg-yellow-500 text-black hover:bg-yellow-400"
                    }`}
                  title={
                    isSubmitDisabled
                      ? "Fix form errors before continuing"
                      : "Save configuration"
                  }
                >
                  Save configuration
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
