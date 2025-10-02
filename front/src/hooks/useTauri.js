// File: src/hooks/useTauri.js
import { useCallback, useState } from "react";
import { tauriInvoke } from "../lib/tauriClient";

export function useTauri() {
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState(null);

  const call = useCallback(async (cmd, payload, timeoutMs) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await tauriInvoke(cmd, payload, timeoutMs);
      return res;
    } catch (e) {
      setErr(e?.message || String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { call, loading, error };
}
