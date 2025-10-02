import React, { useState } from "react";
import WalletTokensModal from "../modals/WalletTokensModal";

/**
 * Example component showing how to use WalletTokensModal with batch mode
 */
const WalletTokensBatchExample = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentWallet, setCurrentWallet] = useState(null);
  const [useBatchMode, setUseBatchMode] = useState(false);
  const [toast, setToast] = useState("");

  // Example wallets
  const exampleWallets = [
    {
      address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      pk: "your-private-key-here",
    },
    {
      address: "2fmz8SuNVyxEP6QwKQs6LNaT2ATszySPEJdhUDesxktc",
      pk: "your-private-key-here-2",
    },
  ];

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const openWalletModal = (wallet) => {
    setCurrentWallet(wallet);
    setModalOpen(true);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-[#1D1539] rounded-lg p-6 text-white">
        <h2 className="text-xl font-bold mb-4">Wallet Tokens Batch Example</h2>

        {/* Batch Mode Toggle */}
        <div className="mb-4 p-3 bg-white/5 rounded-lg">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useBatchMode}
              onChange={(e) => setUseBatchMode(e.target.checked)}
              className="w-4 h-4 rounded bg-white/10 border border-white/20"
            />
            <span className="text-sm">
              Use Batch Mode (with job progress tracking)
            </span>
          </label>
          <p className="text-xs text-white/60 mt-1">
            {useBatchMode
              ? "Token balance fetching will use background jobs with progress tracking"
              : "Token balance fetching will use direct API calls"}
          </p>
        </div>

        {/* Example Wallets */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Example Wallets</h3>
          {exampleWallets.map((wallet, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <div>
                <div className="font-mono text-sm">{wallet.address}</div>
                <div className="text-xs text-white/60">Wallet {index + 1}</div>
              </div>
              <button
                onClick={() => openWalletModal(wallet)}
                className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-md text-sm font-semibold border border-blue-400/30"
              >
                View Tokens {useBatchMode ? "(Batch)" : "(Direct)"}
              </button>
            </div>
          ))}
        </div>

        {/* Usage Instructions */}
        <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-400/30">
          <h4 className="font-semibold text-blue-400 mb-2">
            How to Use Batch Mode:
          </h4>
          <ul className="text-sm text-blue-300 space-y-1">
            <li>• Enable "Use Batch Mode" toggle above</li>
            <li>• Click "View Tokens (Batch)" on any wallet</li>
            <li>• The token fetching will start a background job</li>
            <li>• You'll see a progress bar with job status</li>
            <li>• You can cancel the job if needed</li>
            <li>• Progress is tracked in real-time</li>
          </ul>
        </div>

        {/* Code Example */}
        <div className="mt-6 p-4 bg-gray-800 rounded-lg">
          <h4 className="font-semibold mb-2">Code Example:</h4>
          <pre className="text-xs text-gray-300 overflow-x-auto">
            {`// Use WalletTokensModal with batch mode
<WalletTokensModal
  isOpen={modalOpen}
  onClose={() => setModalOpen(false)}
  wallet={wallet.address}
  pk={wallet.pk}
  useBatchMode={true} // Enable batch mode
  setToast={showToast}
/>

// The component will automatically:
// 1. Start a background job for token fetching
// 2. Show progress bar with real-time updates
// 3. Handle job completion/cancellation
// 4. Display results when job completes`}
          </pre>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Wallet Tokens Modal */}
      {currentWallet && (
        <WalletTokensModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          wallet={currentWallet.address}
          pk={currentWallet.pk}
          useBatchMode={useBatchMode} // Use the toggle state
          setToast={showToast}
        />
      )}
    </div>
  );
};

export default WalletTokensBatchExample;
