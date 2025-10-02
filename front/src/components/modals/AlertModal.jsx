import { Dialog } from "@headlessui/react";
import { AlertTriangle, CheckCircle, XCircle, Info, X } from "lucide-react";

export default function AlertModal({
  isOpen,
  onClose,
  title = "Information",
  message = "",
  type = "info", // "warning", "danger", "success", "info"
  buttonText = "OK",
}) {
  const getIcon = () => {
    switch (type) {
      case "danger":
      case "error":
        return <XCircle className="w-6 h-6 text-red-400" />;
      case "success":
        return <CheckCircle className="w-6 h-6 text-green-400" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-yellow-400" />;
      case "info":
      default:
        return <Info className="w-6 h-6 text-blue-400" />;
    }
  };

  const getButtonClasses = () => {
    switch (type) {
      case "danger":
      case "error":
        return "bg-red-500 hover:bg-red-600 text-white";
      case "success":
        return "bg-green-500 hover:bg-green-600 text-white";
      case "warning":
        return "bg-yellow-500 hover:bg-yellow-600 text-black";
      case "info":
      default:
        return "bg-blue-500 hover:bg-blue-600 text-white";
    }
  };

  return (
    <Dialog open={!!isOpen} onClose={onClose} className="relative z-[60]">
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1D1539] p-6 text-white shadow-xl border border-[#312152]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">{getIcon()}</div>
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
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${getButtonClasses()}`}
            >
              {buttonText}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
