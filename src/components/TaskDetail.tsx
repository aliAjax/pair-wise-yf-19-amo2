import { fmtRange } from "../rules/scheduler";
import type { ScheduleState } from "../types";
import { PRIORITY_LABEL, RESHOOT_LABEL, STATUS_LABEL } from "../types";
import { getCabinet, getSpecimen } from "../state/selectors";

interface Props {
  state: ScheduleState;
  taskId: string | null;
  onClose: () => void;
  onPickUp: (id: string) => void;
  onReturn: (id: string) => void;
  onReject: (id: string, reason: "missing" | "unclear") => void;
  onRequeue: (id: string) => void;
}

export default function TaskDetail({
  state,
  taskId,
  onClose,
  onPickUp,
  onReturn,
  onReject,
  onRequeue,
}: Props) {
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : undefined;
  if (!task) return null;

  const specimen = getSpecimen(state, task.specimenId);
  const cabinet = getCabinet(state, task.cabinetId);

  return (
    <div className="drawer-mask" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p>任务详情</p>
            <h2>
              {task.id}
              <span className={`pill prio-${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
              <span className={`pill status-${task.status}`}>{STATUS_LABEL[task.status]}</span>
            </h2>
          </div>
          <button className="mini" onClick={onClose}>关闭</button>
        </header>

        <div className="detail-grid">
          <section className="detail-box">
            <h3>标本信息</h3>
            <dl>
              <dt>采集号</dt>
              <dd>{specimen?.code}</dd>
              <dt>物种</dt>
              <dd>
                {specimen?.species}
                <small>{specimen?.family}</small>
              </dd>
              <dt>采集地点</dt>
              <dd>{specimen?.locale}</dd>
              <dt>生境</dt>
              <dd>{specimen?.habitat}</dd>
              <dt>采集人</dt>
              <dd>{specimen?.collector}</dd>
              {task.note && (
                <>
                  <dt>拍摄备注</dt>
                  <dd className="note-dd">{task.note}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="detail-box">
            <h3>排期与柜位</h3>
            <dl>
              <dt>拍摄柜位</dt>
              <dd>
                {cabinet?.name}
                <small>{cabinet?.zone} · {cabinet?.note}</small>
              </dd>
              <dt>原存放格位</dt>
              <dd>{specimen?.shelf}（补拍时原柜位保留）</dd>
              <dt>预计时段</dt>
              <dd>
                <b className="range">{fmtRange(task.startMin, task.durationMin)}</b>
                <small>预计时长 {task.durationMin} 分钟</small>
              </dd>
              <dt>创建时间</dt>
              <dd>{task.createdAt}</dd>
            </dl>
          </section>
        </div>

        {task.shift && (
          <section className="detail-box shift-box">
            <h3>顺延记录</h3>
            <p>
              {task.shift.reason}。原时段{" "}
              <del>
                {fmtRange(
                  task.shift.prevStart,
                  task.shift.prevEnd - task.shift.prevStart
                )}
              </del>{" "}
              → 新时段 <b>{fmtRange(task.startMin, task.durationMin)}</b>
              <small>（{task.shift.at}）</small>
            </p>
          </section>
        )}

        {task.status === "reshoot" && (
          <section className="detail-box reshoot-box">
            <h3>补拍原因</h3>
            <p>
              {task.reshootReason ? RESHOOT_LABEL[task.reshootReason] : "—"}
              ，标本未归柜，原柜位 <b>{cabinet?.name}</b> 保留；重排后仍在该柜位拍摄。
            </p>
          </section>
        )}

        <section className="detail-box">
          <h3>流转记录</h3>
          <ol className="history">
            {task.history.map((h, i) => (
              <li key={i}>
                <time>{h.at}</time>
                <span>{h.action}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="drawer-actions">
          {task.status === "scheduled" && (
            <button className="primary" onClick={() => onPickUp(task.id)}>
              取件，进入拍摄中
            </button>
          )}
          {task.status === "shooting" && (
            <>
              <button className="primary" onClick={() => onReturn(task.id)}>
                核验通过，归柜
              </button>
              <button onClick={() => onReject(task.id, "missing")}>
                退回：照片缺失
              </button>
              <button onClick={() => onReject(task.id, "unclear")}>
                退回：标签不清
              </button>
            </>
          )}
          {task.status === "reshoot" && (
            <button className="primary" onClick={() => onRequeue(task.id)}>
              原柜位重新排入补拍
            </button>
          )}
          {task.status === "done" && <span className="done-mark">该任务已归柜完成</span>}
        </footer>
      </aside>
    </div>
  );
}
