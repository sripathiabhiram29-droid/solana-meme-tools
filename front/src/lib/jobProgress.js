import { invoke } from '@tauri-apps/api/core';

/**
 * Job progress tracker for monitoring long-running operations
 */
export class JobProgressTracker {
    constructor() {
        this.activeJobs = new Map();
        this.pollInterval = 1000; // Poll every second
        this.listeners = new Map();
    }

    /**
     * Start tracking a job
     * @param {string} jobId - The job ID to track
     * @param {function} onProgress - Callback function for progress updates
     * @param {function} onComplete - Callback function for completion
     * @param {function} onError - Callback function for errors
     */
    trackJob(jobId, { onProgress, onComplete, onError } = {}) {
        if (this.activeJobs.has(jobId)) {
            console.warn(`Job ${jobId} is already being tracked`);
            return;
        }

        const jobData = {
            id: jobId,
            onProgress,
            onComplete,
            onError,
            pollTimer: null
        };

        this.activeJobs.set(jobId, jobData);
        this.startPolling(jobId);
    }

    /**
     * Stop tracking a job
     * @param {string} jobId - The job ID to stop tracking
     */
    stopTracking(jobId) {
        const jobData = this.activeJobs.get(jobId);
        if (jobData) {
            if (jobData.pollTimer) {
                clearInterval(jobData.pollTimer);
            }
            this.activeJobs.delete(jobId);
        }
    }

    /**
     * Start polling for job status
     * @param {string} jobId - The job ID to poll
     */
    startPolling(jobId) {
        const jobData = this.activeJobs.get(jobId);
        if (!jobData) return;

        const poll = async () => {
            try {
                const jobInfo = await invoke('get_job_status', { jobId });

                if (jobInfo) {
                    // Call progress callback if provided
                    if (jobData.onProgress) {
                        jobData.onProgress({
                            id: jobInfo.id,
                            name: jobInfo.name,
                            state: jobInfo.state,
                            progress: jobInfo.progress_percentage,
                            currentStep: jobInfo.current_step,
                            totalItems: jobInfo.total_items,
                            completedItems: jobInfo.completed_items,
                            result: jobInfo.result
                        });
                    }

                    // Check if job is completed
                    if (jobInfo.state === 'Completed') {
                        this.stopTracking(jobId);
                        if (jobData.onComplete) {
                            jobData.onComplete(jobInfo);
                        }
                    } else if (jobInfo.state === 'Cancelled' || (jobInfo.state && jobInfo.state.Failed)) {
                        this.stopTracking(jobId);
                        if (jobData.onError) {
                            const error = jobInfo.state.Failed || 'Job was cancelled';
                            jobData.onError(error);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error polling job ${jobId}:`, error);
                if (jobData.onError) {
                    jobData.onError(error);
                }
            }
        };

        // Poll immediately, then set up interval
        poll();
        jobData.pollTimer = setInterval(poll, this.pollInterval);
    }

    /**
     * Get current status of all tracked jobs
     */
    getTrackedJobs() {
        return Array.from(this.activeJobs.keys());
    }

    /**
     * Clean up all tracked jobs
     */
    cleanup() {
        for (const jobId of this.activeJobs.keys()) {
            this.stopTracking(jobId);
        }
    }
}

/**
 * Utility function to format progress percentage
 * @param {number} progress - Progress percentage (0-100)
 */
export function formatProgress(progress) {
    return `${Math.round(progress)}%`;
}

/**
 * Utility function to format progress with items
 * @param {number} completed - Completed items
 * @param {number} total - Total items
 */
export function formatProgressItems(completed, total) {
    if (total === null || total === undefined) {
        return null;
    }
    return `${completed || 0} / ${total}`;
}

/**
 * Get progress bar color based on job state
 * @param {string} state - Job state
 * @param {string} jobType - Job type (optional)
 */
export function getProgressColor(state, jobType = '') {
    if (state === 'Completed') return 'green';
    if (state === 'Cancelled') return 'gray';
    if (state && state.Failed) return 'red';

    // Color based on job type
    if (jobType.includes('burn')) return 'orange';
    if (jobType.includes('close')) return 'red';

    return 'blue'; // Default running color
}

// Export singleton instance
export const jobTracker = new JobProgressTracker();

// Example usage functions
export const jobProgressExamples = {
    /**
     * Example: Track a burn tokens job
     */
    async trackBurnTokensJob(walletPk, mintAddress, burnPercentage) {
        try {
            // Start the burn job
            const jobId = await invoke('burn_tokens_job', {
                walletPk,
                mintAddress,
                burnPercentage
            });

            console.log(`Started burn job: ${jobId}`);

            // Track the job progress
            jobTracker.trackJob(jobId, {
                onProgress: (progress) => {
                    console.log(`Burn Progress: ${formatProgress(progress.progress)} - ${progress.currentStep || 'Processing...'}`);

                    if (progress.totalItems && progress.completedItems !== null) {
                        console.log(`Items: ${formatProgressItems(progress.completedItems, progress.totalItems)}`);
                    }
                },
                onComplete: (jobInfo) => {
                    console.log('Burn job completed!', jobInfo);
                },
                onError: (error) => {
                    console.error('Burn job failed:', error);
                }
            });

            return jobId;
        } catch (error) {
            console.error('Failed to start burn job:', error);
            throw error;
        }
    },

    /**
     * Example: Get all jobs and their progress
     */
    async getAllJobsProgress() {
        try {
            const jobs = await invoke('list_jobs');
            return jobs.map(job => ({
                id: job.id,
                name: job.name,
                state: job.state,
                progress: job.progress_percentage,
                currentStep: job.current_step,
                itemsProgress: job.total_items ?
                    `${job.completed_items || 0}/${job.total_items}` : null
            }));
        } catch (error) {
            console.error('Failed to get jobs:', error);
            return [];
        }
    }
};
