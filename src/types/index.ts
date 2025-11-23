import { z } from "zod";

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  command: z.string(),
  dependsOn: z.array(z.string()).default([]),
});

export const PipelineSchema = z.object({
  id: z.string(),
  schedule: z.string().optional(),
  failFast: z.boolean().default(false),
  tasks: z.array(TaskSchema),
});

export type Task = z.infer<typeof TaskSchema>;
export type Pipeline = z.infer<typeof PipelineSchema>;

export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: RunStatus;
  startTime: number;
  endTime?: number;
}