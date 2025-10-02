// File: src/hooks/useUnifiedJobPolling.js
import { useState, useRef, useCallback } from 'react';
import { isTauriEnv, tauriInvoke } from '../lib/tauriClient';
import { useJobContext } from '../context/JobContext';

/**
 * Hook unifié pour le long polling de tous les types de jobs
 * Utilise uniquement get_job_status toutes les 1 sec
 * @param {function} onJobCompleted - Callback appelé quand un job se termine
 */
const useUnifiedJobPolling = (onJobCompleted) => {
    const [activeJobs, setActiveJobs] = useState(new Map()); // jobId -> jobInfo
    const [results, setResults] = useState(new Map()); // jobId -> parsed result
    const [error, setError] = useState(null);

    const pollingIntervalsRef = useRef(new Map()); // jobId -> intervalId
    const { addJobToHistory, updateJobInHistory } = useJobContext();

    const tauriAvailable = isTauriEnv();

    const clearPolling = useCallback((jobId) => {
        const intervalId = pollingIntervalsRef.current.get(jobId);
        if (intervalId) {
            clearInterval(intervalId);
            pollingIntervalsRef.current.delete(jobId);
        }
    }, []);

    const clearAllPolling = useCallback(() => {
        pollingIntervalsRef.current.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        pollingIntervalsRef.current.clear();
    }, []);

    const parseJobResult = useCallback((resultString, jobType, jobInfo) => {
        if (!resultString) return null;

        // Special handling for tokens balance batch jobs
        if (jobType === "get_tokens_balances" && resultString === "Success") {
            console.warn(`⚠️ Job ${jobType} returned "Success" instead of JSON data. This might indicate the backend didn't store the actual results.`);
            // Return an empty result structure instead of failing
            return { error: "Job completed but no data returned" };
        }

        try {
            const resultData = JSON.parse(resultString);
            console.log(`✅ Job result parsed for ${jobType}:`, resultData);
            return resultData;
        } catch (parseError) {
            // For simple success messages, return a success indicator
            if (resultString === "Success") {
                console.log(`✅ Job ${jobType} completed successfully (simple result)`);
                return { success: true, message: "Operation completed successfully" };
            }

            console.error(`❌ Failed to parse ${jobType} result:`, parseError);
            // Return the raw string if parsing fails
            return { raw_result: resultString, parse_error: parseError.message };
        }
    }, []);

    const startJobPolling = useCallback((jobId, jobType, metadata = {}) => {
        if (!tauriAvailable) {
            console.warn('Tauri not available, cannot start job polling');
            return;
        }

        console.log(`🔄 Starting unified polling for job ${jobId} (${jobType})`);

        // Add to history immediately
        addJobToHistory({
            id: jobId,
            name: jobType,
            state: 'Running',
            result: null,
            progress_percentage: 0,
            current_step: 'Starting...'
        }, metadata);

        // Clear any existing polling for this job
        clearPolling(jobId);

        const pollInterval = setInterval(async () => {
            try {
                const jobInfo = await tauriInvoke("get_job_status", { jobId });

                if (!jobInfo) {
                    console.warn(`Job ${jobId} not found`);
                    clearPolling(jobId);
                    setActiveJobs(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(jobId);
                        return newMap;
                    });
                    return;
                }

                // Log job info for debugging
                console.log(`🔄 Job ${jobId} status:`, {
                    state: jobInfo.state,
                    progress: jobInfo.progress_percentage,
                    current_step: jobInfo.current_step
                });

                // Update active jobs
                setActiveJobs(prev => new Map(prev).set(jobId, jobInfo));

                // Update history
                updateJobInHistory(jobId, jobInfo);
                console.log(`📝 Updated job ${jobId} in history with state: ${jobInfo.state}`);

                // Check if job is completed
                if (jobInfo.state === "Completed") {
                    console.log(`✅ Job ${jobId} completed:`, jobInfo);

                    // Parse and store result
                    if (jobInfo.result) {
                        const parsedResult = parseJobResult(jobInfo.result, jobType, jobInfo);
                        setResults(prev => new Map(prev).set(jobId, parsedResult));
                    }

                    // Notify callback if provided
                    if (onJobCompleted && typeof onJobCompleted === 'function') {
                        console.log(`📢 Notifying job completion callback for ${jobId}`);
                        setTimeout(() => {
                            onJobCompleted(jobId, jobInfo);
                        }, 100); // Small delay to ensure state updates
                    }

                    // Stop polling immediately but keep job visible
                    clearPolling(jobId);

                    // Keep the job in activeJobs for a bit longer to allow UI updates
                    setTimeout(() => {
                        console.log(`🧹 Cleaning up completed job ${jobId} from activeJobs`);
                        setActiveJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(jobId);
                            return newMap;
                        });
                    }, 3000); // Keep for 3 seconds after completion
                } else if (jobInfo.state === "Cancelled") {
                    console.log(`⚠️ Job ${jobId} was cancelled`);

                    // Notify callback if provided
                    if (onJobCompleted && typeof onJobCompleted === 'function') {
                        console.log(`📢 Notifying job cancellation callback for ${jobId}`);
                        setTimeout(() => {
                            onJobCompleted(jobId, jobInfo);
                        }, 100);
                    }

                    clearPolling(jobId);
                    setActiveJobs(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(jobId);
                        return newMap;
                    });
                } else if (jobInfo.state && jobInfo.state.Failed) {
                    console.error(`❌ Job ${jobId} failed:`, jobInfo.state.Failed);

                    // Notify callback if provided
                    if (onJobCompleted && typeof onJobCompleted === 'function') {
                        console.log(`📢 Notifying job failure callback for ${jobId}`);
                        setTimeout(() => {
                            onJobCompleted(jobId, jobInfo);
                        }, 100);
                    }

                    // Stop polling immediately
                    clearPolling(jobId);

                    // Keep failed jobs for a bit longer too
                    setTimeout(() => {
                        setActiveJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(jobId);
                            return newMap;
                        });
                    }, 5000); // Keep failed jobs for 5 seconds
                    setError(`Job ${jobType} failed: ${jobInfo.state.Failed}`);
                }

            } catch (pollError) {
                console.error(`❌ Error polling job ${jobId}:`, pollError);
                // Don't stop polling on error, might be temporary
            }
        }, 1000); // Poll every 1 second

        pollingIntervalsRef.current.set(jobId, pollInterval);
    }, [tauriAvailable, addJobToHistory, updateJobInHistory, parseJobResult, clearPolling]);

    // Start specific job types
    const startTokensBalanceJob = useCallback(async (wallet) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("get_tokens_balances_batch_job", {
                wallets: [wallet]
            });

            startJobPolling(jobId, "get_tokens_balances", {
                wallet,
                operation: "fetch_tokens",
                parameters: { wallet }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start tokens balance job:', error);
            setError(`Failed to start tokens fetch: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startBurnEachTokensJob = useCallback(async (walletPk, mintAddresses, burnPercentage = 100) => {
        if (!tauriAvailable) return null;

        console.log("", walletPk, mintAddresses)
        try {
            const jobId = await tauriInvoke("burn_each_tokens_job", {
                walletPk,
                mintAddresses,
                burnPercentage: 100
            });

            startJobPolling(jobId, "burn_each_tokens", {
                wallet: walletPk,
                operation: "burn_tokens",
                parameters: { mintAddresses, burnPercentage: 100 }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start burn each tokens job:', error);
            setError(`Failed to start burn: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startBurnTokensBatchJob = useCallback(async (walletPk, tokenMints) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("burn_tokens_batch_job", {
                walletPk,
                tokenMints
            });

            startJobPolling(jobId, "burn_tokens_batch", {
                wallet: walletPk,
                operation: "burn_tokens_batch",
                parameters: { tokenMints }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start burn tokens batch job:', error);
            setError(`Failed to start burn tokens batch: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startCloseAccountsJob = useCallback(async (walletPk) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("close_accounts_job", { walletPk });

            startJobPolling(jobId, "close_accounts", {
                wallet: walletPk,
                operation: "close_accounts",
                parameters: { walletPk }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start close accounts job:', error);
            setError(`Failed to start close accounts: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startRefundWalletsJob = useCallback(async (pks, refundTo, fundingPk) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("refund_wallets_job", {
                pks: pks,
                refundTo: refundTo,
                fundingPk: fundingPk
            });

            startJobPolling(jobId, "refund_wallets", {
                operation: "refund_wallets",
                refundTo,
                walletsCount: pks.length,
                parameters: { pks, refundTo, fundingPk }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start refund wallets job:', error);
            setError(`Failed to start refund wallets: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startRefundWalletsSpecificAmountJob = useCallback(async (pks, refundTo, amountSol) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("refund_wallets_specific_amount_job", {
                pks: pks,
                refundTo: refundTo,
                amountSol: amountSol
            });

            startJobPolling(jobId, "refund_wallets_specific_amount", {
                operation: "refund_wallets_specific_amount",
                refundTo,
                amountSol,
                walletsCount: pks.length,
                parameters: { pks, refundTo, amountSol }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start refund wallets specific amount job:', error);
            setError(`Failed to start refund wallets specific amount: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startDistributeSolJob = useCallback(async (srcWallet, targetWallets, totalAmount) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("distribute_sol_job", {
                src: srcWallet,
                wallets: targetWallets,
                totalAmountSol: totalAmount
            });

            startJobPolling(jobId, "distribute_sol", {
                srcWallet,
                operation: "distribute_sol",
                parameters: { targetWallets, totalAmount }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start distribute SOL job:', error);
            setError(`Failed to start distribute SOL: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const startCloseTokenAccountJob = useCallback(async (walletPk, tokenMint) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("close_token_account_job", {
                walletPk,
                tokenMint
            });

            startJobPolling(jobId, "close_token_account", {
                operation: "close_token_account",
                walletPk,
                tokenMint,
                parameters: { walletPk, tokenMint }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start close token account job:', error);
            setError(`Failed to start close token account: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    // Start a batch close token accounts job
    const startCloseTokenAccountsBatchJob = useCallback(async (walletPk, tokenMints) => {
        if (!tauriAvailable) return null;

        try {
            const jobId = await tauriInvoke("close_token_accounts_batch_job", {
                walletPk,
                tokenMints
            });

            startJobPolling(jobId, "close_token_accounts_batch", {
                operation: "close_token_accounts_batch",
                parameters: { walletPk, tokenMints }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start close token accounts batch job:', error);
            setError(`Failed to start close token accounts batch: ${error.message}`);
            return null;
        }
    }, [tauriAvailable, startJobPolling]);

    const cancelJob = useCallback(async (jobId) => {
        if (!jobId || !tauriAvailable) return false;

        try {
            await tauriInvoke("cancel_job", { jobId });
            clearPolling(jobId);
            setActiveJobs(prev => {
                const newMap = new Map(prev);
                newMap.delete(jobId);
                return newMap;
            });
            return true;
        } catch (error) {
            console.error(`Failed to cancel job ${jobId}:`, error);
            return false;
        }
    }, [tauriAvailable, clearPolling]);

    const cleanup = useCallback(() => {
        clearAllPolling();
        setActiveJobs(new Map());
        setResults(new Map());
        setError(null);
    }, [clearAllPolling]);

    // Helper methods
    const isJobRunning = useCallback((jobId) => {
        return activeJobs.has(jobId);
    }, [activeJobs]);

    const getJobProgress = useCallback((jobId) => {
        const job = activeJobs.get(jobId);
        return job ? job.progress_percentage : 0;
    }, [activeJobs]);

    const getJobResult = useCallback((jobId) => {
        return results.get(jobId);
    }, [results]);

    const getJobInfo = useCallback((jobId) => {
        return activeJobs.get(jobId);
    }, [activeJobs]);

    // Function to start polling for existing jobs
    const startPollingExistingJob = useCallback((jobId, jobType, metadata = {}) => {
        if (!tauriAvailable || pollingIntervalsRef.current.has(jobId)) {
            return; // Already polling this job
        }

        console.log(`🔄 Starting polling for existing job ${jobId} (${jobType})`);
        startJobPolling(jobId, jobType, metadata);
    }, [tauriAvailable, startJobPolling]);

    return {
        // State
        activeJobs: Array.from(activeJobs.values()),
        results,
        error,
        tauriAvailable,

        // Actions
        startTokensBalanceJob,
        startBurnEachTokensJob,
        startBurnTokensBatchJob,
        startCloseAccountsJob,
        startCloseTokenAccountJob,
        startCloseTokenAccountsBatchJob,
        startRefundWalletsJob,
        startRefundWalletsSpecificAmountJob,
        startDistributeSolJob,
        startPollingExistingJob,
        cancelJob,
        cleanup,

        // Helpers
        isJobRunning,
        getJobProgress,
        getJobResult,
        getJobInfo,
        activeJobsCount: activeJobs.size
    };
};

export default useUnifiedJobPolling;
