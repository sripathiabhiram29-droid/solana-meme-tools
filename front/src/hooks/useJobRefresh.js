// File: src/hooks/useJobRefresh.js
import { useCallback } from 'react';
import { tauriInvoke } from '../lib/tauriClient';
import { useJobContext } from '../context/JobContext';

/**
 * Hook pour rafraîchir automatiquement les jobs depuis le backend
 */
const useJobRefresh = () => {
    const { updateJobInHistory } = useJobContext();

    const refreshSpecificJob = useCallback(async (triggeredByJobId) => {
        try {
            console.log(`🔄 Refreshing specific job ${triggeredByJobId} from backend...`);

            if (!triggeredByJobId) {
                console.log("⚠️ No specific job ID provided, skipping refresh");
                return 0;
            }

            // Get specific job status instead of all jobs
            const jobInfo = await tauriInvoke("get_job_status", { jobId: triggeredByJobId });
            if (jobInfo) {
                console.log(`📋 Found job ${triggeredByJobId} from backend, updating history...`);
                updateJobInHistory(triggeredByJobId, jobInfo);
                console.log(`✅ Successfully refreshed job ${triggeredByJobId} in history`);
                return 1;
            } else {
                console.log(`⚠️ Job ${triggeredByJobId} not found in backend`);
                return 0;
            }
        } catch (error) {
            console.error("❌ Error refreshing job from backend:", error);
            return 0;
        }
    }, [updateJobInHistory]);

    return {
        refreshSpecificJob
    };
};

export default useJobRefresh;
