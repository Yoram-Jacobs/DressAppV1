/**
 * apps/mobile/src/lib/stores/workStore.ts
 *
 * Background work progress store for tracking async AI processing jobs
 * (e.g. batch item segmentation, clothing cutout analysis, background jobs).
 * Matches apps/web/src/lib/workStore.js.
 */

import { useState, useEffect } from 'react';

export interface WorkJob {
  id: string;
  itemId?: string;
  title?: string;
  thumbnail_data_url?: string;
  image_url?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  stage?: string;
  progress?: number;
  error?: string;
  created_at: number;
}

export interface WorkStoreState {
  jobs: WorkJob[];
  activeCount: number;
  completedCount: number;
  lastCompletedBatch: number;
}

type Listener = (state: WorkStoreState) => void;

class WorkStore {
  private jobs: WorkJob[] = [];
  private listeners: Set<Listener> = new Set();
  private lastCompletedBatch: number = 0;

  getState(): WorkStoreState {
    const activeCount = this.jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
    const completedCount = this.jobs.filter((j) => j.status === 'completed').length;
    return {
      jobs: [...this.jobs],
      activeCount,
      completedCount,
      lastCompletedBatch: this.lastCompletedBatch,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  addJob(job: Omit<WorkJob, 'created_at'>): string {
    const id = job.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullJob: WorkJob = { ...job, id, created_at: Date.now() };
    this.jobs.unshift(fullJob);
    this.notify();
    return id;
  }

  updateJob(id: string, updates: Partial<WorkJob>) {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx !== -1) {
      this.jobs[idx] = { ...this.jobs[idx], ...updates };
      if (updates.status === 'completed') {
        const remaining = this.jobs.filter((j) => j.status === 'pending' || j.status === 'running').length;
        if (remaining === 0) {
          this.lastCompletedBatch = Date.now();
        }
      }
      this.notify();
    }
  }

  removeJob(id: string) {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    this.notify();
  }

  clearCompleted() {
    this.jobs = this.jobs.filter((j) => j.status === 'pending' || j.status === 'running');
    this.notify();
  }
}

export const workStore = new WorkStore();

export function useWorkStore(): WorkStoreState {
  const [state, setState] = useState<WorkStoreState>(workStore.getState());

  useEffect(() => {
    return workStore.subscribe(setState);
  }, []);

  return state;
}
