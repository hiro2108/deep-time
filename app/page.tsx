"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  const finishHandledRef = useRef(false);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const [restoredSession] = useState<PersistedTimerSession | null>(() =>
    readPersistedTimerSession(),
  );
  const [taskName, setTaskName] = useState(restoredSession?.taskName ?? "");
  const [category, setCategory] = useState<Category>(restoredSession?.category ?? DEFAULT_CATEGORY);
  const [mode, setMode] = useState<Mode>(restoredSession?.mode ?? "stopwatch");
  const [timerMinutes, setTimerMinutes] = useState(restoredSession?.timerMinutes ?? DEFAULT_TIMER_MINUTES);
  const [isRunning, setIsRunning] = useState(Boolean(restoredSession));
  const [elapsedTime, setElapsedTime] = useState(restoredSession?.elapsedTime ?? 0);
  const [remainingTime, setRemainingTime] = useState(
    restoredSession?.mode === "timer"
      ? restoredSession.remainingTime
      : (restoredSession?.timerMinutes ?? DEFAULT_TIMER_MINUTES) * 60,
  );
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationDraft, setDurationDraft] = useState(String(restoredSession?.timerMinutes ?? DEFAULT_TIMER_MINUTES));
  const [startTime, setStartTime] = useState<number | null>(restoredSession?.startTime ?? null);
  const [todayDuration, setTodayDuration] = useState(0);
  const [isAlarmActive, setIsAlarmActive] = useState(false);

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
    alarmAudioRef.current = new Audio("/alarm.mp3");
    alarmAudioRef.current.preload = "auto";

    return () => {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current = null;
      }
    };
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

  const getCurrentDuration = () => {
    const timerSeconds = timerMinutes * 60;
    if (mode === "stopwatch") return elapsedTime;
    return timerSeconds - remainingTime;
  };

  function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h === 0) {
      return [m, s].map((v) => v.toString().padStart(2, "0")).join(":");
    }

    return [h.toString(), m.toString().padStart(2, "0"), s.toString().padStart(2, "0")].join(":");
  }

  const formatStartTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const playAlarm = useCallback(() => {
    if (!alarmAudioRef.current) {
      return;
    }

    setIsAlarmActive(true);
    alarmAudioRef.current.loop = true;
    alarmAudioRef.current.currentTime = 0;
    void alarmAudioRef.current.play().catch(() => {
      setIsAlarmActive(false);
    });
  }, []);

  const stopAlarm = useCallback(() => {
    setIsAlarmActive(false);
    if (!alarmAudioRef.current) {
      return;
    }

    alarmAudioRef.current.pause();
    alarmAudioRef.current.currentTime = 0;
    alarmAudioRef.current.loop = false;
  }, []);

  const primeAlarmAudio = useCallback(() => {
    if (!alarmAudioRef.current) {
      return;
    }

    const previousLoop = alarmAudioRef.current.loop;
    const previousMuted = alarmAudioRef.current.muted;
    alarmAudioRef.current.loop = false;
    alarmAudioRef.current.muted = true;
    alarmAudioRef.current.currentTime = 0;

    void alarmAudioRef.current.play().then(() => {
      if (!alarmAudioRef.current) {
        return;
      }

      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
      alarmAudioRef.current.muted = previousMuted;
      alarmAudioRef.current.loop = previousLoop;
    }).catch(() => {
      if (!alarmAudioRef.current) {
        return;
      }

      alarmAudioRef.current.muted = previousMuted;
      alarmAudioRef.current.loop = previousLoop;
    });
  }, []);

  const completeAndSaveSession = useCallback(async (duration: number, source: "manual" | "auto") => {
    setIsRunning(false);
    setStartTime(null);
    localStorage.removeItem(ACTIVE_TIMER_SESSION_KEY);

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
      finishHandledRef.current = false;
      return;
    }

    const { duration: nextTodayDuration, error: durationError } = await fetchTodayDuration();
    if (!durationError) {
      setTodayDuration(nextTodayDuration);
    }

    if (source === "manual") {
      alert(`${normalizedTaskName} completed for ${formatTime(duration)}!`);
    }

    setTaskName("");
    setCategory(DEFAULT_CATEGORY);
    setElapsedTime(0);
    setRemainingTime(timerMinutes * 60);
    setStartTime(null);
  }, [category, mode, startTime, taskName, timerMinutes]);

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
          if (finishHandledRef.current) {
            return;
          }

          finishHandledRef.current = true;
          playAlarm();
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, mode, startTime, timerMinutes, playAlarm]);

  const handleStart = () => {
    finishHandledRef.current = false;
    stopAlarm();
    primeAlarmAudio();
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
    stopAlarm();
    finishHandledRef.current = true;
    await completeAndSaveSession(getCurrentDuration(), "manual");
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

  const handleTimerDisplaySetDuration = () => {
    if (mode !== "timer" || isRunning) {
      return;
    }

    setDurationDraft(String(timerMinutes));
    setIsEditingDuration(true);
  };

  const commitTimerDisplayDuration = () => {
    handleTimerMinutesChange(durationDraft);
    setIsEditingDuration(false);
  };

  const handleTimerDisplayKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleTimerDisplaySetDuration();
  };

  const handleDurationDraftKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTimerDisplayDuration();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditingDuration(false);
      setDurationDraft(String(timerMinutes));
    }
  };

  const canEditTimerDisplay = mode === "timer" && !isRunning;

  return (
    <main className={`flex min-h-screen flex-col items-center justify-center p-4 transition-colors ${
      isAlarmActive ? "bg-red-700" : isRunning ? "bg-[#112B25]" : "bg-[#0F172A]"
    }`}>
      <div className={`w-full max-w-md space-y-6 rounded-2xl border bg-slate-900 p-8 shadow-xl transition-all ${
        isRunning
          ? "border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]"
          : "border-slate-700"
      }`}>
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
          </div>

          {canEditTimerDisplay && isEditingDuration ? (
            <input
              type="number"
              min={1}
              max={180}
              step={1}
              inputMode="numeric"
              autoFocus
              value={durationDraft}
              onChange={(event) => setDurationDraft(event.target.value)}
              onBlur={commitTimerDisplayDuration}
              onKeyDown={handleDurationDraftKeyDown}
              className="w-full rounded-xl border-2 border-[#F97316] bg-slate-800/70 py-8 text-center font-mono text-6xl text-slate-100 shadow-[0_0_0_3px_rgba(249,115,22,0.15)] outline-none timer-display"
              aria-label="Set timer duration in minutes"
            />
          ) : (
            <div
              className={`rounded-xl py-8 text-center font-mono text-6xl text-slate-100 timer-display transition-all ${
                isRunning
                  ? "border-2 border-emerald-400 bg-emerald-900/20 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]"
                  : canEditTimerDisplay
                    ? "cursor-pointer border-2 border-[#F97316]/70 bg-slate-800/60 shadow-[0_0_0_2px_rgba(249,115,22,0.15)] hover:scale-[1.01] hover:border-[#FB923C] hover:bg-slate-800 active:scale-[0.99]"
                    : "cursor-default"
              }`}
              role="button"
              tabIndex={canEditTimerDisplay ? 0 : -1}
              aria-label={canEditTimerDisplay ? "Set timer duration" : "Timer display"}
              onPointerUp={handleTimerDisplaySetDuration}
              onKeyDown={handleTimerDisplayKeyDown}
            >
              {formatTime(mode === "stopwatch" ? elapsedTime : remainingTime)}
            </div>
          )}

          {canEditTimerDisplay && !isEditingDuration && (
            <p className="-mt-2 text-center text-xs font-semibold tracking-wide text-[#FDBA74]">
              Tap timer to set minutes
            </p>
          )}

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
