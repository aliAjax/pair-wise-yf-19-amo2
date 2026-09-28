/**
 * 排期规则层：只负责柜位占用、加急顺延、任务状态流转。
 * 纯函数，不依赖 React 与 localStorage，便于单独校验规则。
 */
import type {
  OpResult,
  PhotoTask,
  Priority,
  ReshootReason,
  ScheduleState,
  Specimen,
} from "../types";
import { RESHOOT_LABEL } from "../types";

/** 拍照厅开放时段：08:00–18:00（分钟数） */
export const DAY_START = 8 * 60;
export const DAY_END = 18 * 60;

export const endMin = (task: PhotoTask): number => task.startMin + task.durationMin;

interface Block {
  start: number;
  end: number;
  taskId: string;
}

const overlaps = (a: Block, start: number, end: number) =>
  a.start < end && a.end > start;

const nowStamp = () =>
  new Date().toLocaleString("zh-CN", { hour12: false });

function log(task: PhotoTask, action: string): PhotoTask {
  return { ...task, history: [...task.history, { at: nowStamp(), action }] };
}

/** 已排期 / 拍摄中的任务占用柜位时段；需补拍与已归柜不占用 */
const isBlocking = (task: PhotoTask) =>
  task.status === "scheduled" || task.status === "shooting";

/** 取件后到归柜前（含退回补拍）同一标本不能再次排入 */
const isActive = (task: PhotoTask) =>
  task.status === "scheduled" ||
  task.status === "shooting" ||
  task.status === "reshoot";

function cabinetBlocks(state: ScheduleState, cabinetId: string): Block[] {
  return state.tasks
    .filter((t) => t.cabinetId === cabinetId && isBlocking(t))
    .map((t) => ({ start: t.startMin, end: endMin(t), taskId: t.id }))
    .sort((a, b) => a.start - b.start);
}

/** 在固定占用块之间寻找最早能放下 duration 的空档 */
function earliestGap(blocks: Block[], duration: number, earliest: number): number {
  let t = earliest;
  for (let i = 0; i < 64; i += 1) {
    const hit = blocks.find((b) => overlaps(b, t, t + duration));
    if (!hit) return t;
    t = hit.end;
  }
  return t;
}

function nextId(state: ScheduleState): string {
  const seq = state.seq + 1;
  return `T${String(seq).padStart(3, "0")}`;
}

function findSpecimen(state: ScheduleState, specimenId: string): Specimen | undefined {
  return state.specimens.find((s) => s.id === specimenId);
}

function assertBookable(
  state: ScheduleState,
  specimen: Specimen,
  durationMin: number
): string | null {
  if (!state.cabinets.some((c) => c.id === specimen.cabinetId)) {
    return "该标本未预置柜位，无法排期";
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    return "预计时长必须大于 0";
  }
  if (state.tasks.some((t) => t.specimenId === specimen.id && isActive(t))) {
    return "该标本已在流程中：取件后、归柜前不能再次排入";
  }
  return null;
}

export interface AddTaskInput {
  specimenId: string;
  priority: Priority;
  durationMin: number;
  /** 加急任务的插入起点（分钟）；普通任务忽略，自动顺延排入 */
  startMin?: number;
  note?: string;
}

/** 普通任务：自动排入本柜位最早空档 */
function addNormal(state: ScheduleState, input: AddTaskInput): OpResult {
  const specimen = findSpecimen(state, input.specimenId)!;
  const bad = assertBookable(state, specimen, input.durationMin);
  if (bad) return { ok: false, error: bad };

  const blocks = cabinetBlocks(state, specimen.cabinetId);
  const start = earliestGap(blocks, input.durationMin, DAY_START);
  if (start + input.durationMin > DAY_END) {
    return { ok: false, error: "当日该柜位时段已约满，请改日再排" };
  }

  const task: PhotoTask = log(
    {
      id: nextId(state),
      specimenId: specimen.id,
      cabinetId: specimen.cabinetId,
      priority: "normal",
      status: "scheduled",
      startMin: start,
      durationMin: input.durationMin,
      note: input.note,
      history: [],
      createdAt: nowStamp(),
    },
    `普通任务排入 ${fmtRange(start, input.durationMin)}，柜位 ${cabinetName(state, specimen.cabinetId)}`
  );

  return {
    ok: true,
    state: { ...state, tasks: [...state.tasks, task], seq: state.seq + 1 },
    shifted: [],
    message: `已排入 ${cabinetName(state, specimen.cabinetId)} ${fmtRange(start, input.durationMin)}`,
  };
}

