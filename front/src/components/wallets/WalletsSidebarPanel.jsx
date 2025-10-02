// File: src/components/panels/WalletsSidebarPanel.jsx
import { useState } from "react";
import {
  PlusIcon,
  CurrencyDollarIcon,
  ComputerDesktopIcon,
  // Activity,
} from "@heroicons/react/24/outline";
import GenerateWalletsModal from "../modals/GenerateWalletsModal";
import DistributeSolModal from "../modals/DistributeSolModal";
import RefundWalletModal from "../modals/RefundWalletModal";
import AlertModal from "../modals/AlertModal";
import ConfirmModal from "../modals/ConfirmModal";
import PromptModal from "../modals/PromptModal";
import EnhancedJobManagerModal from "../jobs/EnhancedJobManagerModal";
import useUnifiedJobPolling from "../../hooks/useUnifiedJobPolling";
import { useJobContext } from "../../context/JobContext";
import { useApp } from "../../context/AppContext";
import "../../Sidebar.css";

export default function WalletsSidebarPanel() {
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isDistributeOpen, setIsDistributeOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isJobManagerOpen, setIsJobManagerOpen] = useState(false);

  // Modal states
  const [alertModal, setAlertModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [promptModal, setPromptModal] = useState(null);

  // Job management hooks
  const {
    activeJobs,
    results,
    error: jobError,
    cancelJob,
    activeJobsCount,
  } = useUnifiedJobPolling();

  const { getJobStats, getRecentJobs } = useJobContext();

  const jobStats = getJobStats();
  const recentJobs = getRecentJobs();

  const { groups, activeGroupName, setActiveGroup, addGroup } = useApp();

  // Keep full group list but show 'dev' first for UX
  const groupsWithDev = (() => {
    const all = [...(groups ?? [])];
    const devIdx = all.findIndex((g) => String(g.name).toLowerCase() === "dev");
    if (devIdx >= 0) {
      const dev = all.splice(devIdx, 1)[0];
      return [dev, ...all];
    }
    // If no dev group exists yet, include a placeholder dev first
    return [{ name: "dev", wallets: [] }, ...all];
  })();

  const handleAddGroup = () => {
    if (groups.length >= 10) {
      setAlertModal({
        type: "warning",
        title: "Maximum Groups Reached",
        message: "You can have a maximum of 10 groups.",
      });
      return;
    }

    setPromptModal({
      title: "Create New Group",
      message: "Enter a name for the new group:",
      placeholder: "Group name",
      validation: (value) => {
        if (!value.trim()) return "Group name cannot be empty";
        if (groups.some((g) => g.name === value.trim()))
          return "Group name already exists";
        return true;
      },
      onConfirm: (name) => {
        addGroup(name);
        setActiveGroup(name);
      },
    });
  };

  // Job manager state

  return (
    <>
      <aside className="sidebar-right fixed right-0 top-0 h-full bg-gray-950 border-l border-gray-800 p-4 flex flex-col gap-4 z-40 overflow-y-auto">
        <h2 className="text-lg font-semibold text-white tracking-tight">
          Wallet Groups
        </h2>
        <div className="space-y-1">
          {groupsWithDev.map((group) => {
            const isActive = activeGroupName === group.name;
            return (
              <button
                key={group.name}
                onClick={() => setActiveGroup(group.name)}
                className={`w-full text-left px-3 py-2 rounded-lg font-medium text-sm transition ${
                  isActive
                    ? "bg-white/10 text-white border border-white/10"
                    : "text-gray-200 hover:bg-white/[0.06]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {group.name}
              </button>
            );
          })}
          <button
            onClick={handleAddGroup}
            className="text-xs text-gray-400 hover:text-white underline mt-2"
          >
            + Add Group
          </button>
        </div>
        <hr className="border-gray-800" />
        <h3 className="text-sm font-semibold text-gray-400">Actions</h3>
        <button
          onClick={() => setIsGenerateOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition text-gray-200"
        >
          <PlusIcon className="w-4 h-4 text-lime-400" />
          Generate Wallets
        </button>
        {/* Distribute SOL Button */}
        <button
          onClick={() => setIsDistributeOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 transition text-yellow-200"
        >
          <CurrencyDollarIcon className="w-4 h-4 text-yellow-400" />
          Distribute SOL
        </button>
        <button
          onClick={() => setIsRefundOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/30 transition text-yellow-200"
        >
          <CurrencyDollarIcon className="w-4 h-4 text-yellow-400" />
          Refund a wallet
        </button>

        {/* Enhanced Job Manager Button */}
        <button
          onClick={() => setIsJobManagerOpen(true)}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 transition text-blue-200"
        >
          <div className="flex items-center gap-2">
            {/* <Activity className="w-4 h-4 text-blue-400" /> */}
            <ComputerDesktopIcon className="w-4 h-4 text-white-400" />
            <span>Job Manager</span>
          </div>

          {/* <div className="flex items-center gap-2 text-xs">
            {activeJobsCount > 0 && (
              <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                {activeJobsCount}
              </span>
            )}
            {jobStats.total > 0 && (
              <span className="text-blue-300">
                {jobStats.successRate}% success
              </span>
            )}
          </div> */}
        </button>

        {/* Active Jobs Summary */}
        {activeJobsCount > 0 && (
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-400/20">
            <div className="text-xs text-blue-400 mb-1">
              Active Jobs ({activeJobsCount})
            </div>
            <div className="space-y-1">
              {activeJobs.slice(0, 3).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-blue-200 truncate">
                    {job.name.replace("_", " ")}
                  </span>
                  {job.progress_percentage !== undefined && (
                    <span className="text-blue-300">
                      {job.progress_percentage.toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
              {activeJobsCount > 3 && (
                <div className="text-xs text-blue-400 italic">
                  +{activeJobsCount - 3} more...
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Completed Jobs */}
        {recentJobs.length > 0 && activeJobsCount === 0 && (
          <div className="p-2 rounded-lg bg-green-500/10 border border-green-400/20">
            <div className="text-xs text-green-400 mb-1">Recent Jobs (24h)</div>
            <div className="text-xs text-green-200">
              {recentJobs.length} jobs • {jobStats.successRate}% success rate
            </div>
          </div>
        )}
      </aside>

      <GenerateWalletsModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
      />
      <DistributeSolModal
        isOpen={isDistributeOpen}
        onClose={() => setIsDistributeOpen(false)}
      />
      <RefundWalletModal
        isOpen={isRefundOpen}
        onClose={() => setIsRefundOpen(false)}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        title={alertModal?.title}
        message={alertModal?.message}
        type={alertModal?.type}
        buttonText={alertModal?.buttonText}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.onConfirm}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText}
        cancelText={confirmModal?.cancelText}
        type={confirmModal?.type}
        confirmButtonVariant={confirmModal?.confirmButtonVariant}
      />

      {/* Prompt Modal */}
      <PromptModal
        isOpen={!!promptModal}
        onClose={() => setPromptModal(null)}
        onConfirm={promptModal?.onConfirm}
        title={promptModal?.title}
        message={promptModal?.message}
        placeholder={promptModal?.placeholder}
        defaultValue={promptModal?.defaultValue}
        confirmText={promptModal?.confirmText}
        cancelText={promptModal?.cancelText}
        inputType={promptModal?.inputType}
        validation={promptModal?.validation}
      />

      {/* Enhanced Job Manager Modal */}
      <EnhancedJobManagerModal
        isOpen={isJobManagerOpen}
        onClose={() => setIsJobManagerOpen(false)}
      />
    </>
  );
}
