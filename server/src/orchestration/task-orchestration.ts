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

export interface TaskBranchMerger<TResult = unknown> {
  mergeTaskBranch(request: TaskBranchMergeRequest): MaybePromise<TResult>;
}

export interface TaskWorkspaceCleaner<TResult = unknown> {
  cleanupTaskWorkspace(request: TaskWorkspaceCleanupRequest): MaybePromise<TResult>;
}

export interface TaskOrchestrationServiceOptions<TMergeResult = unknown, TCleanupResult = unknown> {
  locks?: OrchestrationOperationLocks;
  branchMerger: TaskBranchMerger<TMergeResult>;
  workspaceCleaner: TaskWorkspaceCleaner<TCleanupResult>;
}

export class TaskOrchestrationService<TMergeResult = unknown, TCleanupResult = unknown> {
  readonly locks: OrchestrationOperationLocks;
  private readonly branchMerger: TaskBranchMerger<TMergeResult>;
  private readonly workspaceCleaner: TaskWorkspaceCleaner<TCleanupResult>;

  constructor(options: TaskOrchestrationServiceOptions<TMergeResult, TCleanupResult>) {
    this.locks = options.locks ?? new OrchestrationOperationLocks();
    this.branchMerger = options.branchMerger;
    this.workspaceCleaner = options.workspaceCleaner;
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
}
