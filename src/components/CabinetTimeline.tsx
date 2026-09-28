// 展示层：柜位时间轴（同一柜位同一时段不重叠的可视化）

import { CABINETS, DAY_END_MIN, DAY_START_MIN } from "../domain/seed";
import type { Task } from "../domain/types";
import { fmtMin, specimenOf } from "./format";

interface Props {
  tasks: Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const HOURS: number[] = [];
for (let h = 8; h <= 18; h++) HOURS.push(h);

export function CabinetTimeline({ tasks, selectedId, onSelect }: Props) {
  const span = DAY_END_MIN - DAY_START_MIN;

  return (
    <section className="panel timeline-panel">
      <div className="heading">
        <div>
          <p>柜位视图</p>
          <h2>柜位时间轴</h2>
        </div>
        <div className="legend">
          <span><i className="lg scheduled" />待取件</span>
          <span><i className="lg urgent" />加急</span>
          <span><i className="lg busy" />取件/拍摄中</span>
          <span><i className="lg rework" />补拍</span>
          <span><i className="lg done" />已归柜</span>
        </div>
      </div>

      <div className="ruler">
        <span className="ruler-corner">柜位 ＼ 时间</span>
        {HOURS.map((h) => (
          <span key={h} className="ruler-hour" style={{ left: pct(h * 60) }}>
            {fmtMin(h * 60)}
          </span>
        ))}
      </div>

      <div className="lanes">
        {CABINETS.map((c) => {
          const laneTasks = tasks
            .filter((t) => t.cabinetId === c.id && t.startMin !== undefined)
            .sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0));
          return (
            <div key={c.id} className="lane">
              <div className="lane-label">
                <b>{c.id}</b>
                <small>{c.zone}</small>
              </div>
              <div className="lane-track">
                {HOURS.slice(1, -1).map((h) => (
                  <i key={h} className="gridline" style={{ left: pct(h * 60) }} />
                ))}
                {laneTasks.map((t) => {
                  const sp = specimenOf(t.specimenId);
                  const left = pct(t.startMin!);
                  const width = ((t.endMin! - t.startMin!) / span) * 100;
                  const cls =
                    t.status === "done"
                      ? "done"
                      : t.status === "picked" || t.status === "shooting"
                        ? "busy"
                        : t.status === "rework"
                          ? "rework"
                          : t.priority === "urgent"
                            ? "urgent"
                            : "scheduled";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`block ${cls} ${selectedId === t.id ? "selected" : ""}`}
                      style={{ left: `${left}%`, width: `${Math.max(width, 2.2)}%` }}
                      title={`${sp?.code} ${fmtMin(t.startMin!)}–${fmtMin(t.endMin!)}`}
                      onClick={() => onSelect(t.id)}
                    >
                      <b>{sp?.code}</b>
                      <small>
                        {fmtMin(t.startMin!)}–{fmtMin(t.endMin!)}
                      </small>
                      {t.delayed && <em className="block-shift">顺延</em>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  function pct(min: number): number {
    return ((min - DAY_START_MIN) / span) * 100;
  }
}
