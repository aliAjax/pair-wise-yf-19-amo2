import { useState } from "react";
import "./styles.css";
import ScheduleForm from "./components/ScheduleForm";
import TaskList from "./components/TaskList";
import CabinetTimeline from "./components/CabinetTimeline";
import TaskDetail from "./components/TaskDetail";
import { metrics } from "./state/selectors";
import { useSchedule } from "./state/store";
import type { ReshootReason } from "./types";

export default function App() {
  const { state, ops, toasts } = useSchedule();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cards = metrics(state);

  const reject = (id: string, reason: ReshootReason) => ops.reject(id, reason);

  return (
    <main className="app">
      <section className="hero">
        <div className="hero-row">
          <p>标本馆数字化 · 拍照排期台</p>
          <button className="ghost" onClick={ops.reset} title="清空本地修改，恢复预置数据">
            重置演示数据
          </button>
        </div>
        <h1>取件、拍摄、归柜，按柜位时段排开</h1>
        <span>
          每项排期写明柜位、优先级与预计时长；同一柜位同一时段只排一项。加急任务插队后，后续普通任务自动顺延并显示新时段。
          取件即进入拍摄中，归柜前不能再排；照片缺失或标签不清退回补拍，原柜位保留。数据保存在本地，重开页面继续作业。
        </span>
      </section>

      <section className="metrics">
        {cards.map((card) => (
          <article key={card.label} className={card.tone}>
            <small>{card.label}</small>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <ScheduleForm state={state} onAdd={ops.add} />

      <CabinetTimeline
        state={state}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <TaskList
        state={state}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPickUp={ops.pickUp}
        onReturn={ops.returnCabinet}
        onReject={reject}
        onRequeue={ops.requeue}
        onCancel={ops.cancel}
      />

      <section className="panel rules-panel">
        <p>排期规则说明</p>
        <ul>
          <li><b>普通任务</b>：自动排入对应柜位最早空档，按柜位时间先后顺延。</li>
          <li><b>加急任务</b>：指定插入时段；与拍摄中任务或其他加急任务冲突时拒绝插入；后续普通任务顺延，列表标注新时段与原时段。</li>
          <li><b>状态流转</b>：已排期 →（取件）拍摄中 →（核验）已归柜；照片缺失 / 标签不清则拍摄中 → 需补拍 → 原柜位重排。</li>
          <li><b>占用规则</b>：取件后、归柜前同一标本不可再排；需补拍与已归柜不占用拍摄时段。</li>
        </ul>
      </section>

      {selectedId && (
        <TaskDetail
          state={state}
          taskId={selectedId}
          onClose={() => setSelectedId(null)}
          onPickUp={ops.pickUp}
          onReturn={ops.returnCabinet}
          onReject={reject}
          onRequeue={ops.requeue}
        />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "ok" ? "✓" : "!"} {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
