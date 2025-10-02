import { useState, useEffect, useCallback, useRef } from 'react';
import { jobManager, JOB_STATUS, JOB_TYPES } from '../lib/jobManager';

/**
 * Hook pour gérer un job unique avec long polling
 */
export function useJob() {
    const [jobState, setJobState] = useState({
        jobId: null,
        status: null,
        result: null,
        error: null,
        progress: 0,
        isLoading: false
    });

    const listenerRef = useRef(null);

    const startJob = useCallback(async (jobType, params, config = {}) => {
        try {
            setJobState(prev => ({ ...prev, isLoading: true, error: null }));

            const jobId = await jobManager.startJob(jobType, params, config);

            // Ajouter un listener pour les mises à jour
            const listener = (job) => {
                setJobState({
                    jobId: job.id,
                    status: job.status,
                    result: job.result,
                    error: job.error,
                    progress: job.progress,
                    isLoading: job.status === JOB_STATUS.RUNNING || job.status === JOB_STATUS.PENDING
                });
            };

            jobManager.addJobListener(jobId, listener);
            listenerRef.current = { jobId, listener };

            setJobState(prev => ({ ...prev, jobId, status: JOB_STATUS.PENDING }));

            // Démarrer le long polling
            const result = await jobManager.pollJobResult(jobId, config);

            return result;

        } catch (error) {
            setJobState(prev => ({
                ...prev,
                error: error.message || error,
                isLoading: false,
                status: JOB_STATUS.FAILED
            }));
            throw error;
        }
    }, []);

    const cancelJob = useCallback(() => {
        if (jobState.jobId) {
            jobManager.cancelJob(jobState.jobId);
        }
    }, [jobState.jobId]);

    // Cleanup à la destruction du composant
    useEffect(() => {
        return () => {
            if (listenerRef.current) {
                jobManager.removeJobListener(listenerRef.current.jobId, listenerRef.current.listener);
            }
        };
    }, []);

    return {
        ...jobState,
        startJob,
        cancelJob
    };
}

/**
 * Hook pour gérer un batch de jobs
 */
export function useBatchJobs() {
    const [batchState, setBatchState] = useState({
        batchId: null,
        jobIds: [],
        stats: null,
        jobs: [],
        isLoading: false,
        isComplete: false,
        error: null
    });

    const listenersRef = useRef(new Map());

    const startBatchJobs = useCallback(async (jobType, requests, config = {}) => {
        try {
            setBatchState(prev => ({ ...prev, isLoading: true, error: null }));

            const batchResult = await jobManager.startBatchJobs(jobType, requests, config);

            setBatchState(prev => ({
                ...prev,
                batchId: batchResult.batchId,
                jobIds: batchResult.jobIds
            }));

            // Ajouter des listeners pour chaque job
            batchResult.jobIds.forEach(jobId => {
                const listener = () => {
                    // Mettre à jour les stats lors de changements
                    updateBatchStats(batchResult.jobIds);
                };
                jobManager.addJobListener(jobId, listener);
                listenersRef.current.set(jobId, listener);
            });

            // Démarrer le polling du batch
            const pollResult = await jobManager.pollBatchJobs(batchResult.jobIds, config);

            setBatchState(prev => ({
                ...prev,
                stats: pollResult.stats,
                jobs: pollResult.jobs,
                isComplete: pollResult.isComplete,
                isLoading: false
            }));

            return pollResult;

        } catch (error) {
            setBatchState(prev => ({
                ...prev,
                error: error.message || error,
                isLoading: false
            }));
            throw error;
        }
    }, []);

    const updateBatchStats = useCallback((jobIds) => {
        const jobs = jobIds.map(id => jobManager.getJobInfo(id)).filter(Boolean);

        const stats = {
            total: jobs.length,
            completed: jobs.filter(j => j.status === JOB_STATUS.COMPLETED).length,
            failed: jobs.filter(j => j.status === JOB_STATUS.FAILED).length,
            cancelled: jobs.filter(j => j.status === JOB_STATUS.CANCELLED).length,
            running: jobs.filter(j => j.status === JOB_STATUS.RUNNING).length,
            pending: jobs.filter(j => j.status === JOB_STATUS.PENDING).length
        };

        setBatchState(prev => ({ ...prev, stats, jobs }));
    }, []);

    const cancelBatchJobs = useCallback(() => {
        if (batchState.jobIds.length > 0) {
            jobManager.cancelBatchJobs(batchState.jobIds);
        }
    }, [batchState.jobIds]);

    // Cleanup à la destruction du composant
    useEffect(() => {
        return () => {
            listenersRef.current.forEach((listener, jobId) => {
                jobManager.removeJobListener(jobId, listener);
            });
            listenersRef.current.clear();
        };
    }, []);

    return {
        ...batchState,
        startBatchJobs,
        cancelBatchJobs,
        progress: batchState.stats ? (batchState.stats.completed / batchState.stats.total) * 100 : 0
    };
}

