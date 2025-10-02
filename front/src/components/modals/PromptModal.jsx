import { Dialog } from "@headlessui/react";
import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export default function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Input Required",
  message = "Please enter a value:",
  placeholder = "",
  defaultValue = "",
  confirmText = "OK",
  cancelText = "Cancel",
  inputType = "text", // "text", "number", "email", etc.
  validation = null, // function to validate input
}) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState("");

  const handleConfirm = () => {
    const trimmedValue = value.trim();

    // Validate input
    if (validation) {
      const validationResult = validation(trimmedValue);
      if (validationResult !== true) {
        setError(validationResult || "Invalid input");
        return;
      }
    }

    if (!trimmedValue && inputType !== "number") {
      setError("This field is required");
      return;
    }

    onConfirm?.(trimmedValue);
    handleClose();
  };

  const handleClose = () => {
    setValue(defaultValue);
    setError("");
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      handleClose();
    }
  };

  return (
    <Dialog open={!!isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <HelpCircle className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold mb-2">
                  {title}
                </Dialog.Title>
                <p className="text-sm text-white/80 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type={inputType}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-lg bg-[#2F2650] text-white border border-[#3D2B67] focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-white/40"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition"
              >
                {confirmText}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
