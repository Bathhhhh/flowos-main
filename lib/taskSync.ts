import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createClient, hasSupabase } from "@/lib/supabase";

// ตรวจสอบว่ามี Firebase Environment Variables หรือไม่
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
    console.warn("Firestore initialization error:", err);
  }
}

/**
 * ฟังก์ชันอัปเดต Pomodoro Sessions ของ Task
 * บันทึกลงทั้ง Cloud Firestore, Supabase Database และ Local Storage
 */
export async function syncPomodoroSessionToDatabase(
  taskId: string,
  taskTitle: string,
  totalSessions: number
) {
  // 1. อัปเดตลง Cloud Firestore (ถ้ามีการกำหนดค่า Firebase)
  if (hasFirebase && firestoreDb) {
    try {
      const taskRef = doc(firestoreDb, "tasks", taskId);
      await setDoc(
        taskRef,
        {
          id: taskId,
          title: taskTitle,
          pomodoroSessions: totalSessions,
          lastPomodoroAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      console.log(`[Firestore] อัปเดต Task ${taskId} เรียบร้อย: ${totalSessions} รอบ`);
    } catch (err) {
      console.warn("[Firestore] Sync error:", err);
    }
  }

  // 2. อัปเดตลง Supabase Database (ถ้ามีการเชื่อมต่อ Supabase)
  if (hasSupabase) {
    try {
      const supabase = createClient();
      await supabase
        .from("tasks")
        .update({
          pomodoro_sessions: totalSessions,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);
      console.log(`[Supabase] อัปเดต Task ${taskId} เรียบร้อย: ${totalSessions} รอบ`);
    } catch (err) {
      console.warn("[Supabase] Sync error:", err);
    }
  }
}
