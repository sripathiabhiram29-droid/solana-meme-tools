import React from "react";
import SolanaIcon from "../icons/SolanaIcon";

export default function WalletsGroupInfo({
  activeGroupName,
  walletsCount,
  totalBalance,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
      <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 shadow-sm">
        <div className="text-xs text-white/60">Group</div>
        <div className="text-base font-semibold">{activeGroupName || "—"}</div>
      </div>
      <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 shadow-sm">
        <div className="text-xs text-white/60">Wallets</div>
        <div className="text-base font-semibold">{walletsCount}</div>
      </div>
      <div className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 shadow-sm">
        <div className="text-xs text-white/60">Total balance</div>
        <div className="text-base font-semibold flex items-center gap-1">
          <span>{totalBalance}</span>
          <SolanaIcon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
