// 展示层：任务详情与流转操作（取件 → 拍摄中 → 归柜 / 退回补拍）

import { isLocked, isQueued } from "../domain/schedule";
import type { ReworkReason, Task } from "../domain/types";
import {
  PRIORITY_TEXT,
  REWORK_TEXT,
  STATUS_TEXT,
  cabinetName,
  cabinetZone,
  fmtMin,
  fmtRange,
  fmtTime,
  specimenOf,
} from "./format";

interface Props {
  task: Task | null;
  onPick: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onReject: (id: string, reason: ReworkReason) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function TaskDetail({ task, onPick, onStart, onComplete, onReject, onRemove, onClose }: Props) {
  if (!task) {
    return (
      <section className="panel detail-panel empty">
        <p>从列表或时间轴选择一条排期，</p>
        <p>可查看柜位、优先级、预计时长，并办理取件 / 归柜 / 退回补拍。</p>
      </section>
    );
  }

  const sp = specimenOf(task.specimenId);
  const locked = isLocked(task);
  const busy = task.status === "shooting" || task.status === "picked";

  return (
    <section className="panel detail-panel">
      <div className="heading">
        <div>
          <p>任务详情</p>
          <h2>{sp?.code}</h2>
        </div>
        <button className="ghost" onClick={onClose}>收起</button>
      </div>

      <dl className="detail-grid">
        <div><dt>物种</dt><dd>{sp?.species}</dd></div>
        <div><dt>采集地点</dt><dd>{sp?.location}</dd></div>
        <div><dt>生境</dt><dd>{sp?.habitat}</dd></div>
        <div>
          <dt>排期柜位</dt>
          <dd>{task.cabinetId} · {cabinetName(task.cabinetId)}
            <small className="muted">（{cabinetZone(task.cabinetId)}）</small>
          </dd>
        </div>
        <div><dt>优先级</dt><dd><span className={`tag prio-${task.priority}`}>{PRIORITY_TEXT[task.priority]}</span></dd></div>
        <div><dt>预计时长</dt><dd>{task.durationMin} 分钟</dd></div>
        <div><dt>当前状态</dt><dd><span className={`tag status-tag status-${task.status}`}>{STATUS_TEXT[task.status]}</span></dd></div>
        <div>
          <dt>排期时段</dt>
          <dd>
            {fmtRange(task.startMin, task.endMin)}
            {task.delayed && task.prevStartMin !== undefined && (
              <span className="shifted-badge">
                由 {fmtMin(task.prevStartMin)} 顺延至 {fmtMin(task.startMin!)}
              </span>
            )}
          </dd>
        </div>
        {task.status === "rework" && task.reworkReason && (
          <div className="full">
            <dt>补拍原因</dt>
            <dd><span className="tag rework-tag">{REWORK_TEXT[task.reworkReason]}</span> 原柜位 {task.cabinetId} 保留，重新排队等待取件</dd>
          </div>
        )}
        {task.note && (
          <div className="full"><dt>备注</dt><dd>{task.note}</dd></div>
        )}
      </dl>

      <div className="actions">
        {isQueued(task) && (
          <button className="primary" onClick={() => onPick(task.id)}>取件（柜位开始占用）</button>
        )}
        {task.status === "picked" && (
          <button className="primary" onClick={() => onStart(task.id)}>开始拍摄</button>
        )}
        {busy && (
          <>
            <button className="success" onClick={() => onComplete(task.id)}>质检通过 · 归柜</button>
            <button className="danger" onClick={() => onReject(task.id, "missing_photo")}>照片缺失退回</button>
            <button className="danger" onClick={() => onReject(task.id, "unclear_label")}>标签不清退回</button>
          </>
        )}
        {!locked && (
          <button className="ghost danger-ghost" onClick={() => onRemove(task.id)}>删除排期</button>
        )}
        {locked && <small className="muted">已进入取件/拍摄流程，归柜前不可改排或删除。</small>}
      </div>

      <div className="logs">
        <h4>流转记录</h4>
        <ul>
          {[...task.logs].reverse().map((l, i) => (
            <li key={`${l.t}-${i}`}>
              <time>{fmtTime(l.t)}</time>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
