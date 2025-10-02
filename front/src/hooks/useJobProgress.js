import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { jobTracker } from '../lib/jobProgress.js';

/**
 * Hook to track job progress
 * @param {string} jobId - The job ID to track
 * @param {object} options - Configuration options
 */
export const useJobProgress = (jobId, options = {}) => {
    const [jobInfo, setJobInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const {
        autoStart = true,
        pollInterval = 1000,
        onComplete,
        onError,
        onProgress
    } = options;

    const fetchJobInfo = useCallback(async () => {
        if (!jobId) return;

        try {
            setLoading(true);
            const info = await invoke('get_job_status', { jobId });
            setJobInfo(info);
            setError(null);

            if (onProgress && info) {
                onProgress(info);
            }

            // Check if job is completed
            if (info && (info.state === 'Completed' || info.state === 'Cancelled' || (info.state && info.state.Failed))) {
                if (info.state === 'Completed' && onComplete) {
                    onComplete(info);
                } else if (info.state !== 'Completed' && onError) {
                    const errorMsg = info.state && info.state.Failed ? info.state.Failed : 'Job was cancelled';
                    onError(errorMsg);
                }
                setLoading(false);
                return true; // Job is finished
            }

            setLoading(false);
            return false; // Job is still running
        } catch (err) {
            setError(err.message);
            setLoading(false);
            if (onError) {
                onError(err.message);
            }
            return true; // Stop polling on error
        }
    }, [jobId, onComplete, onError, onProgress]);

    const startTracking = useCallback(() => {
        if (!jobId) return;

        jobTracker.trackJob(jobId, {
            onProgress: (progress) => {
                setJobInfo(progress);
                if (onProgress) {
                    onProgress(progress);
                }
            },
            onComplete: (info) => {
                setJobInfo(info);
                setLoading(false);
                if (onComplete) {
                    onComplete(info);
                }
            },
            onError: (err) => {
                setError(err);
                setLoading(false);
                if (onError) {
                    onError(err);
                }
            }
        });
    }, [jobId, onComplete, onError, onProgress]);

    const stopTracking = useCallback(() => {
        if (jobId) {
            jobTracker.stopTracking(jobId);
        }
    }, [jobId]);

    useEffect(() => {
        if (autoStart && jobId) {
            startTracking();
        }

        return () => {
            stopTracking();
        };
    }, [jobId, autoStart, startTracking, stopTracking]);

    return {
        jobInfo,
        loading,
        error,
        startTracking,
        stopTracking,
        refetch: fetchJobInfo
    };
};

/**
 * Hook to manage multiple jobs
 */
export const useJobManager = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAllJobs = useCallback(async () => {
        try {
            setLoading(true);
            const allJobs = await invoke('list_jobs');
            setJobs(allJobs);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            setLoading(false);
        }
    }, []);

    const cancelJob = useCallback(async (jobId) => {
        try {
            await invoke('cancel_job', { jobId });
            await fetchAllJobs(); // Refresh the list
            return true;
        } catch (error) {
            console.error('Failed to cancel job:', error);
            return false;
        }
    }, [fetchAllJobs]);

    const startBurnTokensJob = useCallback(async (walletPk, mintAddress, burnPercentage) => {
        try {
            const jobId = await invoke('burn_tokens_job', {
                walletPk,
                mintAddress,
                burnPercentage
            });
            await fetchAllJobs(); // Refresh the list
            return jobId;
        } catch (error) {
            console.error('Failed to start burn job:', error);
            throw error;
        }
    }, [fetchAllJobs]);

    const startCloseAccountsJob = useCallback(async (walletPk) => {
        try {
            const jobId = await invoke('close_accounts_job', {
                walletPk
            });
            await fetchAllJobs(); // Refresh the list
            return jobId;
        } catch (error) {
            console.error('Failed to start close accounts job:', error);
            throw error;
        }
    }, [fetchAllJobs]);

    const startRefundWalletsJob = useCallback(async (pks, refundTo, fundingPk) => {
        try {
            const jobId = await invoke('refund_wallets_job', {
                pks,
                refundTo,
                fundingPk
            });
            await fetchAllJobs(); // Refresh the list
            return jobId;
        } catch (error) {
            console.error('Failed to start refund job:', error);
            throw error;
        }
    }, [fetchAllJobs]);

    useEffect(() => {
        fetchAllJobs();
    }, [fetchAllJobs]);

    const runningJobs = jobs.filter(job => job.state === 'Running' || job.state === 'Pending');
    const completedJobs = jobs.filter(job => job.state === 'Completed');
    const failedJobs = jobs.filter(job => job.state && job.state.Failed);

    return {
        jobs,
        runningJobs,
        completedJobs,
        failedJobs,
        loading,
        fetchAllJobs,
        cancelJob,
        startBurnTokensJob,
        startCloseAccountsJob,
        startRefundWalletsJob
    };
};

/**
 * Hook for batch job operations
 */
export const useBatchJobs = () => {
    const [batchProgress, setBatchProgress] = useState({});

    const trackBatchJobs = useCallback((jobIds, onBatchComplete) => {
        const batchId = `batch_${Date.now()}`;
        const batchData = {
            jobIds: [...jobIds],
            completed: 0,
            failed: 0,
            total: jobIds.length,
            results: []
        };

        setBatchProgress(prev => ({ ...prev, [batchId]: batchData }));

        jobIds.forEach(jobId => {
            jobTracker.trackJob(jobId, {
                onComplete: (result) => {
                    setBatchProgress(prev => {
                        const updated = { ...prev };
                        if (updated[batchId]) {
                            updated[batchId].completed++;
                            updated[batchId].results.push({ jobId, result, success: true });

                            // Check if batch is complete
                            if (updated[batchId].completed + updated[batchId].failed >= updated[batchId].total) {
                                if (onBatchComplete) {
                                    onBatchComplete(updated[batchId]);
                                }
                            }
                        }
                        return updated;
                    });
                },
                onError: (error) => {
                    setBatchProgress(prev => {
                        const updated = { ...prev };
                        if (updated[batchId]) {
                            updated[batchId].failed++;
                            updated[batchId].results.push({ jobId, error, success: false });

                            // Check if batch is complete
                            if (updated[batchId].completed + updated[batchId].failed >= updated[batchId].total) {
                                if (onBatchComplete) {
                                    onBatchComplete(updated[batchId]);
                                }
                            }
                        }
                        return updated;
                    });
                }
            });
        });

        return batchId;
    }, []);

    return {
        batchProgress,
        trackBatchJobs
    };
};
