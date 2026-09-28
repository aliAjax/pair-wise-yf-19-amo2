/** 列表 / 时间轴 / 详情共用的派生数据（全部来自同一份 ScheduleState） */
import { endMin } from "../rules/scheduler";
import type { PhotoTask, ScheduleState, Specimen, TaskStatus } from "../types";

export function getSpecimen(state: ScheduleState, id: string): Specimen | undefined {
  return state.specimens.find((s) => s.id === id);
}

export function getCabinet(state: ScheduleState, id: string) {
  return state.cabinets.find((c) => c.id === id);
}

export function taskSpecimen(state: ScheduleState, task: PhotoTask) {
  return getSpecimen(state, task.specimenId);
}

/** 标本当前在途任务（已归柜的历史任务不占用标本） */
export function activeTaskOf(state: ScheduleState, specimenId: string): PhotoTask | undefined {
  return state.tasks.find(
    (t) =>
      t.specimenId === specimenId &&
      (t.status === "scheduled" || t.status === "shooting" || t.status === "reshoot")
  );
}

/** 还未进入流程的标本，供排期表单选择 */
export function bookableSpecimens(state: ScheduleState): Specimen[] {
  return state.specimens.filter((s) => !activeTaskOf(state, s.id));
}

export function tasksForCabinet(state: ScheduleState, cabinetId: string): PhotoTask[] {
  return state.tasks
    .filter((t) => t.cabinetId === cabinetId && (t.status === "scheduled" || t.status === "shooting"))
    .sort((a, b) => a.startMin - b.startMin);
}

/** 时间轴展示范围：08:00 起，最晚 18:00 收，所有占用块至少完整可见 */
export function timelineSpan(state: ScheduleState) {
  const ends = state.tasks
    .filter((t) => t.status === "scheduled" || t.status === "shooting")
    .map((t) => endMin(t));
  return { start: 8 * 60, end: Math.max(11 * 60, ...ends) };
}

export const STATUS_ORDER: TaskStatus[] = ["scheduled", "shooting", "reshoot", "done"];

export function metrics(state: ScheduleState) {
  const inProgress = state.tasks.filter(
    (t) => t.status === "scheduled" || t.status === "shooting"
  ).length;
  const shooting = state.tasks.filter((t) => t.status === "shooting").length;
  const reshoot = state.tasks.filter((t) => t.status === "reshoot").length;
  const done = state.tasks.filter((t) => t.status === "done").length;
  return [
    { label: "今日待拍 / 拍摄中", value: inProgress, tone: "primary" },
    { label: "拍摄中（未归柜）", value: shooting, tone: "secondary" },
    { label: "需补拍", value: reshoot, tone: "danger" },
    { label: "已归柜", value: done, tone: "muted" },
  ] as const;
}
