// File: src/components/modals/DistributeSolModal.jsx
import { Dialog } from "@headlessui/react";
import { useState, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { loadSettingsFromLocalStorage as loadSettingsFromLS } from "../../lib/utils";
import useUnifiedJobPolling from "../../hooks/useUnifiedJobPolling";
import useJobRefresh from "../../hooks/useJobRefresh";
import AlertModal from "./AlertModal";

export default function DistributeSolModal({ isOpen, onClose }) {
  const [amount, setAmount] = useState(0.01);
  const [isPending, setIsPending] = useState(false);
  const [fundingPk, setFundingPk] = useState("");
  const [alert, setAlert] = useState(null);
  const { activeGroupName, groups } = useApp();
  const activeGroup = groups.find((g) => g.name === activeGroupName);

  const { refreshSpecificJob } = useJobRefresh();

  // Callback to refresh jobs when completed
  const onJobCompleted = useCallback(
    async (jobId) => {
      console.log(
        `🎯 Distribute job ${jobId} completed, refreshing specific job...`
      );
      await refreshSpecificJob(jobId);
    },
    [refreshSpecificJob]
  );

  // Use unified job polling for distribute SOL
  const { startDistributeSolJob } = useUnifiedJobPolling(onJobCompleted);

  // Load fundingPk from localStorage settings
  useEffect(() => {
    try {
      const s = loadSettingsFromLS("mc_settings_v1", {});
      setFundingPk(s?.fundingPk || "");
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  }, []);

  const handleDistribute = async () => {
    if (!fundingPk.trim()) {
      setAlert({
        type: "warning",
        title: "Missing Configuration",
        message:
          "Funding private key is required. Please configure it in Settings first.",
      });
      return;
    }

    if (!activeGroup?.wallets?.length) {
      setAlert({
        type: "warning",
        title: "No Wallets",
        message: "No wallets found in active group.",
      });
      return;
    }

    setIsPending(true);
    try {
      console.log(
        `Starting distribute SOL job: ${amount} SOL per wallet to ${activeGroup.wallets.length} wallets in ${activeGroupName}`
      );

      const wallets = activeGroup.wallets.map((w) => w.wallet);
      const totalAmount = amount * wallets.length;

      // Start the distribute SOL job
      const jobId = await startDistributeSolJob(
        fundingPk.trim(),
        wallets,
        totalAmount
      );

      if (jobId) {
        console.log(`Started distribute SOL job: ${jobId}`);
        // Show success message and close modal
        setAlert({
          type: "success",
          title: "Job Started Successfully",
          message: `Started distribute SOL job: ${jobId.slice(
            0,
            8
          )}...\nDistributing ${amount} SOL to ${
            wallets.length
          } wallets\nTotal: ${totalAmount} SOL\n\nCheck Job Manager for progress.`,
        });
        onClose();
      } else {
        throw new Error("Failed to start distribute SOL job");
      }
    } catch (error) {
      console.error("Distribution job failed:", error);
      setAlert({
        type: "error",
        title: "Job Failed",
        message: `Failed to start distribution job: ${error.message}`,
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-sm rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
            <Dialog.Title className="text-lg font-bold mb-4 text-white">
              Distribute SOL
            </Dialog.Title>

            {!fundingPk ? (
              <div className="mb-4 p-3 rounded-md bg-yellow-500/20 border border-yellow-500/30 text-yellow-200">
                <p className="text-sm">
                  No funding wallet configured. Please set up your private key
                  in Settings first.
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-md bg-green-500/20 border border-green-500/30 text-green-200">
                <p className="text-sm">
                  Using funding wallet from Settings (Private key:{" "}
                  {fundingPk.slice(0, 8)}...)
                </p>
              </div>
            )}

            <label className="block text-sm mb-2">Amount per wallet (◎):</label>
            <input
              type="number"
              min={0.001}
              step={0.001}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDistribute}
                disabled={!fundingPk.trim() || isPending}
                className="px-4 py-2 rounded-md text-sm bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isPending ? "Distributing..." : "Distribute"}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Alert Modal */}
      <AlertModal
        isOpen={!!alert}
        onClose={() => setAlert(null)}
        title={alert?.title}
        message={alert?.message}
        type={alert?.type}
      />
    </>
  );
}
