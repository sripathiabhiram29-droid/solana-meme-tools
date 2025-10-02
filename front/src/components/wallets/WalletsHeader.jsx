import React from "react";

export default function WalletsHeader() {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg sm:text-xl font-bold tracking-tight">Wallets</h2>
        <p className="text-sm text-white/60">
          Generate, import/export, search and manage private keys securely.
        </p>
      </div>
    </div>
  );
}
