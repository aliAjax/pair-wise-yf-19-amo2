import { useState } from "react";
import { fmtRange } from "../rules/scheduler";
import type { PhotoTask, ScheduleState, TaskStatus } from "../types";
import { PRIORITY_LABEL, RESHOOT_LABEL, STATUS_LABEL } from "../types";
import { getCabinet, getSpecimen } from "../state/selectors";

interface Props {
  state: ScheduleState;
  selectedId: string | null;
  onSelect: (taskId: string) => void;
  onPickUp: (id: string) => void;
  onReturn: (id: string) => void;
  onReject: (id: string, reason: "missing" | "unclear") => void;
  onRequeue: (id: string) => void;
  onCancel: (id: string) => void;
}

const FILTERS: Array<{ key: TaskStatus | "all"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "scheduled", label: STATUS_LABEL.scheduled },
  { key: "shooting", label: STATUS_LABEL.shooting },
  { key: "reshoot", label: STATUS_LABEL.reshoot },
  { key: "done", label: STATUS_LABEL.done },
];

export default function TaskList({
  state,
  selectedId,
  onSelect,
  onPickUp,
  onReturn,
  onReject,
  onRequeue,
  onCancel,
}: Props) {
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  // 同一柜位同时段不能排两项 → 列表按柜位、起始时刻排序，冲突一眼可见
  const rows = state.tasks
    .filter((t) => filter === "all" || t.status === filter)
    .slice()
    .sort((a, b) => {
      if (a.cabinetId !== b.cabinetId) return a.cabinetId.localeCompare(b.cabinetId);
      return a.startMin - b.startMin;
    });

  return (
    <section className="panel list-card">
      <div className="heading">
        <div>
          <p>排期列表</p>
          <h2>今日拍照任务（{rows.length}）</h2>
        </div>
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? "chip on" : "chip"}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="task-table" role="table">
        <div className="task-row head" role="row">
          <span>任务</span>
          <span>柜位</span>
          <span>标本</span>
          <span>优先级</span>
          <span>时段</span>
          <span>状态</span>
          <span>操作</span>
        </div>
        {rows.map((task) => (
          <TaskRowView
            key={task.id}
            state={state}
            task={task}
            active={task.id === selectedId}
            onSelect={() => onSelect(task.id)}
            onPickUp={() => onPickUp(task.id)}
            onReturn={() => onReturn(task.id)}
            onReject={(reason) => onReject(task.id, reason)}
            onRequeue={() => onRequeue(task.id)}
            onCancel={() => onCancel(task.id)}
          />
        ))}
        {rows.length === 0 && <p className="hint empty">当前筛选下没有任务。</p>}
      </div>
    </section>
  );
}

interface RowProps {
  state: ScheduleState;
  task: PhotoTask;
  active: boolean;
  onSelect: () => void;
  onPickUp: () => void;
  onReturn: () => void;
  onReject: (reason: "missing" | "unclear") => void;
  onRequeue: () => void;
  onCancel: () => void;
}

function TaskRowView({
  state,
  task,
  active,
  onSelect,
  onPickUp,
  onReturn,
  onReject,
  onRequeue,
  onCancel,
}: RowProps) {
  const specimen = getSpecimen(state, task.specimenId);
  const cabinet = getCabinet(state, task.cabinetId);
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div
      className={`task-row status-${task.status} ${active ? "selected" : ""}`}
      role="row"
      onClick={onSelect}
    >
      <span className="cell-id">
        <b>{task.id}</b>
        {task.priority === "urgent" && <i className="flag urgent">加急</i>}
      </span>
      <span className="cell-cab">
        <b>{cabinet?.name ?? task.cabinetId}</b>
        <small>{cabinet?.zone}</small>
      </span>
      <span className="cell-sp">
        <b>{specimen?.code ?? task.specimenId}</b>
        <small>{specimen?.species}</small>
      </span>
      <span>
        <span className={`pill prio-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
      </span>
      <span className="cell-time">
        <b>{fmtRange(task.startMin, task.durationMin)}</b>
        <small>{task.durationMin} 分钟</small>
        {task.shift && (
          <small className="shifted">
            已顺延（原 {fmtRange(task.shift.prevStart, task.shift.prevEnd - task.shift.prevStart)}）
          </small>
        )}
      </span>
      <span>
        <span className={`pill status-${task.status}`}>
          {STATUS_LABEL[task.status]}
          {task.status === "reshoot" && task.reshootReason
            ? ` · ${RESHOOT_LABEL[task.reshootReason]}`
            : ""}
        </span>
      </span>
      <span className="cell-actions" onClick={(e) => e.stopPropagation()}>
        {task.status === "scheduled" && (
          <>
            <button className="mini primary" onClick={() => onPickUp()}>取件拍摄</button>
            <button className="mini" onClick={() => onCancel()}>取消</button>
          </>
        )}
        {task.status === "shooting" && (
          <>
            <button className="mini primary" onClick={() => onReturn()}>核验归柜</button>
            <button className="mini warn" onClick={() => setRejectOpen((v) => !v)}>
              退回补拍
            </button>
            {rejectOpen && (
              <span className="reject-pop">
                <button className="mini warn" onClick={() => { onReject("missing"); setRejectOpen(false); }}>
                  照片缺失
                </button>
                <button className="mini warn" onClick={() => { onReject("unclear"); setRejectOpen(false); }}>
                  标签不清
                </button>
              </span>
            )}
          </>
        )}
        {task.status === "reshoot" && (
          <button className="mini primary" onClick={() => onRequeue()}>原柜位重排补拍</button>
        )}
        {task.status === "done" && <span className="done-mark">已归档完成</span>}
        <button className="mini link" onClick={onSelect}>详情</button>
      </span>
    </div>
  );
}
