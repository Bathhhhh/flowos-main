"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithEmail, loginAnonymously } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await loginWithEmail(email, password);
      router.push("/board");
    } catch (err: any) {
      const m = err?.message?.toLowerCase() ?? "";
      if (m.includes("invalid login")) setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      else if (m.includes("email not confirmed")) setError("กรุณายืนยันอีเมลก่อน");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuest() {
    try {
      await loginAnonymously();
    } catch {}
    router.push("/board");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#0a0a0f]">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center text-black font-bold text-xl">
            F
          </div>
          <h1 className="text-xl font-bold text-white mt-3">Flow Board</h1>
          <p className="text-xs text-zinc-500">เข้าสู่ระบบสำหรับผู้สร้างบอร์ด</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-[#111118] p-6 space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">อีเมล</label>
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">รหัสผ่าน</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              />
            </div>
            <button
              disabled={loading}
              className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-40"
            >
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-500">หรือ</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Guest */}
          <button
            onClick={handleGuest}
            className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300 hover:bg-white/5 transition"
          >
            👤 เข้าใช้งานแบบ Guest (ไม่ต้องใช้อีเมล)
          </button>

          <p className="text-center text-xs text-zinc-500">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="text-cyan-400 hover:underline">
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
