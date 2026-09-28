// 规则层：拍照排期领域模型

export type Priority = "urgent" | "normal";

// 待排 -> 已取件(拍摄中前置) -> 拍摄中 -> 已归柜；缺照片/标签不清则退回补拍
export type TaskStatus = "scheduled" | "picked" | "shooting" | "done" | "rework";

export type ReworkReason = "missing_photo" | "unclear_label";

export interface Cabinet {
  id: string;
  name: string;
  zone: string;
}

export interface Specimen {
  id: string;
  code: string; // 采集号
  species: string; // 物种名称
  location: string; // 采集地点
  habitat: string; // 生境
  cabinetId: string; // 馆藏柜位
}

export interface LogEntry {
  t: number;
  text: string;
}

export interface Task {
  id: string;
  specimenId: string;
  cabinetId: string; // 排期柜位（退回补拍时原柜位保留，不允许修改）
  priority: Priority;
  durationMin: number; // 预计时长（分钟）
  status: TaskStatus;
  note?: string;
  reworkReason?: ReworkReason;
  /** 当日相对 00:00 的分钟数；已取件/拍摄中/已归柜为锁定时段，不再参与重排 */
  startMin?: number;
  endMin?: number;
  /** 同一柜位内的排序键：普通任务追加在后，加急插入到普通任务之前 */
  seq: number;
  insertedUrgent?: boolean;
  /** 加急插入导致顺延时，记录上一档开始时间与“已顺延”标记 */
  delayed?: boolean;
  prevStartMin?: number;
  logs: LogEntry[];
  createdAt: number;
}

export interface ScheduleState {
  version: number;
  tasks: Task[];
  seqCounter: number;
}

export interface InsertResult {
  state: ScheduleState;
  delayedCount: number;
}
