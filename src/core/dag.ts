import { load as parse } from "js-yaml";
import fs from "node:fs/promises";
import path from "node:path";
import toposort from "toposort";
import { PipelineSchema, type Pipeline, type Task } from "../types";

const PIPELINES_DIR = path.join(process.cwd(), "pipelines");

export class DagRegistry {
  async loadPipeline(filename: string): Promise<Pipeline> {
    const filePath = path.join(PIPELINES_DIR, filename);
    
    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      const raw = parse(fileContents);
      
      const pipeline = PipelineSchema.parse(raw);
      
      this.validateGraph(pipeline.tasks);

      return pipeline;
    } catch (error) {
      console.error(`Failed to load pipeline ${filename}:`, error);
      throw error;
    }
  }

  private validateGraph(tasks: Task[]) {
    const edges: [string, string][] = [];
    const taskIds = new Set(tasks.map((t) => t.id));

    tasks.forEach((task) => {
      task.dependsOn.forEach((depId) => {
        if (!taskIds.has(depId)) {
          throw new Error(`Task '${task.id}' depends on unknown task '${depId}'`);
        }
        edges.push([depId, task.id]);
      });
    });

    toposort(edges);
  }
}

export const registry = new DagRegistry();