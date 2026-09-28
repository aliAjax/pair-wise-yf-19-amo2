// 展示层：排期列表（按开始时间排序，展示柜位 / 优先级 / 预计时长 / 新时段）

import { isLocked } from "../domain/schedule";
import type { Task } from "../domain/types";
import {
  PRIORITY_TEXT,
  REWORK_TEXT,
  STATUS_TEXT,
  cabinetName,
  fmtMin,
  fmtRange,
  specimenOf,
} from "./format";

interface Props {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ScheduleList({ tasks, selectedId, onSelect }: Props) {
  const sorted = [...tasks].sort((a, b) => {
    const sa = a.startMin ?? 24 * 60;
    const sb = b.startMin ?? 24 * 60;
    return sa - sb || a.cabinetId.localeCompare(b.cabinetId) || a.seq - b.seq;
  });

  return (
    <section className="panel list-panel">
      <div className="heading">
        <div>
          <p>当日档期</p>
          <h2>排期列表</h2>
        </div>
        <span className="muted">共 {tasks.length} 条 · 点击查看详情与流转</span>
      </div>

      <div className="task-rows">
        {sorted.map((t, i) => {
          const sp = specimenOf(t.specimenId);
          return (
            <article
              key={t.id}
              className={`task-row status-${t.status} ${selectedId === t.id ? "selected" : ""}`}
              onClick={() => onSelect(t.id)}
            >
              <div className="row-time">
                <b>{t.startMin !== undefined ? fmtMin(t.startMin) : "--:--"}</b>
                <small>{fmtRange(t.startMin, t.endMin)}</small>
                {t.delayed && t.prevStartMin !== undefined && (
                  <small className="shifted">
                    {fmtMin(t.prevStartMin)} → {fmtMin(t.startMin!)} 顺延
                  </small>
                )}
              </div>
              <div className="row-main">
                <h3>
                  <span className="order-no">{String(i + 1).padStart(2, "0")}</span>
                  {sp?.code} · {sp?.species}
                </h3>
                <p>
                  <span className="tag cabinet-tag">{t.cabinetId} · {cabinetName(t.cabinetId)}</span>
                  <span className={`tag prio-${t.priority}`}>{PRIORITY_TEXT[t.priority]}</span>
                  <span className="tag duration-tag">约 {t.durationMin} 分钟</span>
                  <span className={`tag status-tag status-${t.status}`}>{STATUS_TEXT[t.status]}</span>
                  {t.status === "rework" && t.reworkReason && (
                    <span className="tag rework-tag">补拍：{REWORK_TEXT[t.reworkReason]}</span>
                  )}
                  {isLocked(t) && <span className="tag lock-tag">柜位锁定</span>}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
