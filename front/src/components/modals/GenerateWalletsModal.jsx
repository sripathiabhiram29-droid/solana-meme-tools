import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useApp } from "../../context/AppContext";

export default function GenerateWalletsModal({ isOpen, onClose }) {
  const { addWalletsToGroup, activeGroupName, generateWallets } = useApp();
  const [count, setCount] = useState(1);
  const [isPending, setIsPending] = useState(false);

  const handleGenerate = async () => {
    setIsPending(true);
    try {
      const wallets = generateWallets(count);
      console.log("generate " + count + " wallets");
      console.log(wallets);
      addWalletsToGroup(activeGroupName, wallets);
      onClose();
    } catch (error) {
      console.error("Wallet generation failed:", error);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-sm rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <Dialog.Title className="text-lg font-bold mb-4 text-white">
            Generate Wallets
          </Dialog.Title>

          <label className="block text-sm mb-2">
            Number of wallets to generate:
          </label>
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-lime-400"
          />

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md text-sm bg-gray-700 hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="px-4 py-2 rounded-md text-sm bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {isPending ? "Generating..." : "Generate"}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
