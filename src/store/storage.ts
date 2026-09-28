// 存取层：本地数据持久化（localStorage），重开页面可继续排期

import { initialTasks } from "../domain/seed";
import { reschedule } from "../domain/schedule";
import type { ScheduleState, Task } from "../domain/types";

const STORAGE_KEY = "herbarium-photo-schedule-v1";

export function loadState(): ScheduleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ScheduleState;
      if (parsed && Array.isArray(parsed.tasks) && typeof parsed.seqCounter === "number") {
        // 重新加载后再排一次：保证加解锁变化后时段仍然合法，同时清掉顺延提示
        return reschedule({
          ...parsed,
          tasks: parsed.tasks.map(clearDelayFlags),
        });
      }
    }
  } catch {
    // 存储损坏时回落到预置数据
  }
  const seeded: ScheduleState = { version: 1, tasks: initialTasks(), seqCounter: 100 };
  return reschedule(seeded);
}

export function saveState(state: ScheduleState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式等场景下静默失败，不影响当前会话使用
  }
}

export function resetState(): ScheduleState {
  const seeded: ScheduleState = { version: 1, tasks: initialTasks(), seqCounter: 100 };
  const next = reschedule(seeded);
  saveState(next);
  return next;
}

function clearDelayFlags(t: Task): Task {
  return { ...t, delayed: false, prevStartMin: undefined };
}
