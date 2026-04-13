"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CATEGORY_OPTIONS,
  deleteTimerRecord,
  fetchTimerRecords,
  type TimerRecord,
} from "@/lib/timer-records";

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h === 0) {
    return [m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  }

  return [h.toString(), m.toString().padStart(2, "0"), s.toString().padStart(2, "0")].join(":");
};

export default function RecordsPage() {
  const [records, setRecords] = useState<TimerRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadRecords = async () => {
      const { data, error } = await fetchTimerRecords();
      if (error) {
        setErrorMessage(error);
        return;
      }

      setErrorMessage(null);
      setRecords(data);
    };

    void loadRecords();
  }, []);

  const totalDuration = records.reduce((sum, record) => sum + record.duration, 0);
  const categoryDurations = CATEGORY_OPTIONS.map((category) => ({
    category,
    duration: records
      .filter((record) => record.category === category)
      .reduce((sum, record) => sum + record.duration, 0),
  }));

  const handleDeleteRecord = async (id: number) => {
    const { error } = await deleteTimerRecord(id);
    if (error) {
      setErrorMessage(error);
      return;
    }

    setErrorMessage(null);
    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#0F172A] p-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-100">Records</h1>

        <div className="mt-4 rounded-lg border border-[#F97316]/40 bg-slate-800 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Total Focus Time</p>
          <p className="text-xl font-bold text-slate-100">{formatTime(totalDuration)}</p>
        </div>

        <div className="mt-3 rounded-lg border border-[#F97316]/40 bg-slate-800 px-3 py-2">
          <p className="text-xs font-semibold text-[#F97316]">Totals by Category</p>
          <ul className="mt-2 space-y-1">
            {categoryDurations.map((item) => (
              <li key={item.category} className="flex items-center justify-between text-sm text-slate-200">
                <span>{item.category}</span>
                <span className="font-semibold">{formatTime(item.duration)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          {errorMessage && (
            <p className="mb-2 text-sm text-red-300">{errorMessage}</p>
          )}

          {records.length === 0 ? (
            <p className="text-sm text-slate-400">No records yet.</p>
          ) : (
            <ul className="space-y-2">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-100">{record.taskName}</p>
                  <p className="text-sm font-extrabold tracking-wide text-[#FDBA74]">
                    Duration: {formatTime(record.duration)}
                  </p>
                  <p className="text-xs text-slate-300">
                    Mode: {record.mode === "timer" ? "Timer" : "Stopwatch"}
                  </p>
                  <p className="text-xs text-slate-300">Category: {record.category}</p>
                  <p className="text-xs text-slate-300">Date: {new Date(record.date).toLocaleString("en-US")}</p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteRecord(record.id)}
                    className="mt-2 rounded-md border border-[#F97316]/40 px-2 py-1 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/10"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-[#F97316] hover:text-[#FB923C]"
        >
          Back to Timer
        </Link>
      </div>
    </main>
  );
}
