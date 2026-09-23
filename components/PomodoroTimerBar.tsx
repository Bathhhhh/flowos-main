"use client";

import React from "react";

interface PomodoroTimerBarProps {
  timeLeft: number;
  totalDuration: number;
  isRunning: boolean;
  mode: "work" | "break";
  activeTaskTitle?: string | null;
  onTogglePause: () => void;
  onStartBreak: () => void;
  onStartWork: () => void;
  onReset: () => void;
  onQuickTest: () => void;
}

export default function PomodoroTimerBar({
  timeLeft,
  totalDuration,
  isRunning,
  mode,
  activeTaskTitle,
  onTogglePause,
  onStartBreak,
  onStartWork,
  onReset,
  onQuickTest,
}: PomodoroTimerBarProps) {
  const minutes = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timeLeft % 60).toString().padStart(2, "0");

  const progressPercent =
    totalDuration > 0
      ? Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100))
      : 0;

  const isWork = mode === "work";

  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-4 transition-all duration-300 shadow-md ${
        isWork
          ? "border-amber-500/20 bg-gradient-to-r from-[#17141f] via-[#111118] to-[#121722]"
          : "border-emerald-500/20 bg-gradient-to-r from-[#0e1d17] via-[#111118] to-[#101918]"
      }`}
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Left: Mode Badge & Active Task */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-start">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm ${
              isWork
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-400"
                : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
            }`}
          >
            {isWork ? "🍅" : "☕"}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider font-mono ${
                  isWork
                    ? "bg-amber-400/15 text-amber-300 border border-amber-400/20"
                    : "bg-emerald-400/15 text-emerald-300 border border-emerald-400/20"
                }`}
              >
                {isWork ? "Focus (25 นาที)" : "Break (พักเบรก)"}
              </span>

              {isRunning && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">กำลังนับถอยหลัง</span>
                </span>
              )}
            </div>

            <div className="text-xs text-zinc-300 mt-0.5 flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-[360px]">
              <span className="text-zinc-500 shrink-0">กำลังโฟกัส:</span>
              <span className="font-medium text-white truncate">
                {activeTaskTitle || "เลือกการ์ดใน 'In Progress' เพื่อเริ่ม"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Large Countdown Display */}
        <div className="flex flex-row md:flex-col items-center justify-center gap-2 md:gap-0 my-1 md:my-0">
          <div
            className={`text-3xl sm:text-4xl font-mono font-bold tracking-widest ${
              isWork ? "text-amber-400" : "text-emerald-400"
            }`}
            style={{
              textShadow: isWork
                ? "0 0 20px rgba(251,191,36,0.2)"
                : "0 0 20px rgba(52,211,153,0.2)",
            }}
          >
            {minutes}:{seconds}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
            {isRunning ? "TIMER RUNNING" : "PAUSED"}
          </span>
        </div>

        {/* Right: Controls (Pause, Break, Focus, Reset, Test) */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto">
          {/* Pause / Resume Button */}
          <button
            onClick={onTogglePause}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
              isRunning
                ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700"
                : "bg-amber-500 text-black hover:bg-amber-400 font-bold shadow-[0_0_12px_rgba(245,158,11,0.25)]"
            }`}
            title={isRunning ? "พักการจับเวลาชั่วคราว" : "เริ่มจับเวลาต่อ"}
          >
            <span>{isRunning ? "⏸️" : "▶️"}</span>
            <span>{isRunning ? "พัก" : "ต่อ"}</span>
          </button>

          {/* Break / Work Button */}
          {isWork ? (
            <button
              onClick={onStartBreak}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition flex items-center gap-1.5 active:scale-95"
              title="สลับไปโหมดพักเบรก 5 นาที"
            >
              <span>☕</span>
              <span>พักเบรก</span>
            </button>
          ) : (
            <button
              onClick={onStartWork}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition flex items-center gap-1.5 active:scale-95"
              title="กลับมาโฟกัสงาน 25 นาที"
            >
              <span>🍅</span>
              <span>โฟกัส (25m)</span>
            </button>
          )}

          {/* Reset Button */}
          <button
            onClick={onReset}
            className="p-2 rounded-xl text-xs text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition active:scale-95"
            title="รีเซ็ตเวลาใหม่"
          >
            🔄
          </button>

          {/* Quick Test Button */}
          <button
            onClick={onQuickTest}
            className="px-2.5 py-1.5 rounded-xl text-[11px] font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 hover:bg-cyan-900/40 transition active:scale-95"
            title="ตั้งเวลานับถอยหลัง 5 วินาที เพื่อทดสอบ"
          >
            ⚡ 5s
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-3">
        <div
          className={`h-full transition-all duration-1000 ${
            isWork
              ? "bg-gradient-to-r from-amber-500 to-orange-400"
              : "bg-gradient-to-r from-emerald-500 to-teal-400"
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
