/**
 * 数据存取层：只负责 localStorage 的读取、校验与写入。
 * 规则层与展示层不直接碰 localStorage。
 */
import type { PhotoTask, ScheduleState } from "../types";
import { createSeedState } from "./seed";

const STORAGE_KEY = "herbarium-photo-schedule:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 结构校验：损坏或缺字段时回退到预置数据，避免页面白屏 */
function validate(raw: unknown): ScheduleState | null {
  if (!isRecord(raw) || raw.version !== 1) return null;
  if (!Array.isArray(raw.cabinets) || !Array.isArray(raw.specimens) || !Array.isArray(raw.tasks)) {
    return null;
  }

  const cabinetIds = new Set(
    (raw.cabinets as unknown[]).filter(isRecord).map((c) => asString(c.id))
  );
  const specimenIds = new Set(
    (raw.specimens as unknown[]).filter(isRecord).map((s) => asString(s.id))
  );

  const tasks: PhotoTask[] = [];
  for (const item of raw.tasks as unknown[]) {
    if (!isRecord(item)) continue;
    const cabinetId = asString(item.cabinetId);
    const specimenId = asString(item.specimenId);
    if (!cabinetIds.has(cabinetId) || !specimenIds.has(specimenId)) continue;
    const startMin = Number(item.startMin);
    const durationMin = Number(item.durationMin);
    if (!Number.isFinite(startMin) || !Number.isFinite(durationMin)) continue;
    tasks.push({
      id: asString(item.id),
      specimenId,
      cabinetId,
      priority: item.priority === "urgent" ? "urgent" : "normal",
      status: ["scheduled", "shooting", "reshoot", "done"].includes(asString(item.status))
        ? (asString(item.status) as PhotoTask["status"])
        : "scheduled",
      startMin,
      durationMin,
      note: asString(item.note) || undefined,
      reshootReason:
        item.reshootReason === "missing" || item.reshootReason === "unclear"
          ? item.reshootReason
          : undefined,
      shift: isRecord(item.shift)
        ? {
            reason: asString(item.shift.reason),
            prevStart: Number(item.shift.prevStart) || 0,
            prevEnd: Number(item.shift.prevEnd) || 0,
            at: asString(item.shift.at),
          }
        : undefined,
      history: Array.isArray(item.history)
        ? (item.history as unknown[])
            .filter(isRecord)
            .map((h) => ({ at: asString(h.at), action: asString(h.action) }))
            .filter((h) => h.action)
        : [],
      createdAt: asString(item.createdAt),
    });
  }

  return {
    version: 1,
    cabinets: raw.cabinets as ScheduleState["cabinets"],
    specimens: raw.specimens as ScheduleState["specimens"],
    tasks,
    seq: Number(raw.seq) || tasks.length,
  };
}

export const storage = {
  /** 首次打开使用预置柜位与标本；之后读取本地数据继续作业 */
  load(): ScheduleState {
    try {
      const text = window.localStorage.getItem(STORAGE_KEY);
      if (!text) return createSeedState();
      const parsed: unknown = JSON.parse(text);
      return validate(parsed) ?? createSeedState();
    } catch {
      return createSeedState();
    }
  },

  save(state: ScheduleState): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 隐私模式或存储已满时静默：本次会话内仍可正常排期
    }
  },

  reset(): ScheduleState {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 忽略
    }
    return createSeedState();
  },
};
