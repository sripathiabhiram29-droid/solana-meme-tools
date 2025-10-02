// File: src/views/Wallets.jsx
import { useMemo, useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { useBalanceRefresh } from "../hooks/useBalanceRefresh";
import Toast from "../components/Toast";
import { loadJsonFromLocalStorage } from "../lib/utils";
import GenerateWalletsModal from "../components/modals/GenerateWalletsModal";
import WalletTokensModal from "../components/modals/WalletTokensModal";
import DistributeSolModal from "../components/modals/DistributeSolModal";
import RefundWalletModal from "../components/modals/RefundWalletModal";
import ManageGroupModal from "../components/modals/ManageGroupModal";
import AlertModal from "../components/modals/AlertModal";
import ConfirmModal from "../components/modals/ConfirmModal";
import PromptModal from "../components/modals/PromptModal";
import WalletsHeader from "../components/wallets/WalletsHeader";
import BuySellPresets from "../components/wallets/BuySellPresets";
import WalletsToolbar from "../components/wallets/WalletsToolbar";
import WalletsGroupInfo from "../components/wallets/WalletsGroupInfo";
import WalletsTable from "../components/wallets/WalletsTable";

export default function Wallets({ groups, activeGroupName }) {
  const {
    setActiveGroup,
    deleteWallet,
    addWalletsToGroup,
    generateWallets,
    setGroups,
    renameGroup,
    deleteGroup,
  } = useApp();

  // LocalStorage key for group presets
  const LS_PRESETS_KEY = "mc_group_presets_v1";
  const LS_SETTINGS_KEY = "mc_settings_v1";
  useEffect(() => {
    try {
      setActiveGroup("dev");
    } catch {
      // ignore
    }
  }, []);
  // Load settings from localStorage for balance refresh
  const [settings] = useState(() => {
    const raw = loadJsonFromLocalStorage(LS_SETTINGS_KEY, {});
    return {
      enableToasts: raw.enableToasts ?? true,
      autoRefreshSec: raw.autoRefreshSec ?? 0,
    };
  });

  const { mint } = useApp();
  const { tokens } = useApp();
  // Use shared balance refresh hook (also refresh token balances for current mint)
  const { refreshGroupBalances, tauriAvailable } = useBalanceRefresh(
    groups,
    setGroups,
    settings,
    mint
  );

  // LocalStorage key for group presets

  // Load presets from localStorage
  const loadPresets = () => loadJsonFromLocalStorage(LS_PRESETS_KEY, {});

  // Save presets to localStorage
  const savePresets = (presets) => {
    localStorage.setItem(LS_PRESETS_KEY, JSON.stringify(presets));
  };

  // State for buy/sell presets per group
  const [groupPresets, setGroupPresets] = useState(() => loadPresets());

  // UI state for editing presets
  const [editingPresets, setEditingPresets] = useState(false);

  const [visibleKeys, setVisibleKeys] = useState({}); // { [address]: boolean }
  const [revealAll, setRevealAll] = useState(false);
  const [genCount, setGenCount] = useState(1);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);

  // Always ensure 'dev' group exists and is first, then 'sniper', plus at least one other group
  // Ensure 'dev' is first and 'sniper' second in the list. Keep other groups so addGroup works.
  const groupsWithDev = useMemo(() => {
    const all = [...(groups ?? [])];
    const devIdx = all.findIndex((g) => String(g.name).toLowerCase() === "dev");
    const sniperIdx = all.findIndex(
      (g) => String(g.name).toLowerCase() === "sniper"
    );
    const out = [];
    if (devIdx >= 0) out.push(all.splice(devIdx, 1)[0]);
    else out.push({ name: "dev", wallets: [] });
    if (sniperIdx >= 0) {
      // Need to re-find index because array may have shifted
      const idx2 = all.findIndex(
        (g) => String(g.name).toLowerCase() === "sniper"
      );
      if (idx2 >= 0) out.push(all.splice(idx2, 1)[0]);
    } else {
      out.push({ name: "sniper", wallets: [] });
    }
    // ensure at least Group 1 exists
    //   const group1Idx = all.findIndex(
    //     (g) => String(g.name).toLowerCase() === "group 1"
    //   );
    //   if (group1Idx === -1) all.push({ name: "Group 1", wallets: [] });
    return [...out, ...all];
  }, [groups]);

  const activeGroup = useMemo(() => {
    // Only allow selecting DEV or Group 1
    const found = groupsWithDev.find((g) => g.name === activeGroupName);
    if (found) return found;
    // If not found, fallback to DEV
    return groupsWithDev[0];
  }, [groupsWithDev, activeGroupName]);
  const wallets = activeGroup?.wallets ?? [];

  // Get current group presets or defaults
  // Always 6 buttons for buy/sell, editable for any group (including dev)
  const buyPresets = groupPresets[activeGroupName]?.buyPresets || [
    0.05, 0.1, 0.2, 0.5, 1, 2,
  ];
  const sellPercents = groupPresets[activeGroupName]?.sellPercents || [
    5, 10, 25, 50, 75, 100,
  ];

  // Handlers for preset editing
  const handlePresetChange = (type, idx, value) => {
    setGroupPresets((prev) => {
      const next = { ...prev };
      if (!next[activeGroupName])
        next[activeGroupName] = {
          buyPresets: [...buyPresets],
          sellPercents: [...sellPercents],
        };
      next[activeGroupName][type][idx] = value;
      return next;
    });
  };

  const handleSavePresets = () => {
    savePresets(groupPresets);
    // notify other views
    try {
      window.dispatchEvent(new Event("group_presets:changed"));
    } catch (e) {
      /* ignore */
    }
    setEditingPresets(false);
    setToast("Presets saved");
  };

  const handleEditPresets = () => setEditingPresets(true);
  const handleCancelPresets = () => {
    setGroupPresets(loadPresets());
    setEditingPresets(false);
  };

  // Derived
  const filteredWallets = useMemo(() => {
    if (!query.trim()) return wallets;
    const q = query.trim().toLowerCase();
    return wallets.filter(
      (w) =>
        w.wallet?.toLowerCase().includes(q) ||
        (w.pk || w.privateKey || "").toString().toLowerCase().includes(q)
    );
  }, [wallets, query]);

  // Modal state for wallet tokens
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWallet, setModalWallet] = useState(null);
  const [modalPk, setModalPk] = useState("");
  const [showManageGroups, setShowManageGroups] = useState(false);

  // Custom modal states
  const [alertModal, setAlertModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [promptModal, setPromptModal] = useState(null);

  const totalBalance = useMemo(
    () => wallets.reduce((acc, w) => acc + (Number(w.balance) || 0), 0),
    [wallets]
  );

  // Handlers
  const toggleKeyVisibility = (address) => {
    setVisibleKeys((prev) => ({
      ...prev,
      [address]: !prev[address],
    }));
  };

  const handleRevealAll = () => {
    if (!revealAll) {
      const next = {};
      wallets.forEach((w) => (next[w.wallet] = true));
      setVisibleKeys(next);
      setRevealAll(true);
      setToast("All private keys revealed");
    } else {
      const next = {};
      wallets.forEach((w) => (next[w.wallet] = false));
      setVisibleKeys(next);
      setRevealAll(false);
      setToast("All private keys hidden");
    }
  };

  const copy = async (text, toastMsg = "Copied!") => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(toastMsg);
    } catch (e) {
      console.error("Clipboard error:", e);
      setToast("Clipboard permission denied");
    }
  };

  const copyAddress = (addr) => copy(addr, "Address copied");
  const copyPk = (pk) => copy(pk, "Private key copied");

  const copyAllAddresses = () =>
    copy(wallets.map((w) => w.wallet).join("\n"), "All addresses copied");

  const copyAllPks = () =>
    copy(
      wallets.map((w) => w.pk || w.privateKey || "").join("\n"),
      "All private keys copied"
    );

  const exportCSV = () => {
    const header = "";
    // const header = "_id,group,wallet,pk,balance\n";
    const rows = wallets
      .map(
        (w, i) =>
          `${w.wallet || ""},${(w.pk || w.privateKey || "").replace(
            /"/g,
            '""'
          )},${Number(w.balance) || 0}`
      )
      .join("\n");
    const csv = header + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wallets_${activeGroup?.name || "group"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Exported CSV");
  };

  const importCSV = async () => {
    // Prevent importing into dev/sniper if it already has a wallet
    if (
      ["dev", "sniper"].includes(activeGroup.name.toLowerCase()) &&
      wallets.length > 0
    ) {
      setAlertModal({
        type: "warning",
        title: "Group Limit",
        message: `${activeGroup.name.toUpperCase()} group already has a wallet. Remove it to import another.`,
      });
      return;
    }

    setPromptModal({
      title: "Import CSV Wallets",
      message:
        "Paste CSV lines: address,pk[,balance]\nExample:\naddr1,abcdef...,0.123\naddr2,0123abcd...",
      placeholder: "address,privatekey,balance",
      validation: (text) => {
        if (!text.trim()) return "Please enter CSV data";
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (!lines.length) return "No valid lines found";
        return true;
      },
      onConfirm: (text) => {
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        const parsed = [];
        for (const line of lines) {
          const parts = line.split(",").map((x) => x.trim());
          if (parts.length < 2) continue;
          const [address, pk, balanceStr] = parts;
          if (!address || !pk) continue;
          parsed.push({
            wallet: address,
            pk,
            balance: Number(balanceStr) || 0,
          });
        }

        if (!parsed.length) {
          setAlertModal({
            type: "error",
            title: "Import Failed",
            message: "No valid wallets found in CSV data",
          });
          return;
        }

        addWalletsToGroup?.(activeGroupName, parsed);
        setToast(`Imported ${parsed.length} wallet(s)`);
      },
    });
  };

  // File input based CSV import (select file from disk)
  const fileInputRef = (function () {
    // Lazily create a ref-like object to avoid changing existing code structure too much
    let input = null;
    return {
      get: () => input,
      set: (el) => (input = el),
    };
  })();

  const handleImportFile = async (file) => {
    if (!file) return;
    // Prevent importing into dev/sniper if it already has a wallet
    if (
      ["dev", "sniper"].includes(activeGroup.name.toLowerCase()) &&
      wallets.length > 0
    ) {
      setToast(
        `${activeGroup.name.toUpperCase()} group already has a wallet. Remove it to import another.`
      );
      return;
    }
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) {
        setToast("Import aborted (no valid lines)");
        return;
      }
      const parsed = [];
      for (const line of lines) {
        // Allow CSV that may contain quoted fields
        // Simple split: handle commas inside quotes by using a regex
        const parts = line
          .match(/(?:"([^"]*)")|([^,]+)/g)
          ?.map((p) => p.replace(/^"|"$/g, "").trim());
        if (!parts || parts.length < 2) continue;
        const address = parts[0].trim();
        const pk = parts[1].trim();
        const balanceStr = parts[2] ? parts[2].trim() : "";
        if (!address || !pk) continue;
        parsed.push({ wallet: address, pk, balance: Number(balanceStr) || 0 });
      }
      if (!parsed.length) {
        setToast("Import aborted (no valid lines)");
        return;
      }
      addWalletsToGroup?.(activeGroupName, parsed);
      setToast(`Imported ${parsed.length} wallet(s)`);
    } catch (e) {
      console.error("Import file error:", e);
      setToast("Failed to import CSV file");
    }
  };

  const handleGenerate = () => {
    if (!generateWallets || !addWalletsToGroup) return;
    // Prevent generating more than one wallet into dev/sniper
    if (
      ["dev", "sniper"].includes(activeGroup.name.toLowerCase()) &&
      wallets.length > 0
    ) {
      setToast(
        `${activeGroup.name.toUpperCase()} group already has a wallet. Remove it to generate another.`
      );
      return;
    }
    const count = ["dev", "sniper"].includes(activeGroup.name.toLowerCase())
      ? 1
      : Math.max(1, Math.min(100, Math.floor(genCount)));
    const newWallets = generateWallets(count);
    addWalletsToGroup(activeGroupName, newWallets);
    setToast(`Generated ${count} wallet(s)`);
  };

  const removeWallet = (address) => {
    setConfirmModal({
      type: "warning",
      title: "Remove Wallet",
      message:
        "Remove this wallet from the group? This action cannot be undone.",
      confirmText: "Remove",
      confirmButtonVariant: "danger",
      onConfirm: () => {
        deleteWallet(address);
        setToast("Wallet removed");
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[#0B0A13] text-white">
      <WalletsHeader />

      <BuySellPresets
        buyPresets={buyPresets}
        sellPercents={sellPercents}
        editing={editingPresets}
        onEdit={handleEditPresets}
        onSave={handleSavePresets}
        onCancel={handleCancelPresets}
        onChangePreset={handlePresetChange}
      />

      <WalletsToolbar
        activeGroup={activeGroup}
        groupsWithDev={groupsWithDev}
        wallets={wallets}
        genCount={genCount}
        setGenCount={setGenCount}
        handleGenerate={handleGenerate}
        fileInputRef={fileInputRef}
        handleImportFile={handleImportFile}
        importCSV={importCSV}
        exportCSV={exportCSV}
        copyAllAddresses={copyAllAddresses}
        copyAllPks={copyAllPks}
        handleRevealAll={handleRevealAll}
        revealAll={revealAll}
        refreshGroupBalances={refreshGroupBalances}
        activeGroupName={activeGroupName}
        onSelectGroup={setActiveGroup}
        setToast={setToast}
        tauriAvailable={tauriAvailable}
        setQuery={setQuery}
        query={query}
        onManageGroups={() => setShowManageGroups(true)}
      />

      <WalletsGroupInfo
        activeGroupName={activeGroupName}
        walletsCount={wallets.length}
        totalBalance={totalBalance}
      />

      <WalletsTable
        wallets={wallets}
        filteredWallets={filteredWallets}
        activeGroup={activeGroup}
        revealAll={revealAll}
        visibleKeys={visibleKeys}
        toggleKeyVisibility={toggleKeyVisibility}
        copyAddress={copyAddress}
        copyPk={copyPk}
        removeWallet={removeWallet}
        onWalletClick={(addr, pk) => {
          setModalWallet(addr);
          setModalPk(pk);
          setModalOpen(true);
        }}
      />

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Wallet tokens modal */}
      <WalletTokensModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        wallet={modalWallet}
        pk={modalPk}
        sellPercents={sellPercents}
        tokensList={tokens}
        settings={{
          slippageBps: 100,
          enableToasts: true,
        }}
        setToast={setToast}
        useBatchMode={true}
      />

      {/* Manage groups modal */}
      <ManageGroupModal
        isOpen={showManageGroups}
        onClose={() => setShowManageGroups(false)}
        groups={groupsWithDev}
        activeGroupName={activeGroupName}
        onRename={renameGroup}
        onDelete={deleteGroup}
        setToast={setToast}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        title={alertModal?.title}
        message={alertModal?.message}
        type={alertModal?.type}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={confirmModal?.title}
        message={confirmModal?.message}
        confirmText={confirmModal?.confirmText}
        cancelText={confirmModal?.cancelText}
        type={confirmModal?.type}
        confirmButtonVariant={confirmModal?.confirmButtonVariant}
        onConfirm={() => {
          confirmModal?.onConfirm?.();
          setConfirmModal(null);
        }}
      />

      {/* Prompt Modal */}
      <PromptModal
        isOpen={!!promptModal}
        onClose={() => setPromptModal(null)}
        title={promptModal?.title}
        message={promptModal?.message}
        placeholder={promptModal?.placeholder}
        validation={promptModal?.validation}
        onConfirm={(value) => {
          promptModal?.onConfirm?.(value);
          setPromptModal(null);
        }}
      />
    </div>
  );
}
