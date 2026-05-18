import {
  OrchestrationOperationLocks,
  type BranchMergeLockRequest,
  type WorkspaceCleanupLockRequest,
} from './operation-locks.js';

type MaybePromise<T> = T | Promise<T>;

export interface TaskBranchMergeRequest extends BranchMergeLockRequest {
  taskId: string;
  sourceBranch: string;
  expectedHeadSha?: string;
}

export interface TaskWorkspaceCleanupRequest extends WorkspaceCleanupLockRequest {
  taskId: string;
}

export interface TaskBranchMergeWithCleanupRequest extends TaskBranchMergeRequest {
  workspacePath: string;
}

export interface TaskWorkspaceCleanupQueued {
  taskId: string;
  workspacePath: string;
  status: 'queued';
  queuedAt: string;
}

export interface TaskBranchMergeWithCleanupResult<TMergeResult = unknown> {
  merge: TMergeResult;
  cleanup: TaskWorkspaceCleanupQueued;
}

export interface TaskBranchMerger<TResult = unknown> {
  mergeTaskBranch(request: TaskBranchMergeRequest): MaybePromise<TResult>;
}

export interface TaskWorkspaceCleaner<TResult = unknown> {
  cleanupTaskWorkspace(request: TaskWorkspaceCleanupRequest): MaybePromise<TResult>;
}

export interface TaskWorkspaceCleanupQueue {
  enqueueTaskWorkspaceCleanup(
    request: TaskWorkspaceCleanupRequest,
    runCleanup: () => Promise<unknown>,
  ): MaybePromise<TaskWorkspaceCleanupQueued>;
}

export interface AsyncTaskWorkspaceCleanupQueueOptions {
  now?: () => Date;
  schedule?: (operation: () => void) => void;
  onError?: (error: unknown, request: TaskWorkspaceCleanupRequest) => void;
}

export class AsyncTaskWorkspaceCleanupQueue implements TaskWorkspaceCleanupQueue {
  private readonly now: () => Date;
  private readonly schedule: (operation: () => void) => void;
  private readonly onError?: (error: unknown, request: TaskWorkspaceCleanupRequest) => void;

  constructor(options: AsyncTaskWorkspaceCleanupQueueOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.schedule = options.schedule ?? ((operation) => {
      setImmediate(operation);
    });
    this.onError = options.onError;
  }

  enqueueTaskWorkspaceCleanup(
    request: TaskWorkspaceCleanupRequest,
    runCleanup: () => Promise<unknown>,
  ): TaskWorkspaceCleanupQueued {
    const queued: TaskWorkspaceCleanupQueued = {
      taskId: request.taskId,
      workspacePath: request.workspacePath,
      status: 'queued',
      queuedAt: this.now().toISOString(),
    };

    this.schedule(() => {
      void runCleanup().catch((error) => {
        this.onError?.(error, request);
      });
    });

    return queued;
  }
}

export interface TaskOrchestrationServiceOptions<TMergeResult = unknown, TCleanupResult = unknown> {
  locks?: OrchestrationOperationLocks;
  branchMerger: TaskBranchMerger<TMergeResult>;
  workspaceCleaner: TaskWorkspaceCleaner<TCleanupResult>;
  workspaceCleanupQueue?: TaskWorkspaceCleanupQueue;
}

export class TaskOrchestrationService<TMergeResult = unknown, TCleanupResult = unknown> {
  readonly locks: OrchestrationOperationLocks;
  private readonly branchMerger: TaskBranchMerger<TMergeResult>;
  private readonly workspaceCleaner: TaskWorkspaceCleaner<TCleanupResult>;
  private readonly workspaceCleanupQueue: TaskWorkspaceCleanupQueue;

  constructor(options: TaskOrchestrationServiceOptions<TMergeResult, TCleanupResult>) {
    this.locks = options.locks ?? new OrchestrationOperationLocks();
    this.branchMerger = options.branchMerger;
    this.workspaceCleaner = options.workspaceCleaner;
    this.workspaceCleanupQueue = options.workspaceCleanupQueue ?? new AsyncTaskWorkspaceCleanupQueue();
  }

  mergeTaskBranch(request: TaskBranchMergeRequest): Promise<TMergeResult> {
    return this.locks.withBranchMergeLock(
      {
        repositoryId: request.repositoryId,
        targetBranch: request.targetBranch,
      },
      () => this.branchMerger.mergeTaskBranch(request),
    );
  }

  cleanupTaskWorkspace(request: TaskWorkspaceCleanupRequest): Promise<TCleanupResult> {
    return this.locks.withWorkspaceCleanupLock(
      {
        workspacePath: request.workspacePath,
      },
      () => this.workspaceCleaner.cleanupTaskWorkspace(request),
    );
  }

  async mergeTaskBranchAndQueueWorkspaceCleanup(
    request: TaskBranchMergeWithCleanupRequest,
  ): Promise<TaskBranchMergeWithCleanupResult<TMergeResult>> {
    const merge = await this.mergeTaskBranch(request);
    const cleanupRequest: TaskWorkspaceCleanupRequest = {
      taskId: request.taskId,
      workspacePath: request.workspacePath,
    };
    const cleanup = await this.workspaceCleanupQueue.enqueueTaskWorkspaceCleanup(
      cleanupRequest,
      () => this.cleanupTaskWorkspace(cleanupRequest),
    );

    return { merge, cleanup };
  }
}
