import { Dialog } from "@headlessui/react";
import { useEffect, useState, useMemo } from "react";
import { tauriInvoke, api, isTauriEnv } from "../../lib/tauriClient";
import { X, ClipboardCopy, Flame, RefreshCw, Lock } from "lucide-react";
import useUnifiedJobPolling from "../../hooks/useUnifiedJobPolling";

// Props:
// - isOpen, onClose, wallet (address), pk (private key), sellPercents (array), tokensList (app tokens), settings, setToast
export default function WalletTokensModal({
  isOpen,
  onClose,
  wallet,
  pk,
  sellPercents = [5, 10, 25, 50, 75, 100],
  tokensList = [],
  settings = { slippageBps: 100, enableToasts: true },
  setToast,
}) {
  // State management
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState([]); // [{ mint, balance, decimals, symbol?, name? }]
  const [error, setError] = useState(null);
  const [pending, setPending] = useState({}); // { [mint|__close]: boolean }
  const [selectedTokens, setSelectedTokens] = useState(new Set());

  // Job tracking for UI feedback
  const [currentTokensFetchJobId, setCurrentTokensFetchJobId] = useState(null);
  const [burnJobIds, setBurnJobIds] = useState(new Map());
  const [burnEachJobId, setBurnEachJobId] = useState(null);
  const [burnTokensBatchJobId, setBurnTokensBatchJobId] = useState(null);
  const [closeAccountsJobId, setCloseAccountsJobId] = useState(null);
  const [closeTokenAccountsBatchJobId, setCloseTokenAccountsBatchJobId] =
    useState(null);
  const [selectedTokensCloseJobIds, setSelectedTokensCloseJobIds] = useState(
    new Map()
  );
  const [burningTokens, setBurningTokens] = useState(new Set()); // Track which specific tokens are being burned

  // Unified job polling system
  const {
    activeJobs,
    results,
    error: jobError,
    startTokensBalanceJob,
    startBurnEachTokensJob,
    startBurnTokensBatchJob,
    startCloseAccountsJob,
    startCloseTokenAccountJob,
    startCloseTokenAccountsBatchJob,
    cancelJob,
    cleanup,
    isJobRunning,
    getJobProgress,
    getJobResult,
    tauriAvailable,
  } = useUnifiedJobPolling();

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast?.("Copied to clipboard");
    } catch (e) {
      console.error("Clipboard error:", e);
      setToast?.("Clipboard permission denied");
    }
  };

  const tokensMap = useMemo(() => {
    const m = {};
    for (const t of tokensList || []) m[t.mint] = t;
    return m;
  }, [tokensList]);

  const fetchBalances = async () => {
    if (!wallet) return;
    if (!tauriAvailable) {
      setError("Tauri IPC not available");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      console.log("🚀 Starting token balance fetch with unified polling");
      const jobId = await startTokensBalanceJob(wallet);

      if (jobId) {
        setCurrentTokensFetchJobId(jobId); // Store the job ID for compatibility
        setToast?.(`Started token fetch job: ${jobId.slice(0, 8)}...`);
      } else {
        setError("Failed to start token fetch job");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error starting token fetch:", error);
      setError(`Failed to fetch balances: ${error.message}`);
      setLoading(false);
    }
  };

  // Watch for completed job results
  useEffect(() => {
    // Check for completed token balance results
    for (const [jobId, result] of results.entries()) {
      console.log("Checking job result for jobId:", jobId, result);

      // Check if this is our current tokens fetch job
      if (jobId === currentTokensFetchJobId && result) {
        console.log("✅ Received token balance result:", result);

        // Handle error cases
        if (result.error) {
          console.error(
            "Token balance job completed with error:",
            result.error
          );
          setError(result.error);
          setLoading(false);
          setCurrentTokensFetchJobId(null);
          results.delete(jobId);
          return;
        }

        // Handle parse error cases
        if (result.parse_error) {
          console.error(
            "Token balance job result parse error:",
            result.parse_error
          );
          setError("Failed to parse token balance results");
          setLoading(false);
          setCurrentTokensFetchJobId(null);
          results.delete(jobId);
          return;
        }

        // Extract balances from result
        let foundBalances = false;

        if (result[wallet] && result[wallet].balances) {
          setBalances(result[wallet].balances);
          setToast?.(`✓ Loaded ${result[wallet].balances.length} tokens`);
          foundBalances = true;
        } else if (result.balances) {
          setBalances(result.balances);
          setToast?.(`✓ Loaded ${result.balances.length} tokens`);
          foundBalances = true;
        }

        if (!foundBalances) {
          console.warn("No balance data found in result:", result);
          setError("No token balance data returned from job");
        }

        setLoading(false);
        setCurrentTokensFetchJobId(null); // Clear the job ID

        // Remove this result from the map to avoid re-processing
        results.delete(jobId);
      }

      // Check for completed burn each tokens job
      if (jobId === burnEachJobId && result) {
        console.log("✅ Received burn result:", result);

        if (result.success) {
          setToast?.(
            `✓ Burn completed: ${result.successful_burns}/${result.total_mints} tokens burned`
          );

          // Clear pending state for burned tokens
          const clearPending = {};
          if (result.burn_results) {
            result.burn_results.forEach((burnResult) => {
              clearPending[burnResult.mint] = false;
            });
          }
          setPending((prev) => ({ ...prev, ...clearPending }));

          // Refresh balances after burn
          setTimeout(() => fetchBalances(), 1500);
        } else {
          setToast?.(`❌ Burn failed: ${result.error || result.message}`);
          // Clear all pending state
          setPending((prev) => {
            const cleared = { ...prev };
            Object.keys(cleared).forEach((key) => {
              if (key !== "__close") cleared[key] = false;
            });
            return cleared;
          });
        }

        // Clear burning tokens and job ID
        setBurningTokens(new Set());
        setBurnEachJobId(null); // Clear job ID
        results.delete(jobId);
      }

      // Check for completed burn tokens batch results
      if (jobId === burnTokensBatchJobId && result) {
        console.log("✅ Received burn tokens batch result:", result);

        if (result.success) {
          const successCount = result.successful_burns || 0;
          const failedCount = result.failed_burns || 0;

          if (successCount > 0) {
            setToast?.(`✓ ${successCount} token type(s) burned successfully`);
          }
          if (failedCount > 0) {
            setToast?.(`❌ ${failedCount} token type(s) failed to burn`);
            // Log failed burns for debugging
            result.burn_results?.forEach((burnResult) => {
              if (!burnResult.success) {
                console.error(
                  `Failed to burn ${burnResult.mint}: ${burnResult.error}`
                );
              }
            });
          }

          // Refresh balances after burn
          setTimeout(() => fetchBalances(), 1500);
        } else {
          setToast?.(`❌ Batch burn failed: ${result.error || result.message}`);
        }

        setBurnTokensBatchJobId(null); // Clear job ID
        results.delete(jobId);
      }

      // Check for completed close accounts results
      if (jobId === closeAccountsJobId && result) {
        console.log("✅ Received close accounts result:", result);

        if (result.success) {
          setToast?.(`✓ Accounts closed: ${result.message}`);
          // Refresh balances after closing accounts
          setTimeout(() => fetchBalances(), 1500);
        } else {
          setToast?.(`❌ Close failed: ${result.error || result.message}`);
        }

        setPending((prev) => ({ ...prev, __close: false }));
        setCloseAccountsJobId(null); // Clear job ID
        results.delete(jobId);
      }

      // Check for completed close token accounts batch results
      if (jobId === closeTokenAccountsBatchJobId && result) {
        console.log("✅ Received close token accounts batch result:", result);

        if (result.success) {
          const successCount = result.successful_closures?.length || 0;
          const failedCount = result.failed_closures?.length || 0;

          if (successCount > 0) {
            setToast?.(
              `✓ ${successCount} token account(s) closed successfully`
            );
          }
          if (failedCount > 0) {
            setToast?.(`❌ ${failedCount} token account(s) failed to close`);
            // Log failed closures for debugging
            result.failed_closures?.forEach((failure) => {
              console.error(
                `Failed to close ${failure.mint}: ${failure.error}`
              );
            });
          }

          // Refresh balances after closing accounts
          setTimeout(() => fetchBalances(), 1500);
        } else {
          setToast?.(
            `❌ Batch close failed: ${result.error || result.message}`
          );
        }

        setCloseTokenAccountsBatchJobId(null); // Clear job ID
        results.delete(jobId);
      }

      // Check for completed close token account results (unified system)
      for (const [mint, closeJobId] of selectedTokensCloseJobIds.entries()) {
        if (jobId === closeJobId && result) {
          console.log(
            `✅ Received close token account result for ${mint}:`,
            result
          );

          if (result.success) {
            setToast?.(
              `✓ Token account ${mint.slice(0, 6)}… closed successfully`
            );
            // Refresh balances after closing account
            setTimeout(() => fetchBalances(), 1500);
          } else {
            setToast?.(
              `❌ Close failed for ${mint.slice(0, 6)}…: ${
                result.error || result.message
              }`
            );
          }

          // Remove this token from the close jobs map
          setSelectedTokensCloseJobIds((prev) => {
            const newMap = new Map(prev);
            newMap.delete(mint);
            return newMap;
          });
          results.delete(jobId);
          break; // Exit the loop since we found our job
        }
      }
    }
  }, [
    results,
    wallet,
    setToast,
    fetchBalances,
    currentTokensFetchJobId,
    burnEachJobId,
    closeAccountsJobId,
    closeTokenAccountsBatchJobId,
    selectedTokensCloseJobIds,
  ]);

  // Burn functions using unified polling
  const doBurnToken = async (mint, burnPercent = 100) => {
    if (!pk || !mint) return;

    burnPercent = 100;

    // Set only this specific token as burning
    setBurningTokens(new Set([mint]));
    setPending((prev) => ({ ...prev, [mint]: true }));

    try {
      const jobId = await startBurnEachTokensJob(pk, [mint], burnPercent);

      if (jobId) {
        setBurnEachJobId(jobId); // Track the job ID
        setToast?.(`Started burn job: ${jobId.slice(0, 8)}...`);
      } else {
        setError("Failed to start burn job");
        setPending((prev) => ({ ...prev, [mint]: false }));
        setBurningTokens(new Set());
      }
    } catch (error) {
      console.error("Error starting burn:", error);
      setError(`Failed to burn token: ${error.message}`);
      setPending((prev) => ({ ...prev, [mint]: false }));
      setBurningTokens(new Set());
    }
  };

  const doBurnSelectedTokens = async (burnPercent = 100) => {
    if (!pk || selectedTokens.size === 0) return;

    console.log("Burning selected tokens:", selectedTokens, burnPercent);
    const mintsArray = Array.from(selectedTokens);

    // Set only selected tokens as burning (not all tokens)
    setBurningTokens(new Set(mintsArray));

    // Set all selected tokens as pending
    const pendingUpdates = {};
    mintsArray.forEach((mint) => {
      pendingUpdates[mint] = true;
    });
    setPending((prev) => ({ ...prev, ...pendingUpdates }));

    try {
      const jobId = await startBurnTokensBatchJob(pk, mintsArray);

      if (jobId) {
        setBurnTokensBatchJobId(jobId); // Track the job ID
        setToast?.(
          `Started batch burn job for ${
            mintsArray.length
          } tokens: ${jobId.slice(0, 8)}...`
        );
        // Clear selection since we've started the burn
        setSelectedTokens(new Set());
      } else {
        setError("Failed to start batch burn job");
        // Remove pending state and burning state for all tokens
        const clearPending = {};
        mintsArray.forEach((mint) => {
          clearPending[mint] = false;
        });
        setPending((prev) => ({ ...prev, ...clearPending }));
        setBurningTokens(new Set());
      }
    } catch (error) {
      console.error("Error starting batch burn:", error);
      setError(`Failed to burn tokens: ${error.message}`);
      // Remove pending state and burning state for all tokens
      const clearPending = {};
      mintsArray.forEach((mint) => {
        clearPending[mint] = false;
      });
      setPending((prev) => ({ ...prev, ...clearPending }));
      setBurningTokens(new Set());
    }
  };

  // Close accounts function using unified polling
  const doCloseAccount = async () => {
    if (!pk) return;

    setPending((prev) => ({ ...prev, __close: true }));

    try {
      const jobId = await startCloseAccountsJob(pk);

      if (jobId) {
        setCloseAccountsJobId(jobId); // Track the job ID
        setToast?.(`Started close accounts job: ${jobId.slice(0, 8)}...`);
      } else {
        setError("Failed to start close accounts job");
        setPending((prev) => ({ ...prev, __close: false }));
      }
    } catch (error) {
      console.error("Error starting close accounts:", error);
      setError(`Failed to close accounts: ${error.message}`);
      setPending((prev) => ({ ...prev, __close: false }));
    }
  };

  // (Cleanup is handled within individual polling functions)
  // };

  // // Polling function for burn job status
  // const startPollingBurnJob = (jobId, mint) => {
  //   const pollInterval = setInterval(async () => {
  //     try {
  //       const jobInfo = await tauriInvoke("get_job_status", { jobId });

  //       if (!jobInfo) {
  //         console.warn(`Burn job ${jobId} not found`);
  //         clearInterval(pollInterval);
  //         setBurnJobIds((prev) => {
  //           const newMap = new Map(prev);
  //           newMap.delete(mint);
  //           return newMap;
  //         });
  //         setPending((p) => ({ ...p, [mint]: false }));
  //         return;
  //       }

  //       console.log(`Burn job ${jobId} status:`, jobInfo);

  //       // Check if job is completed
  //       if (jobInfo.state === "Completed") {
  //         // Job completed - check for result
  //         if (jobInfo.result) {
  //           console.log("Burn job completed with result:", jobInfo.result);

  //           try {
  //             // Try to parse the JSON result from the job
  //             const resultData = JSON.parse(jobInfo.result);

  //             // Successfully parsed JSON - stop polling and process results
  //             clearInterval(pollInterval);
  //             setBurnJobIds((prev) => {
  //               const newMap = new Map(prev);
  //               newMap.delete(mint);
  //               return newMap;
  //             });
  //             setPending((p) => ({ ...p, [mint]: false }));

  //             // Check if burn was successful
  //             if (resultData.success || resultData.ok) {
  //               setToast?.(`Token ${mint.slice(0, 6)}… burned successfully ✓`);
  //               setTimeout(() => fetchBalances(), 1000); // Refresh balances
  //             } else {
  //               setToast?.(
  //                 `Token burn completed with issues: ${JSON.stringify(
  //                   resultData
  //                 )}`
  //               );
  //             }
  //           } catch (parseError) {
  //             // JSON parse failed - continue polling as the result might not be ready yet
  //             console.log(
  //               `Burn result not yet valid JSON (${jobInfo.result}), continuing to poll...`
  //             );
  //             // Don't stop polling, just continue to next iteration
  //             return;
  //           }
  //         } else {
  //           // No result yet, continue polling
  //           console.log(
  //             "Burn job completed but no result yet, continuing to poll..."
  //           );
  //           return;
  //         }
  //       } else if (jobInfo.state && jobInfo.state.Failed) {
  //         // Job failed
  //         clearInterval(pollInterval);
  //         setBurnJobIds((prev) => {
  //           const newMap = new Map(prev);
  //           newMap.delete(mint);
  //           return newMap;
  //         });
  //         setPending((p) => ({ ...p, [mint]: false }));

  //         const errorMsg =
  //           typeof jobInfo.state.Failed === "string"
  //             ? jobInfo.state.Failed
  //             : "Burn job failed";

  //         console.error("Burn job failed:", errorMsg);
  //         setToast?.(`Burn failed: ${errorMsg}`);
  //       } else if (jobInfo.state === "Cancelled") {
  //         // Job was cancelled
  //         clearInterval(pollInterval);
  //         setBurnJobIds((prev) => {
  //           const newMap = new Map(prev);
  //           newMap.delete(mint);
  //           return newMap;
  //         });
  //         setPending((p) => ({ ...p, [mint]: false }));

  //         console.log("Burn job was cancelled");
  //         setToast?.("Token burn was cancelled");
  //       }
  //       // If job is still running (Pending/Running), continue polling
  //     } catch (error) {
  //       console.error(`Error polling burn job ${jobId}:`, error);
  //       clearInterval(pollInterval);
  //       setBurnJobIds((prev) => {
  //         const newMap = new Map(prev);
  //         newMap.delete(mint);
  //         return newMap;
  //       });
  //       setPending((p) => ({ ...p, [mint]: false }));
  //       setToast?.(`Failed to check burn job status: ${error.message}`);
  //     }
  //   }, 1000); // Poll every second

  //   // Cleanup function to clear interval if component unmounts
  //   return () => clearInterval(pollInterval);
  // };

  // Polling function for close accounts job status
  const startPollingCloseAccountsJob = (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const jobInfo = await tauriInvoke("get_job_status", { jobId });

        if (!jobInfo) {
          console.warn(`Close accounts job ${jobId} not found`);
          clearInterval(pollInterval);
          setCloseAccountsJobId(null);
          setPending((p) => ({ ...p, __close: false }));
          return;
        }

        console.log(`Close accounts job ${jobId} status:`, jobInfo);

        // Check if job is completed
        if (jobInfo.state === "Completed") {
          // Job completed - check for result
          if (jobInfo.result) {
            console.log(
              "Close accounts job completed with result:",
              jobInfo.result
            );

            try {
              // Try to parse the JSON result from the job
              const resultData = JSON.parse(jobInfo.result);

              // Successfully parsed JSON - stop polling and process results
              clearInterval(pollInterval);
              setCloseAccountsJobId(null);
              setPending((p) => ({ ...p, __close: false }));

              // Check if close accounts was successful
              if (resultData.success || resultData.ok) {
                setToast?.("Accounts closed successfully ✓");
                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                setToast?.(
                  `Close accounts completed with issues: ${JSON.stringify(
                    resultData
                  )}`
                );
              }
            } catch (parseError) {
              // JSON parse failed - check if it's a simple success string
              if (jobInfo.result === "Success") {
                console.log(
                  "Close accounts completed successfully (simple result)"
                );

                // Stop polling
                clearInterval(pollInterval);
                setCloseAccountsJobId(null);
                setPending((p) => ({ ...p, __close: false }));

                setToast?.("Accounts closed successfully ✓");
                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                // Result might not be ready yet, continue polling
                console.log(
                  `Close accounts result not yet valid JSON (${jobInfo.result}), continuing to poll...`
                );
                // Don't stop polling, just continue to next iteration
                return;
              }
            }
          } else {
            // No result yet, continue polling
            console.log(
              "Close accounts job completed but no result yet, continuing to poll..."
            );
            return;
          }
        } else if (jobInfo.state && jobInfo.state.Failed) {
          // Job failed
          clearInterval(pollInterval);
          setCloseAccountsJobId(null);
          setPending((p) => ({ ...p, __close: false }));

          const errorMsg =
            typeof jobInfo.state.Failed === "string"
              ? jobInfo.state.Failed
              : "Close accounts job failed";

          console.error("Close accounts job failed:", errorMsg);
          setToast?.(`Close accounts failed: ${errorMsg}`);
        } else if (jobInfo.state === "Cancelled") {
          // Job was cancelled
          clearInterval(pollInterval);
          setCloseAccountsJobId(null);
          setPending((p) => ({ ...p, __close: false }));

          console.log("Close accounts job was cancelled");
          setToast?.("Close accounts was cancelled");
        }
        // If job is still running (Pending/Running), continue polling
      } catch (error) {
        console.error(`Error polling close accounts job ${jobId}:`, error);
        clearInterval(pollInterval);
        setCloseAccountsJobId(null);
        setPending((p) => ({ ...p, __close: false }));
        setToast?.(
          `Failed to check close accounts job status: ${error.message}`
        );
      }
    }, 1000); // Poll every second

    // Cleanup function to clear interval if component unmounts
    return () => clearInterval(pollInterval);
  };

  // Polling function for selected tokens close accounts job status
  const startPollingSelectedTokenCloseJob = (jobId, mint) => {
    const pollInterval = setInterval(async () => {
      try {
        const jobInfo = await tauriInvoke("get_job_status", { jobId });

        if (!jobInfo) {
          console.warn(`Selected token close job ${jobId} not found`);
          clearInterval(pollInterval);
          setSelectedTokensCloseJobIds((prev) => {
            const newMap = new Map(prev);
            newMap.delete(mint);
            return newMap;
          });
          return;
        }

        console.log(`Selected token close job ${jobId} status:`, jobInfo);

        // Check if job is completed
        if (jobInfo.state === "Completed") {
          // Job completed - check for result
          if (jobInfo.result) {
            console.log(
              "Selected token close job completed with result:",
              jobInfo.result
            );

            try {
              // Try to parse the JSON result from the job
              const resultData = JSON.parse(jobInfo.result);

              // Successfully parsed JSON - stop polling and process results
              clearInterval(pollInterval);
              setSelectedTokensCloseJobIds((prev) => {
                const newMap = new Map(prev);
                newMap.delete(mint);
                return newMap;
              });

              // Check if close accounts was successful
              if (resultData.success || resultData.ok) {
                setToast?.(
                  `Token account ${mint.slice(0, 6)}… closed successfully ✓`
                );
                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                setToast?.(
                  `Close token account completed with issues: ${JSON.stringify(
                    resultData
                  )}`
                );
              }
            } catch (parseError) {
              // JSON parse failed - check if it's a simple success string
              if (jobInfo.result === "Success") {
                console.log(
                  "Close token account completed successfully (simple result)"
                );

                // Stop polling
                clearInterval(pollInterval);
                setSelectedTokensCloseJobIds((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(mint);
                  return newMap;
                });

                setToast?.(
                  `Token account ${mint.slice(0, 6)}… closed successfully ✓`
                );
                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                // Result might not be ready yet, continue polling
                console.log(
                  `Close token account result not yet valid JSON (${jobInfo.result}), continuing to poll...`
                );
                // Don't stop polling, just continue to next iteration
                return;
              }
            }
          } else {
            // No result yet, continue polling
            console.log(
              "Close token account job completed but no result yet, continuing to poll..."
            );
            return;
          }
        } else if (jobInfo.state && jobInfo.state.Failed) {
          // Job failed
          clearInterval(pollInterval);
          setSelectedTokensCloseJobIds((prev) => {
            const newMap = new Map(prev);
            newMap.delete(mint);
            return newMap;
          });

          const errorMsg =
            typeof jobInfo.state.Failed === "string"
              ? jobInfo.state.Failed
              : "Close token account job failed";

          console.error("Close token account job failed:", errorMsg);
          setToast?.(`Close token account failed: ${errorMsg}`);
        } else if (jobInfo.state === "Cancelled") {
          // Job was cancelled
          clearInterval(pollInterval);
          setSelectedTokensCloseJobIds((prev) => {
            const newMap = new Map(prev);
            newMap.delete(mint);
            return newMap;
          });

          console.log("Close token account job was cancelled");
          setToast?.("Close token account was cancelled");
        }
        // If job is still running (Pending/Running), continue polling
      } catch (error) {
        console.error(`Error polling close token account job ${jobId}:`, error);
        clearInterval(pollInterval);
        setSelectedTokensCloseJobIds((prev) => {
          const newMap = new Map(prev);
          newMap.delete(mint);
          return newMap;
        });
        setToast?.(
          `Failed to check close token account job status: ${error.message}`
        );
      }
    }, 1000); // Poll every second

    // Cleanup function to clear interval if component unmounts
    return () => clearInterval(pollInterval);
  };

  // Polling function for burn each tokens job status
  const startPollingBurnEachJob = (jobId) => {
    const pollInterval = setInterval(async () => {
      try {
        const jobInfo = await tauriInvoke("get_job_status", { jobId });

        if (!jobInfo) {
          console.warn(`Burn each tokens job ${jobId} not found`);
          clearInterval(pollInterval);
          setBurnEachJobId(null);
          return;
        }

        console.log(`Burn each tokens job ${jobId} status:`, jobInfo);

        // Check if job is completed
        if (jobInfo.state === "Completed") {
          // Job completed - check for result
          if (jobInfo.result) {
            console.log(
              "Burn each tokens job completed with result:",
              jobInfo.result
            );

            try {
              // Try to parse the JSON result from the job
              const burnResult = JSON.parse(jobInfo.result);

              // Successfully parsed JSON - stop polling and process results
              clearInterval(pollInterval);
              setBurnEachJobId(null);

              // Clear any pending states
              setPending((p) => {
                const newPending = { ...p };
                // Clear all token-specific pending states
                Object.keys(newPending).forEach((key) => {
                  if (key !== "__close") {
                    delete newPending[key];
                  }
                });
                return newPending;
              });

              // Display detailed results
              const successCount = burnResult.successful_burns;
              const failCount = burnResult.failed_burns;
              const totalCount = burnResult.total_mints;

              if (burnResult.success && successCount > 0) {
                setToast?.(
                  `🔥 Multi-mint burn completed: ${successCount}/${totalCount} successful!`
                );

                // Show per-mint results if available
                if (burnResult.burn_results) {
                  burnResult.burn_results.forEach((mintResult) => {
                    if (mintResult.success) {
                      console.log(
                        `✅ ${mintResult.mint.slice(0, 8)}…: ${
                          mintResult.total_tokens_burned
                        } tokens burned, ${
                          mintResult.transaction_signatures.length
                        } transactions`
                      );
                    } else {
                      console.log(
                        `❌ ${mintResult.mint.slice(0, 8)}…: ${
                          mintResult.error
                        }`
                      );
                    }
                  });
                }

                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                setToast?.(
                  `Multi-mint burn completed with issues: ${successCount}/${totalCount} successful, ${failCount} failed`
                );
              }
            } catch (parseError) {
              // JSON parse failed - check if it's a simple success string
              if (jobInfo.result === "Success") {
                console.log(
                  "Burn each tokens completed successfully (simple result)"
                );

                // Stop polling
                clearInterval(pollInterval);
                setBurnEachJobId(null);

                // Clear any pending states
                setPending((p) => {
                  const newPending = { ...p };
                  // Clear all token-specific pending states
                  Object.keys(newPending).forEach((key) => {
                    if (key !== "__close") {
                      delete newPending[key];
                    }
                  });
                  return newPending;
                });

                setToast?.("🔥 Burn operation completed successfully!");
                setTimeout(() => fetchBalances(), 1000); // Refresh balances
              } else {
                // Result might not be ready yet, continue polling
                console.log(
                  `Burn each tokens result not yet valid JSON (${jobInfo.result}), continuing to poll...`
                );
                // Don't stop polling, just continue to next iteration
                return;
              }
            }
          } else {
            // No result yet, continue polling
            console.log(
              "Burn each tokens job completed but no result yet, continuing to poll..."
            );
            return;
          }
        } else if (jobInfo.state && jobInfo.state.Failed) {
          // Job failed
          clearInterval(pollInterval);
          setBurnEachJobId(null);

          // Clear any pending states
          setPending((p) => {
            const newPending = { ...p };
            // Clear all token-specific pending states
            Object.keys(newPending).forEach((key) => {
              if (key !== "__close") {
                delete newPending[key];
              }
            });
            return newPending;
          });

          const errorMsg =
            typeof jobInfo.state.Failed === "string"
              ? jobInfo.state.Failed
              : "Burn each tokens job failed";

          console.error("Burn each tokens job failed:", errorMsg);
          setToast?.(`Multi-mint burn failed: ${errorMsg}`);
        } else if (jobInfo.state === "Cancelled") {
          // Job was cancelled
          clearInterval(pollInterval);
          setBurnEachJobId(null);

          // Clear any pending states
          setPending((p) => {
            const newPending = { ...p };
            // Clear all token-specific pending states
            Object.keys(newPending).forEach((key) => {
              if (key !== "__close") {
                delete newPending[key];
              }
            });
            return newPending;
          });

          console.log("Burn each tokens job was cancelled");
          setToast?.("Multi-mint burn was cancelled");
        }
        // If job is still running (Pending/Running), continue polling
      } catch (error) {
        console.error(`Error polling burn each tokens job ${jobId}:`, error);
        clearInterval(pollInterval);
        setBurnEachJobId(null);
        setToast?.(
          `Failed to check burn each tokens job status: ${error.message}`
        );
      }
    }, 1000); // Poll every second

    // Cleanup function to clear interval if component unmounts
    return () => clearInterval(pollInterval);
  };

  useEffect(() => {
    if (isOpen) fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wallet]);

  // Cleanup polling when modal closes or component unmounts
  useEffect(() => {
    if (!isOpen && currentTokensFetchJobId) {
      setCurrentTokensFetchJobId(null);
      setLoading(false);
    }

    if (!isOpen && burnJobIds.size > 0) {
      setBurnJobIds(new Map());
      setPending({});
    }

    if (!isOpen && burnEachJobId) {
      setBurnEachJobId(null);
      setBurningTokens(new Set()); // Clear burning tokens state
    }

    if (!isOpen && burnTokensBatchJobId) {
      setBurnTokensBatchJobId(null);
      setBurningTokens(new Set()); // Clear burning tokens state
    }

    if (!isOpen && closeAccountsJobId) {
      setCloseAccountsJobId(null);
      setPending((p) => ({ ...p, __close: false }));
    }

    if (!isOpen && selectedTokensCloseJobIds.size > 0) {
      setSelectedTokensCloseJobIds(new Map());
    }

    if (!isOpen && closeTokenAccountsBatchJobId) {
      setCloseTokenAccountsBatchJobId(null);
    }
  }, [
    isOpen,
    currentTokensFetchJobId,
    burnJobIds.size,
    burnEachJobId,
    burnTokensBatchJobId,
    closeAccountsJobId,
    closeTokenAccountsBatchJobId,
    selectedTokensCloseJobIds.size,
  ]);

  const cancelTokensFetchJob = async () => {
    if (!currentTokensFetchJobId) return false;

    try {
      const cancelled = await cancelJob(currentTokensFetchJobId);
      if (cancelled) {
        setCurrentTokensFetchJobId(null);
        setLoading(false);
        setToast?.("Token fetch job cancelled");
        console.log("Token fetch job cancelled");
      }
      return cancelled;
    } catch (error) {
      console.error("Failed to cancel token fetch job:", error);
      setToast?.(`Failed to cancel job: ${error.message}`);
      return false;
    }
  };

  // const doCloseAccount = async () => {
  //   if (!pk) return setToast?.("No private key for this wallet");
  //   const confirmed = confirm("Close all token accounts for this wallet?");
  //   if (!confirmed) return;

  //   setPending((p) => ({ ...p, __close: true }));

  //   try {
  //     // Call close_accounts_job with the correct parameters
  //     const jobId = await tauriInvoke("close_accounts_job", { walletPk: pk });

  //     if (jobId) {
  //       console.log(`Started close accounts job ${jobId}`);
  //       setToast?.(
  //         `Close accounts job started (${jobId}) - polling for results...`
  //       );

  //       // Store the job ID and start polling
  //       setCloseAccountsJobId(jobId);
  //       startPollingCloseAccountsJob(jobId);
  //     } else {
  //       setToast?.("Failed to start close accounts job");
  //       setPending((p) => ({ ...p, __close: false }));
  //     }
  //   } catch (e) {
  //     console.error("Close accounts error", e);
  //     setToast?.(`Close accounts error: ${e?.message || e}`);
  //     setPending((p) => ({ ...p, __close: false }));
  //   }
  // };

  // const doBurnToken = async (mint) => {
  //   if (!pk) return setToast?.("No private key for this wallet");
  //   const confirmed = confirm(`Burn all tokens for mint ${mint.slice(0, 6)}…?`);
  //   if (!confirmed) return;

  //   // Check if there's already a burn each job running
  //   if (burnEachJobId) {
  //     setToast?.("A multi-mint burn job is already running");
  //     return;
  //   }

  //   setPending((p) => ({ ...p, [mint]: true }));

  //   try {
  //     // Use burn_each_tokens_job for consistency, even for single mint
  //     const jobId = await tauriInvoke("burn_each_tokens_job", {
  //       walletPk: pk,
  //       mintAddresses: [mint], // Single mint in array
  //       burnPercentage: 100.0,
  //     });

  //     if (jobId) {
  //       console.log(
  //         `Started burn each tokens job ${jobId} for single mint ${mint}`
  //       );
  //       setToast?.(`Token burn job started (${jobId}) - processing...`);

  //       // Store the job ID and start polling
  //       setBurnEachJobId(jobId);
  //       startPollingBurnEachJob(jobId);

  //       // Don't clear pending here, it will be cleared when job completes
  //     } else {
  //       setToast?.("Failed to start burn job");
  //       setPending((p) => ({ ...p, [mint]: false }));
  //     }
  //   } catch (e) {
  //     console.error("Burn error", e);
  //     setToast?.(`Burn error: ${e?.message || e}`);
  //     setPending((p) => ({ ...p, [mint]: false }));
  //   }
  // };

  // const doBurnSelectedTokens = async () => {
  //   if (!pk) return setToast?.("No private key for this wallet");
  //   if (selectedTokens.size === 0) return setToast?.("No tokens selected");

  //   const tokens = Array.from(selectedTokens);
  //   const confirmed = confirm(
  //     `Burn 100% of ${tokens.length} different token types? This will process each mint individually with detailed tracking.`
  //   );
  //   if (!confirmed) return;

  //   try {
  //     // Use burn_each_tokens_job for sophisticated multi-mint burning
  //     const jobId = await tauriInvoke("burn_each_tokens_job", {
  //       walletPk: pk,
  //       mintAddresses: tokens,
  //       burnPercentage: 100.0,
  //     });

  //     if (jobId) {
  //       console.log(
  //         `Started burn each tokens job ${jobId} for ${tokens.length} mints`
  //       );
  //       setToast?.(
  //         `Multi-mint burn job started (${jobId}) - processing ${tokens.length} token types...`
  //       );

  //       // Store the job ID and start polling
  //       setBurnEachJobId(jobId);
  //       startPollingBurnEachJob(jobId);

  //       // Clear selection since we've started the burn
  //       setSelectedTokens(new Set());
  //     } else {
  //       setToast?.("Failed to start multi-mint burn job");
  //     }
  //   } catch (error) {
  //     console.error("Multi-mint burn error:", error);
  //     setToast?.(`Multi-mint burn failed: ${error?.message || error}`);
  //   }
  // };

  const doCloseSelectedTokensAccounts = async () => {
    if (!pk) return setToast?.("No private key for this wallet");
    if (selectedTokens.size === 0) return setToast?.("No tokens selected");

    const tokens = Array.from(selectedTokens);
    const confirmed = confirm(
      `Close accounts for ${tokens.length} selected token(s)? This will close all selected token accounts.`
    );
    if (!confirmed) return;

    try {
      // Use the unified job polling system like close_accounts
      const jobId = await startCloseTokenAccountsBatchJob(pk, tokens);

      if (jobId) {
        console.log(
          `Started close token accounts batch job ${jobId} for ${tokens.length} tokens`
        );
        setCloseTokenAccountsBatchJobId(jobId);
        setToast?.(
          `Close token accounts batch job started for ${tokens.length} token(s)`
        );
        setSelectedTokens(new Set()); // Clear selection
      } else {
        setToast?.("Failed to start batch close job");
      }
    } catch (error) {
      console.error("Close selected tokens accounts error:", error);
      setToast?.(`Close accounts failed: ${error?.message || error}`);
    }
  };

  const doCloseTokenAccount = async (mint) => {
    if (!pk) return setToast?.("No private key for this wallet");
    const confirmed = confirm(`Close token account for ${mint.slice(0, 6)}…?`);
    if (!confirmed) return;

    try {
      // Check if there's already a job for this mint
      if (selectedTokensCloseJobIds.has(mint)) {
        setToast?.("Close job already running for this token");
        return;
      }

      const jobId = await startCloseTokenAccountJob(pk, mint);

      if (jobId) {
        console.log(
          `Started close token account job ${jobId} for mint ${mint}`
        );
        setToast?.(
          `Close token account job started (${jobId}) - processing...`
        );

        // Store the job ID
        setSelectedTokensCloseJobIds((prev) => new Map(prev).set(mint, jobId));
      } else {
        setToast?.("Failed to start close token account job");
      }
    } catch (e) {
      console.error("Close token account error", e);
      setToast?.(`Close token account error: ${e?.message || e}`);
    }
  };

  const toggleTokenSelection = (mint) => {
    const newSelection = new Set(selectedTokens);
    if (newSelection.has(mint)) {
      newSelection.delete(mint);
    } else {
      newSelection.add(mint);
    }
    setSelectedTokens(newSelection);
  };

  const selectAllTokens = () => {
    if (selectedTokens.size === balances.length) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(
        new Set(balances.map((t) => t.mint || t.address || t.token || ""))
      );
    }
  };

  return (
    <Dialog open={!!isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl max-h-[80vh] rounded-xl bg-[#1D1539] p-4 text-white shadow-xl border border-[#312152] flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h3 className="text-lg font-semibold">Tokens for wallet</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBalances}
                disabled={loading || currentTokensFetchJobId}
                className="px-3 py-1 rounded-lg bg-white/5 text-sm flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={
                    loading || currentTokensFetchJobId ? "animate-spin" : ""
                  }
                />
                {loading || currentTokensFetchJobId ? "Loading..." : "Refresh"}
              </button>
              {currentTokensFetchJobId && (
                <button
                  onClick={cancelTokensFetchJob}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm border border-red-400/30"
                >
                  Cancel Fetch
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-lg bg-white/5 text-sm"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="mb-3 text-xs text-white/60 break-all">
            {wallet}
            {currentTokensFetchJobId && (
              <div className="mt-1 text-blue-400">
                Job ID: {currentTokensFetchJobId} (polling every 1s)
              </div>
            )}
            {burnJobIds.size > 0 && (
              <div className="mt-1 text-orange-400">
                Burn Jobs:{" "}
                {Array.from(burnJobIds.entries()).map(([mint, jobId]) => (
                  <div key={mint} className="text-xs">
                    {mint.slice(0, 8)}…: {jobId} (polling)
                  </div>
                ))}
              </div>
            )}
            {burnEachJobId && (
              <div className="mt-1 text-red-400">
                Multi-Mint Burn Job: {burnEachJobId} (processing multiple
                tokens)
              </div>
            )}
            {burnTokensBatchJobId && (
              <div className="mt-1 text-orange-400">
                Batch Burn Job: {burnTokensBatchJobId} (progress tracking)
              </div>
            )}
            {closeAccountsJobId && (
              <div className="mt-1 text-red-400">
                Close Accounts Job: {closeAccountsJobId} (polling every 1s)
              </div>
            )}
            {selectedTokensCloseJobIds.size > 0 && (
              <div className="mt-1 text-purple-400">
                Close Token Jobs:{" "}
                {Array.from(selectedTokensCloseJobIds.entries()).map(
                  ([mint, jobId]) => (
                    <div key={mint} className="text-xs">
                      {mint.slice(0, 8)}…: {jobId} (polling)
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Token fetch batch progress */}
          {/* Job Progress - Unified System */}
          {currentTokensFetchJobId && (
            <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
              <div className="text-blue-200 text-sm mb-2">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                Fetching token balances (Job ID: {currentTokensFetchJobId})
              </div>
            </div>
          )}

          {/* Job Error Display */}
          {jobError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
              Job Error: {jobError}
            </div>
          )}

          {loading || currentTokensFetchJobId ? (
            <div className="py-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
              {currentTokensFetchJobId
                ? "Fetching token balances via unified job system (polling every second)…"
                : "Loading token balances…"}
            </div>
          ) : error || jobError ? (
            <div className="py-4 text-center text-red-400">
              {error || jobError}
            </div>
          ) : balances.length === 0 ? (
            <div className="py-4 text-center text-white/60">
              No tokens found
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-3 max-h-[50vh] overflow-auto">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllTokens}
                      className="px-2 py-1 rounded-md text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-400/30"
                    >
                      {selectedTokens.size === balances.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                    {selectedTokens.size > 0 && (
                      <span className="text-xs text-white/60">
                        {selectedTokens.size} selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedTokens.size > 0 && (
                      <>
                        <button
                          onClick={doBurnSelectedTokens}
                          disabled={burnTokensBatchJobId}
                          className={`px-3 py-1 rounded-md text-xs font-semibold border disabled:opacity-50 flex items-center gap-1 ${
                            burnTokensBatchJobId
                              ? "bg-red-500/20 border-red-400/40 text-red-300"
                              : "bg-orange-500/30 hover:bg-orange-500/40 border-orange-400/30"
                          }`}
                          title={
                            burnTokensBatchJobId
                              ? `Batch burn job in progress: ${burnTokensBatchJobId}`
                              : `Burn all tokens from ${selectedTokens.size} different mints`
                          }
                        >
                          {burnTokensBatchJobId ? (
                            <>
                              <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                              <span>
                                {Math.round(
                                  getJobProgress(burnTokensBatchJobId) || 0
                                )}
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <Flame className="w-3 h-3" />
                              <span>Burn Batch ({selectedTokens.size})</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={doCloseSelectedTokensAccounts}
                          disabled={closeTokenAccountsBatchJobId}
                          className={`px-3 py-1 rounded-md text-xs font-semibold border disabled:opacity-50 flex items-center gap-1 ${
                            closeTokenAccountsBatchJobId
                              ? "bg-purple-500/20 border-purple-400/40 text-purple-300"
                              : "bg-purple-500/30 hover:bg-purple-500/40 border-purple-400/30"
                          }`}
                          title={
                            closeTokenAccountsBatchJobId
                              ? "Close batch job in progress"
                              : "Close selected token accounts"
                          }
                        >
                          {closeTokenAccountsBatchJobId ? (
                            <>
                              <div className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                              <span>
                                {Math.round(
                                  getJobProgress(
                                    closeTokenAccountsBatchJobId
                                  ) || 0
                                )}
                                %
                              </span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>
                                Close Selected ({selectedTokens.size})
                              </span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                    <button
                      onClick={doCloseAccount}
                      disabled={!!pending.__close || closeAccountsJobId}
                      className={`px-3 py-1 rounded-md text-xs font-semibold border disabled:opacity-50 flex items-center gap-1 ${
                        closeAccountsJobId
                          ? "bg-red-500/20 border-red-400/40 text-red-300"
                          : "bg-red-500/30 hover:bg-red-500/40 border-red-400/30"
                      }`}
                      title={
                        closeAccountsJobId
                          ? `Close accounts job in progress: ${closeAccountsJobId}`
                          : "Close all token accounts"
                      }
                    >
                      {closeAccountsJobId ? (
                        <>
                          <div className="w-3 h-3 border border-red-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Job Active</span>
                        </>
                      ) : pending.__close ? (
                        "Closing…"
                      ) : (
                        "Close Accounts"
                      )}
                    </button>
                  </div>
                </div>
                {balances.map((t) => {
                  const mint = t.mint || t.address || t.token || "";
                  const rawBal = Number(t.balance ?? t.amount ?? 0) || 0;
                  const decimals = Number(t.decimals ?? 0) || 0;
                  const display = rawBal;
                  const meta = tokensMap[mint] || {};
                  const isSelected = selectedTokens.has(mint);
                  const hasCloseJob = selectedTokensCloseJobIds.has(mint);
                  const isTokenBeingBurned = burningTokens.has(mint); // Only this specific token is being burned

                  return (
                    <div
                      key={mint}
                      className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        hasCloseJob
                          ? "bg-purple-500/10 border-purple-400/30"
                          : isTokenBeingBurned
                          ? "bg-orange-500/10 border-orange-400/30"
                          : isSelected
                          ? "bg-blue-500/10 border-blue-400/30"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                      onClick={() => toggleTokenSelection(mint)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTokenSelection(mint)}
                            className="w-3 h-3 rounded bg-white/10 border border-white/20"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {meta.symbol ||
                              meta.name ||
                              mint.slice(0, 24) + "…"}
                            {hasCloseJob && (
                              <span className="text-purple-400 text-xs animate-pulse">
                                🔒 Closing...
                              </span>
                            )}
                            {isTokenBeingBurned && !hasCloseJob && (
                              <span className="text-orange-400 text-xs animate-pulse">
                                🔥 Burning...
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-white/60 font-mono break-all flex items-center gap-1 mt-0.5 ml-5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(mint);
                            }}
                            className="p-0.5 rounded hover:bg-white/10"
                            title="Copy mint"
                          >
                            <ClipboardCopy size={14} />
                          </button>
                          <span>{mint}</span>
                        </div>
                      </div>
                      <div className="text-right mr-2">
                        <div className="text-sm font-mono">
                          {Number(display).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs text-white/50">
                          decimals: {decimals}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            doBurnToken(mint);
                          }}
                          disabled={
                            !!pending[mint] || isTokenBeingBurned || hasCloseJob
                          }
                          className={`px-2 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                            pending[mint] || isTokenBeingBurned || hasCloseJob
                              ? "opacity-50 cursor-not-allowed bg-white/5"
                              : "bg-orange-500/20 hover:bg-orange-500/30"
                          }`}
                          title={
                            isTokenBeingBurned
                              ? `This token is being burned in job: ${burnEachJobId}`
                              : hasCloseJob
                              ? "Cannot burn while closing account"
                              : "Burn all tokens of this mint"
                          }
                        >
                          <Flame
                            className={`w-3 h-3 ${
                              isTokenBeingBurned ? "animate-pulse" : ""
                            }`}
                          />
                          {isTokenBeingBurned && (
                            <span className="text-xs">Burning</span>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            doCloseTokenAccount(mint);
                          }}
                          disabled={hasCloseJob || isTokenBeingBurned}
                          className={`px-2 py-1 rounded-md text-xs font-semibold transition flex items-center gap-1 ${
                            hasCloseJob || isTokenBeingBurned
                              ? "opacity-50 cursor-not-allowed bg-white/5"
                              : "bg-purple-500/20 hover:bg-purple-500/30"
                          }`}
                          title={
                            hasCloseJob
                              ? `Close job in progress: ${selectedTokensCloseJobIds.get(
                                  mint
                                )}`
                              : isTokenBeingBurned
                              ? "Cannot close while burning"
                              : "Close token account"
                          }
                        >
                          <Lock
                            className={`w-3 h-3 ${
                              hasCloseJob ? "animate-pulse" : ""
                            }`}
                          />
                          {hasCloseJob && <span className="text-xs">Job</span>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