/**
 * Hook pour suivre tous les jobs actifs
 */
export function useJobList() {
    const [jobs, setJobs] = useState([]);

    useEffect(() => {
        const updateJobs = () => {
            setJobs(jobManager.listJobs());
        };

        // Mettre à jour initialement
        updateJobs();

        // Mettre à jour périodiquement
        const interval = setInterval(updateJobs, 1000);

        return () => clearInterval(interval);
    }, []);

    return jobs;
}

/**
 * Hook spécialisé pour les opérations de refund en masse
 */
export function useRefundBatch() {
    const { startBatchJobs, ...batchState } = useBatchJobs();

    const refundWallets = useCallback(async (wallets, refundTo, fundingPk, options = {}) => {
        const requests = wallets.map(wallet => ({
            walletPk: wallet.pk || wallet.privateKey,
            refundTo,
            fundingPk
        }));

        return await startBatchJobs(JOB_TYPES.REFUND_WALLETS, requests, {
            maxConcurrent: options.maxConcurrent || 3,
            timeoutMs: options.timeoutMs || 300000, // 5 minutes
            ...options
        });
    }, [startBatchJobs]);

    const refundWalletsSpecificAmount = useCallback(async (wallets, refundTo, amount, options = {}) => {
        const requests = wallets.map(wallet => ({
            walletPk: wallet.pk || wallet.privateKey,
            refundTo,
            amount,
            fundingPk: options.fundingPk
        }));

        return await startBatchJobs(JOB_TYPES.REFUND_WALLETS, requests, {
            maxConcurrent: options.maxConcurrent || 3,
            timeoutMs: options.timeoutMs || 300000,
            ...options
        });
    }, [startBatchJobs]);

    return {
        ...batchState,
        refundWallets,
        refundWalletsSpecificAmount
    };
}

/**
 * Hook spécialisé pour fermer des comptes en masse
 */
export function useCloseAccountsBatch() {
    const { startBatchJobs, ...batchState } = useBatchJobs();

    const closeAccounts = useCallback(async (wallets, options = {}) => {
        const requests = wallets.map(wallet => ({
            walletPk: wallet.pk || wallet.privateKey
        }));

        return await startBatchJobs(JOB_TYPES.CLOSE_ACCOUNTS, requests, {
            maxConcurrent: options.maxConcurrent || 2, // Plus conservateur pour close accounts
            timeoutMs: options.timeoutMs || 600000, // 10 minutes
            ...options
        });
    }, [startBatchJobs]);

    return {
        ...batchState,
        closeAccounts
    };
}

/**
 * Hook spécialisé pour brûler des tokens en masse
 */
export function useBurnTokensBatch() {
    const { startBatchJobs, ...batchState } = useBatchJobs();

    const burnTokens = useCallback(async (wallets, mintAddress, burnPercentage = 100, options = {}) => {
        const requests = wallets.map(wallet => ({
            walletPk: wallet.pk || wallet.privateKey,
            mintAddress,
            burnPercentage
        }));

        return await startBatchJobs(JOB_TYPES.BURN_TOKENS, requests, {
            maxConcurrent: options.maxConcurrent || 3,
            timeoutMs: options.timeoutMs || 300000,
            ...options
        });
    }, [startBatchJobs]);

    return {
        ...batchState,
        burnTokens
    };
}