/**
 * 加急插入：固定在指定时段；拍摄中或其他加急任务占用则拒绝；
 * 同柜位后续普通任务按顺序顺延，并记录新旧时段。
 */
function addUrgent(state: ScheduleState, input: AddTaskInput): OpResult {
  const specimen = findSpecimen(state, input.specimenId)!;
  const bad = assertBookable(state, specimen, input.durationMin);
  if (bad) return { ok: false, error: bad };

  const start = input.startMin;
  if (start === undefined || start < DAY_START) {
    return { ok: false, error: "请选择当日开放时段内的插入时间" };
  }
  const end = start + input.durationMin;
  if (end > DAY_END) {
    return { ok: false, error: "加急任务超出当日开放时段（18:00）" };
  }

  const sameCabinet = state.tasks.filter(
    (t) => t.cabinetId === specimen.cabinetId && isBlocking(t)
  );
  const shootingHit = sameCabinet.find(
    (t) => t.status === "shooting" && t.startMin < end && endMin(t) > start
  );
  if (shootingHit) {
    return { ok: false, error: "该时段柜位正在拍摄中，加急任务不能打断取件中的任务" };
  }
  const urgentHit = sameCabinet.find(
    (t) => t.priority === "urgent" && t.startMin < end && endMin(t) > start
  );
  if (urgentHit) {
    return { ok: false, error: "同一柜位同一时段已有加急任务，不能重叠排入" };
  }

  const urgentId = nextId(state);
  // 固定锚点：拍摄中任务 + 全部加急任务（含本次新任务）
  const blocks: Block[] = [
    ...sameCabinet
      .filter((t) => t.status === "shooting" || t.priority === "urgent")
      .map((t) => ({ start: t.startMin, end: endMin(t), taskId: t.id })),
    { start, end, taskId: urgentId },
  ].sort((a, b) => a.start - b.start);

  // 后续普通任务按原顺序逐个寻找不与锚点冲突的最早位置
  const normals = sameCabinet
    .filter((t) => t.status === "scheduled" && t.priority === "normal")
    .sort((a, b) => a.startMin - b.startMin || a.createdAt.localeCompare(b.createdAt));

  const moveById = new Map<string, number>();
  const scratch = [...blocks];
  for (const n of normals) {
    const moved = earliestGap(scratch, n.durationMin, n.startMin);
    if (moved !== n.startMin) moveById.set(n.id, moved);
    scratch.push({ start: moved, end: moved + n.durationMin, taskId: n.id });
    scratch.sort((a, b) => a.start - b.start);
  }

  const insertedAt = nowStamp();
  const urgentTask: PhotoTask = log(
    {
      id: urgentId,
      specimenId: specimen.id,
      cabinetId: specimen.cabinetId,
      priority: "urgent",
      status: "scheduled",
      startMin: start,
      durationMin: input.durationMin,
      note: input.note,
      history: [],
      createdAt: insertedAt,
    },
    `加急插入 ${fmtRange(start, input.durationMin)}，柜位 ${cabinetName(state, specimen.cabinetId)}`
  );

  const shifted: PhotoTask[] = [];
  const tasks = state.tasks.map((t) => {
    const moved = moveById.get(t.id);
    if (moved === undefined) return t;
    const movedTask = log(
      {
        ...t,
        startMin: moved,
        shift: {
          reason: `加急任务 ${urgentId} 插入，普通任务顺延`,
          prevStart: t.startMin,
          prevEnd: endMin(t),
          at: insertedAt,
        },
      },
      `因加急插入顺延：${fmtRange(t.startMin, t.durationMin)} → ${fmtRange(moved, t.durationMin)}`
    );
    shifted.push(movedTask);
    return movedTask;
  });

  return {
    ok: true,
    state: { ...state, tasks: [...tasks, urgentTask], seq: state.seq + 1 },
    shifted,
    message:
      shifted.length > 0
        ? `加急已插入，${shifted.length} 项普通任务顺延`
        : "加急任务已插入，无普通任务受影响",
  };
}

