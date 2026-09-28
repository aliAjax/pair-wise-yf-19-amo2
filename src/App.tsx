import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { CabinetTimeline } from "./components/CabinetTimeline";
import { TaskDetail } from "./components/TaskDetail";
import { TaskForm } from "./components/TaskForm";
import { ScheduleList } from "./components/ScheduleList";
import { loadState, resetState, saveState } from "./store/storage";
import {
  addTask,
  complete,
  endOfDayOverflows,
  isLocked,
  pickUp,
  reject,
  removeTask,
  startShooting,
} from "./domain/schedule";
import type { Priority, ReworkReason, ScheduleState } from "./domain/types";
import { STATUS_TEXT, specimenOf } from "./components/format";

type FilterKey = "all" | "scheduled" | "busy" | "rework" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "scheduled", label: "待取件" },
  { key: "busy", label: "取件/拍摄中" },
  { key: "rework", label: "退回补拍" },
  { key: "done", label: "已归柜" },
];

function App() {
  const [state, setState] = useState<ScheduleState>(() => loadState());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedTask = state.tasks.find((t) => t.id === selectedId) ?? null;

  const usedSpecimenIds = useMemo(
    () => new Set(state.tasks.filter((t) => !isLocked(t) || t.status !== "done").map((t) => t.specimenId)),
    [state.tasks],
  );

  const visibleTasks = useMemo(() => {
    if (filter === "all") return state.tasks;
    if (filter === "busy") return state.tasks.filter((t) => t.status === "picked" || t.status === "shooting");
    return state.tasks.filter((t) => t.status === filter);
  }, [state.tasks, filter]);

  const counts = useMemo(() => {
    const c = { all: state.tasks.length, scheduled: 0, busy: 0, rework: 0, done: 0 };
    for (const t of state.tasks) {
      if (t.status === "picked" || t.status === "shooting") c.busy += 1;
      else if (t.status === "scheduled") c.scheduled += 1;
      else if (t.status === "rework") c.rework += 1;
      else if (t.status === "done") c.done += 1;
    }
    return c;
  }, [state.tasks]);

  const overflows = useMemo(() => endOfDayOverflows(state.tasks), [state.tasks]);

  const handleAdd: Parameters<typeof TaskForm>[0]["onAdd"] = (input) => {
    const { state: next, delayedCount } = addTask(state, input);
    setState(next);
    const created = next.tasks[next.tasks.length - 1];
    setSelectedId(created?.id ?? null);
    if (input.priority === "urgent") {
      setToast(
        delayedCount > 0
          ? `加急任务已插入 ${input.cabinetId}，${delayedCount} 项普通任务顺延，列表与时间轴已刷新新时段`
          : `加急任务已插入 ${input.cabinetId}，当前无需顺延的普通任务`,
      );
    } else {
      setToast(`已排入柜位 ${input.cabinetId}（${input.priority === "normal" ? "普通" : "加急"} · ${input.durationMin} 分钟）`);
    }
  };

  const guard = (next: ScheduleState, msg: string) => {
    setState(next);
    setToast(msg);
  };

  const handleReject = (id: string, reason: ReworkReason) => {
    const next = reject(state, id, reason);
    setState(next);
    setToast(reason === "missing_photo" ? "已退回补拍：照片缺失，原柜位保留" : "已退回补拍：标签不清，原柜位保留");
  };

  const handleReset = () => {
    if (!window.confirm("恢复预置柜位与标本排期？当前本地修改将被清除。")) return;
    setState(resetState());
    setSelectedId(null);
    setToast("已恢复预置数据");
  };

  return (
    <main className="app">
      <header className="hero">
        <p>植物标本馆数字化 · 拍照排期台</p>
        <h1>拍照排期台</h1>
        <span>
          告别白板排班：取件、拍摄、归柜按柜位时段统一排期；同一柜位同一时段只排一项，
          加急插入自动顺延普通任务，照片缺失或标签不清退回补拍且原柜位保留。数据保存在本机，重开页面继续作业。
        </span>
      </header>

      <section className="metrics">
        <article><small>待取件</small><strong>{counts.scheduled}</strong></article>
        <article><small>取件 / 拍摄中</small><strong>{counts.busy}</strong></article>
        <article><small>退回补拍</small><strong>{counts.rework}</strong></article>
        <article><small>今日已归柜</small><strong>{counts.done}</strong></article>
      </section>

      <div className="toolbar panel">
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "chip-on" : ""}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <em>{counts[f.key]}</em>
            </button>
          ))}
        </div>
        <button className="ghost" onClick={handleReset}>恢复预置数据</button>
      </div>

      {overflows.length > 0 && (
        <div className="overflow-tip">
          有 {overflows.length} 项任务超出 18:00 收工时间：
          {overflows.map((t) => `${specimenOf(t.specimenId)?.code}（预计结束 ${String(Math.floor((t.endMin ?? 0) / 60)).padStart(2, "0")}:${String((t.endMin ?? 0) % 60).padStart(2, "0")}）`).join("、")}
          ，请加急插单时留意。
        </div>
      )}

      <section className="workspace">
        <ScheduleList tasks={visibleTasks} selectedId={selectedId} onSelect={setSelectedId} />
        <TaskDetail
          task={selectedTask}
          onPick={(id) => guard(pickUp(state, id), "已取件，进入拍摄中前置；归柜前该柜位不可再排")}
          onStart={(id) => guard(startShooting(state, id), "开始拍摄，等待照片与标签质检")}
          onComplete={(id) => guard(complete(state, id), "质检通过，已归柜，柜位释放；后续任务已前移")}
          onReject={handleReject}
          onRemove={(id) => {
            setState(removeTask(state, id));
            setToast("排期已删除，同柜后续任务时段已重算");
          }}
          onClose={() => setSelectedId(null)}
        />
      </section>

      <CabinetTimeline tasks={state.tasks} selectedId={selectedId} onSelect={setSelectedId} />

      <TaskForm usedSpecimenIds={usedSpecimenIds} onAdd={handleAdd} />

      <footer className="footnote">
        <p>
          规则说明：柜位 / 优先级 / 预计时长随排期写明；已取件、拍摄中任务锁定柜位，归柜前不可再排；
          补拍任务原柜位保留并回到该柜队列最前。
        </p>
        <p>架构：排期规则（src/domain）、数据存取（src/store，localStorage）、页面展示（src/components）分开承接，列表、时间轴、详情共用同一份本地数据。</p>
        <p>状态图例：{Object.entries(STATUS_TEXT).map(([k, v]) => `${k}=${v}`).join("；")}</p>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
