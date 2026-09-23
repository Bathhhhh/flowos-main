"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function NicknameModal({
  open,
  onDone,
}: {
  open: boolean;
  onDone: () => void;
}) {
  const { user, saveNickname } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) { setName(""); setErr(""); }
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("กรุณากรอกชื่อเล่น"); return; }
    setBusy(true);
    try {
      await saveNickname(name.trim());
      onDone();
    } catch (e: any) {
      setErr(e.message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111118] p-6 shadow-2xl space-y-4"
      >
        <h2 className="text-lg font-bold text-white">👋 ยินดีต้อนรับ!</h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          คุณเข้าสู่ระบบแบบ <span className="text-cyan-400 font-semibold">Guest</span> อัตโนมัติแล้ว
          กรุณาตั้งชื่อเล่นเพื่อใช้งานบอร์ด
        </p>

        {user && (
          <p className="text-[11px] text-zinc-500 font-mono">
            UID: {user.id.slice(0, 12)}…
          </p>
        )}

        {err && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <input
          autoFocus
          type="text"
          maxLength={25}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น น้องโบว์, Max, Dew"
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400/50 transition"
        />

        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก…" : "เข้าใช้งานบอร์ด →"}
        </button>

        <p className="text-[11px] text-center text-zinc-500">
          ชื่อเล่นจะถูกบันทึกลง Local Storage และ Supabase
        </p>
      </form>
    </div>
  );
}
