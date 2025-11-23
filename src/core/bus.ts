import EventEmitter from "node:events";
import type { RunStatus } from "../types";

interface BusEvents {
  "run:start": (payload: { runId: string; pipelineId: string; startTime: number }) => void;

  "run:finish": (payload: { runId: string; status: RunStatus; endTime: number }) => void;

  "task:start": (payload: { taskRunId: string; runId: string; taskId: string; startTime: number }) => void;

  "task:log": (payload: { taskRunId: string; message: string; level: "info" | "error" }) => void;

  "task:finish": (payload: {
    taskRunId: string;
    status: RunStatus;
    exitCode: number | null;
    endTime: number
  }) => void;
}

class TypedEmitter extends EventEmitter {
  override emit<K extends keyof BusEvents>(event: K, ...args: Parameters<BusEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof BusEvents>(event: K, listener: BusEvents[K]): this {
    return super.on(event, listener);
  }
}

export const bus = new TypedEmitter();

// DEBUG
bus.on("task:log", (p) => console.log(`[LOG] ${p.message}`));