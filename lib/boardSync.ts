import { createClient, hasSupabase } from "@/lib/supabase";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export interface SharedBoardData {
  id: string;
  name: string;
  creatorName: string;
  tasks: any[];
  updatedAt: string;
}

// ตรวจสอบ Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasFirebase = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);
let firestoreDb: any = null;
if (hasFirebase) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    firestoreDb = getFirestore(app);
  } catch (err) {
    console.warn("Firestore init error in boardSync:", err);
  }
}

/**
 * เผยแพร่/อัปเดตข้อมูลกระดานที่แชร์ (Cloud & Local Sync)
 */
export async function syncSharedBoardToCloud(
  boardId: string,
  boardName: string,
  tasks: any[],
  creatorName: string
) {
  const payload: SharedBoardData = {
    id: boardId,
    name: boardName,
    creatorName,
    tasks,
    updatedAt: new Date().toISOString(),
  };

  // 1. บันทึกลง Shared Local Pool (สำหรับเปิดในแท็บใหม่ / โหมด Incognito ในเครื่องเดียวกัน)
  try {
    localStorage.setItem(`shared_board_${boardId}`, JSON.stringify(payload));
  } catch {}

  // 2. ซิงค์ลง Supabase (ถ้ามีตาราง shared_boards)
  if (hasSupabase) {
    try {
      const supabase = createClient();
      await supabase.from("shared_boards").upsert(
        {
          id: boardId,
          name: boardName,
          creator_name: creatorName,
          tasks: tasks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.warn("[Supabase] syncSharedBoard error (ตารางอาจยังไม่ถูกสร้าง):", err);
    }
  }

  // 3. ซิงค์ลง Cloud Firestore (ถ้ามีการกำหนดค่า Firebase)
  if (hasFirebase && firestoreDb) {
    try {
      const ref = doc(firestoreDb, "shared_boards", boardId);
      await setDoc(
        ref,
        {
          id: boardId,
          name: boardName,
          creatorName,
          tasks,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn("[Firestore] syncSharedBoard error:", err);
    }
  }
}

/**
 * ดึงข้อมูลกระดานที่ถูกแชร์จาก Cloud หรือ Shared Local Pool
 */
export async function fetchSharedBoardFromCloud(
  boardId: string
): Promise<SharedBoardData | null> {
  // 1. ลองดึงจาก Supabase
  if (hasSupabase) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("shared_boards")
        .select("*")
        .eq("id", boardId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          creatorName: data.creator_name,
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
          updatedAt: data.updated_at,
        };
      }
    } catch {}
  }

  // 2. ลองดึงจาก Firestore
  if (hasFirebase && firestoreDb) {
    try {
      const ref = doc(firestoreDb, "shared_boards", boardId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data();
        return {
          id: d.id,
          name: d.name,
          creatorName: d.creatorName,
          tasks: Array.isArray(d.tasks) ? d.tasks : [],
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        };
      }
    } catch {}
  }

  // 3. ดึงจาก Shared Local Pool
  try {
    const raw = localStorage.getItem(`shared_board_${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}

  return null;
}
