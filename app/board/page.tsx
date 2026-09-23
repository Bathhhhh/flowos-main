"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NicknameModal from "@/components/NicknameModal";
import PomodoroTimerBar from "@/components/PomodoroTimerBar";
import ShareBoardModal from "@/components/ShareBoardModal";
import AnalyticsModal from "@/components/AnalyticsModal";
import { playPomodoroChime } from "@/lib/audio";
import { syncPomodoroSessionToDatabase } from "@/lib/taskSync";
import { syncSharedBoardToCloud, fetchSharedBoardFromCloud } from "@/lib/boardSync";

/* -------- types -------- */
type Status = "todo" | "inprogress" | "done";
type Priority = "low" | "medium" | "high";

interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  pomodoroSessions?: number; // จำนวนรอบ Pomodoro ที่ใช้ไป (นับเป็นรอบ)
  dueDate?: string; // กำหนดส่งงาน เช่น "2026-09-25"
}

interface BoardMeta {
  id: string;
  name: string;
  createdAt: string;
  isShared?: boolean;
}

const COLUMNS: { id: Status; label: string; dot: string }[] = [
  { id: "todo", label: "To Do", dot: "bg-cyan-400" },
  { id: "inprogress", label: "In Progress", dot: "bg-amber-400" },
  { id: "done", label: "Done", dot: "bg-green-400" },
];

const PRI: Record<Priority, { label: string; color: string }> = {
  high: { label: "ด่วน", color: "text-red-400 bg-red-400/10 border border-red-500/20" },
  medium: { label: "ปานกลาง", color: "text-amber-400 bg-amber-400/10 border border-amber-500/20" },
  low: { label: "ทั่วไป", color: "text-cyan-400 bg-cyan-400/10 border border-cyan-500/20" },
};

/* -------- helper: Format Due Date Badge -------- */
function formatDueDateBadge(dueDate?: string) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dueDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `⚠️ เลยกำหนด (${Math.abs(diffDays)} วัน)`,
      color: "bg-red-500/15 text-red-400 border border-red-500/30",
    };
  } else if (diffDays === 0) {
    return {
      label: "⏰ ครบกำหนดวันนี้",
      color: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    };
  } else if (diffDays === 1) {
    return {
      label: "📅 พรุ่งนี้",
      color: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
    };
  } else {
    return {
      label: `📅 ${target.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`,
      color: "bg-white/5 text-zinc-400 border border-white/10",
    };
  }
}

