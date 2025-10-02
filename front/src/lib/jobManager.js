import { tauriInvoke } from './tauriClient';

/**
 * Job statuses
 */
export const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

/**
 * Job types pour les opérations longues
 */
export const JOB_TYPES = {
    REFUND_WALLETS: 'refund_wallets',
    DISTRIBUTE_SOL: 'distribute_sol',
    CLOSE_ACCOUNTS: 'close_accounts',
    BURN_TOKENS: 'burn_tokens',
    GET_TOKENS_BALANCES: 'get_tokens_balances',
    BATCH_OPERATION: 'batch_operation'
};

/**
 * Configuration par défaut pour le long polling
 */
const DEFAULT_POLL_CONFIG = {
    timeoutMs: 30000,        // 30 secondes
    pollIntervalMs: 500,     // 500ms entre chaque poll
    maxRetries: 3            // Nombre max de tentatives
};

/**
 * Gestionnaire de jobs avec long polling pattern
 */
export class JobManager {
    constructor() {
        this.activeJobs = new Map();
        this.jobQueue = [];
        this.maxConcurrentJobs = 5;
        this.listeners = new Map();
        this.isProcessing = false;
    }

    /**
     * Génère un ID unique pour un job
     */
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Démarre un job simple et retourne immédiatement l'ID
     */
    async startJob(jobType, params, config = {}) {
        const jobId = this.generateJobId();
        const jobConfig = { ...DEFAULT_POLL_CONFIG, ...config };

        const job = {
            id: jobId,
            type: jobType,
            params,
            config: jobConfig,
            status: JOB_STATUS.PENDING,
            startTime: new Date(),
            endTime: null,
            result: null,
            error: null,
            progress: 0
        };

        this.activeJobs.set(jobId, job);
        this.jobQueue.push(jobId);

        // Démarrer le traitement de la queue si pas déjà en cours
        if (!this.isProcessing) {
            this.processQueue();
        }

        return jobId;
    }

    /**
     * Long polling pour attendre le résultat d'un job
     */
    async pollJobResult(jobId, customConfig = {}) {
        const config = { ...DEFAULT_POLL_CONFIG, ...customConfig };
        const startTime = Date.now();
        let retries = 0;

        while (retries < config.maxRetries) {
            try {
                const job = this.activeJobs.get(jobId);

                if (!job) {
                    throw new Error(`Job ${jobId} not found`);
                }

                // Vérifier si le job est terminé
                if ([JOB_STATUS.COMPLETED, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status)) {
                    return job;
                }

                // Vérifier le timeout
                if (Date.now() - startTime > config.timeoutMs) {
                    throw new Error(`Job ${jobId} timed out after ${config.timeoutMs}ms`);
                }

                // Attendre avant le prochain poll
                await this.sleep(config.pollIntervalMs);

            } catch (error) {
                retries++;
                if (retries >= config.maxRetries) {
                    throw error;
                }
                await this.sleep(1000); // Attendre 1s avant retry
            }
        }

        throw new Error(`Job ${jobId} polling failed after ${config.maxRetries} retries`);
    }

    /**
     * Démarre un batch de jobs et les traite par chunks
     */
    async startBatchJobs(jobType, requests, batchConfig = {}) {
        const config = {
            maxConcurrent: 3,
            chunkDelay: 1000,
            timeoutMs: 300000, // 5 minutes par défaut
            ...batchConfig
        };

        const batchId = this.generateJobId();
        const jobIds = [];

        // Diviser les requêtes en chunks
        const chunks = this.chunkArray(requests, config.maxConcurrent);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkJobIds = [];

            // Démarrer tous les jobs du chunk
            for (const request of chunk) {
                const jobId = await this.startJob(jobType, request, { timeoutMs: config.timeoutMs });
                chunkJobIds.push(jobId);
                jobIds.push(jobId);
            }

            // Attendre que le chunk soit terminé avant de passer au suivant
            if (i < chunks.length - 1) {
                await this.waitForJobs(chunkJobIds);
                await this.sleep(config.chunkDelay);
            }
        }

