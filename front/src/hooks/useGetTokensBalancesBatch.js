import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useJobProgress } from './useJobProgress';

/**
 * Hook to manage batch token balance fetching with job progress tracking
 */
export const useGetTokensBalancesBatch = () => {
    const [currentJobId, setCurrentJobId] = useState(null);
    const [results, setResults] = useState(new Map());
    const [stats, setStats] = useState({
        total: 0,
        completed: 0,
        failed: 0
    });

    const {
        jobInfo,
        loading: isJobLoading,
        error: jobError
    } = useJobProgress(currentJobId, {
        onProgress: (info) => {
            if (info.total_items && info.completed_items !== null) {
                setStats({
                    total: info.total_items,
                    completed: info.completed_items,
                    failed: 0 // We'll need to track this separately
                });
            }
        },
        onComplete: (result) => {
            console.log('Batch token balances fetch completed:', result);
            setCurrentJobId(null);
        },
        onError: (error) => {
            console.error('Batch token balances fetch failed:', error);
            setCurrentJobId(null);
        }
    });

    /**
     * Start a batch token balances fetch job
     * @param {string[]} wallets - Array of wallet addresses
     */
    const fetchTokensBalancesBatch = useCallback(async (wallets) => {
        if (!wallets || wallets.length === 0) {
            throw new Error('No wallets provided');
        }

        try {
            setResults(new Map());
            setStats({
                total: wallets.length,
                completed: 0,
                failed: 0
            });

            const jobId = await invoke('get_tokens_balances_batch_job', { wallets });
            setCurrentJobId(jobId);

            console.log(`Started batch token balances fetch job: ${jobId} for ${wallets.length} wallets`);

            return jobId;
        } catch (error) {
            console.error('Failed to start batch token balances fetch:', error);
            throw error;
        }
    }, []);

    /**
     * Cancel the current batch operation
     */
    const cancelBatch = useCallback(async () => {
        if (!currentJobId) return false;

        try {
            const cancelled = await invoke('cancel_job', { jobId: currentJobId });
            if (cancelled) {
                setCurrentJobId(null);
                console.log('Batch token balances fetch cancelled');
            }
            return cancelled;
        } catch (error) {
            console.error('Failed to cancel batch token balances fetch:', error);
            return false;
        }
    }, [currentJobId]);

    /**
     * Get individual wallet token balances (for fallback or single wallet)
     */
    const getWalletTokens = useCallback(async (wallet) => {
        try {
            const result = await invoke('get_tokens_balances', { wallet });
            return result;
        } catch (error) {
            console.error(`Failed to get tokens for wallet ${wallet}:`, error);
            throw error;
        }
    }, []);

    const isLoading = isJobLoading && currentJobId !== null;
    const isComplete = currentJobId === null && stats.completed > 0;
    const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

    return {
        // State
        isLoading,
        isComplete,
        error: jobError,
        results,
        stats,
        progress,
        currentJobId,
        jobInfo,

        // Actions
        fetchTokensBalancesBatch,
        cancelBatch,
        getWalletTokens,
    };
};

/**
 * Hook for batch operations with multiple wallets in WalletTokensModal
 */
export const useWalletTokensBatch = () => {
    const [selectedWallets, setSelectedWallets] = useState(new Set());
    const tokensBatch = useGetTokensBalancesBatch();

    const toggleWalletSelection = useCallback((walletAddress) => {
        setSelectedWallets(prev => {
            const newSelection = new Set(prev);
            if (newSelection.has(walletAddress)) {
                newSelection.delete(walletAddress);
            } else {
                newSelection.add(walletAddress);
            }
            return newSelection;
        });
    }, []);

    const selectAllWallets = useCallback((wallets) => {
        if (selectedWallets.size === wallets.length) {
            setSelectedWallets(new Set());
        } else {
            setSelectedWallets(new Set(wallets.map(w => w.address || w.wallet || w)));
        }
    }, [selectedWallets.size]);

    const fetchSelectedWalletsTokens = useCallback(async () => {
        if (selectedWallets.size === 0) {
            throw new Error('No wallets selected');
        }

        const walletAddresses = Array.from(selectedWallets);
        return await tokensBatch.fetchTokensBalancesBatch(walletAddresses);
    }, [selectedWallets, tokensBatch]);

    return {
        ...tokensBatch,
        selectedWallets,
        toggleWalletSelection,
        selectAllWallets,
        fetchSelectedWalletsTokens,
        clearSelection: () => setSelectedWallets(new Set()),
    };
};
