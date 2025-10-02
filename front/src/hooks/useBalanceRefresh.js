// File: src/hooks/useBalanceRefresh.js
import { useCallback, useRef, useEffect } from "react";
import { isTauriEnv, tauriInvoke } from "../lib/tauriClient";

export function useBalanceRefresh(groups, setGroups, settings, mint) {
    const mountedRef = useRef(true);
    const autoRef = useRef(null);
    const tauriAvailable = isTauriEnv();

    // Refresh balances for a specific group
    const refreshGroupBalances = useCallback(
        async (groupName, opts = { showToast: true, setToast: null }) => {
            if (!tauriAvailable) {
                if (opts.showToast && settings?.enableToasts && opts.setToast) {
                    opts.setToast("Open with Tauri to refresh");
                }
                return;
            }

            const g = groups?.find((x) => x.name === groupName);
            if (!g) {
                if (opts.showToast && settings?.enableToasts && opts.setToast) {
                    opts.setToast("Group not found");
                }
                return;
            }

            if (!g.wallets || g.wallets.length === 0) {
                if (opts.showToast && settings?.enableToasts && opts.setToast) {
                    opts.setToast("No wallets in group");
                }
                return;
            }

            if (opts.showToast && settings?.enableToasts && opts.setToast) {
                opts.setToast(`Refreshing ${groupName}…`);
            }

            const updatedWallets = [];
            for (const w of g.wallets) {
                if (!mountedRef.current) break;
                try {
                    const balanceLamports = await tauriInvoke("get_sol_balance", {
                        wallet: w.wallet,
                    });
                    let balance;
                    if (typeof balanceLamports === "number" && balanceLamports > 1e9) {
                        balance = balanceLamports / 1_000_000_000;
                    } else {
                        balance = Number(balanceLamports) || 0;
                    }
                    // Also try to fetch token balance for the current mint (if provided)
                    let tokenBalance = w.tokens ?? 0;
                    // try {
                    //     if (mint && String(mint).trim()) {
                    //         const tb = await tauriInvoke("get_token_balance", {
                    //             wallet: w.wallet,
                    //             mint,
                    //         });
                    //         tokenBalance = Number(tb) || 0;
                    //     }
                    // } catch (te) {
                    //     console.error("getTokenBalance error:", te);
                    //     // keep existing token value on error
                    //     tokenBalance = w.tokens ?? tokenBalance;
                    // }

                    updatedWallets.push({ ...w, balance, tokens: tokenBalance });
                } catch (e) {
                    console.error("getSolBalance error:", e);
                    updatedWallets.push({ ...w, balance: w.balance ?? 0, tokens: w.tokens ?? 0 });
                }
            }

            setGroups((prev) =>
                prev.map((pg) =>
                    pg.name === groupName ? { ...pg, wallets: updatedWallets } : pg
                )
            );

            if (opts.showToast && settings?.enableToasts && opts.setToast) {
                opts.setToast(`Group ${groupName} refreshed ✓`);
            }
        },
        [groups, setGroups, settings?.enableToasts, tauriAvailable, mint]
    );

    // Auto-refresh functionality
    useEffect(() => {
        mountedRef.current = true;
        if (!tauriAvailable) return;

        if (autoRef.current) {
            clearInterval(autoRef.current);
            autoRef.current = null;
        }

        if (settings?.autoRefreshSec > 0) {
            autoRef.current = setInterval(() => {
                if (!mountedRef.current) return;
                (async () => {
                    for (const g of groups || []) {
                        if (!mountedRef.current) break;
                        if (!g.wallets || g.wallets.length === 0) continue;
                        // pass through the same opts; refreshGroupBalances will use the current `mint` captured in the hook
                        await refreshGroupBalances(g.name, { showToast: false });
                    }
                })();
            }, settings.autoRefreshSec * 1000);
        }

        return () => {
            mountedRef.current = false;
            if (autoRef.current) {
                clearInterval(autoRef.current);
                autoRef.current = null;
            }
        };
    }, [groups, settings?.autoRefreshSec, refreshGroupBalances, tauriAvailable, mint]);

    return {
        refreshGroupBalances,
        tauriAvailable,
    };
}
