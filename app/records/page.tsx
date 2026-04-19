"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CATEGORY_OPTIONS,
  deleteTimerRecord,
  fetchTimerRecords,
  type Category,
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

const formatDateKey = (dateValue: string) => {
  return new Date(dateValue).toLocaleDateString("en-CA");
};

const getWeekStartDate = (dateValue: string) => {
  const date = new Date(dateValue);
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const mondayBasedDayIndex = (date.getDay() + 6) % 7;
  weekStart.setDate(date.getDate() - mondayBasedDayIndex);
  return weekStart;
};

const formatWeekKey = (dateValue: string) => {
  return getWeekStartDate(dateValue).toISOString().slice(0, 10);
};

const formatWeekLabel = (weekKey: string) => {
  return `Week of ${new Date(weekKey).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
};

const getTotalDuration = (items: TimerRecord[]) => {
  return items.reduce((sum, item) => sum + item.duration, 0);
};

const RecordItem = ({
  record,
  onDelete,
}: {
  record: TimerRecord;
  onDelete: (id: number) => void;
}) => (
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
      onClick={() => onDelete(record.id)}
      className="mt-2 rounded-md border border-[#F97316]/40 px-2 py-1 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/10"
    >
      Delete
    </button>
  </li>
);

export default function RecordsPage() {
  const [records, setRecords] = useState<TimerRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"date" | "week">("date");
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all");
  const [showMoreByDate, setShowMoreByDate] = useState(false);
  const [showMoreByWeek, setShowMoreByWeek] = useState(false);

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
  const filteredRecords = selectedCategory === "all"
    ? records
    : records.filter((record) => record.category === selectedCategory);
  const sortedRecords = [...filteredRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const recordsByDate = sortedRecords.reduce<Record<string, TimerRecord[]>>((acc, record) => {
    const key = formatDateKey(record.date);
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(record);
    return acc;
  }, {});
  const recordsByWeek = sortedRecords.reduce<Record<string, TimerRecord[]>>((acc, record) => {
    const key = formatWeekKey(record.date);
    if (!acc[key]) {
      acc[key] = [];
    }

    acc[key].push(record);
    return acc;
  }, {});
  const dateKeys = Object.keys(recordsByDate).sort((a, b) => b.localeCompare(a));
  const weekKeys = Object.keys(recordsByWeek).sort((a, b) => b.localeCompare(a));

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
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`rounded-md border border-[#F97316]/40 px-3 py-1 text-xs font-semibold transition-colors ${
                    selectedCategory === "all"
                      ? "bg-[#F97316] text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  All Categories
                </button>
                {CATEGORY_OPTIONS.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-md border border-[#F97316]/40 px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedCategory === category
                        ? "bg-[#F97316] text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-lg border border-[#F97316]/40 bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("date")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    activeTab === "date"
                      ? "bg-[#F97316] text-white"
                      : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  By Date
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("week")}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                    activeTab === "week"
                      ? "bg-[#F97316] text-white"
                      : "text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  By Week
                </button>
              </div>

              {filteredRecords.length === 0 ? (
                <p className="text-sm text-slate-400">No records in this category.</p>
              ) : (
                <>
                  {activeTab === "date" ? (
                    <section>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#F97316]">By Date</p>
                      <div className="space-y-3">
                        {(showMoreByDate ? dateKeys : dateKeys.slice(0, 7)).map((dateKey) => (
                          <div key={dateKey} className="space-y-2">
                            <p className="flex items-center justify-between text-xs font-semibold text-slate-300">
                              <span>{dateKey}</span>
                              <span className="text-[#FDBA74]">{formatTime(getTotalDuration(recordsByDate[dateKey]))}</span>
                            </p>
                            <ul className="space-y-2">
                              {recordsByDate[dateKey].map((record) => (
                                <RecordItem
                                  key={record.id}
                                  record={record}
                                  onDelete={(id) => {
                                    void handleDeleteRecord(id);
                                  }}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {!showMoreByDate && dateKeys.length > 7 && (
                        <button
                          type="button"
                          onClick={() => setShowMoreByDate(true)}
                          className="mt-3 w-full rounded-md border border-[#F97316]/40 bg-slate-800 px-3 py-2 text-xs font-semibold text-[#F97316] transition-colors hover:bg-slate-700"
                        >
                          View More ({dateKeys.length - 7} earlier days)
                        </button>
                      )}
                    </section>
                  ) : (
                    <section>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#F97316]">By Week</p>
                      <div className="space-y-3">
                        {(showMoreByWeek ? weekKeys : weekKeys.slice(0, 1)).map((weekKey) => (
                          <div key={weekKey} className="space-y-2">
                            <p className="flex items-center justify-between text-xs font-semibold text-slate-300">
                              <span>{formatWeekLabel(weekKey)}</span>
                              <span className="text-[#FDBA74]">{formatTime(getTotalDuration(recordsByWeek[weekKey]))}</span>
                            </p>
                            <ul className="space-y-2">
                              {recordsByWeek[weekKey].map((record) => (
                                <RecordItem
                                  key={`week-${record.id}`}
                                  record={record}
                                  onDelete={(id) => {
                                    void handleDeleteRecord(id);
                                  }}
                                />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                      {!showMoreByWeek && weekKeys.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setShowMoreByWeek(true)}
                          className="mt-3 w-full rounded-md border border-[#F97316]/40 bg-slate-800 px-3 py-2 text-xs font-semibold text-[#F97316] transition-colors hover:bg-slate-700"
                        >
                          View More ({weekKeys.length - 1} earlier weeks)
                        </button>
                      )}
                    </section>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <Link
          href="/"
          className="fixed right-4 top-4 rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#EA580C]"
        >
          Back to Timer
        </Link>
      </div>
    </main>
  );
}
