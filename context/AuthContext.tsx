"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, hasSupabase } from "@/lib/supabase";

/* -------- types -------- */
interface AuthCtx {
  user: User | null;
  nickname: string | null;
  isAnonymous: boolean;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  loginAnonymously: () => Promise<User>;
  saveNickname: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/* -------- helper: ดึงชื่อเล่นจาก localStorage / user_metadata -------- */
function resolveNickname(u: User | null): string | null {
  if (!u) return null;
  try {
    const cached = localStorage.getItem(`board_nick_${u.id}`);
    if (cached) return cached;
  } catch {}
  return u.user_metadata?.nickname ?? u.user_metadata?.displayName ?? null;
}

/* -------- local-only guest (ใช้เมื่อยังไม่ได้ใส่ Supabase key) -------- */
function createLocalGuest(): User {
  // ดึง guest เดิมจาก localStorage ถ้ามี
  try {
    const saved = localStorage.getItem("board_local_guest");
    if (saved) return JSON.parse(saved);
  } catch {}

  const guest: User = {
    id: "local-" + Math.random().toString(36).slice(2, 10),
    is_anonymous: true,
    email: undefined,
    user_metadata: {},
    app_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as any;

  try { localStorage.setItem("board_local_guest", JSON.stringify(guest)); } catch {}
  return guest;
}

/* -------- provider -------- */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabase) {
      // โหมด offline — ไม่เชื่อม Supabase
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setNickname(resolveNickname(data.user));
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setNickname(resolveNickname(u));
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /* 1) Email / Password — ผู้สร้างบอร์ด */
  async function loginWithEmail(email: string, password: string) {
    if (!hasSupabase) throw new Error("กรุณาใส่ Supabase URL/Key ใน .env.local ก่อน");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setNickname(resolveNickname(data.user));
    }
  }

  async function registerWithEmail(email: string, password: string, name?: string) {
    if (!hasSupabase) throw new Error("กรุณาใส่ Supabase URL/Key ใน .env.local ก่อน");
    const displayName = name?.trim() || email.split("@")[0];
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { displayName, nickname: displayName, role: "creator" } },
    });
    if (error) throw error;
    if (data.user) {
      setUser(data.user);
      setNickname(displayName);
    }
  }

  /* 2) Anonymous — Guest */
  async function loginAnonymously(): Promise<User> {
    if (!hasSupabase) {
      // โหมด offline — สร้าง guest ใน localStorage
      const guest = createLocalGuest();
      setUser(guest);
      return guest;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      // Fallback ถ้า Anonymous ยังไม่ได้เปิดใน Dashboard
      const guest = createLocalGuest();
      setUser(guest);
      return guest;
    }
    return data.user!;
  }

  /* 3) บันทึกชื่อเล่น → localStorage + Supabase user_metadata */
  async function saveNickname(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("กรุณากรอกชื่อเล่น");
    const u = user;
    if (!u) throw new Error("ยังไม่ได้เข้าสู่ระบบ");

    // Local Storage — ใช้ได้เสมอ
    localStorage.setItem(`board_nick_${u.id}`, trimmed);

    // Supabase user_metadata — ใช้ได้เมื่อเชื่อมต่อจริง
    if (hasSupabase && !u.id.startsWith("local-")) {
      try {
        await supabase.auth.updateUser({
          data: { nickname: trimmed, displayName: trimmed },
        });
      } catch {}
    }

    setNickname(trimmed);
  }

  /* 4) Logout */
  async function logout() {
    if (hasSupabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    try { localStorage.removeItem("board_local_guest"); } catch {}
    setUser(null);
    setNickname(null);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        nickname,
        isAnonymous: user?.id.startsWith("local-") || !!user?.is_anonymous,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginAnonymously,
        saveNickname,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth ต้องอยู่ภายใน <AuthProvider>");
  return c;
}
