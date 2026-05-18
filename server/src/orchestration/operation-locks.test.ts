import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'node:path';
import { OrchestrationOperationLocks } from './operation-locks.js';

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

test('branch merges serialize per repository and target branch', async () => {
  const locks = new OrchestrationOperationLocks();
  const firstCanFinish = deferred();
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;

  const first = locks.withBranchMergeLock({ repositoryId: 'Osttik/SimpleRPG', targetBranch: 'epic/branch' }, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push('first:start');
    await firstCanFinish.promise;
    order.push('first:end');
    active -= 1;
  });

  const second = locks.withBranchMergeLock({ repositoryId: 'Osttik/SimpleRPG', targetBranch: 'epic/branch' }, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push('second:start');
    active -= 1;
  });

  await waitForQueuedMicrotasks();
  assert.deepEqual(order, ['first:start']);
  assert.equal(maxActive, 1);

  firstCanFinish.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(order, ['first:start', 'first:end', 'second:start']);
  assert.equal(maxActive, 1);
  assert.equal(locks.activeMergeLockCount, 0);
});

test('branch merge locks allow different target branches to proceed independently', async () => {
  const locks = new OrchestrationOperationLocks();
  const finish = deferred();
  let active = 0;
  let maxActive = 0;

  const first = locks.withBranchMergeLock({ repositoryId: 'Osttik/SimpleRPG', targetBranch: 'agentic/main' }, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await finish.promise;
    active -= 1;
  });

  const second = locks.withBranchMergeLock({ repositoryId: 'Osttik/SimpleRPG', targetBranch: 'epic/branch' }, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    active -= 1;
  });

  await waitForQueuedMicrotasks();
  assert.equal(maxActive, 2);

  finish.resolve();
  await Promise.all([first, second]);
});

test('workspace cleanup locks normalize equivalent workspace paths', async () => {
  const locks = new OrchestrationOperationLocks();
  const workspacePath = path.join(process.cwd(), 'runtime', 'workspaces', 'task-a');
  const equivalentPath = path.join(workspacePath, '..', 'task-a');
  const firstCanFinish = deferred();
  const order: string[] = [];

  const first = locks.withWorkspaceCleanupLock({ workspacePath }, async () => {
    order.push('first:start');
    await firstCanFinish.promise;
    order.push('first:end');
  });

  const second = locks.withWorkspaceCleanupLock({ workspacePath: equivalentPath }, async () => {
    order.push('second:start');
  });

  await waitForQueuedMicrotasks();
  assert.deepEqual(order, ['first:start']);

  firstCanFinish.resolve();
  await Promise.all([first, second]);

  assert.deepEqual(order, ['first:start', 'first:end', 'second:start']);
  assert.equal(locks.activeCleanupLockCount, 0);
});

test('failed operations release their lock for the next queued operation', async () => {
  const locks = new OrchestrationOperationLocks();
  const order: string[] = [];

  const first = locks.withBranchMergeLock({ repositoryId: 'repo', targetBranch: 'agentic/main' }, async () => {
    order.push('first');
    throw new Error('merge conflict');
  });

  const second = locks.withBranchMergeLock({ repositoryId: 'repo', targetBranch: 'agentic/main' }, async () => {
    order.push('second');
    return 'released';
  });

  await assert.rejects(first, /merge conflict/);
  assert.equal(await second, 'released');
  assert.deepEqual(order, ['first', 'second']);
  assert.equal(locks.activeMergeLockCount, 0);
});

