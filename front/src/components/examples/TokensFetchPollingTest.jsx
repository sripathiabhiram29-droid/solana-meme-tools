import React, { useState } from "react";
import WalletTokensModal from "../modals/WalletTokensModal";

export default function TokensFetchPollingTest() {
  const [modalOpen, setModalOpen] = useState(false);
  const [testWallet] = useState("So11111111111111111111111111111111111111112"); // Sample wallet
  const [testPk] = useState("your-private-key-here"); // Replace with test key
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Token Fetch Polling Test</h2>

      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded-lg">
          <h3 className="font-semibold mb-2">Test Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>
              Click "Test Batch Mode" to open modal with batch mode enabled
            </li>
            <li>Watch the console for polling logs (every 1 second)</li>
            <li>Monitor the job ID displayed in the modal</li>
            <li>Check that results are displayed when job completes</li>
            <li>Test cancellation by clicking the "Cancel Fetch" button</li>
          </ol>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Batch Mode (with polling)
          </button>

          <button
            onClick={() => {
              console.log("Opening console to monitor polling logs...");
            }}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Open Console (F12)
          </button>
        </div>

        {toastMessage && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {toastMessage}
          </div>
        )}

        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="font-semibold text-yellow-800 mb-2">
            Expected Behavior:
          </h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
            <li>
              <strong>Job Start:</strong> Modal shows job ID and "polling every
              1s" message
            </li>
            <li>
              <strong>Polling:</strong> Console logs job status every second
            </li>
            <li>
              <strong>Progress:</strong> Loading spinner and progress indication
            </li>
            <li>
              <strong>Completion:</strong> Results appear automatically when job
              finishes
            </li>
            <li>
              <strong>Error Handling:</strong> Failed jobs display error message
            </li>
            <li>
              <strong>Cancellation:</strong> Cancel button stops polling and job
            </li>
          </ul>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-semibold text-blue-800 mb-2">
            Console Messages to Watch:
          </h4>
          <pre className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
            {`Using batch mode for token balance fetch
Started batch token fetch job: <job-id>
Job <job-id> status: { state: "Running", progress_percentage: 50.0, ... }
Job completed with result: <result>
Token balances fetched successfully!`}
          </pre>
        </div>
      </div>

      <WalletTokensModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wallet={testWallet}
        pk={testPk}
        useBatchMode={true} // Enable batch mode for testing
        setToast={showToast}
      />
    </div>
  );
}
