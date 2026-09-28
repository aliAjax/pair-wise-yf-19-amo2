// 规则层：排期规则
// 1. 每条排期写明柜位、优先级、预计时长
// 2. 同一柜位同一时段不能排两项（顺序排布、互不重叠）
// 3. 加急任务插入到同柜所有普通任务之前，后续普通任务顺延
// 4. 已取件 / 拍摄中 / 已归柜为锁定块，不再移动；待排/补拍任务排在锁定块之后
// 5. 照片缺失或标签不清 -> 退回补拍，原柜位保留，重新排队等待取件

import { DAY_END_MIN, DAY_START_MIN } from "./seed";
import type { InsertResult, Priority, ReworkReason, ScheduleState, Task, TaskStatus } from "./types";

const LOCKED: ReadonlySet<TaskStatus> = new Set(["picked", "shooting", "done"]);

export function isLocked(t: Task): boolean {
  return LOCKED.has(t.status);
}

export function isQueued(t: Task): boolean {
  return t.status === "scheduled" || t.status === "rework";
}

let idCounter = 0;
export function nextTaskId(): string {
  idCounter += 1;
  return `tk-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * 按柜位重排所有“可移动”任务。
 * 锁定块保留原时段；可移动任务按 补拍优先 -> 加急 -> seq 排序，依次贴在锁定块之后，
 * 保证同柜位不重叠。返回的任务携带 delayed / prevStartMin，供页面提示顺延。
 */
export function reschedule(state: ScheduleState): ScheduleState {
  const oldStart = new Map<string, number | undefined>();
  state.tasks.forEach((t) => oldStart.set(t.id, t.startMin));

  const byCabinet = new Map<string, Task[]>();
  for (const t of state.tasks) {
    const list = byCabinet.get(t.cabinetId) ?? [];
    list.push(t);
    byCabinet.set(t.cabinetId, list);
  }

  const result: Task[] = [];
  for (const list of byCabinet.values()) {
    const locked = list
      .filter(isLocked)
      .sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));

    // 游标：从当日开排时间起，越过所有锁定块
    let cursor = DAY_START_MIN;
    for (const lk of locked) {
      const lStart = lk.startMin ?? cursor;
      const lEnd = lk.endMin ?? lStart + lk.durationMin;
      if (lEnd <= cursor) continue; // 早于游标的锁定块（理论上不会出现）
      cursor = Math.max(cursor, lEnd);
    }

    const movable = list
      .filter((t) => !isLocked(t))
      .sort((a, b) => queueRank(a) - queueRank(b) || a.seq - b.seq);

    for (const t of movable) {
      const prev = oldStart.get(t.id);
      const start = cursor;
      const end = start + t.durationMin;
      result.push({
        ...t,
        startMin: start,
        endMin: end,
        delayed: prev !== undefined && start > prev,
        prevStartMin: prev,
      });
      cursor = end;
    }

    result.push(
      ...locked.map((t) =>
        t.delayed || t.prevStartMin !== undefined
          ? { ...t, delayed: false, prevStartMin: undefined }
          : t,
      ),
    );
  }

  return { ...state, tasks: result };
}

// 补拍任务优先级最高（原柜位保留、尽快重拍），其后加急，再普通
function queueRank(t: Task): number {
  if (t.status === "rework") return 0;
  return t.priority === "urgent" ? 1 : 2;
}

/** 新建排期（priority=urgent 即加急插入），自动顺延同柜后续普通任务 */
export function addTask(
  state: ScheduleState,
  input: {
    specimenId: string;
    cabinetId: string;
    priority: Priority;
    durationMin: number;
    note?: string;
  },
): InsertResult {
  const seq = state.seqCounter;
  const task: Task = {
    id: nextTaskId(),
    specimenId: input.specimenId,
    cabinetId: input.cabinetId,
    priority: input.priority,
    durationMin: input.durationMin,
    note: input.note?.trim() || undefined,
    status: "scheduled",
    seq,
    insertedUrgent: input.priority === "urgent",
    logs: [
      {
        t: Date.now(),
        text:
          input.priority === "urgent"
            ? `加急任务插入柜位 ${input.cabinetId}，后续普通任务自动顺延`
            : `排入柜位 ${input.cabinetId}，预计 ${input.durationMin} 分钟`,
      },
    ],
    createdAt: Date.now(),
  };
  const next = reschedule({ ...state, tasks: [...state.tasks, task], seqCounter: seq + 1 });
  const delayedCount = next.tasks.filter((t) => t.delayed && t.id !== task.id).length;
  return { state: next, delayedCount };
}

function appendLog(t: Task, text: string): Task {
  return { ...t, logs: [...t.logs, { t: Date.now(), text }] };
}

/** 取件：待排/补拍 -> 已取件（柜位开始占用，归柜前不可再排） */
export function pickUp(state: ScheduleState, taskId: string): ScheduleState {
  return mutate(state, taskId, (t) => {
    if (!isQueued(t)) return t;
    return appendLog({ ...t, status: "picked" }, "已取件，进入拍摄中前置；归柜前该柜位不可再排");
  });
}

/** 开始拍摄：已取件 -> 拍摄中 */
export function startShooting(state: ScheduleState, taskId: string): ScheduleState {
  return mutate(state, taskId, (t) =>
    t.status === "picked"
      ? appendLog({ ...t, status: "shooting" }, "开始拍摄，照片与标签待质检")
      : t,
  );
}

/** 归柜：拍摄中 -> 已归柜，柜位释放，后续待排任务自动前移 */
export function complete(state: ScheduleState, taskId: string): ScheduleState {
  const marked = mutate(state, taskId, (t) =>
    t.status === "shooting" || t.status === "picked"
      ? appendLog({ ...t, status: "done" }, "质检通过，已归柜，柜位释放")
      : t,
  );
  return reschedule(marked);
}

/**
 * 退回补拍：拍摄中 -> 补拍。
 * 原柜位保留（cabinetId 不变），回到该柜队列最前，待重新取件。
 */
export function reject(state: ScheduleState, taskId: string, reason: ReworkReason, remark?: string): ScheduleState {
  const marked = mutate(state, taskId, (t) => {
    if (t.status !== "shooting" && t.status !== "picked") return t;
    const label = reason === "missing_photo" ? "照片缺失" : "标签不清";
    return appendLog(
      {
        ...t,
        status: "rework",
        reworkReason: reason,
        note: remark?.trim() ? remark.trim() : t.note,
        insertedUrgent: false,
      },
      `退回补拍：${label}；原柜位 ${t.cabinetId} 保留，重新排队`,
    );
  });
  return reschedule(marked);
}

/** 删除尚未取件的排期；已取件/拍摄中/已归柜不允许删除（需先走流程） */
export function removeTask(state: ScheduleState, taskId: string): ScheduleState {
  const target = state.tasks.find((t) => t.id === taskId);
  if (!target || isLocked(target)) return state;
  const next = { ...state, tasks: state.tasks.filter((t) => t.id !== taskId) };
  return reschedule(next);
}

function mutate(state: ScheduleState, taskId: string, fn: (t: Task) => Task): ScheduleState {
  return { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? fn(t) : t)) };
}

export function endOfDayOverflows(tasks: Task[]): Task[] {
  return tasks.filter((t) => (t.endMin ?? 0) > DAY_END_MIN);
}
