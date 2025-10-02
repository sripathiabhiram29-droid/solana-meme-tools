import { Dialog } from "@headlessui/react";
import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // "warning", "danger", "success", "info"
  confirmButtonVariant = "primary", // "primary", "danger", "success"
}) {
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <XCircle className="w-6 h-6 text-red-400" />;
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case "info":
        return <Info className="w-6 h-6 text-blue-400" />;
      case "warning":
      default:
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
    }
  };

  const getConfirmButtonClasses = () => {
    switch (confirmButtonVariant) {
      case "danger":
        return "bg-red-500 hover:bg-red-600 text-white";
      case "success":
        return "bg-green-500 hover:bg-green-600 text-white";
      case "primary":
      default:
        return "bg-lime-500 hover:bg-lime-600 text-black";
    }
  };

  return (
    <Dialog open={!!isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 mt-1">{getIcon()}</div>
            <div className="flex-1">
              <Dialog.Title className="text-lg font-semibold mb-2">
                {title}
              </Dialog.Title>
              <p className="text-sm text-white/80 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${getConfirmButtonClasses()}`}
            >
              {confirmText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
