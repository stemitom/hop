import { v4 as uuidv4 } from "uuid";
import { bus } from "./bus";
import type { Pipeline, Task } from "../types";

export class PipelineRunner {
  private activeRuns = new Map<string, Promise<void>>();

  async run(pipeline: Pipeline) {
    const runId = uuidv4();
    const runStartTime = Date.now();
    const abortController = new AbortController();

    bus.emit("run:start", { runId, pipelineId: pipeline.id, startTime: runStartTime });

    const taskMap = new Map(pipeline.tasks.map((t) => [t.id, t]));

    const taskPromises = new Map<string, Promise<void>>();

    const executeTask = async (taskId: string): Promise<void> => {
      const task = taskMap.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);

      if (taskPromises.has(taskId)) {
        return taskPromises.get(taskId)!;
      }

      const promise = (async () => {
        if (abortController.signal.aborted) {
          throw new Error("Pipeline aborted due to fail-fast");
        }

        if (task.dependsOn.length > 0) {
          await Promise.all(task.dependsOn.map((depId) => executeTask(depId)));
        }

        if (abortController.signal.aborted) {
          throw new Error("Pipeline aborted due to fail-fast");
        }

        await this.runShellCommand(task, runId, abortController.signal);
      })();

      taskPromises.set(taskId, promise);
      return promise;
    };

    try {
      await Promise.all(pipeline.tasks.map((t) => executeTask(t.id)));

      bus.emit("run:finish", { runId, status: "completed", endTime: Date.now() });
    } catch (error) {
      if (pipeline.failFast) {
        abortController.abort();
      }
      console.error("Pipeline failed:", error);
      bus.emit("run:finish", { runId, status: "failed", endTime: Date.now() });
    }
  }

  private async runShellCommand(task: Task, runId: string, signal: AbortSignal) {
    const taskRunId = uuidv4();
    const startTime = Date.now();

    bus.emit("task:start", { taskRunId, runId, taskId: task.id, startTime });

    if (signal.aborted) {
      bus.emit("task:finish", { taskRunId, status: "failed", exitCode: null, endTime: Date.now() });
      throw new Error("Task aborted due to fail-fast");
    }

    try {
      // TODO: Is this the only way?
      const proc = Bun.spawn(["sh", "-c", task.command], {
        stdout: "pipe",
        stderr: "pipe",
      });

      signal.addEventListener("abort", () => proc.kill(), { once: true });

      const streamOutput = async (stream: ReadableStream, level: "info" | "error") => {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value).trim();
          if (text) {
            text.split("\n").forEach((line) => {
              bus.emit("task:log", { taskRunId, message: line, level });
            });
          }
        }
      };

      await Promise.all([
        streamOutput(proc.stdout, "info"),
        streamOutput(proc.stderr, "error"),
        proc.exited,
      ]);

      if (proc.exitCode !== 0) {
        throw new Error(`Exit code ${proc.exitCode}`);
      }

      bus.emit("task:finish", { taskRunId, status: "completed", exitCode: 0, endTime: Date.now() });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      bus.emit("task:log", { taskRunId, message: `Exec failed: ${msg}`, level: "error" });

      bus.emit("task:finish", { taskRunId, status: "failed", exitCode: 1, endTime: Date.now() });
      throw e;
    }
  }
}

export const runner = new PipelineRunner();
