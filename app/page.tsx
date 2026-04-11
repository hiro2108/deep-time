"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import ytmIcon from "./ytm-icon.png";
import {
  CATEGORY_OPTIONS,
  DEFAULT_CATEGORY,
  type Category,
  fetchTodayDuration,
  insertTimerRecord,
  type Mode,
} from "@/lib/timer-records";

type TimerRecord = {
  taskName: string;
  duration: number;
  date: string;
  mode: Mode;
  category: Category;
};

type PersistedTimerSession = {
  taskName: string;
  category: Category;
  mode: Mode;
  timerMinutes: number;
  startTime: number;
  elapsedTime: number;
  remainingTime: number;
};

const DEFAULT_TIMER_MINUTES = 25;
const ACTIVE_TIMER_SESSION_KEY = "deep-time-active-session-v1";

const readPersistedTimerSession = (): PersistedTimerSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSession = localStorage.getItem(ACTIVE_TIMER_SESSION_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedSession) as Partial<PersistedTimerSession>;
    if (!parsed.startTime || typeof parsed.startTime !== "number") {
      return null;
    }

    const restoredMode: Mode = parsed.mode === "stopwatch" ? "stopwatch" : "timer";
    const restoredCategory: Category = CATEGORY_OPTIONS.includes(parsed.category as Category)
      ? (parsed.category as Category)
      : DEFAULT_CATEGORY;
    const restoredMinutes = Math.min(
      180,
      Math.max(1, parsed.timerMinutes ?? DEFAULT_TIMER_MINUTES),
    );

    return {
      taskName: parsed.taskName ?? "",
      category: restoredCategory,
      mode: restoredMode,
      timerMinutes: restoredMinutes,
      startTime: parsed.startTime,
      elapsedTime: Math.max(0, parsed.elapsedTime ?? 0),
      remainingTime: Math.max(0, parsed.remainingTime ?? restoredMinutes * 60),
    };
  } catch {
    return null;
  }
};

