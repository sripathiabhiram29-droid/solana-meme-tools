import React from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import {
  Upload,
  Download,
  CopyCheck,
  KeyRound,
  WalletMinimal,
  RefreshCw,
  PlusCircle,
  Search,
  Settings,
} from "lucide-react";

export default function WalletsToolbar({
  activeGroup,
  groupsWithDev,
  wallets,
  genCount,
  setGenCount,
  handleGenerate,
  fileInputRef,
  handleImportFile,
  importCSV,
  exportCSV,
  copyAllAddresses,
  copyAllPks,
  handleRevealAll,
  revealAll,
  refreshGroupBalances,
  activeGroupName,
  onSelectGroup,
  setToast,
  tauriAvailable,
  setQuery,
  query,
  onManageGroups,
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {activeGroup.name === "dev" && wallets.length === 0 ? (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
            <WalletMinimal size={16} className="opacity-70" />
            <input
              type="number"
              min={1}
              max={1}
              step={1}
              value={genCount > 1 ? 1 : genCount}
              onChange={() => setGenCount(1)}
              className="w-16 bg-transparent outline-none text-sm"
              title="Number of wallets to generate (dev group: 1 max)"
              disabled
            />
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
              title="Generate wallet for dev group"
            >
              <PlusCircle size={14} />
              Generate
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2 py-1.5 shadow-sm">
            <WalletMinimal size={16} className="opacity-70" />
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              className="w-16 bg-transparent outline-none text-sm"
              title="Number of wallets to generate"
            />
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
              title="Generate wallets"
            >
              <PlusCircle size={14} />
              Generate
            </button>
          </div>
        )}

        <input
          type="file"
          accept=".csv,text/csv"
          ref={(el) => fileInputRef.set(el)}
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (f) handleImportFile(f);
            e.target.value = "";
          }}
          className="hidden"
        />

        <button
          onClick={() => {
            const input = fileInputRef.get();
            if (input && typeof input.click === "function") {
              input.click();
              return;
            }
            importCSV();
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
          title="Import wallets from CSV"
        >
          <Upload size={14} />
          Import CSV
        </button>

        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
          title="Export wallets to CSV"
        >
          <Download size={14} />
          Export CSV
        </button>

        <button
          onClick={copyAllAddresses}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
          title="Copy all addresses"
        >
          <CopyCheck size={14} />
          Copy addresses
        </button>

        <button
          onClick={copyAllPks}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
          title="Copy all private keys"
        >
          <KeyRound size={14} />
          Copy PKs
        </button>

        <button
          onClick={handleRevealAll}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
          title={
            revealAll ? "Hide all private keys" : "Reveal all private keys"
          }
        >
          {revealAll ? (
            <EyeSlashIcon className="w-4 h-4" />
          ) : (
            <EyeIcon className="w-4 h-4" />
          )}
          {revealAll ? "Hide PKs" : "Reveal PKs"}
        </button>

        <button
          onClick={() =>
            refreshGroupBalances(activeGroupName, {
              showToast: true,
              setToast: setToast,
            })
          }
          disabled={!tauriAvailable || !activeGroup.wallets?.length}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh balances for current group"
        >
          <RefreshCw size={14} />
          Refresh Balances
        </button>

        {/* Active group selector (pills) under refresh balances */}
        <div className="w-full"></div>
        <div className="flex flex-wrap gap-2 mt-1">
          <button
            onClick={onManageGroups}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
            title="Manage groups (rename/delete)"
          >
            <Settings size={14} />
            Manage Groups
          </button>

          {groupsWithDev?.map((group) => (
            <button
              key={group.name}
              onClick={() => onSelectGroup?.(group.name)}
              className={`px-3 py-1.5 rounded-full text-sm transition border ${
                activeGroupName === group.name
                  ? "bg-white text-black border-white/10 shadow"
                  : "bg-white/10 text-white/80 hover:bg-white/15 border-white/10"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full md:w-72">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60"
          size={16}
        />
        <input
          type="text"
          placeholder="Search address or key…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400/70 placeholder-white/30 text-sm"
        />
      </div>
    </div>
  );
}
