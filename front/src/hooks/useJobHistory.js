// File: src/hooks/useJobHistory.js
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'jobs_history';

// Format job with timestamp and additional metadata
const formatJobForHistory = (jobInfo, metadata = {}) => ({
    ...jobInfo,
    timestamp: Date.now(),
    completedAt: jobInfo.state === 'Completed' ? Date.now() : null,
    duration: null, // Will be calculated
    metadata: {
        wallet: metadata.wallet,
        operation: metadata.operation,
        parameters: metadata.parameters,
        ...metadata
    }
});

// Calculate job duration
const calculateDuration = (job) => {
    if (job.completedAt && job.timestamp) {
        return job.completedAt - job.timestamp;
    }
    return null;
};

export const useJobHistory = () => {
    const [jobsHistory, setJobsHistory] = useState([]);

    // Load history from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setJobsHistory(parsed);
            }
        } catch (error) {
            console.error('Error loading job history:', error);
        }
    }, []);

    // Save to localStorage whenever history changes
    const saveToStorage = useCallback((history) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.error('Error saving job history:', error);
        }
    }, []);

    // Add job to history
    const addJobToHistory = useCallback((jobInfo, metadata = {}) => {
        const formattedJob = formatJobForHistory(jobInfo, metadata);

        setJobsHistory(prev => {
            const updated = [formattedJob, ...prev].slice(0, 100); // Keep last 100 jobs
            saveToStorage(updated);
            return updated;
        });
    }, [saveToStorage]);

    // Update existing job in history
    const updateJobInHistory = useCallback((jobId, updatedJobInfo) => {
        console.log(`📋 updateJobInHistory called for job ${jobId}:`, updatedJobInfo);
        setJobsHistory(prev => {
            console.log(`🔍 Current history before update: ${prev.length} jobs`, prev.map(j => ({ id: j.id.slice(0, 8), state: j.state })));

            // Check for duplicates and remove them first
            const seenIds = new Set();
            const deduplicatedHistory = prev.filter(job => {
                if (seenIds.has(job.id)) {
                    console.log(`🗑️ Removing duplicate job ${job.id.slice(0, 8)} from history`);
                    return false;
                }
                seenIds.add(job.id);
                return true;
            });

            if (deduplicatedHistory.length !== prev.length) {
                console.log(`🧹 Removed ${prev.length - deduplicatedHistory.length} duplicate(s), now ${deduplicatedHistory.length} jobs`);
            }

            const existingJobIndex = deduplicatedHistory.findIndex(job => job.id === jobId);

            if (existingJobIndex >= 0) {
                // Update existing job
                const updated = deduplicatedHistory.map(job => {
                    if (job.id === jobId) {
                        const updatedJob = {
                            ...job,
                            ...updatedJobInfo,
                            completedAt: updatedJobInfo.state === 'Completed' ? Date.now() : job.completedAt
                        };
                        updatedJob.duration = calculateDuration(updatedJob);
                        console.log(`✅ Job ${jobId.slice(0, 8)} updated in history:`, updatedJob);
                        return updatedJob;
                    }
                    return job;
                });
                console.log(`🔍 History after update: ${updated.length} jobs`, updated.map(j => ({ id: j.id.slice(0, 8), state: j.state })));
                saveToStorage(updated);
                console.log(`💾 History saved with ${updated.length} jobs`);
                return updated;
            } else {
                // Job doesn't exist, add it to history
                console.log(`➕ Job ${jobId.slice(0, 8)} not found in history, adding it...`);
                const formattedJob = formatJobForHistory(updatedJobInfo);
                const updated = [formattedJob, ...deduplicatedHistory].slice(0, 100);
                console.log(`🔍 History after adding: ${updated.length} jobs`, updated.map(j => ({ id: j.id.slice(0, 8), state: j.state })));
                saveToStorage(updated);
                console.log(`💾 History saved with ${updated.length} jobs (new job added)`);
                return updated;
            }
        });
    }, [saveToStorage]);    // Remove specific job from history
    const removeJobFromHistory = useCallback((jobId) => {
        setJobsHistory(prev => {
            const updated = prev.filter(job => job.id !== jobId);
            saveToStorage(updated);
            return updated;
        });
    }, [saveToStorage]);

    // Clear all history
    const clearJobHistory = useCallback(() => {
        setJobsHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    }, []);

    // Clear completed jobs only
    const clearCompletedJobs = useCallback(() => {
        setJobsHistory(prev => {
            const updated = prev.filter(job =>
                job.state !== 'Completed' &&
                !job.state?.Failed
            );
            saveToStorage(updated);
            return updated;
        });
    }, [saveToStorage]);

    // Get job statistics
    const getJobStats = useCallback(() => {
        const total = jobsHistory.length;
        const completed = jobsHistory.filter(job => job.state === 'Completed').length;
        const failed = jobsHistory.filter(job => job.state?.Failed).length;
        const running = jobsHistory.filter(job => job.state === 'Running').length;

        return {
            total,
            completed,
            failed,
            running,
            successRate: total > 0 ? (completed / total * 100).toFixed(1) : 0
        };
    }, [jobsHistory]);

    // Get jobs by type
    const getJobsByType = useCallback((jobType) => {
        return jobsHistory.filter(job => job.name === jobType);
    }, [jobsHistory]);

    // Get recent jobs (last 24 hours)
    const getRecentJobs = useCallback(() => {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        return jobsHistory.filter(job => job.timestamp > oneDayAgo);
    }, [jobsHistory]);

    // Format duration for display
    const formatDuration = useCallback((duration) => {
        if (!duration) return 'N/A';

        const seconds = Math.floor(duration / 1000);
        if (seconds < 60) return `${seconds}s`;

        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }, []);

    // Format timestamp for display
    const formatTimestamp = useCallback((timestamp) => {
        if (!timestamp) return 'N/A';

        const date = new Date(timestamp);
        const now = new Date();

        // If today, show time only
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString();
        }

        // If within a week, show day and time
        const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) {
            return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }

        // Otherwise full date
        return date.toLocaleString();
    }, []);

    return {
        jobsHistory,
        addJobToHistory,
        updateJobInHistory,
        removeJobFromHistory,
        clearJobHistory,
        clearCompletedJobs,
        getJobStats,
        getJobsByType,
        getRecentJobs,
        formatDuration,
        formatTimestamp
    };
};

export default useJobHistory;
