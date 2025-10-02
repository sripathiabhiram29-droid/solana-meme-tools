// useJobOnlyTokens.js - Hook optimisé pour l'approche job-only
import { useState, useCallback, useRef } from 'react';
import { invoke as tauriInvoke } from '@tauri-apps/api/tauri';

/**
 * Hook optimisé pour récupérer les tokens en utilisant UNIQUEMENT le job status
 * Élimine tous les appels API redondants
 */
const useJobOnlyTokens = () => {
    const [balances, setBalances] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState('');

    const pollingIntervalRef = useRef(null);
    const apiCallCountRef = useRef(0);

    // Reset API call counter for monitoring
    const resetApiCallCount = () => {
        apiCallCountRef.current = 0;
    };

    // Track API calls for debugging
    const trackApiCall = (endpoint) => {
        apiCallCountRef.current += 1;
        console.log(`🔄 API Call #${apiCallCountRef.current}: ${endpoint}`);

        // Log warning if trying to call get_tokens_balances directly
        if (endpoint === 'get_tokens_balances') {
            console.warn('❌ VIOLATION: Direct get_tokens_balances call detected!');
        }
    };

    const clearPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const parseJobResults = useCallback((resultString, wallet) => {
        try {
            const resultsData = JSON.parse(resultString);

            if (resultsData[wallet] && resultsData[wallet].balances) {
                console.log('✅ Results parsed from job data - NO additional API calls needed');
                setBalances(resultsData[wallet].balances);
                return true;
            } else {
                console.warn('⚠️ No data found for wallet in job results');
                setBalances([]);
                return false;
            }
        } catch (parseError) {
            console.error('❌ Failed to parse job result:', parseError);
            setError('Failed to parse results from job');
            return false;
        }
    }, []);

    const pollJobStatus = useCallback((jobId, wallet) => {
        console.log(`📊 Starting job-only polling for job ${jobId}`);

        const pollInterval = setInterval(async () => {
            try {
                trackApiCall('get_job_status'); // ONLY allowed API call
                const jobInfo = await tauriInvoke("get_job_status", { jobId });

                // Update progress indicators
                if (jobInfo.progress_percentage !== undefined) {
                    setProgress(jobInfo.progress_percentage);
                }
                if (jobInfo.current_step) {
                    setCurrentStep(jobInfo.current_step);
                }

                // Check completion
                if (jobInfo.state === "Completed") {
                    console.log('✅ Job completed - parsing results from job data');

                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;
                    setLoading(false);

                    // Parse results DIRECTLY from job - NO additional API calls
                    if (jobInfo.result) {
                        parseJobResults(jobInfo.result, wallet);
                    } else {
                        console.warn('⚠️ Job completed but no result data');
                        setError('Job completed but no result data');
                    }
                } else if (jobInfo.state && jobInfo.state.Failed) {
                    console.error('❌ Job failed:', jobInfo.state.Failed);

                    clearInterval(pollInterval);
                    pollingIntervalRef.current = null;
                    setLoading(false);
                    setError(jobInfo.state.Failed);
                }
            } catch (pollError) {
                console.error('❌ Error polling job status:', pollError);
                setError('Failed to check job status');
                clearInterval(pollInterval);
                pollingIntervalRef.current = null;
                setLoading(false);
            }
        }, 1000); // Poll every second

        pollingIntervalRef.current = pollInterval;
    }, [parseJobResults]);

    const fetchTokensJobOnly = useCallback(async (wallet) => {
        console.log('🚀 Starting job-only token fetch for:', wallet);
        resetApiCallCount();

        setLoading(true);
        setError(null);
        setProgress(0);
        setCurrentStep('Starting...');
        setBalances([]);

        // Clear any existing polling
        clearPolling();

        try {
            // ONLY API call to start the job
            trackApiCall('get_tokens_balances_batch_job');
            const response = await tauriInvoke("get_tokens_balances_batch_job", {
                wallets: [wallet]
            });

            if (response && response.job_id) {
                console.log('✅ Batch job started with ID:', response.job_id);

                // Start job-only polling
                pollJobStatus(response.job_id, wallet);
            } else {
                throw new Error('No job ID received');
            }
        } catch (fetchError) {
            console.error('❌ Failed to start batch job:', fetchError);
            setError('Failed to start token fetch job');
            setLoading(false);
        }
    }, [pollJobStatus, clearPolling]);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        clearPolling();
    }, [clearPolling]);

    // Get API call statistics for monitoring
    const getApiCallStats = useCallback(() => {
        return {
            totalCalls: apiCallCountRef.current,
            isOptimized: apiCallCountRef.current <= 2, // Should be max 2: start job + some status polls
            description: `Made ${apiCallCountRef.current} API calls (job-only approach)`
        };
    }, []);

    return {
        balances,
        loading,
        error,
        progress,
        currentStep,
        fetchTokensJobOnly,
        cleanup,
        getApiCallStats,
        isJobOnlyCompliant: true // This hook only uses job approach
    };
};

export default useJobOnlyTokens;
