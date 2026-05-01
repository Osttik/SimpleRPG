import * as path from 'node:path';

type MaybePromise<T> = T | Promise<T>;

export interface BranchMergeLockRequest {
  repositoryId: string;
  targetBranch: string;
}

export interface WorkspaceCleanupLockRequest {
  workspacePath: string;
}

export class KeyedOperationLock {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(private readonly namespace: string) {}

  get activeKeyCount(): number {
    return this.queues.size;
  }

  isLocked(key: string): boolean {
    return this.queues.has(this.formatKey(key));
  }

  async runExclusive<T>(key: string, operation: () => MaybePromise<T>): Promise<T> {
    const lockKey = this.formatKey(key);
    const predecessor = this.queues.get(lockKey) ?? Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const queueTail = predecessor.catch(() => undefined).then(() => current);

    this.queues.set(lockKey, queueTail);

    try {
      await predecessor.catch(() => undefined);
      return await operation();
    } finally {
      releaseCurrent();
      if (this.queues.get(lockKey) === queueTail) {
        this.queues.delete(lockKey);
      }
    }
  }

  private formatKey(key: string): string {
    const normalized = key.trim();
    if (normalized.length === 0) {
      throw new Error(`${this.namespace} lock key must not be empty`);
    }
    return `${this.namespace}:${normalized}`;
  }
}

export class OrchestrationOperationLocks {
  private readonly branchMergeLocks = new KeyedOperationLock('branch-merge');
  private readonly workspaceCleanupLocks = new KeyedOperationLock('workspace-cleanup');

  get activeMergeLockCount(): number {
    return this.branchMergeLocks.activeKeyCount;
  }

  get activeCleanupLockCount(): number {
    return this.workspaceCleanupLocks.activeKeyCount;
  }

  withBranchMergeLock<T>(request: BranchMergeLockRequest, operation: () => MaybePromise<T>): Promise<T> {
    return this.branchMergeLocks.runExclusive(this.branchMergeKey(request), operation);
  }

  withWorkspaceCleanupLock<T>(request: WorkspaceCleanupLockRequest, operation: () => MaybePromise<T>): Promise<T> {
    return this.workspaceCleanupLocks.runExclusive(this.workspaceCleanupKey(request), operation);
  }

  isBranchMergeLocked(request: BranchMergeLockRequest): boolean {
    return this.branchMergeLocks.isLocked(this.branchMergeKey(request));
  }

  isWorkspaceCleanupLocked(request: WorkspaceCleanupLockRequest): boolean {
    return this.workspaceCleanupLocks.isLocked(this.workspaceCleanupKey(request));
  }

  private branchMergeKey(request: BranchMergeLockRequest): string {
    const repositoryId = request.repositoryId.trim();
    const targetBranch = request.targetBranch.trim();

    if (repositoryId.length === 0) {
      throw new Error('repositoryId is required for branch merge locking');
    }
    if (targetBranch.length === 0) {
      throw new Error('targetBranch is required for branch merge locking');
    }

    return `${repositoryId}\0${targetBranch}`;
  }

  private workspaceCleanupKey(request: WorkspaceCleanupLockRequest): string {
    const workspacePath = request.workspacePath.trim();
    if (workspacePath.length === 0) {
      throw new Error('workspacePath is required for workspace cleanup locking');
    }

    const resolvedPath = path.resolve(workspacePath);
    return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
  }
}