/* -------- Storage Helpers: แยกกระดานและงานตามบัญชีผู้ใช้ (Per-User Isolation) -------- */
function getUserBoards(userId: string): BoardMeta[] {
  try {
    const raw = localStorage.getItem(`user_boards_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}

  const defaultBoards: BoardMeta[] = [
    {
      id: "main",
      name: "กระดานส่วนตัว (My Board)",
      createdAt: new Date().toISOString(),
    },
  ];
  try {
    localStorage.setItem(`user_boards_${userId}`, JSON.stringify(defaultBoards));
  } catch {}
  return defaultBoards;
}

function saveUserBoards(userId: string, boards: BoardMeta[]) {
  try {
    localStorage.setItem(`user_boards_${userId}`, JSON.stringify(boards));
  } catch (err) {
    console.warn("Save user boards error:", err);
  }
}

function getBoardTasks(userId: string, boardId: string, authorName: string): Task[] {
  try {
    const raw = localStorage.getItem(`board_tasks_${userId}_${boardId}`);
    if (raw) return JSON.parse(raw);
  } catch {}

  // คำนวณวันพรุ่งนี้เป็นตัวอย่าง Due Date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const initialTasks: Task[] = [
    {
      id: `task_${Date.now()}_1`,
      title: "ยินดีต้อนรับสู่กระดานงานของคุณ!",
      description: "กระดานส่วนตัวเฉพาะบัญชีของคุณ หรือแชร์ลิงก์ให้เพื่อนเข้ามาร่วมใช้งานได้",
      status: "todo",
      priority: "medium",
      createdBy: authorName,
      createdAt: new Date().toISOString(),
      pomodoroSessions: 0,
      dueDate: tomorrowStr,
    },
    {
      id: `task_${Date.now()}_2`,
      title: "ทดสอบ Pomodoro 25 นาที (ลากเข้า In Progress)",
      description: "เมื่อลากการ์ดนี้เข้าคอลัมน์ In Progress ตัวจับเวลา 25 นาทีจะเริ่มนับถอยหลังอัตโนมัติ",
      status: "todo",
      priority: "high",
      createdBy: authorName,
      createdAt: new Date().toISOString(),
      pomodoroSessions: 0,
      dueDate: new Date().toISOString().split("T")[0],
    },
  ];

  try {
    localStorage.setItem(`board_tasks_${userId}_${boardId}`, JSON.stringify(initialTasks));
  } catch {}
  return initialTasks;
}

function saveBoardTasks(userId: string, boardId: string, tasks: Task[]) {
  try {
    localStorage.setItem(`board_tasks_${userId}_${boardId}`, JSON.stringify(tasks));
  } catch (err) {
    console.warn("Save board tasks error:", err);
  }
}

/* ======== INNER BOARD COMPONENT (หุ้มด้วย Suspense) ======== */
function BoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlBoardId = searchParams.get("id"); // รหัสบอร์ดจาก URL เช่น /board?id=xxx

  const { user, nickname, isAnonymous, loading, loginAnonymously, logout } = useAuth();

  // — Multi-board state (แยกตามบัญชี)
  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("main");
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // — Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [filterOnlyMine, setFilterOnlyMine] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [showNickModal, setShowNickModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // — Drag and drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  // — Pomodoro Timer state
  const WORK_SECONDS = 25 * 60; // 25 นาที (1500 วินาที)
  const BREAK_SECONDS = 5 * 60; // 5 นาที (300 วินาที)

  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState<number>(WORK_SECONDS);
  const [pomodoroDuration, setPomodoroDuration] = useState<number>(WORK_SECONDS);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState<boolean>(false);
  const [pomodoroMode, setPomodoroMode] = useState<"work" | "break">("work");
  const [activePomodoroTask, setActivePomodoroTask] = useState<{ id: string; title: string } | null>(null);
  const [pomodoroToast, setPomodoroToast] = useState<string | null>(null);

  // — Add task modal state
  const [showAdd, setShowAdd] = useState(false);
  const [addCol, setAddCol] = useState<Status>("todo");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [pri, setPri] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");

  // — Edit task modal state
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPri, setEditPri] = useState<Priority>("medium");
  const [editCol, setEditCol] = useState<Status>("todo");
  const [editDueDate, setEditDueDate] = useState("");

  /* 1) ตรวจสอบสิทธิ์การเข้าใช้งานบอร์ด */
  useEffect(() => {
    if (loading || user || signingIn) return;

    if (urlBoardId) {
      setSigningIn(true);
      loginAnonymously()
        .catch(console.error)
        .finally(() => setSigningIn(false));
    } else {
      router.replace("/register");
    }
  }, [loading, user, signingIn, urlBoardId, router]);

  /* 2) เปิด Modal ถามชื่อเล่นถ้าเป็น Guest + ยังไม่มีชื่อ */
  useEffect(() => {
    if (!loading && !signingIn && user && isAnonymous && !nickname) {
      setShowNickModal(true);
    }
  }, [loading, signingIn, user, isAnonymous, nickname]);

  /* 3) โหลดกระดานและงาน: รองรับทั้งบอร์ดส่วนตัวและบอร์ดที่เปิดผ่านลิงก์แชร์ (?id=...) */
  useEffect(() => {
    if (loading) return;

    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || (isAnonymous ? "Guest" : "ผู้สร้างบอร์ด");

    let userBoards = getUserBoards(currentUserId);

    if (urlBoardId) {
      const exists = userBoards.some((b) => b.id === urlBoardId);
      if (!exists) {
        const sharedMeta: BoardMeta = {
          id: urlBoardId,
          name: "กระดานที่แชร์ (Shared Board)",
          createdAt: new Date().toISOString(),
          isShared: true,
        };
        userBoards = [sharedMeta, ...userBoards];
        saveUserBoards(currentUserId, userBoards);
      }

      setBoards(userBoards);
      setActiveBoardId(urlBoardId);

      fetchSharedBoardFromCloud(urlBoardId).then((sharedData) => {
        if (sharedData && sharedData.tasks) {
          setTasks(sharedData.tasks);
          saveBoardTasks(currentUserId, urlBoardId, sharedData.tasks);
          if (sharedData.name) {
            setBoards((prev) =>
              prev.map((b) =>
                b.id === urlBoardId ? { ...b, name: `🔗 ${sharedData.name}` } : b
              )
            );
          }
        } else {
          const localTasks = getBoardTasks(currentUserId, urlBoardId, authorName);
          setTasks(localTasks);
        }
      });
    } else {
      setBoards(userBoards);
      const targetBoardId = userBoards[0]?.id || "main";
      setActiveBoardId(targetBoardId);
      const userTasks = getBoardTasks(currentUserId, targetBoardId, authorName);
      setTasks(userTasks);
    }

    setIsPomodoroRunning(false);
    setActivePomodoroTask(null);
    setPomodoroTimeLeft(WORK_SECONDS);
  }, [user?.id, loading, nickname, urlBoardId]);

  /* 4) Background Auto-Sync สำหรับกระดานที่แชร์ (Realtime Check ทุก 20 วิ) */
  useEffect(() => {
    if (!urlBoardId) return;

    const interval = setInterval(async () => {
      try {
        const sharedData = await fetchSharedBoardFromCloud(urlBoardId);
        if (sharedData?.tasks && JSON.stringify(sharedData.tasks) !== JSON.stringify(tasks)) {
          setTasks(sharedData.tasks);
        }
      } catch {}
    }, 20000);

    return () => clearInterval(interval);
  }, [urlBoardId, tasks]);

  /* 5) ลอจิกนับถอยหลัง Pomodoro Timer */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPomodoroRunning && pomodoroTimeLeft > 0) {
      interval = setInterval(() => {
        setPomodoroTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isPomodoroRunning && pomodoroTimeLeft <= 0) {
      handleTimerComplete();
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPomodoroRunning, pomodoroTimeLeft]);

  /* 6) ฟังก์ชันเมื่อหมดเวลา Pomodoro */
  async function handleTimerComplete() {
    setIsPomodoroRunning(false);
    playPomodoroChime();

    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "คุณ";
    const currentBoardName = boards.find((b) => b.id === activeBoardId)?.name || "กระดานส่วนตัว";

    if (pomodoroMode === "work") {
      if (activePomodoroTask) {
        const targetId = activePomodoroTask.id;
        let newCount = 1;

        setTasks((prev) => {
          const next = prev.map((t) => {
            if (t.id === targetId) {
              newCount = (t.pomodoroSessions || 0) + 1;
              return {
                ...t,
                pomodoroSessions: newCount,
                updatedAt: new Date().toISOString(),
              };
            }
            return t;
          });
          saveBoardTasks(currentUserId, activeBoardId, next);
          syncSharedBoardToCloud(activeBoardId, currentBoardName, next, authorName);
          return next;
        });

        await syncPomodoroSessionToDatabase(targetId, activePomodoroTask.title, newCount);

        setPomodoroToast(
          `🎉 ครบ 25 นาทีแล้ว! บันทึกรอบ Pomodoro สำหรับ "${activePomodoroTask.title}" เรียบร้อย (รวมเป็น ${newCount} รอบ)`
        );
      } else {
        setPomodoroToast("🎉 ครบเวลาโฟกัส 25 นาทีแล้ว!");
      }

      setPomodoroMode("break");
      setPomodoroDuration(BREAK_SECONDS);
      setPomodoroTimeLeft(BREAK_SECONDS);
      setIsPomodoroRunning(true);
    } else {
      setPomodoroToast("⏰ หมดเวลาพักเบรกแล้ว พร้อมเริ่มงานรอบต่อไป!");
      setPomodoroMode("work");
      setPomodoroDuration(WORK_SECONDS);
      setPomodoroTimeLeft(WORK_SECONDS);
    }

    setTimeout(() => {
      setPomodoroToast(null);
    }, 6000);
  }

  function startPomodoroForTask(task: { id: string; title: string }) {
    setActivePomodoroTask({ id: task.id, title: task.title });
    setPomodoroMode("work");
    setPomodoroDuration(WORK_SECONDS);
    setPomodoroTimeLeft(WORK_SECONDS);
    setIsPomodoroRunning(true);

    setPomodoroToast(`🍅 เริ่มนับถอยหลัง 25 นาทีอัตโนมัติสำหรับ: "${task.title}"`);
    setTimeout(() => setPomodoroToast(null), 4000);
  }

  /* ---- Board Switching & Management ---- */
  function handleSwitchBoard(boardId: string) {
    setActiveBoardId(boardId);
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "คุณ";
    const boardTasks = getBoardTasks(currentUserId, boardId, authorName);
    setTasks(boardTasks);

    setIsPomodoroRunning(false);
    setActivePomodoroTask(null);
    setPomodoroTimeLeft(WORK_SECONDS);
  }

  function handleCreateNewBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    const currentUserId = user?.id || "guest_default";
    const newBoard: BoardMeta = {
      id: `b_${Date.now()}`,
      name: newBoardName.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextBoards = [...boards, newBoard];
    setBoards(nextBoards);
    saveUserBoards(currentUserId, nextBoards);

    setActiveBoardId(newBoard.id);
    setTasks([]);
    saveBoardTasks(currentUserId, newBoard.id, []);

    setNewBoardName("");
    setShowNewBoardModal(false);

    setPomodoroToast(`✨ สร้างกระดานส่วนตัวใหม่ "${newBoard.name}" สำเร็จ!`);
    setTimeout(() => setPomodoroToast(null), 3000);
  }

  function handleDeleteBoard(boardId: string) {
    if (boards.length <= 1) {
      alert("ไม่สามารถลบกระดานสุดท้ายได้ครับ");
      return;
    }
    const boardToDelete = boards.find((b) => b.id === boardId);
    if (!confirm(`คุณต้องการลบกระดาน "${boardToDelete?.name || ""}" หรือไม่?`)) return;

    const currentUserId = user?.id || "guest_default";
    const nextBoards = boards.filter((b) => b.id !== boardId);
    setBoards(nextBoards);
    saveUserBoards(currentUserId, nextBoards);

    try {
      localStorage.removeItem(`board_tasks_${currentUserId}_${boardId}`);
    } catch {}

    const fallbackBoardId = nextBoards[0].id;
    handleSwitchBoard(fallbackBoardId);
  }

  function handleOpenShareModal() {
    const currentBoard = boards.find((b) => b.id === activeBoardId) || boards[0];
    const authorName = nickname || user?.email?.split("@")[0] || "ผู้สร้างบอร์ด";
    syncSharedBoardToCloud(activeBoardId, currentBoard?.name || "Shared Board", tasks, authorName);
    setShowShareModal(true);
  }

  /* ---- Live Refresh / Sync Handler ---- */
  async function handleLiveRefresh() {
    setIsSyncing(true);
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "ผู้ใช้";

    try {
      if (urlBoardId) {
        const sharedData = await fetchSharedBoardFromCloud(urlBoardId);
        if (sharedData?.tasks) {
          setTasks(sharedData.tasks);
          saveBoardTasks(currentUserId, urlBoardId, sharedData.tasks);
          setPomodoroToast("🔄 ซิงค์ข้อมูลล่าสุดจาก Cloud เรียบร้อยแล้ว!");
        }
      } else {
        const localTasks = getBoardTasks(currentUserId, activeBoardId, authorName);
        setTasks(localTasks);
        setPomodoroToast("🔄 อัปเดตข้อมูลกระดานเรียบร้อยแล้ว");
      }
    } catch (e) {
      console.warn("Live refresh error:", e);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setPomodoroToast(null);
      }, 2000);
    }
  }

  /* ---- Task Actions ---- */
  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || (isAnonymous ? "Guest" : "ผู้สร้างบอร์ด");
    const currentBoard = boards.find((b) => b.id === activeBoardId);

    const t: Task = {
      id: Date.now().toString(),
      title: title.trim(),
      description: desc.trim(),
      status: addCol,
      priority: pri,
      dueDate: dueDate || undefined,
      createdBy: authorName,
      createdAt: new Date().toISOString(),
      pomodoroSessions: 0,
    };
    const next = [t, ...tasks];
    setTasks(next);
    saveBoardTasks(currentUserId, activeBoardId, next);

    syncSharedBoardToCloud(activeBoardId, currentBoard?.name || "Board", next, authorName);

    setTitle("");
    setDesc("");
    setPri("medium");
    setDueDate("");
    setShowAdd(false);

    if (addCol === "inprogress") {
      startPomodoroForTask(t);
    }
  }

  function moveTask(id: string, to: Status) {
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "ผู้ใช้";
    const currentBoard = boards.find((b) => b.id === activeBoardId);

    const targetTask = tasks.find((t) => t.id === id);
    const next = tasks.map((t) =>
      t.id === id ? { ...t, status: to, updatedAt: new Date().toISOString() } : t
    );
    setTasks(next);
    saveBoardTasks(currentUserId, activeBoardId, next);

    syncSharedBoardToCloud(activeBoardId, currentBoard?.name || "Board", next, authorName);

    if (to === "inprogress" && targetTask) {
      startPomodoroForTask(targetTask);
    }
  }

  function deleteTask(id: string) {
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "ผู้ใช้";
    const currentBoard = boards.find((b) => b.id === activeBoardId);

    const next = tasks.filter((t) => t.id !== id);
    setTasks(next);
    saveBoardTasks(currentUserId, activeBoardId, next);

    syncSharedBoardToCloud(activeBoardId, currentBoard?.name || "Board", next, authorName);

    if (editingTask?.id === id) {
      setEditingTask(null);
    }
    if (activePomodoroTask?.id === id) {
      setActivePomodoroTask(null);
    }
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
    setEditPri(task.priority);
    setEditCol(task.status);
    setEditDueDate(task.dueDate || "");
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    const currentUserId = user?.id || "guest_default";
    const authorName = nickname || user?.email?.split("@")[0] || "ผู้ใช้";
    const currentBoard = boards.find((b) => b.id === activeBoardId);

    const next = tasks.map((t) =>
      t.id === editingTask.id
        ? {
            ...t,
            title: editTitle.trim(),
            description: editDesc.trim(),
            priority: editPri,
            status: editCol,
            dueDate: editDueDate || undefined,
            updatedAt: new Date().toISOString(),
          }
        : t
    );
    setTasks(next);
    saveBoardTasks(currentUserId, activeBoardId, next);

    syncSharedBoardToCloud(activeBoardId, currentBoard?.name || "Board", next, authorName);

    if (editCol === "inprogress" && editingTask.status !== "inprogress") {
      startPomodoroForTask({ id: editingTask.id, title: editTitle.trim() });
    }

    setEditingTask(null);
  }

  /* ---- Drag and Drop Handlers ---- */
  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverCol(null);
  }

  function handleDragOver(e: React.DragEvent, colId: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overCol !== colId) {
      setOverCol(colId);
    }
  }

  function handleDragLeave(e: React.DragEvent, colId: Status) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (overCol === colId) {
      setOverCol(null);
    }
  }

  function handleDrop(e: React.DragEvent, colId: Status) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      moveTask(taskId, colId);
    }
    setOverCol(null);
    setDraggingId(null);
  }

  /* ---- Pomodoro Handlers ---- */
  function handleTogglePause() {
    setIsPomodoroRunning(!isPomodoroRunning);
  }

  function handleStartBreak() {
    setPomodoroMode("break");
    setPomodoroDuration(BREAK_SECONDS);
    setPomodoroTimeLeft(BREAK_SECONDS);
    setIsPomodoroRunning(true);
    setPomodoroToast("☕ สลับเข้าสู่โหมดพักเบรก (Break 5 นาที)");
    setTimeout(() => setPomodoroToast(null), 3000);
  }

  function handleStartWork() {
    setPomodoroMode("work");
    setPomodoroDuration(WORK_SECONDS);
    setPomodoroTimeLeft(WORK_SECONDS);
    setIsPomodoroRunning(true);
    setPomodoroToast("🍅 สลับเข้าสู่โหมดโฟกัสงาน (Focus 25 นาที)");
    setTimeout(() => setPomodoroToast(null), 3000);
  }

  function handleResetTimer() {
    setIsPomodoroRunning(false);
    setPomodoroTimeLeft(pomodoroDuration);
  }

  function handleQuickTest() {
    setPomodoroTimeLeft(5);
    setIsPomodoroRunning(true);
    setPomodoroToast("⚡ ตั้งเวลานับถอยหลัง 5 วินาที เพื่อทดสอบเสียงแจ้งเตือนและการนับรอบ Pomodoro ทันที!");
    setTimeout(() => setPomodoroToast(null), 3500);
  }

  /* ---- Filtering Logic (ค้นหาและกรองการ์ดงาน) ---- */
  const displayName = nickname || user?.email?.split("@")[0] || (isAnonymous ? "Guest" : "ผู้สร้างบอร์ด");
  const currentBoard = boards.find((b) => b.id === activeBoardId) || boards[0];

  const displayedTasks = tasks.filter((t) => {
    // 1. กรองตาม Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || "").toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    // 2. กรองตามระดับความสำคัญ
    if (filterPriority !== "all" && t.priority !== filterPriority) {
      return false;
    }
    // 3. กรองเฉพาะงานของฉัน
    if (filterOnlyMine && t.createdBy !== displayName) {
      return false;
    }
    return true;
  });

  /* ---- Loading Screen ---- */
  if (loading || signingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-zinc-400">กำลังเตรียมกระดานของคุณ…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-200 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* ===== TOP BAR (Minimal & Mobile-friendly) ===== */}
      <header className="border-b border-white/5 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        {/* Left: Logo & Board Selector */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-black font-bold text-sm shadow-[0_0_12px_rgba(6,182,212,0.25)] shrink-0">
            F
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight block">Flow Board</span>
            <span className="text-[10px] text-zinc-500 hidden sm:block leading-tight font-mono">
              Kanban · Pomodoro 25m
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

          {/* Board Selector & Quick Actions */}
          <div className="flex items-center gap-1.5">
            <select
              value={activeBoardId}
              onChange={(e) => handleSwitchBoard(e.target.value)}
              className="bg-[#17141f] border border-white/10 hover:border-cyan-400/40 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer transition font-medium max-w-[130px] sm:max-w-[200px] truncate"
              title="สลับกระดาน"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.isShared ? "🔗 " : "📋 "}
                  {b.name}
                </option>
              ))}
            </select>

            {/* ปุ่มสร้างกระดานใหม่ */}
            <button
              onClick={() => setShowNewBoardModal(true)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition flex items-center gap-1 active:scale-95"
              title="สร้างกระดานส่วนตัวเพิ่ม"
            >
              <span>+</span>
              <span className="hidden md:inline">กระดานใหม่</span>
            </button>

            {/* ปุ่มลบกระดาน */}
            {boards.length > 1 && (
              <button
                onClick={() => handleDeleteBoard(activeBoardId)}
                className="p-1.5 rounded-xl text-xs text-zinc-500 hover:text-red-400 hover:bg-red-400/10 border border-white/5 transition active:scale-95"
                title="ลบกระดานปัจจุบัน"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions (Analytics, Share, Add Task, User Badge, Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* ปุ่มดูสถิติ (Analytics Button) */}
          <button
            onClick={() => setShowAnalyticsModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-cyan-300 hover:bg-cyan-500/10 hover:border-cyan-500/25 transition flex items-center gap-1.5 active:scale-95 shadow-sm"
            title="ดูสรุปสถิติและประสิทธิภาพ (Analytics Dashboard)"
          >
            <span>📊</span>
            <span className="hidden sm:inline">สถิติ</span>
          </button>

          {/* ปุ่มแชร์กระดาน (Share Button) */}
          <button
            onClick={handleOpenShareModal}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-400 hover:to-indigo-500 transition flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.25)] active:scale-95"
            title="แชร์ลิงก์กระดานนี้ให้เพื่อนหรือ Guest ใช้งานร่วมกัน"
          >
            <span>🔗</span>
            <span className="hidden sm:inline">แชร์</span>
          </button>

          {/* ปุ่มเพิ่มงาน */}
          <button
            onClick={() => {
              setAddCol("todo");
              setShowAdd(true);
            }}
            className="px-2.5 py-1.5 sm:px-3 rounded-xl text-xs font-semibold bg-cyan-500 text-black hover:bg-cyan-400 transition flex items-center gap-1 shadow-[0_0_12px_rgba(6,182,212,0.25)] active:scale-95"
          >
            <span>+</span>
            <span className="hidden sm:inline">เพิ่มงาน</span>
          </button>

          {/* User badge */}
          <div className="flex items-center gap-1.5 text-xs bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5">
            <span className="w-4 h-4 rounded-md flex items-center justify-center text-[10px] font-bold text-black bg-cyan-400 shrink-0">
              {displayName[0]?.toUpperCase()}
            </span>
            <span className="text-zinc-300 font-medium max-w-[80px] sm:max-w-[120px] truncate text-[11px] sm:text-xs">
              {displayName}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition active:scale-95"
            title="ออกจากระบบ / สลับบัญชี"
          >
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* ===== SUB-TOOLBAR: Search, Filter & Live Sync (Minimal & Responsive) ===== */}
      <div className="border-b border-white/5 bg-white/[0.015] px-3 sm:px-6 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1 max-w-full md:max-w-md">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่องาน หรือรายละเอียด..."
              className="w-full bg-[#111118] border border-white/10 hover:border-white/20 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400/40 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white p-0.5"
                title="ล้างคำค้นหา"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills & Live Refresh */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-[11px] text-zinc-500 shrink-0 hidden lg:inline font-mono">กรอง:</span>

            {/* Filter: All */}
            <button
              onClick={() => setFilterPriority("all")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 active:scale-95 ${
                filterPriority === "all"
                  ? "bg-white/15 text-white border border-white/20 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5"
              }`}
            >
              ทั้งหมด ({tasks.length})
            </button>

            {/* Filter: High */}
            <button
              onClick={() => setFilterPriority(filterPriority === "high" ? "all" : "high")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 active:scale-95 ${
                filterPriority === "high"
                  ? "bg-red-500/20 text-red-300 border border-red-500/40 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-red-300 bg-white/5 hover:bg-red-500/10 border border-white/5"
              }`}
            >
              🔥 ด่วน
            </button>

            {/* Filter: Medium */}
            <button
              onClick={() => setFilterPriority(filterPriority === "medium" ? "all" : "medium")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 active:scale-95 ${
                filterPriority === "medium"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-amber-300 bg-white/5 hover:bg-amber-500/10 border border-white/5"
              }`}
            >
              ปานกลาง
            </button>

            {/* Filter: Low */}
            <button
              onClick={() => setFilterPriority(filterPriority === "low" ? "all" : "low")}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 active:scale-95 ${
                filterPriority === "low"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-cyan-300 bg-white/5 hover:bg-cyan-500/10 border border-white/5"
              }`}
            >
              ทั่วไป
            </button>

            {/* Filter: Only Mine */}
            <button
              onClick={() => setFilterOnlyMine(!filterOnlyMine)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 flex items-center gap-1 active:scale-95 ${
                filterOnlyMine
                  ? "bg-purple-500/25 text-purple-300 border border-purple-500/40 font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-purple-300 bg-white/5 hover:bg-purple-500/10 border border-white/5"
              }`}
              title="แสดงเฉพาะงานที่คุณสร้าง"
            >
              <span>👤</span>
              <span>งานของฉัน</span>
            </button>

            {/* Live Refresh Button */}
            <button
              onClick={handleLiveRefresh}
              disabled={isSyncing}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border border-white/10 transition shrink-0 flex items-center gap-1 active:scale-95"
              title="ซิงค์และอัปเดตข้อมูลล่าสุดจาก Cloud"
            >
              <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
              <span className="hidden sm:inline">{isSyncing ? "กำลังซิงค์…" : "ซิงค์"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 p-3 sm:p-6 overflow-auto space-y-4">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* ===== 1. POMODORO TIMER BAR ===== */}
          <PomodoroTimerBar
            timeLeft={pomodoroTimeLeft}
            totalDuration={pomodoroDuration}
            isRunning={isPomodoroRunning}
            mode={pomodoroMode}
            activeTaskTitle={activePomodoroTask?.title}
            onTogglePause={handleTogglePause}
            onStartBreak={handleStartBreak}
            onStartWork={handleStartWork}
            onReset={handleResetTimer}
            onQuickTest={handleQuickTest}
          />

          {/* ===== 2. KANBAN BOARD COLUMNS (Responsive 1-col on mobile, 3-col on desktop) ===== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = displayedTasks.filter((t) => t.status === col.id);
              const isColumnOver = overCol === col.id;

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`rounded-2xl border p-3.5 sm:p-4 min-h-[380px] sm:min-h-[480px] flex flex-col transition-all duration-200 ${
                    isColumnOver
                      ? "border-cyan-400/50 bg-cyan-950/20 ring-2 ring-cyan-400/30 scale-[1.008]"
                      : "border-white/5 bg-[#111118]"
                  }`}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-sm font-semibold text-white">{col.label}</span>
                      {col.id === "inprogress" && (
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          🍅 25m
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                        {colTasks.length}
                      </span>
                      <button
                        onClick={() => {
                          setAddCol(col.id);
                          setShowAdd(true);
                        }}
                        className="text-zinc-500 hover:text-cyan-400 text-sm px-1.5 py-0.5 rounded hover:bg-white/5"
                        title={`เพิ่มการ์ดใน ${col.label}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div className="space-y-3 flex-1">
                    {colTasks.length === 0 ? (
                      <div
                        onClick={() => {
                          setAddCol(col.id);
                          setShowAdd(true);
                        }}
                        className={`w-full h-28 rounded-xl border border-dashed flex flex-col items-center justify-center text-xs cursor-pointer transition ${
                          isColumnOver
                            ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
                            : "border-white/10 text-zinc-600 hover:text-cyan-400 hover:border-cyan-400/30"
                        }`}
                      >
                        <span>
                          {isColumnOver
                            ? "ปล่อยการ์ดที่นี่ ✨"
                            : searchQuery || filterPriority !== "all"
                            ? "ไม่พบงานที่ตรงกับเงื่อนไขกรอง"
                            : col.id === "inprogress"
                            ? "ลากการ์ดมาที่นี่เพื่อเริ่ม Pomodoro"
                            : "+ เพิ่มงานที่นี่ หรือลากมาวาง"}
                        </span>
                      </div>
                    ) : null}

                    {colTasks.map((task) => {
                      const isDragging = draggingId === task.id;
                      const isTaskActiveTimer = activePomodoroTask?.id === task.id;
                      const dueBadge = formatDueDateBadge(task.dueDate);

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          className={`rounded-xl border p-3.5 space-y-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing group ${
                            isDragging
                              ? "opacity-30 border-cyan-400/50 scale-95 shadow-inner"
                              : isTaskActiveTimer && isPomodoroRunning
                              ? "border-amber-400/60 bg-amber-500/[0.04] ring-2 ring-amber-400/30 shadow-[0_0_15px_rgba(245,158,11,0.12)]"
                              : "border-white/5 bg-white/[0.02] hover:border-cyan-400/30 hover:bg-white/[0.04] shadow-sm hover:shadow-md"
                          }`}
                        >
                          {/* Top: Priority, Due Date, Pomodoro Badge & Action Buttons */}
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${PRI[task.priority].color}`}>
                                {PRI[task.priority].label}
                              </span>

                              {/* Due Date Badge */}
                              {dueBadge && (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full ${dueBadge.color}`}>
                                  {dueBadge.label}
                                </span>
                              )}

                              {/* Pomodoro Sessions Badge */}
                              {typeof task.pomodoroSessions === "number" && task.pomodoroSessions > 0 ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 shadow-sm"
                                  title={`Task นี้ใช้เวลาไปแล้ว ${task.pomodoroSessions} Pomodoro Sessions`}
                                >
                                  <span>🍅</span>
                                  <span>{task.pomodoroSessions}</span>
                                </span>
                              ) : null}

                              {/* Active Timer Indicator */}
                              {isTaskActiveTimer && isPomodoroRunning && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                  <span>🔥</span>
                                  <span>กำลังโฟกัส</span>
                                </span>
                              )}
                            </div>

                            {/* Actions: Quick move buttons are visible by default on mobile for easy touch access */}
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Pomodoro trigger button */}
                              {task.status === "inprogress" && !isTaskActiveTimer && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startPomodoroForTask(task);
                                  }}
                                  className="px-1.5 py-0.5 rounded text-[10px] text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 active:scale-95"
                                  title="จับเวลา Pomodoro สำหรับการ์ดนี้"
                                >
                                  🍅 จับเวลานี้
                                </button>
                              )}

                              {/* Quick move left */}
                              {task.status !== "todo" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveTask(task.id, task.status === "done" ? "inprogress" : "todo");
                                  }}
                                  className="px-1.5 py-0.5 rounded text-xs text-zinc-400 hover:bg-white/10 active:scale-95"
                                  title="ย้ายกลับ"
                                >
                                  ←
                                </button>
                              )}

                              {/* Quick move right */}
                              {task.status !== "done" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveTask(task.id, task.status === "todo" ? "inprogress" : "done");
                                  }}
                                  className="px-1.5 py-0.5 rounded text-xs text-zinc-400 hover:bg-white/10 active:scale-95"
                                  title="ย้ายไปข้างหน้า"
                                >
                                  →
                                </button>
                              )}

                              {/* Edit button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(task);
                                }}
                                className="px-1.5 py-0.5 rounded text-xs text-cyan-400 hover:bg-cyan-400/10 active:scale-95"
                                title="แก้ไขเนื้อหาการ์ด"
                              >
                                ✏️
                              </button>

                              {/* Delete button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                }}
                                className="px-1.5 py-0.5 rounded text-xs text-zinc-500 hover:text-red-400 hover:bg-red-400/10 active:scale-95"
                                title="ลบการ์ดงาน"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Title (clickable to edit) */}
                          <h4
                            onClick={() => openEditModal(task)}
                            className="text-sm font-medium text-white hover:text-cyan-300 transition-colors cursor-pointer leading-snug"
                            title="คลิกเพื่อแก้ไข"
                          >
                            {task.title}
                          </h4>

                          {/* Description (clickable to edit) */}
                          {task.description && (
                            <p
                              onClick={() => openEditModal(task)}
                              className="text-xs text-zinc-400 leading-relaxed cursor-pointer hover:text-zinc-300 line-clamp-3"
                              title="คลิกเพื่อแก้ไข"
                            >
                              {task.description}
                            </p>
                          )}

                          {/* Footer: Creator & Edit link */}
                          <div className="pt-2 border-t border-white/5 text-[11px] text-zinc-500 flex items-center justify-between">
                            <span className="flex items-center gap-1 truncate max-w-[130px]">
                              <span>👤</span>
                              <span>{task.createdBy}</span>
                            </span>
                            <span
                              onClick={() => openEditModal(task)}
                              className="text-[10px] text-zinc-500 hover:text-cyan-400 cursor-pointer"
                            >
                              คลิกแก้ไข ✏️
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ===== MODAL: SHARE BOARD MODAL ===== */}
      <ShareBoardModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        boardId={activeBoardId}
        boardName={currentBoard?.name || "กระดาน"}
      />

      {/* ===== MODAL: ANALYTICS MODAL (สถิติกระดานส่วนตัวและทีม) ===== */}
      <AnalyticsModal
        open={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        boardName={currentBoard?.name || "กระดาน"}
        isShared={currentBoard?.isShared}
        tasks={tasks}
      />

      {/* ===== TOAST NOTIFICATION ===== */}
      {pomodoroToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 bg-[#17141f] border border-amber-400/40 text-amber-200 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-medium animate-fade-in backdrop-blur-md max-w-sm">
          <span className="text-base shrink-0">🔔</span>
          <span className="truncate">{pomodoroToast}</span>
        </div>
      )}

      {/* ===== MODAL: NICKNAME MODAL ===== */}
      <NicknameModal open={showNickModal} onDone={() => setShowNickModal(false)} />

      {/* ===== MODAL: CREATE NEW BOARD MODAL ===== */}
      {showNewBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleCreateNewBoard}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111118] p-5 sm:p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white">📋 สร้างกระดานใหม่</h3>
              <button
                type="button"
                onClick={() => setShowNewBoardModal(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">
                ชื่อกระดาน <span className="text-cyan-400">*</span>
              </label>
              <input
                autoFocus
                required
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="เช่น งานส่วนตัว, โปรเจกต์จบ, Sprint 2"
                maxLength={30}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              />
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              💡 คุณสามารถสร้างกระดานแยกได้ตามต้องการ และสามารถกดปุ่มแชร์เพื่อส่งให้เพื่อนมาร่วมใช้งานได้
            </p>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowNewBoardModal(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-400 hover:bg-white/5"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!newBoardName.trim()}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-40 transition"
              >
                สร้างกระดาน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== MODAL: ADD TASK MODAL (พร้อม Due Date & Responsive) ===== */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <form
            onSubmit={addTask}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111118] p-5 sm:p-6 space-y-4 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <h3 className="text-base sm:text-lg font-bold text-white">
                เพิ่มการ์ดงาน ({currentBoard?.name})
              </h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="text-zinc-500 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">ชื่องาน *</label>
              <input
                autoFocus
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ออกแบบหน้าแดชบอร์ดใหม่"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">รายละเอียด</label>
              <textarea
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติมของงาน..."
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none resize-none focus:border-cyan-400/50 transition"
              />
            </div>

            {/* Priority & Column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">ความสำคัญ</label>
                <select
                  value={pri}
                  onChange={(e) => setPri(e.target.value as Priority)}
                  className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="low">ทั่วไป</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">ด่วน</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">คอลัมน์เริ่มต้น</label>
                <select
                  value={addCol}
                  onChange={(e) => setAddCol(e.target.value as Status)}
                  className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress (เริ่มจับเวลา)</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Due Date Picker */}
            <div>
              <label className="text-xs text-zinc-400 block mb-1">📅 กำหนดส่งงาน (Due Date)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400/50 transition [color-scheme:dark]"
              />
            </div>

            <div className="pt-1 text-xs text-zinc-500">
              สร้างในนาม: <strong className="text-white">{displayName}</strong>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-400 hover:bg-white/5"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-40"
              >
                บันทึก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===== MODAL: EDIT TASK MODAL (พร้อม Due Date & Responsive) ===== */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#111118] p-5 sm:p-6 space-y-4 shadow-2xl my-auto"
          >
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-base">✏️</span>
                <h3 className="text-base sm:text-lg font-bold text-white">แก้ไขการ์ดงาน</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="text-zinc-500 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">ชื่องาน *</label>
              <input
                autoFocus
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50 transition"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">รายละเอียด</label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="รายละเอียดเพิ่มเติมของงาน..."
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none resize-none focus:border-cyan-400/50 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">ความสำคัญ</label>
                <select
                  value={editPri}
                  onChange={(e) => setEditPri(e.target.value as Priority)}
                  className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="low">ทั่วไป</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">ด่วน</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">ย้ายไปคอลัมน์</label>
                <select
                  value={editCol}
                  onChange={(e) => setEditCol(e.target.value as Status)}
                  className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3 py-2 text-xs text-white outline-none"
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Due Date Edit */}
            <div>
              <label className="text-xs text-zinc-400 block mb-1">📅 กำหนดส่งงาน (Due Date)</label>
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="w-full rounded-xl bg-[#1a1a24] border border-white/10 px-3.5 py-2 text-xs text-white outline-none focus:border-cyan-400/50 transition [color-scheme:dark]"
              />
            </div>

            {/* Pomodoro Sessions stat info */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span>🍅</span>
                <span>รอบ Pomodoro ที่ใช้ไป:</span>
              </span>
              <span className="font-mono font-bold text-red-400">
                {editingTask.pomodoroSessions || 0} รอบ
              </span>
            </div>

            <div className="pt-1 text-[11px] text-zinc-500 flex items-center justify-between">
              <span>
                สร้างโดย: <strong className="text-zinc-300">{editingTask.createdBy}</strong>
              </span>
              <button
                type="button"
                onClick={() => deleteTask(editingTask.id)}
                className="text-red-400/80 hover:text-red-400 underline"
              >
                ลบการ์ดนี้
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-400 hover:bg-white/5"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!editTitle.trim()}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-40"
              >
                บันทึกการแก้ไข
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ======== ROOT EXPORT (WITH SUSPENSE FOR NEXT.JS) ======== */
export default function BoardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-zinc-500 text-xs">
          กำลังโหลดบอร์ด...
        </div>
      }
    >
      <BoardContent />
    </Suspense>
  );
}