        return {
            batchId,
            jobIds,
            totalJobs: requests.length,
            chunks: chunks.length
        };
    }

    /**
     * Poll un batch de jobs et retourne les statistiques
     */
    async pollBatchJobs(jobIds, config = {}) {
        const pollConfig = { ...DEFAULT_POLL_CONFIG, timeoutMs: 60000, ...config };
        const startTime = Date.now();

        while (Date.now() - startTime < pollConfig.timeoutMs) {
            const jobs = jobIds.map(id => this.activeJobs.get(id)).filter(Boolean);

            const stats = {
                total: jobs.length,
                completed: jobs.filter(j => j.status === JOB_STATUS.COMPLETED).length,
                failed: jobs.filter(j => j.status === JOB_STATUS.FAILED).length,
                cancelled: jobs.filter(j => j.status === JOB_STATUS.CANCELLED).length,
                running: jobs.filter(j => j.status === JOB_STATUS.RUNNING).length,
                pending: jobs.filter(j => j.status === JOB_STATUS.PENDING).length
            };

            // Tous les jobs sont terminés
            if (stats.completed + stats.failed + stats.cancelled === stats.total) {
                return {
                    batchId: `batch_${Date.now()}`,
                    jobIds,
                    stats,
                    jobs,
                    isComplete: true
                };
            }

            await this.sleep(pollConfig.pollIntervalMs);
        }

        // Timeout atteint, retourner l'état actuel
        const jobs = jobIds.map(id => this.activeJobs.get(id)).filter(Boolean);
        const stats = {
            total: jobs.length,
            completed: jobs.filter(j => j.status === JOB_STATUS.COMPLETED).length,
            failed: jobs.filter(j => j.status === JOB_STATUS.FAILED).length,
            cancelled: jobs.filter(j => j.status === JOB_STATUS.CANCELLED).length,
            running: jobs.filter(j => j.status === JOB_STATUS.RUNNING).length,
            pending: jobs.filter(j => j.status === JOB_STATUS.PENDING).length
        };

        return {
            batchId: `batch_timeout_${Date.now()}`,
            jobIds,
            stats,
            jobs,
            isComplete: false,
            timeout: true
        };
    }

    /**
     * Annule un job
     */
    cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (job && job.status !== JOB_STATUS.COMPLETED && job.status !== JOB_STATUS.FAILED) {
            job.status = JOB_STATUS.CANCELLED;
            job.endTime = new Date();
            this.notifyListeners(jobId, job);
            return true;
        }
        return false;
    }

    /**
     * Annule un batch de jobs
     */
    cancelBatchJobs(jobIds) {
        const cancelled = [];
        for (const jobId of jobIds) {
            if (this.cancelJob(jobId)) {
                cancelled.push(jobId);
            }
        }
        return cancelled;
    }

    /**
     * Récupère les informations d'un job
     */
    getJobInfo(jobId) {
        return this.activeJobs.get(jobId);
    }

    /**
     * Liste tous les jobs actifs
     */
    listJobs() {
        return Array.from(this.activeJobs.values());
    }

    /**
     * Ajoute un listener pour les changements de status des jobs
     */
    addJobListener(jobId, callback) {
        if (!this.listeners.has(jobId)) {
            this.listeners.set(jobId, []);
        }
        this.listeners.get(jobId).push(callback);
    }

    /**
     * Supprime un listener
     */
    removeJobListener(jobId, callback) {
        const callbacks = this.listeners.get(jobId);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Traite la queue des jobs
     */
    async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.jobQueue.length > 0) {
            const activeRunningJobs = Array.from(this.activeJobs.values())
                .filter(job => job.status === JOB_STATUS.RUNNING).length;

            if (activeRunningJobs >= this.maxConcurrentJobs) {
                await this.sleep(1000);
                continue;
            }

            const jobId = this.jobQueue.shift();
            const job = this.activeJobs.get(jobId);

            if (job && job.status === JOB_STATUS.PENDING) {
                this.executeJob(job);
            }
        }

        this.isProcessing = false;
    }

    /**
     * Exécute un job individuel
     */
    async executeJob(job) {
        try {
            job.status = JOB_STATUS.RUNNING;
            this.notifyListeners(job.id, job);

            const result = await this.callTauriCommand(job.type, job.params);

            job.status = JOB_STATUS.COMPLETED;
            job.result = result;
            job.endTime = new Date();
            job.progress = 100;

        } catch (error) {
            job.status = JOB_STATUS.FAILED;
            job.error = error.message || error;
            job.endTime = new Date();
        }

        this.notifyListeners(job.id, job);
    }

    /**
     * Appelle la commande Tauri appropriée selon le type de job
     */
    async callTauriCommand(jobType, params) {
        switch (jobType) {
            case JOB_TYPES.REFUND_WALLETS:
                if (params.amount) {
                    return await tauriInvoke('refund_wallets_specific_amount_job', params);
                } else {
                    return await tauriInvoke('refund_wallets_job', params);
                }

            case JOB_TYPES.DISTRIBUTE_SOL:
                return await tauriInvoke('distribute_sol_job', params);

            case JOB_TYPES.CLOSE_ACCOUNTS:
                return await tauriInvoke('close_accounts_job', params);

            case JOB_TYPES.BURN_TOKENS:
                return await tauriInvoke('burn_tokens_job', params);

            case JOB_TYPES.GET_TOKENS_BALANCES:
                return await tauriInvoke('get_tokens_balances_job', params);

            default:
                throw new Error(`Unsupported job type: ${jobType}`);
        }
    }

    /**
     * Attend que tous les jobs spécifiés soient terminés
     */
    async waitForJobs(jobIds, timeoutMs = 60000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const allFinished = jobIds.every(jobId => {
                const job = this.activeJobs.get(jobId);
                return job && [JOB_STATUS.COMPLETED, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status);
            });

            if (allFinished) {
                return;
            }

            await this.sleep(500);
        }

        throw new Error(`Timeout waiting for jobs: ${jobIds.join(', ')}`);
    }

    /**
     * Divise un array en chunks
     */
    chunkArray(array, chunkSize) {
        const chunks = [];
        for (let i = 0; i < array.length; i += chunkSize) {
            chunks.push(array.slice(i, i + chunkSize));
        }
        return chunks;
    }

    /**
     * Notifie les listeners d'un changement de status
     */
    notifyListeners(jobId, job) {
        const callbacks = this.listeners.get(jobId);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(job);
                } catch (error) {
                    console.error('Error in job listener:', error);
                }
            });
        }
    }

    /**
     * Utilitaire pour attendre
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Nettoie les jobs terminés plus anciens que X minutes
     */
    cleanupOldJobs(maxAgeMinutes = 30) {
        const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);

        for (const [jobId, job] of this.activeJobs.entries()) {
            if (job.endTime && new Date(job.endTime).getTime() < cutoffTime) {
                this.activeJobs.delete(jobId);
                this.listeners.delete(jobId);
            }
        }
    }
}

// Instance globale du job manager
export const jobManager = new JobManager();

// Auto-cleanup toutes les 10 minutes
setInterval(() => {
    jobManager.cleanupOldJobs(30);
}, 10 * 60 * 1000);
