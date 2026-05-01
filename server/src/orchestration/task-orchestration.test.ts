import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { TaskOrchestrationService, type TaskWorkspaceCleaner } from './task-orchestration.js';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitForQueuedMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

const noopCleaner: TaskWorkspaceCleaner<'cleaned'> = {
  cleanupTaskWorkspace: () => 'cleaned',
};

test('task branch merge path serializes merges for the same repository target branch', async () => {
  const firstCanFinish = deferred();
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;

  const service = new TaskOrchestrationService({
    workspaceCleaner: noopCleaner,
    branchMerger: {
      async mergeTaskBranch(request) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        order.push(`${request.taskId}:start`);
        if (request.taskId === 'task-a') {
          await firstCanFinish.promise;
        }
        order.push(`${request.taskId}:end`);
        active -= 1;
        return request.taskId;
      },
    },
  });

  const first = service.mergeTaskBranch({
    taskId: 'task-a',
    repositoryId: 'Osttik/SimpleRPG',
    sourceBranch: 'feature/task-a',
    targetBranch: 'epic/epics-branch-and-workspaces',
  });
  const second = service.mergeTaskBranch({
    taskId: 'task-b',
    repositoryId: 'Osttik/SimpleRPG',
    sourceBranch: 'feature/task-b',
    targetBranch: 'epic/epics-branch-and-workspaces',
  });

  await waitForQueuedMicrotasks();
  assert.deepEqual(order, ['task-a:start']);
  assert.equal(maxActive, 1);

  firstCanFinish.resolve();
  assert.deepEqual(await Promise.all([first, second]), ['task-a', 'task-b']);
  assert.deepEqual(order, ['task-a:start', 'task-a:end', 'task-b:start', 'task-b:end']);
  assert.equal(maxActive, 1);
  assert.equal(service.locks.activeMergeLockCount, 0);
});

test('task branch merge path allows independent target branches to run concurrently', async () => {
  const firstCanFinish = deferred();
  let active = 0;
  let maxActive = 0;

  const service = new TaskOrchestrationService({
    workspaceCleaner: noopCleaner,
    branchMerger: {
      async mergeTaskBranch(request) {
        active += 1;
        maxActive = Math.max(maxActive, active);
        if (request.taskId === 'task-main') {
          await firstCanFinish.promise;
        }
        active -= 1;
        return request.targetBranch;
      },
    },
  });

  const mainMerge = service.mergeTaskBranch({
    taskId: 'task-main',
    repositoryId: 'Osttik/SimpleRPG',
    sourceBranch: 'feature/task-main',
    targetBranch: 'agentic/main',
  });
  const epicMerge = service.mergeTaskBranch({
    taskId: 'task-epic',
    repositoryId: 'Osttik/SimpleRPG',
    sourceBranch: 'feature/task-epic',
    targetBranch: 'epic/epics-branch-and-workspaces',
  });

  await waitForQueuedMicrotasks();
  assert.equal(maxActive, 2);

  firstCanFinish.resolve();
  assert.deepEqual(await Promise.all([mainMerge, epicMerge]), ['agentic/main', 'epic/epics-branch-and-workspaces']);
});

test('task workspace cleanup path serializes equivalent workspace paths', async () => {
  const firstCanFinish = deferred();
  const order: string[] = [];
  const workspacePath = path.join(process.cwd(), 'runtime', 'workspaces', 'task-a');
  const equivalentPath = path.join(workspacePath, '..', 'task-a');

  const service = new TaskOrchestrationService({
    branchMerger: {
      mergeTaskBranch: () => 'merged',
    },
    workspaceCleaner: {
      async cleanupTaskWorkspace(request) {
        order.push(`${request.taskId}:start`);
        if (request.taskId === 'task-a') {
          await firstCanFinish.promise;
        }
        order.push(`${request.taskId}:end`);
        return request.taskId;
      },
    },
  });

  const first = service.cleanupTaskWorkspace({ taskId: 'task-a', workspacePath });
  const second = service.cleanupTaskWorkspace({ taskId: 'task-a-retry', workspacePath: equivalentPath });

  await waitForQueuedMicrotasks();
  assert.deepEqual(order, ['task-a:start']);

  firstCanFinish.resolve();
  assert.deepEqual(await Promise.all([first, second]), ['task-a', 'task-a-retry']);
  assert.deepEqual(order, ['task-a:start', 'task-a:end', 'task-a-retry:start', 'task-a-retry:end']);
  assert.equal(service.locks.activeCleanupLockCount, 0);
});

test('task orchestration releases locks when merge or cleanup runners fail', async () => {
  const service = new TaskOrchestrationService({
    branchMerger: {
      mergeTaskBranch(request) {
        if (request.taskId === 'task-conflict') {
          throw new Error('merge conflict');
        }
        return 'merged';
      },
    },
    workspaceCleaner: {
      cleanupTaskWorkspace(request) {
        if (request.taskId === 'task-busy') {
          throw new Error('workspace busy');
        }
        return 'cleaned';
      },
    },
  });

  await assert.rejects(
    service.mergeTaskBranch({
      taskId: 'task-conflict',
      repositoryId: 'Osttik/SimpleRPG',
      sourceBranch: 'feature/task-conflict',
      targetBranch: 'agentic/main',
    }),
    /merge conflict/,
  );
  assert.equal(
    await service.mergeTaskBranch({
      taskId: 'task-retry',
      repositoryId: 'Osttik/SimpleRPG',
      sourceBranch: 'feature/task-retry',
      targetBranch: 'agentic/main',
    }),
    'merged',
  );

  await assert.rejects(
    service.cleanupTaskWorkspace({
      taskId: 'task-busy',
      workspacePath: path.join(process.cwd(), 'runtime', 'workspaces', 'task-busy'),
    }),
    /workspace busy/,
  );
  assert.equal(
    await service.cleanupTaskWorkspace({
      taskId: 'task-busy-retry',
      workspacePath: path.join(process.cwd(), 'runtime', 'workspaces', 'task-busy'),
    }),
    'cleaned',
  );
  assert.equal(service.locks.activeMergeLockCount, 0);
  assert.equal(service.locks.activeCleanupLockCount, 0);
});
