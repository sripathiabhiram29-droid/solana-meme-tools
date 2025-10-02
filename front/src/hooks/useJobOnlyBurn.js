// useJobOnlyBurn.js - Hook optimisé pour l'approche job-only pour les burns
import { useState, useCallback, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/tauri';

/**
 * Hook optimisé pour burn des tokens en utilisant UNIQUEMENT le job status
 * Élimine tous les appels API redondants et timeouts artificiels
 */
const useJobOnlyBurn = () => {
    const [burnJobs, setBurnJobs] = useState(new Map()); // mint -> { jobId, status, progress }
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
        console.log(`🔥 API Call #${apiCallCountRef.current}: ${endpoint}`);
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

            console.log(`✅ Burn result parsed for ${mint.slice(0, 8)}...`, resultData);
            setResults(prev => new Map(prev).set(mint, resultData));

            // Check if burn was successful
            if (resultData.success || resultData.ok) {
                return { success: true, result: resultData };
            } else {
                return { success: false, result: resultData };
            }
        } catch (parseError) {
            console.error(`❌ Failed to parse burn result for ${mint}:`, parseError);
            return { success: false, error: 'Failed to parse burn result' };
        }
    }, []);

    const pollBurnJobStatus = useCallback((jobId, mint, walletPk, burnPercentage) => {
        console.log(`🔥 Starting job-only burn polling for job ${jobId} (mint: ${mint.slice(0, 8)}...)`);

        const pollInterval = setInterval(async () => {
            try {
                trackApiCall('get_job_status'); // ONLY allowed API call
                const jobInfo = await tauriInvoke("get_job_status", { jobId });

                // Update job status
                setBurnJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.set(mint, {
                        jobId,
                        status: jobInfo.state,
                        progress: jobInfo.progress_percentage || 0,
                        currentStep: jobInfo.current_step || 'Processing...'
                    });
                    return newMap;
                });

                // Check completion
                if (jobInfo.state === "Completed") {
                    console.log(`✅ Burn job completed for ${mint.slice(0, 8)}...`);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Parse results DIRECTLY from job - NO additional API calls
                    if (jobInfo.result) {
                        const parseResult = parseJobResults(jobInfo.result, mint);

                        // Update final job status
                        setBurnJobs(prev => {
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
                            setBurnJobs(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(mint);
                                return newMap;
                            });
                        }, 3000);
                    } else {
                        console.warn(`⚠️ Burn job completed but no result data for ${mint}`);
                    }
                } else if (jobInfo.state && jobInfo.state.Failed) {
                    console.error(`❌ Burn job failed for ${mint}:`, jobInfo.state.Failed);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Update job status with error
                    setBurnJobs(prev => {
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
                        setBurnJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(mint);
                            return newMap;
                        });
                    }, 5000);
                } else if (jobInfo.state === "Cancelled") {
                    console.log(`🚫 Burn job was cancelled for ${mint}`);

                    clearInterval(pollInterval);
                    pollingIntervalsRef.current.delete(mint);

                    // Update job status
                    setBurnJobs(prev => {
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
                        setBurnJobs(prev => {
                            const newMap = new Map(prev);
                            newMap.delete(mint);
                            return newMap;
                        });
                    }, 3000);
                }
                // If job is still running, continue polling
            } catch (pollError) {
                console.error(`❌ Error polling burn job ${jobId}:`, pollError);
                setError(`Failed to check burn job status: ${pollError.message}`);

                clearInterval(pollInterval);
                pollingIntervalsRef.current.delete(mint);

                // Update job status with error
                setBurnJobs(prev => {
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

    const burnTokenJobOnly = useCallback(async (walletPk, mintAddress, burnPercentage = 100.0) => {
        console.log(`🚀 Starting job-only burn for mint ${mintAddress.slice(0, 8)}...`);
        resetApiCallCount();

        setError(null);

        // Clear any existing polling for this mint
        clearPolling(mintAddress);

        // Set initial job status
        setBurnJobs(prev => {
            const newMap = new Map(prev);
            newMap.set(mintAddress, {
                jobId: null,
                status: 'Starting',
                progress: 0,
                currentStep: 'Initiating burn...'
            });
            return newMap;
        });

        try {
            // ONLY API call to start the burn job
            trackApiCall('burn_tokens_job');
            const jobId = await tauriInvoke("burn_tokens_job", {
                walletPk,
                mintAddress,
                burnPercentage
            });

            if (jobId) {
                console.log(`✅ Burn job started with ID: ${jobId} for mint ${mintAddress.slice(0, 8)}...`);

                // Update job status
                setBurnJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.set(mintAddress, {
                        jobId,
                        status: 'Running',
                        progress: 0,
                        currentStep: 'Burning tokens...'
                    });
                    return newMap;
                });

                // Start job-only polling
                pollBurnJobStatus(jobId, mintAddress, walletPk, burnPercentage);

                return jobId;
            } else {
                throw new Error('No job ID received from burn_tokens_job');
            }
        } catch (burnError) {
            console.error(`❌ Failed to start burn job for ${mintAddress}:`, burnError);
            setError(`Failed to start burn job: ${burnError.message}`);

            // Update job status with error
            setBurnJobs(prev => {
                const newMap = new Map(prev);
                newMap.set(mintAddress, {
                    jobId: null,
                    status: 'Failed',
                    progress: 0,
                    success: false,
                    error: burnError.message
                });
                return newMap;
            });

            throw burnError;
        }
    }, [pollBurnJobStatus, clearPolling]);

    const cancelBurnJob = useCallback(async (mintAddress) => {
        const job = burnJobs.get(mintAddress);
        if (!job || !job.jobId) return false;

        try {
            const cancelled = await tauriInvoke("cancel_job", { jobId: job.jobId });
            if (cancelled) {
                console.log(`🚫 Burn job cancelled for ${mintAddress.slice(0, 8)}...`);
                clearPolling(mintAddress);

                setBurnJobs(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(mintAddress);
                    return newMap;
                });
            }
            return cancelled;
        } catch (error) {
            console.error(`❌ Failed to cancel burn job for ${mintAddress}:`, error);
            return false;
        }
    }, [burnJobs, clearPolling]);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        clearAllPolling();
        setBurnJobs(new Map());
        setResults(new Map());
    }, [clearAllPolling]);

    // Get API call statistics for monitoring
    const getApiCallStats = useCallback(() => {
        return {
            totalCalls: apiCallCountRef.current,
            isOptimized: true, // This hook only uses job approach
            description: `Made ${apiCallCountRef.current} API calls (job-only burn approach)`
        };
    }, []);

    // Helper methods
    const isBurning = useCallback((mintAddress) => {
        const job = burnJobs.get(mintAddress);
        return job && (job.status === 'Starting' || job.status === 'Running');
    }, [burnJobs]);

    const getBurnProgress = useCallback((mintAddress) => {
        const job = burnJobs.get(mintAddress);
        return job ? job.progress : 0;
    }, [burnJobs]);

    const getBurnStatus = useCallback((mintAddress) => {
        const job = burnJobs.get(mintAddress);
        return job ? job.status : null;
    }, [burnJobs]);

    return {
        burnJobs,
        results,
        error,
        burnTokenJobOnly,
        cancelBurnJob,
        cleanup,
        getApiCallStats,
        isBurning,
        getBurnProgress,
        getBurnStatus,
        isJobOnlyCompliant: true // This hook only uses job approach
    };
};

export default useJobOnlyBurn;
