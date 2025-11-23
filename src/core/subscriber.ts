import { bus } from "./bus";
import { db } from "../db/client";

export function initSubscribers() {
  bus.on("run:start", (payload) => {
    db.createRun({
      id: payload.runId,
      pipelineId: payload.pipelineId,
      startTime: payload.startTime,
    });
  });

  bus.on("run:finish", (payload) => {
    db.updateRunStatus(payload.runId, payload.status, payload.endTime);
  });

  bus.on("task:start", (payload) => {
    db.createTaskRun({
      id: payload.taskRunId,
      runId: payload.runId,
      taskId: payload.taskId,
      startTime: payload.startTime,
    });
  });

  bus.on("task:finish", (payload) => {
    db.updateTaskStatus(
      payload.taskRunId,
      payload.status,
      payload.exitCode,
      payload.endTime
    );
  });

  bus.on("task:log", (payload) => {
    db.addLog(payload.taskRunId, payload.message, payload.level);
  });
}