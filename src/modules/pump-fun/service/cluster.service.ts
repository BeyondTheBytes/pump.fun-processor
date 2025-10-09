import { Injectable } from "@nestjs/common";
import * as cluster from "cluster";
import * as os from "os";

@Injectable()
export class ClusterService {
  private readonly clusterWorker = cluster as any;

  static clusterize(
    callback: () => Promise<void>,
    workersCount?: number
  ): void {
    const clusterWorker = cluster as any;
    const numWorkers = workersCount || os.cpus().length;

    if (clusterWorker.isPrimary) {
      console.log('Pump.fun Worker Server (Clustered)\n');
      console.log(`CPU Cores: ${os.cpus().length}`);
      console.log(`Starting ${numWorkers} workers...\n`);

      for (let i = 0; i < numWorkers; i++) {
        clusterWorker.fork();
      }

      clusterWorker.on('exit', (worker: any, code: number, signal: string) => {
        console.warn(
          `Worker ${worker.process.pid} died (${signal || code}). Restarting...`
        );
        clusterWorker.fork();
      });

      clusterWorker.on('online', (worker: any) => {
        console.log(`Worker ${worker.process.pid} is online`);
      });

      callback();
    } else {
      callback();
    }
  }

  static isWorker(): boolean {
    return (cluster as any).isWorker;
  }

  static isPrimary(): boolean {
    return (cluster as any).isPrimary;
  }

  isPrimary(): boolean {
    return this.clusterWorker.isPrimary;
  }

  isWorker(): boolean {
    return this.clusterWorker.isWorker;
  }

  getWorkerId(): number | undefined {
    return this.clusterWorker.worker?.id;
  }

  getProcessId(): number {
    return process.pid;
  }

  broadcastToWorkers(message: any): void {
    if (this.isPrimary()) {
      const workers = this.clusterWorker.workers;
      for (const id in workers) {
        workers[id]?.send(message);
      }
    }
  }

  async shutdownWorkers(timeout = 10000): Promise<void> {
    if (this.isPrimary()) {
      const workers = this.clusterWorker.workers;
      const shutdownPromises: Promise<void>[] = [];

      for (const id in workers) {
        const worker = workers[id];
        if (worker) {
          shutdownPromises.push(
            new Promise<void>((resolve) => {
              worker.disconnect();
              const killTimeout = setTimeout(() => {
                worker.kill();
                resolve();
              }, timeout);

              worker.on('disconnect', () => {
                clearTimeout(killTimeout);
                resolve();
              });
            })
          );
        }
      }

      await Promise.all(shutdownPromises);
    }
  }
}