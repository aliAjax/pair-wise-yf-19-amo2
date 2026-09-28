/** 状态承接：把排期规则的纯函数操作落到本地数据，并向页面暴露 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "../data/storage";
import {
  addTask,
  cancelTask,
  pickUp,
  rejectForReshoot,
  requeueReshoot,
  returnToCabinet,
  type AddTaskInput,
} from "../rules/scheduler";
import type { OpResult, ReshootReason, ScheduleState } from "../types";

export interface Toast {
  id: number;
  kind: "ok" | "err";
  text: string;
}

export function useSchedule() {
  const [state, setState] = useState<ScheduleState>(() => storage.load());
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 每次变更写回本地：重开页面继续作业
  useEffect(() => {
    storage.save(state);
  }, [state]);

  const notify = useCallback((result: OpResult) => {
    if (!result.ok) {
      pushToast("err", result.error);
      return;
    }
    setState(result.state);
    pushToast("ok", result.message);
  }, []);

  const pushToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, kind, text }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const ops = useMemo(
    () => ({
      add: (input: AddTaskInput) => notify(addTask(state, input)),
      pickUp: (taskId: string) => notify(pickUp(state, taskId)),
      returnCabinet: (taskId: string) => notify(returnToCabinet(state, taskId)),
      reject: (taskId: string, reason: ReshootReason) =>
        notify(rejectForReshoot(state, taskId, reason)),
      requeue: (taskId: string) => notify(requeueReshoot(state, taskId)),
      cancel: (taskId: string) => notify(cancelTask(state, taskId)),
      reset: () => {
        setState(storage.reset());
        pushToast("ok", "已恢复预置柜位与标本数据");
      },
    }),
    [state, notify, pushToast]
  );

  return { state, ops, toasts };
}
