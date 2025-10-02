// useJobOnlyCloseTokenAccounts.js - Hook optimisé pour fermer des comptes de tokens spécifiques
import { useState, useCallback, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/tauri';

/**
 * Hook optimisé pour fermer des comptes de tokens spécifiques en utilisant UNIQUEMENT le job status
 * Gère plusieurs jobs de fermeture de comptes simultanément
 */
const useJobOnlyCloseTokenAccounts = () => {
    const [closeTokenJobs, setCloseTokenJobs] = useState(new Map()); // mint -> { jobId, status, progress }
    const [results, setResults] = useState(new Map()); // mint -> result
    const [error, setError] = useState(null);

    const pollingIntervalsRef = useRef(new Map()); // mint -> intervalId
    const apiCallCountRef = useRef(0);

    // Reset API call counter for monitoring
    const resetApiCallCount = () => {
        apiCallCountRef.current = 0;
    };

    // Track API calls for debugging
    const trackApiCall = (endpoint) => {
        apiCallCountRef.current += 1;
        console.log(`🔒 API Call #${apiCallCountRef.current}: ${endpoint}`);
    };

    const clearPolling = useCallback((mint) => {
        const intervalId = pollingIntervalsRef.current.get(mint);
        if (intervalId) {
            clearInterval(intervalId);
            pollingIntervalsRef.current.delete(mint);
        }
    }, []);

    const clearAllPolling = useCallback(() => {
        pollingIntervalsRef.current.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        pollingIntervalsRef.current.clear();
    }, []);

    const parseJobResults = useCallback((resultString, mint) => {
        try {
            const resultData = JSON.parse(resultString);

            console.log(`✅ Close token account result parsed for ${mint.slice(0, 8)}...`, resultData);
            setResults(prev => new Map(prev).set(mint, resultData));

            // Check if close was successful
            if (resultData.success || resultData.ok) {
                return { success: true, result: resultData };
            } else {
                return { success: false, result: resultData };
            }
        } catch (parseError) {
            console.error(`❌ Failed to parse close token account result for ${mint}:`, parseError);
            return { success: false, error: 'Failed to parse close token account result' };
        }
    }, []);

    const pollCloseTokenJobStatus = useCallback((jobId, mint) => {
        console.log(`🔒 Starting job-only close token account polling for job ${jobId} (mint: ${mint.slice(0, 8)}...)`);

        const pollInterval = setInterval(async () => {
            try {
                trackApiCall('get_job_status'); // ONLY allowed API call
                const jobInfo = await tauriInvoke("get_job_status", { jobId });

                // Update job status
                setCloseTokenJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.set(mint, {
                        jobId,
                        status: jobInfo.state,
                        progress: jobInfo.progress_percentage || 0,
                        currentStep: jobInfo.current_step || 'Closing token account...'
                    });
                    return newMap;
                });

                // Check completion
                if (jobInfo.state === "Completed") {
                    console.log(`✅ Close token account job completed for ${mint.slice(0, 8)}...`);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Parse results DIRECTLY from job - NO additional API calls
                    if (jobInfo.result) {
                        const parseResult = parseJobResults(jobInfo.result, mint);

                        // Update final job status
                        setCloseTokenJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.set(mint, {
                                jobId,
                                status: 'Completed',
                                progress: 100,
                                success: parseResult.success,
                                result: parseResult.result
                            });
                            return newMap;
                        });

                        // Clean up after a delay
                        setTimeout(() => {
                            setCloseTokenJobs(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(mint);
                                return newMap;
                            });
                        }, 3000);
                    } else {
                        console.warn(`⚠️ Close token account job completed but no result data for ${mint}`);
                    }
                } else if (jobInfo.state && jobInfo.state.Failed) {
                    console.error(`❌ Close token account job failed for ${mint}:`, jobInfo.state.Failed);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Update job status with error
                    setCloseTokenJobs(prev => {
                        const newMap = new Map(prev);
                        newMap.set(mint, {
                            jobId,
                            status: 'Failed',
                            progress: 0,
                            success: false,
                            error: jobInfo.state.Failed
                        });
                        return newMap;
                    });

                    // Clean up after a delay
                    setTimeout(() => {
                        setCloseTokenJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(mint);
                            return newMap;
                        });
                    }, 5000);
                } else if (jobInfo.state === "Cancelled") {
                    console.log(`🚫 Close token account job was cancelled for ${mint}`);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Update job status
                    setCloseTokenJobs(prev => {
                        const newMap = new Map(prev);
                        newMap.set(mint, {
                            jobId,
                            status: 'Cancelled',
                            progress: 0,
                            success: false
                        });
                        return newMap;
                    });

                    // Clean up after a delay
                    setTimeout(() => {
                        setCloseTokenJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(mint);
                            return newMap;
                        });
                    }, 3000);
                }
                // If job is still running, continue polling
            } catch (pollError) {
                console.error(`❌ Error polling close token account job ${jobId}:`, pollError);
                setError(`Failed to check close token account job status: ${pollError.message}`);

                clearInterval(pollInterval);
                pollingIntervalsRef.current.delete(mint);

                // Update job status with error
                setCloseTokenJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.set(mint, {
                        jobId,
                        status: 'Failed',
                        progress: 0,
                        success: false,
                        error: pollError.message
                    });
                    return newMap;
                });
            }
        }, 1000); // Poll every second

        pollingIntervalsRef.current.set(mint, pollInterval);
    }, [parseJobResults]);

    const closeTokenAccountJobOnly = useCallback(async (walletPk, tokenMint) => {
        console.log(`🚀 Starting job-only close token account for mint ${tokenMint.slice(0, 8)}...`);
        resetApiCallCount();

        setError(null);

        // Clear any existing polling for this mint
        clearPolling(tokenMint);

        // Set initial job status
        setCloseTokenJobs(prev => {
            const newMap = new Map(prev);
            newMap.set(tokenMint, {
                jobId: null,
                status: 'Starting',
                progress: 0,
                currentStep: 'Initiating close token account...'
            });
            return newMap;
        });

        try {
            // ONLY API call to start the close token account job
            trackApiCall('close_token_account_job');
            const jobId = await tauriInvoke("close_token_account_job", {
                walletPk,
                tokenMint
            });

            if (jobId) {
                console.log(`✅ Close token account job started with ID: ${jobId} for mint ${tokenMint.slice(0, 8)}...`);

                // Update job status
                setCloseTokenJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.set(tokenMint, {
                        jobId,
                        status: 'Running',
                        progress: 0,
                        currentStep: 'Closing token account...'
                    });
                    return newMap;
                });

                // Start job-only polling
                pollCloseTokenJobStatus(jobId, tokenMint);

                return jobId;
            } else {
                throw new Error('No job ID received from close_token_account_job');
            }
        } catch (closeError) {
            console.error(`❌ Failed to start close token account job for ${tokenMint}:`, closeError);
            setError(`Failed to start close token account job: ${closeError.message}`);

            // Update job status with error
            setCloseTokenJobs(prev => {
                const newMap = new Map(prev);
                newMap.set(tokenMint, {
                    jobId: null,
                    status: 'Failed',
                    progress: 0,
                    success: false,
                    error: closeError.message
                });
                return newMap;
            });

            throw closeError;
        }
    }, [pollCloseTokenJobStatus, clearPolling]);

    const closeMultipleTokenAccountsJobOnly = useCallback(async (walletPk, tokenMints) => {
        console.log(`🚀 Starting job-only close for ${tokenMints.length} token accounts`);

        const jobIds = [];

        for (const mint of tokenMints) {
            try {
                const jobId = await closeTokenAccountJobOnly(walletPk, mint);
                jobIds.push({ mint, jobId });
            } catch (error) {
                console.error(`Failed to start close job for ${mint}:`, error);
            }
        }

        return jobIds;
    }, [closeTokenAccountJobOnly]);

    const cancelCloseTokenJob = useCallback(async (tokenMint) => {
        const job = closeTokenJobs.get(tokenMint);
        if (!job || !job.jobId) return false;

        try {
            const cancelled = await tauriInvoke("cancel_job", { jobId: job.jobId });
            if (cancelled) {
                console.log(`🚫 Close token account job cancelled for ${tokenMint.slice(0, 8)}...`);
                clearPolling(tokenMint);

                setCloseTokenJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(tokenMint);
                    return newMap;
                });
            }
            return cancelled;
        } catch (error) {
            console.error(`❌ Failed to cancel close token account job for ${tokenMint}:`, error);
            return false;
        }
    }, [closeTokenJobs, clearPolling]);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        clearAllPolling();
        setCloseTokenJobs(new Map());
        setResults(new Map());
    }, [clearAllPolling]);

    // Get API call statistics for monitoring
    const getApiCallStats = useCallback(() => {
        return {
            totalCalls: apiCallCountRef.current,
            isOptimized: true, // This hook only uses job approach
            description: `Made ${apiCallCountRef.current} API calls (job-only close token accounts approach)`
        };
    }, []);

    // Helper methods
    const isClosingTokenAccount = useCallback((tokenMint) => {
        const job = closeTokenJobs.get(tokenMint);
        return job && (job.status === 'Starting' || job.status === 'Running');
    }, [closeTokenJobs]);

    const getCloseTokenProgress = useCallback((tokenMint) => {
        const job = closeTokenJobs.get(tokenMint);
        return job ? job.progress : 0;
    }, [closeTokenJobs]);

    const getCloseTokenStatus = useCallback((tokenMint) => {
        const job = closeTokenJobs.get(tokenMint);
        return job ? job.status : null;
    }, [closeTokenJobs]);

    const hasActiveCloseJob = useCallback((tokenMint) => {
        return closeTokenJobs.has(tokenMint);
    }, [closeTokenJobs]);

    return {
        closeTokenJobs,
        results,
        error,
        closeTokenAccountJobOnly,
        closeMultipleTokenAccountsJobOnly,
        cancelCloseTokenJob,
        cleanup,
        getApiCallStats,
        isClosingTokenAccount,
        getCloseTokenProgress,
        getCloseTokenStatus,
        hasActiveCloseJob,
        activeJobsCount: closeTokenJobs.size,
        isJobOnlyCompliant: true // This hook only uses job approach
    };
};

export default useJobOnlyCloseTokenAccounts;
