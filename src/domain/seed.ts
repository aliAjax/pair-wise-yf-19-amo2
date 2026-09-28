// 规则层：预置柜位与标本数据

import type { Cabinet, Specimen, Task } from "./types";

export const DAY_START_MIN = 8 * 60 + 30; // 08:30 开排
export const DAY_END_MIN = 18 * 60; // 18:00 收工

export const CABINETS: Cabinet[] = [
  { id: "A-03", name: "A 区 · 柜 03", zone: "蕨类与苔藓" },
  { id: "A-07", name: "A 区 · 柜 07", zone: "裸子植物" },
  { id: "B-12", name: "B 区 · 柜 12", zone: "被子植物 · 合瓣花" },
  { id: "B-15", name: "B 区 · 柜 15", zone: "被子植物 · 离瓣花" },
  { id: "C-05", name: "C 区 · 柜 05", zone: "菊科专区" },
  { id: "C-09", name: "C 区 · 柜 09", zone: "模式标本" },
];

export const SPECIMENS: Specimen[] = [
  { id: "sp-01", code: "HX-240615-01", species: "元宝槭（待定种）", location: "苍山洗马潭步道", habitat: "针阔混交林缘", cabinetId: "B-15" },
  { id: "sp-02", code: "HX-240615-08", species: "荚果蕨", location: "阴湿沟谷 1420m", habitat: "溪旁腐殖土", cabinetId: "A-03" },
  { id: "sp-03", code: "HX-240616-03", species: "毛华菊", location: "东坡草甸", habitat: "向阳灌丛", cabinetId: "C-05" },
  { id: "sp-04", code: "HX-240616-11", species: "云南松", location: "西坡防火线", habitat: "干燥松林", cabinetId: "A-07" },
  { id: "sp-05", code: "HX-240617-02", species: "滇黄芩", location: "南坡弃耕地", habitat: "路边荒地", cabinetId: "B-12" },
  { id: "sp-06", code: "HX-240617-09", species: "水龙骨", location: "阴湿沟谷 1380m", habitat: "岩壁石缝", cabinetId: "A-03" },
  { id: "sp-07", code: "HX-240618-04", species: "大籽蒿", location: "垭口风口", habitat: "高山草甸", cabinetId: "C-05" },
  { id: "sp-08", code: "HX-240618-12", species: "流苏龙胆", location: "高山湖边", habitat: "湿草甸", cabinetId: "C-09" },
  { id: "sp-09", code: "HX-240619-01", species: "野棉花", location: "林缘步道", habitat: "半阴坡地", cabinetId: "B-15" },
  { id: "sp-10", code: "HX-240619-06", species: "川滇小檗", location: "北坡灌丛", habitat: "多石坡地", cabinetId: "B-12" },
];

const now = Date.UTC(2026, 8, 28, 0, 0, 0);

export function initialTasks(): Task[] {
  const log = (text: string): { t: number; text: string }[] => [{ t: now, text }];
  return [
    {
      id: "tk-seed-01", specimenId: "sp-02", cabinetId: "A-03", priority: "normal",
      durationMin: 25, status: "picked", startMin: 8 * 60 + 30, endMin: 8 * 60 + 55, seq: 0,
      note: "叶背孢子囊群需特写", logs: log("已取件，进入拍摄中前置环节（柜位占用，不可再排）"), createdAt: now,
    },
    {
      id: "tk-seed-02", specimenId: "sp-06", cabinetId: "A-03", priority: "normal",
      durationMin: 20, status: "scheduled", seq: 1, note: "整株与标签分两张", logs: log("排入今日档期 09:00"), createdAt: now,
    },
    {
      id: "tk-seed-03", specimenId: "sp-03", cabinetId: "C-05", priority: "normal",
      durationMin: 30, status: "scheduled", seq: 0, logs: log("排入今日档期 08:30"), createdAt: now,
    },
    {
      id: "tk-seed-04", specimenId: "sp-07", cabinetId: "C-05", priority: "normal",
      durationMin: 25, status: "scheduled", seq: 1, logs: log("排入今日档期 09:00"), createdAt: now,
    },
    {
      id: "tk-seed-05", specimenId: "sp-01", cabinetId: "B-15", priority: "normal",
      durationMin: 35, status: "shooting", startMin: 8 * 60 + 30, endMin: 9 * 60 + 5, seq: 0,
      note: "果实待补照", logs: log("开始拍摄（柜位占用，归柜前不可再排）"), createdAt: now,
    },
    {
      id: "tk-seed-06", specimenId: "sp-09", cabinetId: "B-15", priority: "normal",
      durationMin: 25, status: "scheduled", seq: 1, logs: log("排入今日档期 09:10"), createdAt: now,
    },
    {
      id: "tk-seed-07", specimenId: "sp-05", cabinetId: "B-12", priority: "normal",
      durationMin: 30, status: "scheduled", seq: 0, logs: log("排入今日档期 08:30"), createdAt: now,
    },
    {
      id: "tk-seed-08", specimenId: "sp-10", cabinetId: "B-12", priority: "normal",
      durationMin: 20, status: "rework", reworkReason: "unclear_label", seq: 1,
      note: "原柜位保留，优先补拍", logs: log("退回补拍：标签不清，原柜位 B-12 保留"), createdAt: now,
    },
    {
      id: "tk-seed-09", specimenId: "sp-04", cabinetId: "A-07", priority: "normal",
      durationMin: 25, status: "scheduled", seq: 0, logs: log("排入今日档期 08:30"), createdAt: now,
    },
    {
      id: "tk-seed-10", specimenId: "sp-08", cabinetId: "C-09", priority: "normal",
      durationMin: 40, status: "done", startMin: 8 * 60 + 30, endMin: 9 * 60 + 10, seq: 0,
      logs: log("拍摄完成，已归柜，柜位释放"), createdAt: now,
    },
  ];
}
