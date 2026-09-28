import { useMemo, useState } from "react";
import {
  DAY_END,
  fmtMin,
  suggestEarliest,
} from "../rules/scheduler";
import type { Priority, ScheduleState } from "../types";
import { bookableSpecimens, activeTaskOf } from "../state/selectors";

interface Props {
  state: ScheduleState;
  onAdd: (input: {
    specimenId: string;
    priority: Priority;
    durationMin: number;
    startMin?: number;
    note?: string;
  }) => void;
}

const DURATIONS = [15, 20, 25, 30, 40, 45, 60];

export default function ScheduleForm({ state, onAdd }: Props) {
  const [cabinetFilter, setCabinetFilter] = useState<string>("all");
  const [specimenId, setSpecimenId] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [duration, setDuration] = useState(30);
  const [urgentTime, setUrgentTime] = useState(8 * 60 + 30);
  const [note, setNote] = useState("");

  const options = useMemo(() => {
    const list = bookableSpecimens(state);
    return cabinetFilter === "all"
      ? list
      : list.filter((s) => s.cabinetId === cabinetFilter);
  }, [state, cabinetFilter]);

  const chosen = state.specimens.find((s) => s.id === specimenId);
  const active = chosen ? activeTaskOf(state, chosen.id) : undefined;

  const suggest = chosen
    ? suggestEarliest(state, chosen.cabinetId, duration)
    : null;
  const suggestFits = suggest !== null && suggest + duration <= DAY_END;

  // 加急时段下拉：08:00–17:30，每 15 分钟一档
  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    for (let m = 8 * 60; m + 15 <= 18 * 60; m += 15) slots.push(m);
    return slots;
  }, []);

  const submit = () => {
    if (!specimenId) return;
    onAdd({
      specimenId,
      priority,
      durationMin: duration,
      startMin: priority === "urgent" ? urgentTime : undefined,
      note: note.trim() || undefined,
    });
    setSpecimenId("");
    setNote("");
  };

  return (
    <section className="panel form-card">
      <div className="heading">
        <div>
          <p>新建排期</p>
          <h2>拍照任务登记</h2>
        </div>
        <span className="rule-tag">普通自动排入 · 加急指定时段顺延后续</span>
      </div>

      <div className="form-row">
        <label>
          <span>柜位筛选</span>
          <select value={cabinetFilter} onChange={(e) => setCabinetFilter(e.target.value)}>
            <option value="all">全部柜位</option>
            {state.cabinets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          <span>标本（采集号 · 物种）</span>
          <select
            value={specimenId}
            onChange={(e) => setSpecimenId(e.target.value)}
          >
            <option value="">请选择待拍标本</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.species}（{s.shelf}）
              </option>
            ))}
          </select>
        </label>
      </div>

      {options.length === 0 && (
        <p className="hint warn">所选柜位的标本都已在流程中或已归柜，可到列表处理在途任务。</p>
      )}

      {chosen && (
        <div className="spec-mini">
          <b>{chosen.code}</b>
          <span>{chosen.species}</span>
          <span>{chosen.family}</span>
          <span>{chosen.locale}</span>
          <em>{chosen.shelf}</em>
          {active && <strong className="mini-lock">在途：{active.id} 占用中</strong>}
        </div>
      )}

      <div className="form-row">
        <label>
          <span>优先级</span>
          <div className="seg">
            <button
              type="button"
              className={priority === "normal" ? "on" : ""}
              onClick={() => setPriority("normal")}
            >
              普通
            </button>
            <button
              type="button"
              className={priority === "urgent" ? "on danger" : "danger"}
              onClick={() => setPriority("urgent")}
            >
              加急
            </button>
          </div>
        </label>
        <label>
          <span>预计时长</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} 分钟
              </option>
            ))}
          </select>
        </label>
        {priority === "urgent" ? (
          <label>
            <span>插入时段（起）</span>
            <select
              value={urgentTime}
              onChange={(e) => setUrgentTime(Number(e.target.value))}
            >
              {timeSlots.map((m) => (
                <option key={m} value={m}>
                  {fmtMin(m)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span>预计排入</span>
            <div className={`auto-slot ${suggestFits ? "" : "bad"}`}>
              {suggest === null
                ? "选择标本后显示"
                : suggestFits
                  ? `${fmtMin(suggest)}–${fmtMin(suggest + duration)}`
                  : "当日已满"}
            </div>
          </label>
        )}
      </div>

      <div className="form-row">
        <label className="grow">
          <span>备注（选填）</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="如：台纸边缘破损、需侧光补拍标签"
          />
        </label>
        <button
          className="primary"
          disabled={!specimenId || (priority === "normal" && suggestFits === false)}
          onClick={submit}
        >
          {priority === "urgent" ? "加急插入并顺延" : "排入最早空档"}
        </button>
      </div>

      {priority === "urgent" && (
        <p className="hint danger-hint">
          加急任务固定占用所选时段；同柜位拍摄中或其他加急任务占用时将被拒绝；后续普通任务自动顺延并显示新时段。
        </p>
      )}
    </section>
  );
}
