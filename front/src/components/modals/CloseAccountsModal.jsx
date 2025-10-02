import { Dialog } from "@headlessui/react";
import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext";
import { isTauriEnv, tauriInvoke } from "../../lib/tauriClient";
import { loadSettingsFromLocalStorage as loadSettingsFromLS } from "../../lib/utils";

// Close token accounts for a single wallet
// Props: isOpen, onClose
export default function CloseAccountsModal({ isOpen, onClose }) {
  const { groups } = useApp();
  const [walletAddr, setWalletAddr] = useState("");
  const [walletPk, setWalletPk] = useState("");
  const [fundingPk, setFundingPk] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    try {
      const settings = loadSettingsFromLS("mc_settings_v1", {});
      setFundingPk(settings?.fundingPk || "");
    } catch (_) {
      // ignore
    }
  }, [isOpen]);

  const resolvePkFromGroups = (address) => {
    if (!address) return "";
    for (const g of groups || []) {
      for (const w of g.wallets || []) {
        if (String(w.wallet).trim() === String(address).trim()) {
          return w.pk || w.privateKey || "";
        }
      }
    }
    return "";
  };

  const handleCloseAccounts = async () => {
    setError(null);
    if (!isTauriEnv()) {
      setError("Open with Tauri to perform this action.");
      return;
    }
    const pkToUse = walletPk?.trim() || resolvePkFromGroups(walletAddr?.trim());
    if (!pkToUse) {
      setError(
        "Private key not found. Provide the PK or ensure the wallet exists in your groups."
      );
      return;
    }
    if (!fundingPk?.trim()) {
      setError(
        "Funding private key is required (configure in Settings or enter here)."
      );
      return;
    }

    const confirmed = confirm(
      `Close token accounts for wallet\n${
        walletAddr || "(PK provided)"
      }?\nFunds will be refunded to the funding wallet.`
    );
    if (!confirmed) return;

    setIsPending(true);
    try {
      const res = await tauriInvoke("close_accounts", {
        pks: [pkToUse],
        refundPk: fundingPk,
      });
      if (res?.ok) {
        alert(
          "Accounts closed successfully. Funds refunded to funding wallet."
        );
        onClose?.();
      } else {
        setError(res?.error || "Unknown error while closing accounts");
      }
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={!!isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <Dialog.Title className="text-lg font-bold mb-4">
            Close Token Accounts
          </Dialog.Title>

          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">
                Wallet address (optional if PK given)
              </label>
              <input
                type="text"
                value={walletAddr}
                onChange={(e) => setWalletAddr(e.target.value)}
                placeholder="Enter wallet address"
                className="w-full px-3 py-2 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">
                Wallet private key (optional)
              </label>
              <input
                type="text"
                value={walletPk}
                onChange={(e) => setWalletPk(e.target.value)}
                placeholder="Enter wallet private key (base58)"
                className="w-full px-3 py-2 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="text-xs text-white/60 mt-1">
                If empty, we will try to resolve the PK from your current groups
                by address.
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Funding private key</label>
              <input
                type="text"
                value={fundingPk}
                onChange={(e) => setFundingPk(e.target.value)}
                placeholder="Refund destination private key"
                className="w-full px-3 py-2 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {error && <div className="text-sm text-red-400">{error}</div>}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleCloseAccounts}
              disabled={isPending}
              className="px-4 py-2 rounded-md text-sm bg-red-500/90 text-white font-semibold hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Closing…" : "Close Accounts"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
