import { Database } from "bun:sqlite";
import type { RunStatus } from "../types";

export class HopDatabase {
  private db: Database;

  constructor() {
    this.db = new Database("hop.sqlite", { create: true });
    
    // concurrent read/write for runners and UI
    this.db.run("PRAGMA journal_mode = WAL;");
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS task_runs (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        exit_code INTEGER,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        FOREIGN KEY(run_id) REFERENCES runs(id)
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_run_id TEXT NOT NULL,
        level TEXT DEFAULT 'info',
        message TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY(task_run_id) REFERENCES task_runs(id)
      );
    `);
    
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_logs_task_run ON logs(task_run_id);`);
  }


  createRun(run: { id: string; pipelineId: string; startTime: number }) {
    const query = this.db.query(`
      INSERT INTO runs (id, pipeline_id, status, start_time)
      VALUES ($id, $pipelineId, $status, $startTime)
    `);
    query.run({
      $id: run.id,
      $pipelineId: run.pipelineId,
      $status: "pending" as RunStatus,
      $startTime: run.startTime,
    });
  }

  updateRunStatus(id: string, status: RunStatus, endTime?: number) {
    const query = this.db.query(`
      UPDATE runs SET status = $status, end_time = $endTime WHERE id = $id
    `);
    query.run({ $id: id, $status: status, $endTime: endTime || null });
  }

  createTaskRun(taskRun: { id: string; runId: string; taskId: string; startTime: number }) {
    const query = this.db.query(`
      INSERT INTO task_runs (id, run_id, task_id, status, start_time)
      VALUES ($id, $runId, $taskId, $status, $startTime)
    `);
    query.run({
      $id: taskRun.id,
      $runId: taskRun.runId,
      $taskId: taskRun.taskId,
      $status: "pending" as RunStatus,
      $startTime: taskRun.startTime,
    });
  }

  updateTaskStatus(id: string, status: RunStatus, exitCode: number | null, endTime?: number) {
    const query = this.db.query(`
      UPDATE task_runs 
      SET status = $status, exit_code = $exitCode, end_time = $endTime 
      WHERE id = $id
    `);
    query.run({
      $id: id,
      $status: status,
      $exitCode: exitCode,
      $endTime: endTime || null
    });
  }

  addLog(taskRunId: string, message: string, level: "info" | "error" = "info") {
    const query = this.db.query(`
      INSERT INTO logs (task_run_id, level, message, timestamp)
      VALUES ($taskRunId, $level, $message, $timestamp)
    `);
    query.run({
      $taskRunId: taskRunId,
      $level: level,
      $message: message,
      $timestamp: Date.now(),
    });
  }


  getRun(id: string) {
    return this.db.query("SELECT * FROM runs WHERE id = $id").get({ $id: id });
  }
  
  getTaskRuns(runId: string) {
    return this.db.query("SELECT * FROM task_runs WHERE run_id = $runId").all({ $runId: runId });
  }
}

export const db = new HopDatabase();