"use client";

import React, { useState } from "react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done";
  priority: "low" | "medium" | "high";
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  pomodoroSessions?: number;
}

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  boardName: string;
  isShared?: boolean;
  tasks: Task[];
}

export default function AnalyticsModal({
  open,
  onClose,
  boardName,
  isShared,
  tasks,
}: AnalyticsModalProps) {
  const [tab, setTab] = useState<"overview" | "team">("overview");

  if (!open) return null;

  // 1. คำนวณภาพรวมงาน
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inprogressTasks = tasks.filter((t) => t.status === "inprogress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const completionRate =
    totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // 2. คำนวณเวลาและรอบ Pomodoro
  const totalPomodoroSessions = tasks.reduce(
    (acc, t) => acc + (t.pomodoroSessions || 0),
    0
  );
  const totalFocusMinutes = totalPomodoroSessions * 25;
  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusRemainderMinutes = totalFocusMinutes % 60;

  // 3. คำนวณความสำคัญของงาน (Priority)
  const highPriority = tasks.filter((t) => t.priority === "high");
  const mediumPriority = tasks.filter((t) => t.priority === "medium");
  const lowPriority = tasks.filter((t) => t.priority === "low");
  const pendingHigh = highPriority.filter((t) => t.status !== "done").length;

  // 4. งานที่ใช้รอบ Pomodoro สูงสุด (Top Focus Tasks)
  const topFocusTasks = [...tasks]
    .filter((t) => (t.pomodoroSessions || 0) > 0)
    .sort((a, b) => (b.pomodoroSessions || 0) - (a.pomodoroSessions || 0))
    .slice(0, 4);

  // 5. สถิติทีมและสมาชิก (Team Breakdown)
  const memberMap = new Map<
    string,
    { total: number; done: number; inprog: number; sessions: number }
  >();

  tasks.forEach((t) => {
    const name = t.createdBy || "ไม่ระบุ";
    const current = memberMap.get(name) || {
      total: 0,
      done: 0,
      inprog: 0,
      sessions: 0,
    };
    current.total += 1;
    if (t.status === "done") current.done += 1;
    if (t.status === "inprogress") current.inprog += 1;
    current.sessions += t.pomodoroSessions || 0;
    memberMap.set(name, current);
  });

  const memberStats = Array.from(memberMap.entries())
    .map(([name, stat]) => ({
      name,
      ...stat,
      rate: stat.total > 0 ? Math.round((stat.done / stat.total) * 100) : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.done - a.done);

  const topFocusMember = memberStats.length > 0 && memberStats[0].sessions > 0 ? memberStats[0] : null;

  // คำแนะนำส่วนบุคคล (Productivity Insights)
  let insightText = "กำลังทำผลงานได้ดี จัดลำดับความสำคัญและโฟกัสไปทีละงาน";
  if (completionRate >= 80 && totalTasks > 0) {
    insightText = "🎉 ผลงานยอดเยี่ยมมาก! คุณเคลียร์งานไปได้เกิน 80% แล้ว";
  } else if (pendingHigh > 2) {
    insightText = `⚠️ คุณมีงานด่วนค้างอยู่ ${pendingHigh} ชิ้น แนะนำให้ดึงเข้า In Progress และเปิด Pomodoro โฟกัสก่อน`;
  } else if (totalPomodoroSessions >= 6) {
    insightText = "🔥 วันนี้คุณมีสมาธิการทำงานที่สูงมาก สะสมเวลาโฟกัสไปหลายชั่วโมง อย่าลืมพักสายตาด้วยนะ!";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-cyan-500/20">
              📊
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>สรุปสถิติ (Analytics Dashboard)</span>
                {isShared && (
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    กระดานทีม
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                กระดาน: <span className="text-cyan-300 font-medium">&quot;{boardName}&quot;</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher (ถ้ามีมากกว่า 1 คน หรือเป็นกระดานทีม) */}
        {(isShared || memberStats.length > 1) && (
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <button
              onClick={() => setTab("overview")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                tab === "overview"
                  ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              📈 ภาพรวม & เวลาโฟกัส (Overview)
            </button>
            <button
              onClick={() => setTab("team")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                tab === "team"
                  ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>👥 สถิติสมาชิกทีม (Team Leaderboard)</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {memberStats.length}
              </span>
            </button>
          </div>
        )}

        {/* ================= TAB 1: OVERVIEW ================= */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Card 1: Completion Rate */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-400 block">อัตราความสำเร็จ</span>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  {completionRate}%
                </div>
                <div className="text-[10px] text-zinc-500">
                  เสร็จ {doneTasks.length} จาก {totalTasks} งาน
                </div>
              </div>

              {/* Card 2: Total Focus Time */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-400 block flex items-center gap-1">
                  <span>🍅</span>
                  <span>เวลาโฟกัสรวม</span>
                </span>
                <div className="text-xl font-bold font-mono text-amber-400">
                  {focusHours}ชม. {focusRemainderMinutes}น.
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  {totalPomodoroSessions} รอบ Pomodoro
                </div>
              </div>

              {/* Card 3: In Progress Workload */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-400 block">กำลังดำเนินการ</span>
                <div className="text-2xl font-bold font-mono text-amber-300">
                  {inprogressTasks.length} งาน
                </div>
                <div className="text-[10px] text-zinc-500">
                  รอทำ {todoTasks.length} งาน
                </div>
              </div>

              {/* Card 4: High Priority Pending */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[11px] text-zinc-400 block">งานด่วนคงค้าง</span>
                <div
                  className={`text-2xl font-bold font-mono ${
                    pendingHigh > 0 ? "text-red-400" : "text-emerald-400"
                  }`}
                >
                  {pendingHigh} งาน
                </div>
                <div className="text-[10px] text-zinc-500">
                  {pendingHigh === 0 ? "เคลียร์งานด่วนหมดแล้ว ✨" : "ต้องการการโฟกัส 🔥"}
                </div>
              </div>
            </div>

            {/* Task Status Progress Bar */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">สัดส่วนสถานะงาน (Task Status)</span>
                <span className="text-zinc-400 font-mono text-[11px]">
                  ทั้งหมด {totalTasks} งาน
                </span>
              </div>

              {/* Multi-segment Bar */}
              <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
                <div
                  style={{
                    width: totalTasks > 0 ? `${(doneTasks.length / totalTasks) * 100}%` : "0%",
                  }}
                  className="bg-emerald-400 transition-all duration-500"
                  title={`เสร็จสิ้น (Done): ${doneTasks.length} งาน`}
                />
                <div
                  style={{
                    width:
                      totalTasks > 0
                        ? `${(inprogressTasks.length / totalTasks) * 100}%`
                        : "0%",
                  }}
                  className="bg-amber-400 transition-all duration-500"
                  title={`กำลังทำ (In Progress): ${inprogressTasks.length} งาน`}
                />
                <div
                  style={{
                    width: totalTasks > 0 ? `${(todoTasks.length / totalTasks) * 100}%` : "0%",
                  }}
                  className="bg-cyan-400 transition-all duration-500"
                  title={`รอทำ (To Do): ${todoTasks.length} งาน`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span>Done ({doneTasks.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>In Progress ({inprogressTasks.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span>To Do ({todoTasks.length})</span>
                </div>
              </div>
            </div>

            {/* Priority Distribution & Top Focus Tasks */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority Distribution */}
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
                <span className="text-xs font-semibold text-white block">
                  ระดับความสำคัญ (Priority)
                </span>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-red-400 font-medium">ด่วน (High)</span>
                      <span className="text-zinc-400 font-mono">{highPriority.length} งาน</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        style={{
                          width:
                            totalTasks > 0
                              ? `${(highPriority.length / totalTasks) * 100}%`
                              : "0%",
                        }}
                        className="bg-red-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-amber-400 font-medium">ปานกลาง (Medium)</span>
                      <span className="text-zinc-400 font-mono">{mediumPriority.length} งาน</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        style={{
                          width:
                            totalTasks > 0
                              ? `${(mediumPriority.length / totalTasks) * 100}%`
                              : "0%",
                        }}
                        className="bg-amber-400 h-full rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-cyan-400 font-medium">ทั่วไป (Low)</span>
                      <span className="text-zinc-400 font-mono">{lowPriority.length} งาน</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        style={{
                          width:
                            totalTasks > 0
                              ? `${(lowPriority.length / totalTasks) * 100}%`
                              : "0%",
                        }}
                        className="bg-cyan-400 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Focus Tasks */}
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 space-y-3">
                <span className="text-xs font-semibold text-white block flex items-center justify-between">
                  <span>🔥 งานที่ใช้เวลาโฟกัสมากที่สุด</span>
                  <span className="text-[10px] text-zinc-500 font-normal">เรียงตาม Pomodoro</span>
                </span>

                {topFocusTasks.length === 0 ? (
                  <div className="h-28 flex flex-col items-center justify-center text-xs text-zinc-500 text-center">
                    <span>ยังไม่มีการสะสมรอบ Pomodoro</span>
                    <span className="text-[10px] text-zinc-600 mt-1">
                      ลากการ์ดเข้า In Progress เพื่อเริ่มจับเวลา
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topFocusTasks.map((t, idx) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/[0.02] border border-white/5"
                      >
                        <div className="flex items-center gap-2 truncate max-w-[170px]">
                          <span className="text-xs font-bold text-cyan-400 font-mono">
                            #{idx + 1}
                          </span>
                          <span className="text-zinc-200 truncate">{t.title}</span>
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-amber-400 shrink-0 flex items-center gap-1">
                          <span>🍅</span>
                          <span>{t.pomodoroSessions} รอบ</span>
                          <span className="text-zinc-500 text-[10px]">
                            ({(t.pomodoroSessions || 0) * 25}น.)
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Productivity Insight Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 to-blue-950/20 border border-cyan-500/20 flex items-center gap-3">
              <span className="text-xl shrink-0">💡</span>
              <div className="text-xs">
                <strong className="text-cyan-300 block font-semibold mb-0.5">
                  ข้อเสนอแนะเชิงประสิทธิภาพ (Productivity Insight):
                </strong>
                <span className="text-zinc-300 leading-relaxed">{insightText}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TEAM LEADERBOARD ================= */}
        {tab === "team" && (
          <div className="space-y-5">
            {/* Focus Champion Trophy Banner */}
            {topFocusMember && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
                    🏆
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-300 font-semibold uppercase tracking-wider font-mono">
                      แชมป์โฟกัสประจำทีม (Top Focused Member)
                    </span>
                    <h4 className="text-base font-bold text-white">
                      {topFocusMember.name}
                    </h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-amber-400">
                    🍅 {topFocusMember.sessions} รอบ
                  </span>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    ({topFocusMember.sessions * 25} นาทีโฟกัส)
                  </div>
                </div>
              </div>
            )}

            {/* Member Contributions Table */}
            <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>สมาชิก ({memberStats.length} คน)</span>
                <span>งาน / รอบ Pomodoro</span>
              </div>

              <div className="divide-y divide-white/5">
                {memberStats.map((member, index) => (
                  <div
                    key={member.name}
                    className="px-4 py-3 flex items-center justify-between text-xs hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold text-zinc-500 font-mono">
                        #{index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-cyan-400/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 font-bold text-xs">
                        {member.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {index === 0 && member.sessions > 0 && (
                            <span className="text-[10px] px-1.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                              Top Focus 🌟
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          สร้างทั้งหมด {member.total} งาน (เสร็จแล้ว {member.done} งาน · สำเร็จ {member.rate}%)
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-amber-400 font-bold flex items-center justify-end gap-1">
                        <span>🍅</span>
                        <span>{member.sessions} รอบ</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {member.sessions * 25} นาที
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 text-center">
              💡 สถิติของสมาชิกคำนวณจากชื่อเล่น (Guest หรือ Creator) ที่ผูกอยู่กับการ์ดแต่ละใบ
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
