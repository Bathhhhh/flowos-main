"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (user) {
      // มีเซสชันอยู่แล้ว ให้เปิดหน้าบอร์ดทันที
      router.replace("/board");
    } else {
      // สำหรับคนเข้าเว็บครั้งแรก ขึ้นหน้าสมัครสมาชิกเป็นอันแรก ให้ผู้ใช้เลือกเองว่าจะสมัครหรือใช้แบบ Guest
      router.replace("/register");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] gap-3">
      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-zinc-500 text-xs">กำลังเตรียมระบบ…</p>
    </div>
  );
}
