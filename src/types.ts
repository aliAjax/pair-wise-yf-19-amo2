/** 拍照排期台领域模型：柜位、标本、排期任务与共享状态 */

export type Priority = "normal" | "urgent";
export type TaskStatus = "scheduled" | "shooting" | "reshoot" | "done";
/** 退回补拍原因：照片缺失 / 标签不清 */
export type ReshootReason = "missing" | "unclear";

export interface Cabinet {
  id: string;
  name: string;
  zone: string;
  note: string;
}

export interface Specimen {
  id: string;
  /** 采集号 */
  code: string;
  species: string;
  family: string;
  locale: string;
  habitat: string;
  collector: string;
  /** 原柜位（归柜柜位，也是默认拍摄取件柜位） */
  cabinetId: string;
  shelf: string;
}

export interface HistoryEntry {
  at: string;
  action: string;
}

/** 加急插入导致的顺延记录，用于列表与详情展示新时段 */
export interface ShiftInfo {
  reason: string;
  prevStart: number;
  prevEnd: number;
  at: string;
}

export interface PhotoTask {
  id: string;
  specimenId: string;
  /** 排期柜位（与标本原柜位一致，退回补拍时原柜位保留） */
  cabinetId: string;
  priority: Priority;
  status: TaskStatus;
  /** 时段起点，单位：自零点起的分钟数 */
  startMin: number;
  /** 预计时长（分钟） */
  durationMin: number;
  note?: string;
  reshootReason?: ReshootReason;
  shift?: ShiftInfo;
  history: HistoryEntry[];
  createdAt: string;
}

export interface ScheduleState {
  version: 1;
  cabinets: Cabinet[];
  specimens: Specimen[];
  tasks: PhotoTask[];
  seq: number;
}

/** 一次排期操作的结果：成功时给出新状态、受影响顺延任务与提示 */
export type OpResult =
  | {
      ok: true;
      state: ScheduleState;
      /** 本次操作中时段发生变化的普通任务 */
      shifted: PhotoTask[];
      message: string;
    }
  | { ok: false; error: string };

export const PRIORITY_LABEL: Record<Priority, string> = {
  normal: "普通",
  urgent: "加急",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  scheduled: "已排期",
  shooting: "拍摄中",
  reshoot: "需补拍",
  done: "已归柜",
};

export const RESHOOT_LABEL: Record<ReshootReason, string> = {
  missing: "照片缺失",
  unclear: "标签不清",
};
