import { Dialog } from "@headlessui/react";
import { useState } from "react";
import { X, Edit3, Trash2, AlertTriangle } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

// Props: isOpen, onClose, groups, activeGroupName, onRename, onDelete, setToast
export default function ManageGroupModal({
  isOpen,
  onClose,
  groups = [],
  activeGroupName,
  onRename,
  onDelete,
  setToast,
}) {
  const [editingGroup, setEditingGroup] = useState(null);
  const [newName, setNewName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const protectedGroups = ["dev", "sniper"];

  const handleStartRename = (group) => {
    setEditingGroup(group.name);
    setNewName(group.name);
  };

  const handleCancelRename = () => {
    setEditingGroup(null);
    setNewName("");
  };

  const handleConfirmRename = () => {
    if (!newName.trim()) {
      setToast?.("Group name cannot be empty");
      return;
    }

    if (
      groups.some((g) => g.name === newName.trim() && g.name !== editingGroup)
    ) {
      setToast?.("A group with this name already exists");
      return;
    }

    const success = onRename?.(editingGroup, newName.trim());
    if (success) {
      setToast?.(`Group renamed to "${newName.trim()}"`);
      setEditingGroup(null);
      setNewName("");
    } else {
      setToast?.("Failed to rename group");
    }
  };

  const handleDeleteGroup = (groupName) => {
    if (protectedGroups.includes(groupName.toLowerCase())) {
      setToast?.(`Cannot delete ${groupName.toUpperCase()} group`);
      return;
    }

    const group = groups.find((g) => g.name === groupName);
    const walletCount = group?.wallets?.length || 0;

    const confirmMessage =
      walletCount > 0
        ? `Delete group "${groupName}" and its ${walletCount} wallet(s)? This action cannot be undone.`
        : `Delete group "${groupName}"? This action cannot be undone.`;

    setDeleteConfirm({
      groupName,
      title: "Delete Group",
      message: confirmMessage,
      confirmText: "Delete",
      type: "danger",
      confirmButtonVariant: "danger",
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    const success = onDelete?.(deleteConfirm.groupName);
    if (success) {
      setToast?.(`Group "${deleteConfirm.groupName}" deleted`);
    } else {
      setToast?.("Failed to delete group");
    }
    setDeleteConfirm(null);
  };

  const canDelete = (groupName) => {
    return (
      !protectedGroups.includes(groupName.toLowerCase()) && groups.length > 1
    );
  };

  const canRename = (groupName) => {
    return !protectedGroups.includes(groupName.toLowerCase());
  };

  return (
    <Dialog open={!!isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                Manage Groups
              </Dialog.Title>
              <p className="text-sm text-white/60 mt-1">
                Rename or delete wallet groups
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-white/5 text-sm hover:bg-white/10 transition"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-auto">
            {groups.map((group) => {
              const isProtected = protectedGroups.includes(
                group.name.toLowerCase()
              );
              const isActive = group.name === activeGroupName;
              const walletCount = group.wallets?.length || 0;
              const isEditing = editingGroup === group.name;

              return (
                <div
                  key={group.name}
                  className={`p-4 rounded-lg border transition ${
                    isActive
                      ? "bg-lime-500/10 border-lime-400/30"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-md bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                            placeholder="Group name"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleConfirmRename();
                              if (e.key === "Escape") handleCancelRename();
                            }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleConfirmRename}
                              className="px-2 py-1 text-xs bg-lime-500 text-black rounded hover:bg-lime-400 transition"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelRename}
                              className="px-2 py-1 text-xs bg-gray-600 rounded hover:bg-gray-500 transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{group.name}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 text-xs bg-lime-500/20 text-lime-400 rounded">
                                Active
                              </span>
                            )}
                            {isProtected && (
                              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                                Protected
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-white/60 mt-1">
                            {walletCount} wallet{walletCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-2">
                        {canRename(group.name) && (
                          <button
                            onClick={() => handleStartRename(group)}
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 transition"
                            title="Rename group"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {canDelete(group.name) && (
                          <button
                            onClick={() => handleDeleteGroup(group.name)}
                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/30 transition"
                            title="Delete group"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-start gap-2 text-xs text-white/60">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Protected groups:</p>
                <p>
                  DEV and SNIPER groups cannot be renamed or deleted as they are
                  required by the system.
                </p>
              </div>
            </div>
          </div>
        </Dialog.Panel>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleConfirmDelete}
        title={deleteConfirm?.title}
        message={deleteConfirm?.message}
        confirmText={deleteConfirm?.confirmText}
        cancelText="Cancel"
        type={deleteConfirm?.type}
        confirmButtonVariant={deleteConfirm?.confirmButtonVariant}
      />
    </Dialog>
  );
}
