import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  jobTracker,
  formatProgress,
  formatProgressItems,
  getProgressColor,
} from "../lib/jobProgress.js";

const JobProgressCard = ({ job, onCancel }) => {
  const progressColor = getProgressColor(job.state, job.name);
  const isRunning = job.state === "Running";
  const isCompleted = job.state === "Completed";
  const isFailed = job.state && job.state.Failed;
  const isCancelled = job.state === "Cancelled";

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-800">{job.name}</h3>
          <p className="text-sm text-gray-600">ID: {job.id}</p>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full
            ${
              isCompleted
                ? "bg-green-100 text-green-800"
                : isFailed
                ? "bg-red-100 text-red-800"
                : isCancelled
                ? "bg-gray-100 text-gray-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            {isFailed ? "Failed" : job.state}
          </span>
          {isRunning && onCancel && (
            <button
              onClick={() => onCancel(job.id)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{formatProgress(job.progress_percentage || 0)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 bg-${progressColor}-500`}
            style={{ width: `${job.progress_percentage || 0}%` }}
          ></div>
        </div>
      </div>

      {/* Current Step */}
      {job.current_step && (
        <div className="mb-2">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Current Step:</span>{" "}
            {job.current_step}
          </p>
        </div>
      )}

      {/* Items Progress */}
      {job.total_items && (
        <div className="mb-2">
          <p className="text-sm text-gray-600">
            <span className="font-medium">Items:</span>{" "}
            {formatProgressItems(job.completed_items, job.total_items)}
          </p>
        </div>
      )}

      {/* Result */}
      {job.result && (job.state === "Completed" || isFailed) && (
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <p className="text-sm">
            <span className="font-medium">Result:</span>
            <span className={isFailed ? "text-red-600" : "text-green-600"}>
              {job.result}
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

const JobProgressMonitor = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = async () => {
    try {
      const allJobs = await invoke("list_jobs");
      setJobs(allJobs);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setLoading(false);
    }
  };

  const cancelJob = async (jobId) => {
    try {
      const cancelled = await invoke("cancel_job", { jobId });
      if (cancelled) {
        await fetchJobs(); // Refresh the list
      }
    } catch (error) {
      console.error("Failed to cancel job:", error);
    }
  };

  const clearCompletedJobs = () => {
    // Filter out completed and failed jobs from display
    setJobs(
      jobs.filter(
        (job) =>
          job.state !== "Completed" &&
          !(job.state && job.state.Failed) &&
          job.state !== "Cancelled"
      )
    );
  };

  useEffect(() => {
    fetchJobs();

    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchJobs, 2000); // Refresh every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const runningJobs = jobs.filter(
    (job) => job.state === "Running" || job.state === "Pending"
  );
  const completedJobs = jobs.filter((job) => job.state === "Completed");
  const failedJobs = jobs.filter((job) => job.state && job.state.Failed);
  const cancelledJobs = jobs.filter((job) => job.state === "Cancelled");

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="mt-2 text-gray-600">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Job Progress Monitor
        </h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Auto Refresh</span>
          </label>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh
          </button>
          {(completedJobs.length > 0 ||
            failedJobs.length > 0 ||
            cancelledJobs.length > 0) && (
            <button
              onClick={clearCompletedJobs}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Finished
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-800">
            {runningJobs.length}
          </div>
          <div className="text-sm text-blue-600">Running</div>
        </div>
        <div className="bg-green-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-800">
            {completedJobs.length}
          </div>
          <div className="text-sm text-green-600">Completed</div>
        </div>
        <div className="bg-red-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-800">
            {failedJobs.length}
          </div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
        <div className="bg-gray-100 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-800">
            {cancelledJobs.length}
          </div>
          <div className="text-sm text-gray-600">Cancelled</div>
        </div>
      </div>

      {/* Running Jobs */}
      {runningJobs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Active Jobs
          </h3>
          {runningJobs.map((job) => (
            <JobProgressCard key={job.id} job={job} onCancel={cancelJob} />
          ))}
        </div>
      )}

      {/* Recent Completed Jobs */}
      {completedJobs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Completed Jobs
          </h3>
          {completedJobs.slice(0, 5).map((job) => (
            <JobProgressCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Failed Jobs */}
      {failedJobs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            Failed Jobs
          </h3>
          {failedJobs.map((job) => (
            <JobProgressCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {jobs.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Jobs Found
          </h3>
          <p className="text-gray-500">
            Start a job to see progress tracking here.
          </p>
        </div>
      )}
    </div>
  );
};

export default JobProgressMonitor;