export function addTask(state: ScheduleState, input: AddTaskInput): OpResult {
  const specimen = findSpecimen(state, input.specimenId);
  if (!specimen) return { ok: false, error: "请选择标本" };
  return input.priority === "urgent"
    ? addUrgent(state, input)
    : addNormal(state, input);
}

/** 取件：已排期 → 拍摄中 */
export function pickUp(state: ScheduleState, taskId: string): OpResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "scheduled") return { ok: false, error: "只有已排期任务可以取件" };
  const next = log(task, "工作人员取件，进入拍摄中；归柜前该标本不再排期");
  return {
    ok: true,
    state: { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? { ...next, status: "shooting" } : t)) },
    shifted: [],
    message: `${task.id} 已取件，拍摄中`,
  };
}

/** 归柜：拍摄中 → 已归柜，释放柜位与标本占用 */
export function returnToCabinet(state: ScheduleState, taskId: string): OpResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "shooting") return { ok: false, error: "拍摄中的任务才能归柜" };
  const next = log(
    { ...task, status: "done", reshootReason: undefined },
    `照片与标签核验通过，归柜 ${cabinetName(state, task.cabinetId)}`
  );
  return {
    ok: true,
    state: { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? next : t)) },
    shifted: [],
    message: `${task.id} 已归柜，柜位释放`,
  };
}

/** 退回补拍：拍摄中 → 需补拍，原柜位保留，释放原拍摄时段 */
export function rejectForReshoot(
  state: ScheduleState,
  taskId: string,
  reason: ReshootReason
): OpResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "shooting") return { ok: false, error: "只有拍摄中的任务可以退回补拍" };
  const next = log(
    { ...task, status: "reshoot", reshootReason: reason },
    `退回补拍（${RESHOOT_LABEL[reason]}），原柜位 ${cabinetName(state, task.cabinetId)} 保留`
  );
  return {
    ok: true,
    state: { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? next : t)) },
    shifted: [],
    message: `已退回补拍：${RESHOOT_LABEL[reason]}，原柜位保留`,
  };
}

/** 补拍重新排入：原柜位不变，自动取最早空档 */
export function requeueReshoot(state: ScheduleState, taskId: string): OpResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "reshoot") return { ok: false, error: "只有需补拍任务可以重新排入" };
  const blocks = cabinetBlocks(state, task.cabinetId);
  const start = earliestGap(blocks, task.durationMin, DAY_START);
  if (start + task.durationMin > DAY_END) {
    return { ok: false, error: "当日该柜位时段已约满，补拍请改日再排" };
  }
  const reason = task.reshootReason ? RESHOOT_LABEL[task.reshootReason] : "补拍";
  const next = log(
    {
      ...task,
      status: "scheduled",
      startMin: start,
      reshootReason: undefined,
      shift: undefined,
    },
    `${reason}重新排入 ${fmtRange(start, task.durationMin)}，仍在原柜位 ${cabinetName(state, task.cabinetId)}`
  );
  return {
    ok: true,
    state: { ...state, tasks: state.tasks.map((t) => (t.id === taskId ? next : t)) },
    shifted: [],
    message: `补拍任务已重新排入 ${fmtRange(start, task.durationMin)}，原柜位保留`,
  };
}

/** 取消未取件的排期 */
export function cancelTask(state: ScheduleState, taskId: string): OpResult {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.status !== "scheduled") return { ok: false, error: "只有已排期、未取件的任务可以取消" };
  return {
    ok: true,
    state: { ...state, tasks: state.tasks.filter((t) => t.id !== taskId) },
    shifted: [],
    message: `${taskId} 已取消`,
  };
}

/** 表单辅助：预估某柜位放入指定时长的最早空档 */
export function suggestEarliest(
  state: ScheduleState,
  cabinetId: string,
  durationMin: number
): number {
  return earliestGap(cabinetBlocks(state, cabinetId), durationMin, DAY_START);
}

function cabinetName(state: ScheduleState, cabinetId: string): string {
  return state.cabinets.find((c) => c.id === cabinetId)?.name ?? cabinetId;
}

/** 分钟 → HH:MM */
export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function fmtRange(start: number, duration: number): string {
  return `${fmtMin(start)}–${fmtMin(start + duration)}`;
}
