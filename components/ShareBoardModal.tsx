"use client";

import React, { useState } from "react";

interface ShareBoardModalProps {
  open: boolean;
  onClose: () => void;
  boardId: string;
  boardName: string;
}

export default function ShareBoardModal({
  open,
  onClose,
  boardId,
  boardName,
}: ShareBoardModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/board?id=${encodeURIComponent(boardId)}`
      : `/board?id=${encodeURIComponent(boardId)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-cyan-400/30 bg-[#111118] p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-lg">
              🔗
            </div>
            <div>
              <h3 className="text-base font-bold text-white">แชร์กระดานให้ผู้อื่น</h3>
              <p className="text-xs text-zinc-400">กระดาน: &quot;{boardName}&quot;</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Share Link Input */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 block font-medium">
            ลิงก์สำหรับแชร์กระดาน (Shareable Link)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-xs text-cyan-300 font-mono outline-none select-all"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                copied
                  ? "bg-green-500 text-black font-bold"
                  : "bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              }`}
            >
              <span>{copied ? "✅" : "📋"}</span>
              <span>{copied ? "คัดลอกแล้ว!" : "คัดลอกลิงก์"}</span>
            </button>
          </div>
        </div>

        {/* Explain how it works */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2.5 text-xs text-zinc-300">
          <h4 className="font-semibold text-white flex items-center gap-1.5">
            <span>✨</span>
            <span>เมื่อมีผู้ใช้เปิดผ่านลิงก์นี้:</span>
          </h4>
          <ul className="space-y-1.5 text-zinc-400 list-disc list-inside">
            <li>
              หากยังไม่ได้ล็อกอิน ระบบจะทำการ <strong className="text-cyan-300">Sign-in แบบ Anonymous (Guest) ให้อัตโนมัติ</strong>
            </li>
            <li>
              ระบบจะแสดง Modal ให้ <strong className="text-white">กรอกชื่อเล่น</strong> เพื่อผูกกับ UID
            </li>
            <li>
              Guest จะสามารถเข้าใช้งานกระดานนี้ เพิ่มการ์ด และจับเวลา Pomodoro ร่วมกันได้ทันที!
            </li>
          </ul>
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 text-xs font-medium text-white hover:bg-white/15 transition"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>
    </div>
  );
}