export default function TimerApp() {
  const [restoredSession] = useState<PersistedTimerSession | null>(() =>
    readPersistedTimerSession(),
  );
  const [taskName, setTaskName] = useState(restoredSession?.taskName ?? "");
  const [category, setCategory] = useState<Category>(restoredSession?.category ?? DEFAULT_CATEGORY);
  const [mode, setMode] = useState<Mode>(restoredSession?.mode ?? "timer");
  const [timerMinutes, setTimerMinutes] = useState(restoredSession?.timerMinutes ?? DEFAULT_TIMER_MINUTES);
  const [isRunning, setIsRunning] = useState(Boolean(restoredSession));
  const [elapsedTime, setElapsedTime] = useState(restoredSession?.elapsedTime ?? 0);
  const [remainingTime, setRemainingTime] = useState(
    restoredSession?.mode === "timer"
      ? restoredSession.remainingTime
      : (restoredSession?.timerMinutes ?? DEFAULT_TIMER_MINUTES) * 60,
  );
  const [startTime, setStartTime] = useState<number | null>(restoredSession?.startTime ?? null);
  const [todayDuration, setTodayDuration] = useState(0);

  useEffect(() => {
    const loadTodayDuration = async () => {
      const { duration, error } = await fetchTodayDuration();
      if (error) {
        console.error(error);
        return;
      }

      setTodayDuration(duration);
    };

    void loadTodayDuration();
  }, []);

  useEffect(() => {
    if (!isRunning || !startTime) {
      localStorage.removeItem(ACTIVE_TIMER_SESSION_KEY);
      return;
    }

    const session: PersistedTimerSession = {
      taskName,
      category,
      mode,
      timerMinutes,
      startTime,
      elapsedTime,
      remainingTime,
    };

    localStorage.setItem(ACTIVE_TIMER_SESSION_KEY, JSON.stringify(session));
  }, [
    isRunning,
    taskName,
    category,
    mode,
    timerMinutes,
    startTime,
    elapsedTime,
    remainingTime,
  ]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const diffSeconds = Math.floor((now - startTime) / 1000);

        if (mode === "stopwatch") {
          setElapsedTime(diffSeconds);
          return;
        }

        const timerSeconds = timerMinutes * 60;
        const nextRemaining = Math.max(timerSeconds - diffSeconds, 0);
        setRemainingTime(nextRemaining);

        if (nextRemaining === 0) {
          setIsRunning(false);
          setStartTime(null);
          localStorage.removeItem(ACTIVE_TIMER_SESSION_KEY);
          alert("The timer has finished.");
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, mode, startTime, timerMinutes]);

  const getCurrentDuration = () => {
    const timerSeconds = timerMinutes * 60;
    if (mode === "stopwatch") return elapsedTime;
    return timerSeconds - remainingTime;
  };

  const formatStartTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleStart = () => {
    const now = Date.now();
    const normalizedTaskName = taskName.trim() || `${category}${formatStartTime(now)}`;

    if (!taskName.trim()) {
      setTaskName(normalizedTaskName);
    }

    if (mode === "stopwatch") {
      setElapsedTime(0);
    } else {
      setRemainingTime(timerMinutes * 60);
    }

    setStartTime(now);
    setIsRunning(true);
  };

  const handleStop = async () => {
    setIsRunning(false);
    localStorage.removeItem(ACTIVE_TIMER_SESSION_KEY);
    const duration = getCurrentDuration();
    const completedAt = new Date().toISOString();
    const completedAtTimestamp = startTime ?? Date.parse(completedAt);
    const normalizedTaskName = taskName.trim() || `${category}${formatStartTime(completedAtTimestamp)}`;

    const nextRecord: TimerRecord = {
      taskName: normalizedTaskName,
      duration,
      date: completedAt,
      mode,
      category,
    };

    const saveResult = await insertTimerRecord(nextRecord);
    if (saveResult.error) {
      alert(`Failed to save record. ${saveResult.error}`);
      return;
    }

    const { duration: nextTodayDuration, error: durationError } = await fetchTodayDuration();
    if (!durationError) {
      setTodayDuration(nextTodayDuration);
    }

    alert(`${normalizedTaskName} completed for ${formatTime(duration)}!`);
    setTaskName("");
    setCategory(DEFAULT_CATEGORY);
    setElapsedTime(0);
    setRemainingTime(timerMinutes * 60);
    setStartTime(null);
  };

  const handleModeChange = (nextMode: Mode) => {
    if (isRunning) return;
    setMode(nextMode);
    setElapsedTime(0);
    setRemainingTime(timerMinutes * 60);
  };

  const handleTimerMinutesChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setTimerMinutes(DEFAULT_TIMER_MINUTES);
      setRemainingTime(DEFAULT_TIMER_MINUTES * 60);
      return;
    }

    const nextMinutes = Math.min(180, Math.max(1, parsed));
    setTimerMinutes(nextMinutes);
    if (!isRunning) {
      setRemainingTime(nextMinutes * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, "0")).join(":");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0F172A] p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-center text-2xl font-bold text-slate-100">
          Focus Timer
        </h1>

        <div className="rounded-lg border border-[#F97316]/40 bg-slate-800 px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-[#F97316]">
            Total Focus Time Today
          </p>
          <p className="text-xl font-bold text-slate-100">{formatTime(todayDuration)}</p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="category"
            className="block text-sm font-medium text-slate-200"
          >
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={isRunning}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-slate-700"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="What are you working on now?"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            disabled={isRunning}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-slate-700"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModeChange("timer")}
              disabled={isRunning}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "timer"
                  ? "border-[#F97316] bg-[#F97316] text-white"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
                Timer
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("stopwatch")}
              disabled={isRunning}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "stopwatch"
                  ? "border-[#F97316] bg-[#F97316] text-white"
                  : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
                Stopwatch
            </button>
          </div>

          {mode === "timer" && (
            <div className="space-y-2">
              <label
                htmlFor="timer-minutes"
                className="block text-sm font-medium text-slate-200"
              >
                Timer Duration (minutes)
              </label>
              <input
                id="timer-minutes"
                type="number"
                min={1}
                max={180}
                step={1}
                value={timerMinutes}
                onChange={(e) => handleTimerMinutesChange(e.target.value)}
                disabled={isRunning}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-slate-700"
              />
              <p className="text-xs text-slate-400">
                You can set a value between 1 and 180 minutes.
              </p>
            </div>
          )}

          <div className="py-8 text-center font-mono text-6xl text-slate-100">
            {formatTime(mode === "stopwatch" ? elapsedTime : remainingTime)}
          </div>

          {!isRunning ? (
            <button
              onClick={handleStart}
              className="w-full rounded-lg bg-[#F97316] py-4 font-bold text-white shadow-lg transition-all hover:bg-[#EA580C] active:scale-95"
            >
              START
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full rounded-lg bg-[#F97316] py-4 font-bold text-white shadow-lg transition-all hover:bg-[#EA580C] active:scale-95"
            >
              STOP & SAVE
            </button>
          )}
        </div>

        <Link
          href="/records"
          className="fixed right-4 top-4 rounded-full bg-[#F97316] px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#EA580C]"
        >
          View Records
        </Link>

        <a
          href="https://music.youtube.com/"
          target="_blank"
          rel="noreferrer"
          aria-label="Open YouTube Music"
          className="fixed bottom-4 left-4 rounded-full border border-[#F97316]/40 bg-slate-800 p-2 shadow-lg transition-transform hover:scale-105"
        >
          <Image src={ytmIcon} alt="YouTube Music" className="h-8 w-8" priority />
        </a>
      </div>
    </main>
  );
}
