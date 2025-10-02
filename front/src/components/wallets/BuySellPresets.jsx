import React from "react";

export default function BuySellPresets({
  buyPresets,
  sellPercents,
  editing,
  onEdit,
  onSave,
  onCancel,
  onChangePreset,
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-white/80">
          Buy/Sell Presets
        </h3>
        {!editing ? (
          <button
            onClick={onEdit}
            className="px-3 py-1.5 rounded-lg bg-lime-500 text-black hover:bg-lime-400 border-lime-400/60 text-xs font-semibold"
          >
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={onSave}
              className="px-3 py-1.5 rounded-lg bg-lime-500 text-black hover:bg-lime-400 border-lime-400/60 text-xs font-semibold"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-white border border-white/10 text-xs font-semibold ml-2"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
        <div>
          <div className="text-xs text-white/70 mb-1">Buy presets (SOL)</div>
          <div className="flex gap-2">
            {buyPresets.map((val, i) =>
              editing ? (
                <input
                  key={`buy-${i}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={val}
                  onChange={(e) =>
                    onChangePreset("buyPresets", i, Number(e.target.value))
                  }
                  className="px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400/70 w-20 text-center"
                />
              ) : (
                <button
                  key={`buy-btn-${i}`}
                  className="px-3 py-1.5 rounded-lg bg-lime-500/10 text-lime-300 border border-lime-400/20 text-sm w-20 text-center hover:bg-lime-500/30"
                >
                  {val}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <div className="text-xs text-white/70 mb-1">Sell percents (%)</div>
          <div className="flex gap-2">
            {sellPercents.map((val, i) =>
              editing ? (
                <input
                  key={`sell-${i}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={val}
                  onChange={(e) =>
                    onChangePreset("sellPercents", i, Number(e.target.value))
                  }
                  className="px-3 py-1.5 text-sm rounded-lg bg-white/10 border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400/70 w-20 text-center"
                />
              ) : (
                <button
                  key={`sell-btn-${i}`}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-400/20 text-sm w-20 text-center hover:bg-indigo-500/30"
                >
                  {val}%
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
