// JobOnlyBurnTest.jsx - Composant de test pour valider l'approche job-only des burns
import React, { useState } from "react";
import { Flame, BarChart3, CheckCircle, XCircle, Clock } from "lucide-react";
import useJobOnlyBurn from "../hooks/useJobOnlyBurn";

const JobOnlyBurnTest = () => {
  const [testWallet, setTestWallet] = useState("");
  const [testMints, setTestMints] = useState("");
  const [burnPercentage, setBurnPercentage] = useState(100);
  const [apiCallLog, setApiCallLog] = useState([]);

  const {
    burnJobs,
    results,
    error,
    burnTokenJobOnly,
    cancelBurnJob,
    getApiCallStats,
    isBurning,
    getBurnProgress,
    getBurnStatus,
    isJobOnlyCompliant,
  } = useJobOnlyBurn();

  // Mock API call tracking
  React.useEffect(() => {
    const originalFetch = window.fetch;
    const originalInvoke = window.__TAURI_API__?.tauri?.invoke;

    // Track fetch calls
    window.fetch = async (...args) => {
      const url = args[0];
      setApiCallLog((prev) => [
        ...prev,
        {
          type: "fetch",
          url,
          timestamp: new Date().toLocaleTimeString(),
          isViolation: url.includes("burn_tokens") && !url.includes("job"),
        },
      ]);
      return originalFetch(...args);
    };

    // Track Tauri invoke calls
    if (window.__TAURI_API__?.tauri) {
      window.__TAURI_API__.tauri.invoke = async (cmd, args) => {
        setApiCallLog((prev) => [
          ...prev,
          {
            type: "tauri",
            command: cmd,
            args,
            timestamp: new Date().toLocaleTimeString(),
            isViolation: cmd === "burn_tokens", // Direct burn call is a violation
          },
        ]);
        return originalInvoke(cmd, args);
      };
    }

    return () => {
      window.fetch = originalFetch;
      if (window.__TAURI_API__?.tauri && originalInvoke) {
        window.__TAURI_API__.tauri.invoke = originalInvoke;
      }
    };
  }, []);

  const handleTestBurn = async () => {
    if (!testWallet.trim()) {
      alert("Please enter a wallet private key");
      return;
    }

    const mints = testMints.split("\n").filter((mint) => mint.trim());
    if (mints.length === 0) {
      alert("Please enter at least one mint address");
      return;
    }

    // Clear previous logs
    setApiCallLog([]);

    try {
      // Start burn jobs for each mint
      for (const mint of mints) {
        const mintAddress = mint.trim();
        if (mintAddress) {
          console.log(
            `🔥 Starting burn test for mint: ${mintAddress.slice(0, 8)}...`
          );
          await burnTokenJobOnly(testWallet, mintAddress, burnPercentage);
        }
      }
    } catch (error) {
      console.error("❌ Test burn failed:", error);
      alert(`Test failed: ${error.message}`);
    }
  };

  const handleCancelBurn = async (mintAddress) => {
    const cancelled = await cancelBurnJob(mintAddress);
    if (cancelled) {
      console.log(`🚫 Cancelled burn for ${mintAddress.slice(0, 8)}...`);
    }
  };

  const clearApiCallLog = () => {
    setApiCallLog([]);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "Starting":
      case "Running":
        return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case "Completed":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "Failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "Cancelled":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const violations = apiCallLog.filter((call) => call.isViolation);
  const stats = getApiCallStats();

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-900 text-white">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          Job-Only Burn Test
        </h1>
        <p className="text-gray-400">
          Test burn operations using ONLY job status polling - no direct API
          calls
        </p>
        <div className="mt-2 flex items-center gap-4">
          <span
            className={`px-2 py-1 rounded text-xs ${
              isJobOnlyCompliant
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {isJobOnlyCompliant ? "✅ Job-Only Compliant" : "❌ Non-Compliant"}
          </span>
          <span className="text-xs text-gray-500">{stats.description}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Test Configuration */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Test Configuration</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Wallet Private Key
              </label>
              <input
                type="password"
                value={testWallet}
                onChange={(e) => setTestWallet(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder="Enter wallet private key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Mint Addresses (one per line)
              </label>
              <textarea
                value={testMints}
                onChange={(e) => setTestMints(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-24"
                placeholder="So11111111111111111111111111111111111111112
EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Burn Percentage: {burnPercentage}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={burnPercentage}
                onChange={(e) => setBurnPercentage(parseInt(e.target.value))}
                className="w-full"
              />
            </div>

            <button
              onClick={handleTestBurn}
              disabled={burnJobs.size > 0}
              className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium flex items-center justify-center gap-2"
            >
              <Flame className="w-4 h-4" />
              {burnJobs.size > 0 ? "Burn Jobs Running..." : "Start Burn Test"}
            </button>
          </div>
        </div>

        {/* Job Status */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Active Burn Jobs</h2>

          {burnJobs.size === 0 ? (
            <p className="text-gray-400 text-center py-4">
              No active burn jobs
            </p>
          ) : (
            <div className="space-y-3">
              {Array.from(burnJobs.entries()).map(([mint, job]) => (
                <div key={mint} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">
                        {mint.slice(0, 8)}...{mint.slice(-4)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {job.status}
                      </span>
                      {(job.status === "Starting" ||
                        job.status === "Running") && (
                        <button
                          onClick={() => handleCancelBurn(mint)}
                          className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded border border-red-400/30"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {job.jobId && (
                    <p className="text-xs text-gray-500 mb-2">
                      Job ID: {job.jobId}
                    </p>
                  )}

                  {job.currentStep && (
                    <p className="text-xs text-gray-400 mb-2">
                      {job.currentStep}
                    </p>
                  )}

                  <div className="w-full bg-gray-600 rounded-full h-2 mb-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Progress: {job.progress}%</span>
                    {job.success !== undefined && (
                      <span
                        className={
                          job.success ? "text-green-400" : "text-red-400"
                        }
                      >
                        {job.success ? "✅ Success" : "❌ Failed"}
                      </span>
                    )}
                  </div>

                  {job.error && (
                    <p className="text-xs text-red-400 mt-2">
                      Error: {job.error}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* API Call Monitoring */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            API Call Monitoring
          </h2>
          <button
            onClick={clearApiCallLog}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Clear Log
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div className="text-blue-400 text-sm font-medium">
              Total API Calls
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {stats.totalCalls}
            </div>
          </div>
          <div
            className={`border rounded-lg p-3 ${
              violations.length === 0
                ? "bg-green-500/10 border-green-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}
          >
            <div
              className={`text-sm font-medium ${
                violations.length === 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              Violations
            </div>
            <div
              className={`text-2xl font-bold ${
                violations.length === 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {violations.length}
            </div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
            <div className="text-orange-400 text-sm font-medium">
              Active Jobs
            </div>
            <div className="text-2xl font-bold text-orange-400">
              {burnJobs.size}
            </div>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {apiCallLog.length === 0 ? (
            <p className="text-gray-400 text-center py-4">
              No API calls logged yet
            </p>
          ) : (
            <div className="space-y-1">
              {apiCallLog.map((call, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between px-3 py-2 rounded text-xs ${
                    call.isViolation
                      ? "bg-red-500/20 border border-red-500/30 text-red-300"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {call.type === "tauri" ? "🦀" : "🌐"}
                    </span>
                    <span>
                      {call.type === "tauri"
                        ? call.command
                        : new URL(call.url).pathname}
                    </span>
                    {call.isViolation && (
                      <span className="px-1 py-0.5 bg-red-600 text-red-100 rounded text-xs">
                        VIOLATION
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500">{call.timestamp}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {violations.length > 0 && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm font-medium">
              ⚠️ API Violations Detected!
            </p>
            <p className="text-red-300 text-xs mt-1">
              The system made {violations.length} direct API call(s) instead of
              using job-only approach.
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-red-400 font-medium">Error</p>
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default JobOnlyBurnTest;
