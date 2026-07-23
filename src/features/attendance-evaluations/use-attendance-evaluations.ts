"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { attendanceEvaluationSource, type AttendanceEvaluationSource } from "./service";
import type { AttendanceEvaluationDataset } from "./types";

const AUTO_REFRESH_INTERVAL_MS = 60_000;
const emptyDataset: AttendanceEvaluationDataset = {
  evaluations: [],
  updatedAt: null,
  sourceConnected: false,
};

export function useAttendanceEvaluations(
  source: AttendanceEvaluationSource = attendanceEvaluationSource,
) {
  const [dataset, setDataset] = useState<AttendanceEvaluationDataset>(emptyDataset);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  const refresh = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const nextDataset = await source.load();
      if (mountedRef.current) setDataset(nextDataset);
    } catch (nextError) {
      if (mountedRef.current) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Não foi possível atualizar as avaliações.",
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [source]);

  useEffect(() => {
    mountedRef.current = true;
    source
      .load()
      .then((nextDataset) => {
        if (mountedRef.current) setDataset(nextDataset);
      })
      .catch((nextError: unknown) => {
        if (mountedRef.current) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Não foi possível atualizar as avaliações.",
          );
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    const interval = window.setInterval(() => void refresh(), AUTO_REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh, source]);

  return {
    ...dataset,
    loading,
    refreshing,
    error,
    refresh,
  };
}
