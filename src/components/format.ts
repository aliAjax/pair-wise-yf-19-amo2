// 展示层工具：文案与时间格式化

import { CABINETS, SPECIMENS } from "../domain/seed";
import type { Priority, ReworkReason, TaskStatus } from "../domain/types";

export function cabinetName(id: string): string {
  return CABINETS.find((c) => c.id === id)?.name ?? id;
}

export function cabinetZone(id: string): string {
  return CABINETS.find((c) => c.id === id)?.zone ?? "";
}

export function specimenOf(id: string) {
  return SPECIMENS.find((s) => s.id === id);
}

export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtRange(start?: number, end?: number): string {
  if (start === undefined || end === undefined) return "待排期";
  return `${fmtMin(start)} – ${fmtMin(end)}`;
}

export const STATUS_TEXT: Record<TaskStatus, string> = {
  scheduled: "待取件",
  picked: "已取件",
  shooting: "拍摄中",
  done: "已归柜",
  rework: "退回补拍",
};

export const PRIORITY_TEXT: Record<Priority, string> = {
  urgent: "加急",
  normal: "普通",
};

export const REWORK_TEXT: Record<ReworkReason, string> = {
  missing_photo: "照片缺失",
  unclear_label: "标签不清",
};

export function fmtTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
