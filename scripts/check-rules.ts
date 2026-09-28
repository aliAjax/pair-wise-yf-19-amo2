import { createSeedState } from "../src/data/seed";
import {
  addTask,
  pickUp,
  returnToCabinet,
  rejectForReshoot,
  requeueReshoot,
  cancelTask,
  fmtRange,
} from "../src/rules/scheduler";
import type { ScheduleState } from "../src/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.error(`✗ ${name} ${extra}`);
  }
}

function apply(s0: ScheduleState, r: { ok: boolean } & Record<string, unknown>): ScheduleState {
  return (r as { state: ScheduleState }).state ?? s0;
}

let s: ScheduleState = createSeedState();

// 1. 普通任务自动排入最早空档（B-12 现有 08:00–09:00，S08 20 分钟应排 09:00）
const r1 = addTask(s, { specimenId: "S08", priority: "normal", durationMin: 20 });
check("普通任务排入成功", r1.ok, JSON.stringify(r1));
if (r1.ok) {
  s = apply(s, r1);
  const t = s.tasks.find((x) => x.specimenId === "S08")!;
  check("普通任务时段为 09:00–09:20", t.startMin === 9 * 60, fmtRange(t.startMin, t.durationMin));
}

// 2. 加急插入 C-07 08:20–08:40：T005（08:10–08:55 普通）顺延到 08:40
const r2 = addTask(s, {
  specimenId: "S06",
  priority: "urgent",
  durationMin: 20,
  startMin: 8 * 60 + 20,
});
check("C-07 加急插入成功", r2.ok, JSON.stringify(r2));
if (r2.ok) {
  s = apply(s, r2);
  const urgent = s.tasks.find((x) => x.specimenId === "S06" && x.priority === "urgent")!;
  check("加急落在 C-07 08:20–08:40", urgent.cabinetId === "C-07" && urgent.startMin === 8 * 60 + 20);
  const t005 = s.tasks.find((x) => x.id === "T005")!;
  check("T005 顺延到 08:40 起", t005.startMin === 8 * 60 + 40, fmtRange(t005.startMin, t005.durationMin));
  check("T005 记录了新旧时段", !!t005.shift && t005.shift.prevStart === 8 * 60 + 10 && t005.shift.prevEnd === 8 * 60 + 55);
  check("返回受影响任务列表", r2.shifted.length === 1 && r2.shifted[0].id === "T005");
}

// 3. 在途标本（S08 已排普通任务）不能再次排入
const r3 = addTask(s, { specimenId: "S08", priority: "urgent", durationMin: 20, startMin: 8 * 60 + 30 });
check("在途标本再次排入被拒绝", !r3.ok);

// 4. 加急不得撞上拍摄中任务：取消 T002 腾出 S07，向 A-01 08:05 插加急
const c2 = cancelTask(s, "T002");
check("取消未取件任务成功", c2.ok);
if (c2.ok) s = apply(s, c2);
const ruShoot = addTask(s, { specimenId: "S07", priority: "urgent", durationMin: 20, startMin: 8 * 60 + 5 });
check("加急撞上拍摄中（T001）被拒绝", !ruShoot.ok);

// 5. 取件 → 拍摄中（用 A-03 的 T006，避免干扰后续用例）
const rp = pickUp(s, "T006");
check("取件成功进入拍摄中", rp.ok);
if (rp.ok) s = apply(s, rp);
const ret6 = returnToCabinet(s, "T006");
check("T006 核验归柜成功", ret6.ok);
if (ret6.ok) s = apply(s, ret6);

// 6. 拍摄中退回补拍：标签不清，原柜位保留、标本仍占用
const rrj = rejectForReshoot(s, "T001", "unclear");
check("退回补拍成功", rrj.ok);
if (rrj.ok) s = apply(s, rrj);
const t001 = s.tasks.find((x) => x.id === "T001")!;
check("状态 reshoot 且原因 unclear", t001.status === "reshoot" && t001.reshootReason === "unclear");
check("原柜位 A-01 保留", t001.cabinetId === "A-01");
check("退回后同一标本仍不能再排", !addTask(s, { specimenId: "S02", priority: "normal", durationMin: 30 }).ok);
check("非补拍任务不能重排", !requeueReshoot(s, "T003").ok);

