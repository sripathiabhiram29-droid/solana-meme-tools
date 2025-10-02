import React, { useState, useEffect } from "react";
import WalletTokensModal from "../modals/WalletTokensModal";

export default function JobOnlyTokensTest() {
  const [modalOpen, setModalOpen] = useState(false);
  const [testWallet] = useState("So11111111111111111111111111111111111111112");
  const [testPk] = useState("your-private-key-here");
  const [toastMessage, setToastMessage] = useState("");
  const [apiCallsLog, setApiCallsLog] = useState([]);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Monitor API calls by intercepting tauriInvoke
  useEffect(() => {
    // Override console methods to capture API calls
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      const message = args.join(" ");
      if (
        message.includes("get_tokens_balances") ||
        message.includes("get_job_status")
      ) {
        setApiCallsLog((prev) => [
          ...prev,
          {
            type: "API_CALL",
            message,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      originalLog(...args);
    };

    console.warn = (...args) => {
      const message = args.join(" ");
      if (
        message.includes("get_tokens_balances") ||
        message.includes("get_job_status")
      ) {
        setApiCallsLog((prev) => [
          ...prev,
          {
            type: "WARNING",
            message,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      originalWarn(...args);
    };

    console.error = (...args) => {
      const message = args.join(" ");
      if (
        message.includes("get_tokens_balances") ||
        message.includes("get_job_status")
      ) {
        setApiCallsLog((prev) => [
          ...prev,
          {
            type: "ERROR",
            message,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
      originalError(...args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  const clearLogs = () => {
    setApiCallsLog([]);
  };

  const expectedBehavior = [
    "✅ Initial job start: get_tokens_balances_batch_job called",
    "✅ Polling: get_job_status called every second",
    "✅ Results parsing: JSON parsed from job result",
    "❌ NO get_tokens_balances calls after job completion",
    "✅ Token balances displayed from job result only",
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Job-Only Token Fetch Test</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Column - Test Controls */}
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold mb-2 text-blue-800">
              Test Objective:
            </h3>
            <p className="text-sm text-blue-700">
              Verify that token fetching uses ONLY job status polling and never
              calls get_tokens_balances after job completion.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setModalOpen(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Test Job-Only Mode
            </button>

            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Logs
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
            <ul className="space-y-1 text-sm">
              {expectedBehavior.map((item, idx) => (
                <li
                  key={idx}
                  className={`${
                    item.startsWith("❌") ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column - API Calls Monitor */}
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-semibold">API Calls Monitor</h4>
              <span className="text-sm text-gray-600">
                Calls: {apiCallsLog.length}
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1">
              {apiCallsLog.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No API calls detected yet...
                </p>
              ) : (
                apiCallsLog.map((log, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded ${
                      log.type === "ERROR"
                        ? "bg-red-100 text-red-800"
                        : log.type === "WARNING"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    <span className="font-mono text-gray-600">
                      {log.timestamp}
                    </span>
                    <br />
                    <span className="font-semibold">{log.type}:</span>{" "}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h4 className="font-semibold text-red-800 mb-2">
              Watch For (Should NOT Happen):
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
              <li>get_tokens_balances called after job completion</li>
              <li>Multiple API calls to fetch same data</li>
              <li>Fallback API calls when job succeeds</li>
            </ul>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-semibold text-green-800 mb-2">
              Expected Pattern:
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-green-700">
              <li>get_tokens_balances_batch_job (once)</li>
              <li>get_job_status (every 1s until complete)</li>
              <li>Result parsing from job data</li>
              <li>Display results (no additional API calls)</li>
            </ol>
          </div>
        </div>
      </div>

      <WalletTokensModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wallet={testWallet}
        pk={testPk}
        useBatchMode={true}
        setToast={showToast}
      />
    </div>
  );
}
