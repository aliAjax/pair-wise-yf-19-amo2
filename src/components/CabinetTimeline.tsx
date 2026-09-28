import { endMin, fmtMin, fmtRange } from "../rules/scheduler";
import type { PhotoTask, ScheduleState } from "../types";
import { STATUS_LABEL } from "../types";
import { getSpecimen, timelineSpan } from "../state/selectors";

interface Props {
  state: ScheduleState;
  selectedId: string | null;
  onSelect: (taskId: string) => void;
}

export default function CabinetTimeline({ state, selectedId, onSelect }: Props) {
  const span = timelineSpan(state);
  const width = span.end - span.start;
  const hours: number[] = [];
  for (let h = Math.floor(span.start / 60); h * 60 <= span.end; h += 1) hours.push(h * 60);

  const pct = (min: number) => `${((min - span.start) / width) * 100}%`;

  return (
    <section className="panel timeline-card">
      <div className="heading">
        <div>
          <p>柜位时间轴</p>
          <h2>同一柜位同一时段不重叠</h2>
        </div>
        <div className="legend">
          <i className="lg normal" />普通
          <i className="lg urgent" />加急
          <i className="lg shooting" />拍摄中
          <i className="lg free" />空档
        </div>
      </div>

      <div className="tl-scroll">
        <div className="tl-grid">
          <div className="tl-head-row">
            <div className="tl-cab-label" />
            <div className="tl-track" style={{ position: "relative" }}>
              {hours.map((h) => (
                <span
                  key={h}
                  className="tl-hour"
                  style={{ left: pct(h) }}
                >
                  {fmtMin(h)}
                </span>
              ))}
            </div>
          </div>

          {state.cabinets.map((cabinet) => {
            const blocks = state.tasks
              .filter(
                (t) =>
                  t.cabinetId === cabinet.id &&
                  (t.status === "scheduled" || t.status === "shooting")
              )
              .sort((a, b) => a.startMin - b.startMin);
            const reshoots = state.tasks.filter(
              (t) => t.cabinetId === cabinet.id && t.status === "reshoot"
            );

            return (
              <div key={cabinet.id} className="tl-row">
                <div className="tl-cab-label">
                  <b>{cabinet.name}</b>
                  <small>{cabinet.zone}</small>
                  <small className="cab-note">{cabinet.note}</small>
                </div>
                <div className="tl-track">
                  {hours.map((h) => (
                    <i key={h} className="tl-gridline" style={{ left: pct(h) }} />
                  ))}
                  {blocks.map((task) => (
                    <Block
                      key={task.id}
                      state={state}
                      task={task}
                      span={span}
                      width={width}
                      selected={task.id === selectedId}
                      onSelect={() => onSelect(task.id)}
                    />
                  ))}
                  {blocks.length === 0 && <span className="tl-empty">暂无占用，可随时排入</span>}
                  {reshoots.map((t) => (
                    <span key={t.id} className="tl-reshoot-flag" onClick={() => onSelect(t.id)}>
                      {t.id} 待补拍 · {getSpecimen(state, t.specimenId)?.code}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Block({
  state,
  task,
  span,
  width,
  selected,
  onSelect,
}: {
  state: ScheduleState;
  task: PhotoTask;
  span: { start: number; end: number };
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const specimen = getSpecimen(state, task.specimenId);
  const left = ((task.startMin - span.start) / width) * 100;
  const blockWidth = Math.max(
    ((task.startMin + task.durationMin - span.start) / width) * 100 - left,
    2.4
  );

  return (
    <button
      type="button"
      className={`tl-block prio-${task.priority} status-${task.status} ${selected ? "selected" : ""}`}
      style={{ left: `${left}%`, width: `${blockWidth}%` }}
      onClick={onSelect}
      title={`${task.id} · ${fmtRange(task.startMin, task.durationMin)} · ${STATUS_LABEL[task.status]}`}
    >
      <span className="tlb-id">
        {task.id}
        {task.priority === "urgent" && <em>急</em>}
      </span>
      <span className="tlb-sp">{specimen?.code}</span>
      <span className="tlb-time">
        {fmtMin(task.startMin)}–{fmtMin(endMin(task))}
      </span>
      {task.shift && <span className="tlb-shift">已顺延</span>}
    </button>
  );
}
