// File: src/components/jobs/EnhancedJobManagerModal.jsx
import { Dialog } from "@headlessui/react";
import { useState, useEffect, useCallback } from "react";
import {
  X,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader,
  Play,
  Square,
} from "lucide-react";
import useUnifiedJobPolling from "../../hooks/useUnifiedJobPolling";
import useJobRefresh from "../../hooks/useJobRefresh";
import { useJobContext } from "../../context/JobContext";
import { tauriInvoke } from "../../lib/tauriClient";
import AlertModal from "../modals/AlertModal";
import useJobManagerSettings from "../../hooks/useJobManagerSettings";
import JobManagerSettings from "./JobManagerSettings";

export default function EnhancedJobManagerModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("active");
  const [alert, setAlert] = useState(null);

  const {
    settings,
    updateSettings,
    toggleJobType,
    toggleAllJobTypes,
    resetSettings,
    filterJobs,
    getJobTypes,
  } = useJobManagerSettings();

  // Distribute SOL form state
  const [distributeSolForm, setDistributeSolForm] = useState({
    srcWallet: "",
    targetWallets: "",
    totalAmount: 0.1,
  });

  // Refund wallets form state
  const [refundForm, setRefundForm] = useState({
    fundingPk: "",
    refundTo: "",
    pks: "",
  });

  const {
    jobsHistory,
    clearJobHistory,
    clearCompletedJobs,
    removeJobFromHistory,
    getJobStats,
    updateJobInHistory,
    formatDuration,
    formatTimestamp,
    getRecentJobs,
  } = useJobContext();

  const { refreshSpecificJob } = useJobRefresh();

  // Function to refresh jobs from backend when a job completes
  const onJobCompleted = useCallback(
    async (completedJobId, completedJobInfo) => {
      console.log(
        `🎯 Job ${completedJobId} completed, refreshing specific job...`
      );
      await refreshSpecificJob(completedJobId);
    },
    [refreshSpecificJob]
  );

  const {
    activeJobs,
    cancelJob,
    cleanup,
    startDistributeSolJob,
    startRefundWalletsJob,
    startPollingExistingJob,
  } = useUnifiedJobPolling(onJobCompleted);

  const stats = getJobStats();
  const recentJobs = getRecentJobs();

  // Effect to start polling existing jobs when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const checkExistingJobs = async () => {
      try {
        const existingJobs = await tauriInvoke("list_jobs");
        if (existingJobs && Array.isArray(existingJobs)) {
          console.log(
            `Found ${existingJobs.length} existing jobs, starting polling...`
          );

          existingJobs.forEach((job) => {
            // Only start polling for running jobs that aren't already being polled
            if (job.state === "Running" || job.state === "Pending") {
              startPollingExistingJob(job.id, job.name, {
                operation: job.name,
                existing: true,
              });
            }
          });
        }
      } catch (error) {
        console.error("Failed to fetch existing jobs:", error);
      }
    };

    checkExistingJobs();
  }, [isOpen, startPollingExistingJob]);

  // Force refresh every 2 seconds to ensure UI updates
  useEffect(() => {
    if (!isOpen) return;

    const refreshInterval = setInterval(() => {
      // This will trigger a re-render and update the UI
      console.log(
        `📊 Job Manager refresh - Active: ${activeJobs.length}, History: ${jobsHistory.length}`
      );
    }, 2000);

    return () => clearInterval(refreshInterval);
  }, [isOpen, activeJobs.length, jobsHistory.length]);

  // Handle distribute SOL form submission
  const handleDistributeSol = async () => {
    if (!distributeSolForm.srcWallet || !distributeSolForm.targetWallets) {
      setAlert({
        type: "warning",
        title: "Missing Information",
        message: "Please fill in all required fields",
      });
      return;
    }

    const targetWalletsList = distributeSolForm.targetWallets
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (targetWalletsList.length === 0) {
      setAlert({
        type: "warning",
        title: "No Target Wallets",
        message: "Please provide target wallet addresses",
      });
      return;
    }

    try {
      const jobId = await startDistributeSolJob(
        distributeSolForm.srcWallet,
        targetWalletsList,
        distributeSolForm.totalAmount
      );

      if (jobId) {
        setAlert({
          type: "success",
          title: "Job Started",
          message: `Started distribute SOL job: ${jobId.slice(0, 8)}...`,
        });
        setActiveTab("active"); // Switch to active tab to see the job
      }
    } catch (error) {
      setAlert({
        type: "error",
        title: "Job Failed",
        message: `Failed to start distribute SOL job: ${error.message}`,
      });
    }
  };

  // Handle refund wallets form submission
  const handleRefund = async () => {
    if (!refundForm.fundingPk || !refundForm.refundTo || !refundForm.pks) {
      setAlert({
        type: "warning",
        title: "Missing Information",
        message: "Please fill in all required fields",
      });
      return;
    }

    const pksList = refundForm.pks
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (pksList.length === 0) {
      setAlert({
        type: "warning",
        title: "No Wallets",
        message: "Please provide wallet private keys",
      });
      return;
    }

    try {
      const jobId = await startRefundWalletsJob(
        pksList,
        refundForm.refundTo,
        refundForm.fundingPk
      );

      if (jobId) {
        setAlert({
          type: "success",
          title: "Job Started",
          message: `Started refund wallets job: ${jobId.slice(0, 8)}...`,
        });
        setActiveTab("active"); // Switch to active tab to see the job
      }
    } catch (error) {
      setAlert({
        type: "error",
        title: "Job Failed",
        message: `Failed to start refund wallets job: ${error.message}`,
      });
    }
  };

  // Combine active jobs with history for complete view, avoiding duplicates
  // Active jobs take priority over history entries
  const allJobs = (() => {
    console.log(
      `📊 Building allJobs - History: ${jobsHistory.length}, Active: ${activeJobs.size}`
    );

    const jobMap = new Map();

    // First add history jobs
    jobsHistory.forEach((job) => {
      if (jobMap.has(job.id)) {
        console.log(`⚠️ Duplicate job ${job.id.slice(0, 8)} found in history!`);
      }
      jobMap.set(job.id, job);
    });

    // Then add/update with active jobs (these have priority)
    activeJobs.forEach((job) => {
      if (jobMap.has(job.id)) {
        console.log(
          `🔄 Updating job ${job.id.slice(
            0,
            8
          )} from activeJobs (overriding history)`
        );
      } else {
        console.log(`➕ Adding new job ${job.id.slice(0, 8)} from activeJobs`);
      }
      jobMap.set(job.id, job);
    });

    const result = Array.from(jobMap.values());

    // Debug log to see what jobs we have
    console.log(`🔍 Job Manager - Total jobs: ${result.length}`, {
      activeJobs: activeJobs.size,
      historyJobs: jobsHistory.length,
      completedJobs: result.filter((j) => j.state === "Completed").length,
      runningJobs: result.filter((j) => j.state === "Running").length,
      duplicates: jobsHistory.length + activeJobs.size - result.length,
      allJobIds: result.map((j) => j.id?.slice(0, 8) || "invalid"),
      historyJobIds: jobsHistory.map((j) => j.id?.slice(0, 8) || "invalid"),
      activeJobIds: Array.from(activeJobs.keys()).map((id) =>
        typeof id === "string" ? id.slice(0, 8) : "invalid"
      ),
    });

    return result;
  })();

  const getStatusIcon = (state) => {
    if (!state) return <Loader className="w-4 h-4 text-gray-500" />;

    if (state === "Running")
      return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
    if (state === "Completed")
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (state === "Cancelled")
      return <Square className="w-4 h-4 text-gray-500" />;
    if (state?.Failed) return <AlertCircle className="w-4 h-4 text-red-500" />;

    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = (state) => {
    if (!state) return "bg-gray-500/20 border border-gray-500/30 text-gray-200";

    if (state === "Running")
      return "bg-blue-500/20 border border-blue-500/30 text-blue-200";
    if (state === "Completed")
      return "bg-green-500/20 border border-green-500/30 text-green-200";
    if (state === "Cancelled")
      return "bg-gray-500/20 border border-gray-500/30 text-gray-200";
    if (state?.Failed)
      return "bg-red-500/20 border border-red-500/30 text-red-200";

    return "bg-yellow-500/20 border border-yellow-500/30 text-yellow-200";
  };

  const getJobTypeDisplay = (name) => {
    const displayNames = {
      get_tokens_balances: "Fetch Tokens",
      burn_each_tokens: "Burn Tokens",
      close_accounts: "Close Accounts",
      refund_wallets: "Refund Wallets",
      refund_wallets_specific_amount: "Refund Wallets (Specific Amount)",
      distribute_sol: "Distribute SOL",
    };

    return displayNames[name] || name;
  };

  const handleCancelJob = async (jobId) => {
    const success = await cancelJob(jobId);
    if (success) {
      console.log(`Job ${jobId} cancelled successfully`);
    }
  };

  const filteredJobs = () => {
    const baseFiltered = (() => {
      switch (activeTab) {
        case "start":
          return []; // No jobs to display in start tab
        case "active":
          return allJobs.filter(
            (job) => job.state === "Running" || job.state === "Pending"
          );
        case "completed":
          const completedJobs = allJobs.filter((job) => {
            console.log(
              `🔍 Checking job ${job.id}: state="${
                job.state
              }", type=${typeof job.state}`
            );
            return job.state === "Completed";
          });
          console.log(
            `✅ Filtered completed jobs: ${completedJobs.length}`,
            completedJobs.map((j) => ({ id: j.id, state: j.state }))
          );
          return completedJobs;
        case "failed":
          return allJobs.filter((job) => job.state?.Failed);
        case "recent":
          return recentJobs;
        default:
          return allJobs;
      }
    })();

    // Apply settings-based filtering
    const filtered = filterJobs(baseFiltered);

    console.log(
      `📋 Active tab: ${activeTab}, Filtered jobs: ${filtered.length}`
    );
    return filtered;
  };

  return (
    <>
      <Dialog open={isOpen} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-4xl w-full bg-[#1D1539] rounded-lg shadow-xl max-h-[80vh] flex flex-col border border-[#312152]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#312152]">
              <div className="flex items-center gap-4">
                <Dialog.Title className="text-lg font-semibold text-white">
                  Enhanced Job Manager
                </Dialog.Title>

                {/* Stats */}
                <div className="flex gap-2 text-sm">
                  <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-200 rounded">
                    {stats.running} running
                  </span>
                  <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 text-green-200 rounded">
                    {stats.completed} completed
                  </span>
                  <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 text-red-200 rounded">
                    {stats.failed} failed
                  </span>
                  <span className="px-2 py-1 bg-gray-500/20 border border-gray-500/30 text-gray-200 rounded">
                    {stats.successRate}% success rate
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearCompletedJobs}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded"
                >
                  Clear Completed
                </button>
                <button
                  onClick={clearJobHistory}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-500 text-white rounded"
                >
                  Clear All
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-700 text-white rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-[#312152]">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {[
                  // {
                  //   key: "start",
                  //   label: "Start Jobs",
                  //   count: 0,
                  // },
                  {
                    key: "active",
                    label: "Active",
                    count: allJobs.filter(
                      (j) => j.state === "Running" || j.state === "Pending"
                    ).length,
                  },
                  {
                    key: "completed",
                    label: "Completed",
                    count: stats.completed,
                  },
                  { key: "failed", label: "Failed", count: stats.failed },
                  {
                    key: "recent",
                    label: "Recent (24h)",
                    count: recentJobs.length,
                  },
                  { key: "all", label: "All", count: stats.total },
                  { key: "settings", label: "Paramètres", count: "" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.key
                        ? "border-yellow-400 text-yellow-400"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== "" && ` (${tab.count})`}
                  </button>
                ))}
              </nav>
            </div>

            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === "settings" ? (
                /* Settings Tab */
                <div className="h-full">
                  <JobManagerSettings
                    settings={settings}
                    jobs={allJobs}
                    getJobTypes={getJobTypes}
                    toggleJobType={toggleJobType}
                    toggleAllJobTypes={toggleAllJobTypes}
                    updateSettings={updateSettings}
                    resetSettings={resetSettings}
                    isOpen={true}
                    onClose={() => setActiveTab("active")}
                  />
                </div>
              ) : activeTab === "start" ? (
                /* Start Jobs Form */
                <div className="space-y-6">
                  <h3 className="text-lg font-medium text-white">
                    Start New Jobs
                  </h3>

                  {/* Distribute SOL Section */}
                  <div className="bg-[#2F2650] rounded-lg p-6 border border-[#3D2B67]">
                    <h4 className="text-md font-medium text-white mb-4">
                      Distribute SOL
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Source Wallet Private Key
                        </label>
                        <input
                          type="text"
                          value={distributeSolForm.srcWallet}
                          onChange={(e) =>
                            setDistributeSolForm((prev) => ({
                              ...prev,
                              srcWallet: e.target.value,
                            }))
                          }
                          placeholder="Enter source wallet private key"
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Target Wallets (one per line)
                        </label>
                        <textarea
                          value={distributeSolForm.targetWallets}
                          onChange={(e) =>
                            setDistributeSolForm((prev) => ({
                              ...prev,
                              targetWallets: e.target.value,
                            }))
                          }
                          placeholder="Enter wallet addresses, one per line"
                          rows={6}
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Total Amount (SOL)
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={distributeSolForm.totalAmount}
                          onChange={(e) =>
                            setDistributeSolForm((prev) => ({
                              ...prev,
                              totalAmount: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <button
                        onClick={handleDistributeSol}
                        className="w-full bg-yellow-400 text-black py-2 px-4 rounded-md hover:bg-yellow-300 transition font-semibold"
                      >
                        Start Distribute SOL Job
                      </button>
                    </div>
                  </div>

                  {/* Refund Wallets Section */}
                  <div className="bg-[#2F2650] rounded-lg p-6 border border-[#3D2B67]">
                    <h4 className="text-md font-medium text-white mb-4">
                      Refund Wallets
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Funding Private Key
                        </label>
                        <input
                          type="text"
                          value={refundForm.fundingPk}
                          onChange={(e) =>
                            setRefundForm((prev) => ({
                              ...prev,
                              fundingPk: e.target.value,
                            }))
                          }
                          placeholder="Enter funding wallet private key"
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Refund To Wallet
                        </label>
                        <input
                          type="text"
                          value={refundForm.refundTo}
                          onChange={(e) =>
                            setRefundForm((prev) => ({
                              ...prev,
                              refundTo: e.target.value,
                            }))
                          }
                          placeholder="Enter destination wallet address"
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-2">
                          Wallet Private Keys (one per line)
                        </label>
                        <textarea
                          value={refundForm.pks}
                          onChange={(e) =>
                            setRefundForm((prev) => ({
                              ...prev,
                              pks: e.target.value,
                            }))
                          }
                          placeholder="Enter wallet private keys to refund from, one per line"
                          rows={6}
                          className="w-full px-3 py-2 bg-[#1D1539] text-white border border-[#3D2B67] rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
                        />
                      </div>

                      <button
                        onClick={handleRefund}
                        className="w-full bg-yellow-400 text-black py-2 px-4 rounded-md hover:bg-yellow-300 transition font-semibold"
                      >
                        Start Refund Wallets Job
                      </button>
                    </div>
                  </div>
                </div>
              ) : filteredJobs().length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No jobs found for this category
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredJobs().map((job) => (
                    <div
                      key={job.id}
                      className="bg-[#2F2650] rounded-lg p-4 hover:bg-[#3D2B67] border border-[#3D2B67]"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {getStatusIcon(job.state)}
                            <div>
                              <h3 className="font-medium text-white">
                                {getJobTypeDisplay(job.name)}
                              </h3>
                              <p className="text-sm text-gray-400">
                                ID: {job.id.slice(0, 8)}...
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                job.state
                              )}`}
                            >
                              {job.state?.Failed
                                ? `Failed: ${job.state.Failed}`
                                : job.state || "Unknown"}
                            </span>
                          </div>

                          {/* Progress */}
                          {job.progress_percentage !== undefined && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-300">
                                  {job.current_step || "Processing..."}
                                </span>
                                <span className="text-gray-300">
                                  {job.progress_percentage.toFixed(1)}%
                                </span>
                              </div>
                              <div className="mt-1 w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-yellow-400 h-2 rounded-full transition-all duration-500"
                                  style={{
                                    width: `${job.progress_percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {job.metadata && (
                            <div className="mt-2 text-xs text-gray-400 space-y-1">
                              {job.metadata.wallet && (
                                <div>
                                  Wallet: {job.metadata.wallet.slice(0, 8)}...
                                </div>
                              )}
                              {job.metadata.parameters && (
                                <div>
                                  Parameters:{" "}
                                  {JSON.stringify(
                                    job.metadata.parameters
                                  ).slice(0, 100)}
                                  {JSON.stringify(job.metadata.parameters)
                                    .length > 100
                                    ? "..."
                                    : ""}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timing */}
                          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                            <span>
                              Started: {formatTimestamp(job.timestamp)}
                            </span>
                            {job.completedAt && (
                              <span>
                                Duration: {formatDuration(job.duration)}
                              </span>
                            )}
                            {job.total_items && (
                              <span>
                                Items: {job.completed_items || 0}/
                                {job.total_items}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          {(job.state === "Running" ||
                            job.state === "Pending") && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded"
                              title="Cancel job"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeJobFromHistory(job.id)}
                            className="p-2 text-gray-400 hover:bg-gray-200 rounded"
                            title="Remove from history"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Result */}
                      {job.result && job.state === "Completed" && (
                        <details className="mt-3">
                          <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                            View result
                          </summary>
                          <pre className="mt-2 text-xs bg-white p-3 rounded border overflow-x-auto">
                            {typeof job.result === "string"
                              ? job.result
                              : JSON.stringify(job.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
