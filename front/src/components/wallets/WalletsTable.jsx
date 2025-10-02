import React from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { ClipboardCopy, Trash2, KeyRound } from "lucide-react";
import SolanaIcon from "../icons/SolanaIcon";

export default function WalletsTable({
  wallets,
  filteredWallets,
  activeGroup,
  revealAll,
  visibleKeys,
  toggleKeyVisibility,
  copyAddress,
  copyPk,
  removeWallet,
  onWalletClick,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl">
      <div className="max-h-[65vh] overflow-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="sticky top-0 z-10 bg-[#11101a] text-gray-300 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Private Key</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredWallets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/70">
                  No wallets match your search.
                </td>
              </tr>
            ) : (
              filteredWallets.map((walletObj) => {
                const addr = walletObj.wallet;
                const pk = walletObj.pk || walletObj.privateKey || "";
                const revealed = revealAll || visibleKeys[addr];
                return (
                  <tr
                    key={addr}
                    className="border-t border-white/5 odd:bg-white/[0.02] hover:bg-white/[0.06] transition"
                  >
                    <td className="px-4 py-3">
                      {activeGroup.name === "dev" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-300 px-2 py-0.5 text-xs font-semibold">
                          DEV
                        </span>
                      ) : activeGroup.name === "sniper" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 text-indigo-300 px-2 py-0.5 text-xs font-semibold">
                          SNIPER
                        </span>
                      ) : (
                        <span className="text-white/70">
                          {wallets.findIndex((w) => w.wallet === addr)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-mono">
                      <div
                        className="flex items-center gap-2 group cursor-pointer"
                        onClick={() => onWalletClick && onWalletClick(addr, pk)}
                      >
                        <span className="hidden md:inline group-hover:text-indigo-300 transition">
                          {addr}
                        </span>
                        <span className="md:hidden group-hover:text-indigo-300 transition">
                          {addr?.slice(0, 6)}…{addr?.slice(-6)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyAddress(addr);
                          }}
                          className="text-white/60 hover:text-indigo-400 transition"
                          title="Copy address"
                        >
                          <ClipboardCopy size={16} />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[42ch]">
                        <span
                          className={`font-mono truncate ${
                            revealed ? "" : "blur-sm select-none"
                          }`}
                          title={revealed ? pk : "Hidden"}
                        >
                          {pk}
                        </span>
                        <button
                          onClick={() => toggleKeyVisibility(addr)}
                          className="text-white/60 hover:text-white transition"
                          title={
                            revealed ? "Hide private key" : "Show private key"
                          }
                        >
                          {revealed ? (
                            <EyeSlashIcon className="w-4 h-4" />
                          ) : (
                            <EyeIcon className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyPk(pk)}
                          className="text-white/60 hover:text-white transition"
                          title="Copy private key"
                        >
                          <ClipboardCopy size={16} />
                        </button>
                        <button
                          onClick={() => copyPk(pk)}
                          className="text-white/60 hover:text-white transition"
                          title="Copy private key"
                        >
                          <KeyRound size={16} />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-lime-400 font-mono">
                      <span>{Number(walletObj.balance) || 0}</span>
                      <SolanaIcon className="w-4 h-4 inline-block ml-1 align-[-2px] opacity-90" />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeWallet(addr)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-400/30 transition"
                        title="Remove wallet"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
