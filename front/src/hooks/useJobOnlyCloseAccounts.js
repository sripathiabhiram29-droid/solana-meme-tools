// useJobOnlyCloseAccounts.js - Hook optimisé pour l'approche job-only pour close accounts
import { useState, useCallback, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/tauri';

/**
 * Hook optimisé pour fermer des comptes en utilisant UNIQUEMENT le job status
 * Élimine tous les appels API redondants et timeouts artificiels
 */
const useJobOnlyCloseAccounts = () => {
    const [closeJob, setCloseJob] = useState(null); // { jobId, status, progress, result }
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const pollingIntervalRef = useRef(null);
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

    const clearPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const parseJobResults = useCallback((resultString) => {
        try {
            const resultData = JSON.parse(resultString);

            console.log('✅ Close accounts result parsed:', resultData);
            setResult(resultData);

            // Check if close was successful
            if (resultData.success || resultData.ok) {
                return { success: true, result: resultData };
            } else {
                return { success: false, result: resultData };
            }
        } catch (parseError) {
            console.error('❌ Failed to parse close accounts result:', parseError);
            return { success: false, error: 'Failed to parse close accounts result' };
        }
    }, []);

    const pollCloseJobStatus = useCallback((jobId, walletPk) => {
        console.log(`🔒 Starting job-only close accounts polling for job ${jobId}`);

        const pollInterval = setInterval(async () => {
            try {
                trackApiCall('get_job_status'); // ONLY allowed API call
                const jobInfo = await tauriInvoke("get_job_status", { jobId });

                // Update job status
                setCloseJob(prev => ({
                    ...prev,
                    jobId,
                    status: jobInfo.state,
                    progress: jobInfo.progress_percentage || 0,
                    currentStep: jobInfo.current_step || 'Closing accounts...'
                }));

                // Check completion
                if (jobInfo.state === "Completed") {
                    console.log('✅ Close accounts job completed');

                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;

                    // Parse results DIRECTLY from job - NO additional API calls
                    if (jobInfo.result) {
                        const parseResult = parseJobResults(jobInfo.result);

                        // Update final job status
                        setCloseJob(prev => ({
                            ...prev,
                            status: 'Completed',
                            progress: 100,
                            success: parseResult.success,
                            result: parseResult.result
                        }));

                        // Clean up after a delay
                        setTimeout(() => {
                            setCloseJob(null);
                        }, 3000);
                    } else {
                        console.warn('⚠️ Close accounts job completed but no result data');
                    }
                } else if (jobInfo.state && jobInfo.state.Failed) {
                    console.error('❌ Close accounts job failed:', jobInfo.state.Failed);

                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;

                    // Update job status with error
                    setCloseJob(prev => ({
                        ...prev,
                        status: 'Failed',
                        progress: 0,
                        success: false,
                        error: jobInfo.state.Failed
                    }));

                    // Clean up after a delay
                    setTimeout(() => {
                        setCloseJob(null);
                    }, 5000);
                } else if (jobInfo.state === "Cancelled") {
                    console.log('🚫 Close accounts job was cancelled');

                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;

                    // Update job status
                    setCloseJob(prev => ({
                        ...prev,
                        status: 'Cancelled',
                        progress: 0,
                        success: false
                    }));

                    // Clean up after a delay
                    setTimeout(() => {
                        setCloseJob(null);
                    }, 3000);
                }
                // If job is still running, continue polling
            } catch (pollError) {
                console.error(`❌ Error polling close accounts job ${jobId}:`, pollError);
                setError(`Failed to check close accounts job status: ${pollError.message}`);

                clearInterval(pollInterval);
                pollingIntervalRef.current = null;

                // Update job status with error
                setCloseJob(prev => ({
                    ...prev,
                    status: 'Failed',
                    progress: 0,
                    success: false,
                    error: pollError.message
                }));
            }
        }, 1000); // Poll every second

        pollingIntervalRef.current = pollInterval;
    }, [parseJobResults]);

    const closeAccountsJobOnly = useCallback(async (walletPk) => {
        console.log('🚀 Starting job-only close accounts');
        resetApiCallCount();

        setError(null);

        // Clear any existing polling
        clearPolling();

        // Set initial job status
        setCloseJob({
            jobId: null,
            status: 'Starting',
            progress: 0,
            currentStep: 'Initiating close accounts...'
        });

        try {
            // ONLY API call to start the close accounts job
            trackApiCall('close_accounts_job');
            const jobId = await tauriInvoke("close_accounts_job", { walletPk });

            if (jobId) {
                console.log(`✅ Close accounts job started with ID: ${jobId}`);

                // Update job status
                setCloseJob(prev => ({
                    ...prev,
                    jobId,
                    status: 'Running',
                    progress: 0,
                    currentStep: 'Closing token accounts...'
                }));

                // Start job-only polling
                pollCloseJobStatus(jobId, walletPk);

                return jobId;
            } else {
                throw new Error('No job ID received from close_accounts_job');
            }
        } catch (closeError) {
            console.error('❌ Failed to start close accounts job:', closeError);
            setError(`Failed to start close accounts job: ${closeError.message}`);

            // Update job status with error
            setCloseJob({
                jobId: null,
                status: 'Failed',
                progress: 0,
                success: false,
                error: closeError.message
            });

            throw closeError;
        }
    }, [pollCloseJobStatus, clearPolling]);

    const cancelCloseJob = useCallback(async () => {
        if (!closeJob || !closeJob.jobId) return false;

        try {
            const cancelled = await tauriInvoke("cancel_job", { jobId: closeJob.jobId });
            if (cancelled) {
                console.log('🚫 Close accounts job cancelled');
                clearPolling();
                setCloseJob(null);
            }
            return cancelled;
        } catch (error) {
            console.error('❌ Failed to cancel close accounts job:', error);
            return false;
        }
    }, [closeJob, clearPolling]);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        clearPolling();
        setCloseJob(null);
        setResult(null);
    }, [clearPolling]);

    // Get API call statistics for monitoring
    const getApiCallStats = useCallback(() => {
        return {
            totalCalls: apiCallCountRef.current,
            isOptimized: true, // This hook only uses job approach
            description: `Made ${apiCallCountRef.current} API calls (job-only close accounts approach)`
        };
    }, []);

    // Helper methods
    const isClosing = useCallback(() => {
        return closeJob && (closeJob.status === 'Starting' || closeJob.status === 'Running');
    }, [closeJob]);

    const getCloseProgress = useCallback(() => {
        return closeJob ? closeJob.progress : 0;
    }, [closeJob]);

    const getCloseStatus = useCallback(() => {
        return closeJob ? closeJob.status : null;
    }, [closeJob]);

    const isCloseJobActive = useCallback(() => {
        return closeJob !== null;
    }, [closeJob]);

    return {
        closeJob,
        result,
        error,
        closeAccountsJobOnly,
        cancelCloseJob,
        cleanup,
        getApiCallStats,
        isClosing,
        getCloseProgress,
        getCloseStatus,
        isCloseJobActive,
        isJobOnlyCompliant: true // This hook only uses job approach
    };
};

export default useJobOnlyCloseAccounts;