// 7. 补拍重排：A-01 已无占用（T002 已取消），应回到 08:00，柜位不变
const rrq = requeueReshoot(s, "T001");
check("补拍重排成功", rrq.ok, JSON.stringify(rrq));
if (rrq.ok) {
  s = apply(s, rrq);
  const t = s.tasks.find((x) => x.id === "T001")!;
  check("补拍排到 08:00 且柜位不变", t.startMin === 8 * 60 && t.cabinetId === "A-01", fmtRange(t.startMin, t.durationMin));
  check("补拍原因清除且状态恢复 scheduled", t.reshootReason === undefined && t.status === "scheduled");
}

// 8. 拍摄 → 核验 → 归柜（用 T005，C-07）
const rp5 = pickUp(s, "T005");
check("T005 取件成功", rp5.ok);
if (rp5.ok) s = apply(s, rp5);
const rret = returnToCabinet(s, "T005");
check("核验归柜成功", rret.ok);
if (rret.ok) {
  s = apply(s, rret);
  check("T005 状态 done", s.tasks.find((x) => x.id === "T005")!.status === "done");
}

// 9. 非法流转拦截
check("done 不能再取件", !pickUp(s, "T005").ok);
check("scheduled 不能直接归柜", !returnToCabinet(s, "T003").ok);
check("scheduled 不能直接退回", !rejectForReshoot(s, "T003", "missing").ok);
// T001 重排后为 scheduled：先取件，再验证拍摄中不能重复取件
const p1 = pickUp(s, "T001");
check("T001 重排后可再次取件", p1.ok);
if (p1.ok) s = apply(s, p1);
check("拍摄中不能重复取件", !pickUp(s, "T001").ok);
// 退回补拍释放，供后续用例
const back = rejectForReshoot(s, "T001", "missing");
if (back.ok) s = apply(s, back);

// 10. 加急插入引发多任务级联顺延
// 准备：取消 S08 普通任务（T007），释放 S08 用于加急
s = apply(s, cancelTask(s, s.tasks.find((t) => t.specimenId === "S08" && t.status === "scheduled")!.id));
// B-12 现有：T003 08:00–08:35、T004 08:35–09:00；追加 S09 普通 30 分钟 → 09:00–09:30
const aS09 = addTask(s, { specimenId: "S09", priority: "normal", durationMin: 30 });
check("S09 普通任务排入 B-12 09:00", aS09.ok, JSON.stringify(aS09));
if (aS09.ok) s = apply(s, aS09);
const idS09 = s.tasks.find((t) => t.specimenId === "S09" && t.status === "scheduled")!.id;
// S08 加急 08:15–08:35 插入：T003→08:35、T004→09:10、S09→09:35
const cascade = addTask(s, { specimenId: "S08", priority: "urgent", durationMin: 20, startMin: 8 * 60 + 15 });
check("级联加急插入成功", cascade.ok, JSON.stringify(cascade));
if (cascade.ok) {
  s = apply(s, cascade);
  const got = ["T003", "T004", idS09].map((id) => {
    const t = s.tasks.find((x) => x.id === id)!;
    return fmtRange(t.startMin, t.durationMin);
  });
  check(
    "三项普通任务依次顺延到 08:35 / 09:10 / 09:35",
    got.join("|") === "08:35–09:10|09:10–09:35|09:35–10:05",
    got.join(" | ")
  );
  const s08urgent = s.tasks.find((t) => t.specimenId === "S08" && t.priority === "urgent")!;
  check("加急块本身固定在 08:15", s08urgent.startMin === 8 * 60 + 15);
  check("顺延任务数为 3", cascade.shifted.length === 3, String(cascade.shifted.length));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
