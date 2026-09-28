// 展示层：新建 / 加急排期表单

import { useMemo, useState } from "react";
import { CABINETS, SPECIMENS } from "../domain/seed";
import type { Priority } from "../domain/types";

interface Props {
  usedSpecimenIds: Set<string>;
  onAdd: (input: {
    specimenId: string;
    cabinetId: string;
    priority: Priority;
    durationMin: number;
    note?: string;
  }) => void;
}

export function TaskForm({ usedSpecimenIds, onAdd }: Props) {
  const [specimenId, setSpecimenId] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [durationMin, setDurationMin] = useState(30);
  const [note, setNote] = useState("");

  const chosen = useMemo(() => SPECIMENS.find((s) => s.id === specimenId), [specimenId]);
  const available = SPECIMENS.filter((s) => !usedSpecimenIds.has(s.id));

  const submit = () => {
    if (!chosen) return;
    onAdd({
      specimenId: chosen.id,
      cabinetId: chosen.cabinetId,
      priority,
      durationMin: Math.max(10, Math.min(180, Math.round(durationMin) || 30)),
      note,
    });
    setSpecimenId("");
    setPriority("normal");
    setDurationMin(30);
    setNote("");
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>拍照任务</p>
          <h2>新建排期</h2>
        </div>
        <button className="primary" onClick={submit} disabled={!chosen}>
          {priority === "urgent" ? "加急插入" : "排入档期"}
        </button>
      </div>

      <div className="field-grid">
        <label>
          <span>标本（柜位按馆藏位置自动带入）</span>
          <select value={specimenId} onChange={(e) => setSpecimenId(e.target.value)}>
            <option value="">选择待拍标本…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.species}（{s.cabinetId}）
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>预计时长（分钟，10–180）</span>
          <input
            type="number"
            min={10}
            max={180}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
          />
        </label>

        <label className="priority-field">
          <span>优先级</span>
          <div className="segmented">
            <button
              type="button"
              className={priority === "normal" ? "on" : ""}
              onClick={() => setPriority("normal")}
            >
              普通
            </button>
            <button
              type="button"
              className={priority === "urgent" ? "on urgent-on" : ""}
              onClick={() => setPriority("urgent")}
            >
              加急
            </button>
          </div>
        </label>

        <label>
          <span>拍摄备注</span>
          <input
            placeholder="如：标签特写 / 叶背细节"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {chosen && (
        <div className="form-preview">
          <b>{chosen.cabinetId}</b>
          <span>
            {chosen.species} · {chosen.location} · {chosen.habitat}
          </span>
          {priority === "urgent" && (
            <em className="urgent-hint">加急将插到该柜普通任务之前，后续任务自动顺延并刷新时段</em>
          )}
        </div>
      )}

      {available.length === 0 && (
        <p className="empty-tip">所有预置标本均已在档期内；归柜或删除任务后可继续安排。</p>
      )}
      <p className="cabinet-foot">共 {CABINETS.length} 个柜位 · 取自 {SPECIMENS.length} 份预置标本</p>
    </section>
  );
}
