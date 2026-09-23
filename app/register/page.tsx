"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function RegisterPage() {
  const router = useRouter();
  const { registerWithEmail, loginAnonymously } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail(email, password, name);
      router.push("/board");
    } catch (err: any) {
      const m = err?.message?.toLowerCase() ?? "";
      if (m.includes("already registered")) setError("อีเมลนี้มีบัญชีอยู่แล้ว");
      else setError(err.message || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    setGuestLoading(true);
    setError("");
    try {
      await loginAnonymously();
      router.push("/board");
    } catch (err: any) {
      console.warn("Guest sign-in fallback:", err);
      router.push("/board");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0f]">
      <div className="w-full max-w-md space-y-6 my-8">
        {/* Logo & Welcome */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-purple-500/20">
            F
          </div>
          <h1 className="text-2xl font-bold text-white">ยินดีต้อนรับสู่ Flow Board</h1>
          <p className="text-xs text-zinc-400">
            เลือกรูปแบบการใช้งานที่คุณต้องการ: สมัครสมาชิก หรือ ทดลองใช้แบบ Guest
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-5 shadow-2xl">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3.5 py-2.5">
              {error}
            </p>
          )}

          {/* ===== OPTION 1: สมัครสมาชิกผู้สร้างบอร์ด ===== */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-white/5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <h2 className="text-sm font-bold text-white">
                ตัวเลือกที่ 1: สมัครสมาชิก (ผู้สร้างบอร์ด)
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  ชื่อที่ต้องการแสดง
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น กิตติ, Boss, Dew"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50 transition"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  อีเมล <span className="text-purple-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-400/50 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    รหัสผ่าน (6+ ตัว) *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-400/50 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    ยืนยันรหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-white outline-none focus:border-purple-400/50 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || guestLoading}
                className="w-full rounded-xl bg-purple-500 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-400 disabled:opacity-40 shadow-lg shadow-purple-500/20"
              >
                {loading ? "กำลังสร้างบัญชี…" : "✨ สมัครสมาชิกผู้สร้างบอร์ด"}
              </button>
            </form>
          </div>

          {/* ===== DIVIDER ===== */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-500 font-medium">หรือ</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* ===== OPTION 2: เข้าใช้งานทันทีแบบ GUEST ===== */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h2 className="text-sm font-bold text-white">
                ตัวเลือกที่ 2: ทดลองใช้งานแบบ Guest
              </h2>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3.5 space-y-2.5">
              <p className="text-xs text-zinc-400 leading-relaxed">
                เข้าใช้งานกระดานได้ทันทีโดยไม่ต้องกรอกอีเมล สามารถตั้งชื่อเล่น จับเวลา Pomodoro และสร้างการ์ดงานได้เลย
              </p>

              <button
                type="button"
                onClick={handleGuest}
                disabled={loading || guestLoading}
                className="w-full rounded-xl border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <span>{guestLoading ? "⏳" : "👤"}</span>
                <span>
                  {guestLoading ? "กำลังเข้าใช้งาน…" : "เข้าใช้งานทันทีแบบ Guest (ไม่ต้องใช้อีเมล)"}
                </span>
              </button>
            </div>
          </div>

          {/* Footer: Link to Login */}
          <div className="pt-3 border-t border-white/5 text-center">
            <p className="text-xs text-zinc-500">
              มีบัญชีผู้สร้างบอร์ดอยู่แล้ว?{" "}
              <Link href="/login" className="text-purple-400 hover:underline font-medium">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
