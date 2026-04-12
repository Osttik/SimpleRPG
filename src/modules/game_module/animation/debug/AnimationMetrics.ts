export interface AnimationMetricsSnapshot {
  riggedEntitiesRendered: number;
  fullIkSolves: number;
  simplifiedSolves: number;
  instancedQuadsSubmitted: number;
  drawCallsBeforeBatching: number;
  drawCallsAfterBatching: number;
  facingSectorSwitchesPerSecond: number;
  lateCombatEventsDiscarded: number;
  staleCombatEventsDiscarded: number;
  attackVisualResetsDueToEpochMismatch: number;
  shieldDamageEvents: number;
  shieldBreakEvents: number;
  guardCrushEvents: number;
  averageAnimationUpdateMs: number;
}

export class AnimationMetrics {
  private frameStartMs = 0;
  private frameCostTotalMs = 0;
  private frameCostSamples = 0;
  private facingSwitches = 0;
  private facingWindowStartMs = performance.now();
  private facingSwitchesPerSecond = 0;
  private lastPublishMs = 0;

  riggedEntitiesRendered = 0;
  fullIkSolves = 0;
  simplifiedSolves = 0;
  instancedQuadsSubmitted = 0;
  drawCallsBeforeBatching = 0;
  drawCallsAfterBatching = 0;
  lateCombatEventsDiscarded = 0;
  staleCombatEventsDiscarded = 0;
  attackVisualResetsDueToEpochMismatch = 0;
  shieldDamageEvents = 0;
  shieldBreakEvents = 0;
  guardCrushEvents = 0;

  beginFrame(): void {
    this.frameStartMs = performance.now();
    this.riggedEntitiesRendered = 0;
    this.fullIkSolves = 0;
    this.simplifiedSolves = 0;
    this.instancedQuadsSubmitted = 0;
    this.drawCallsBeforeBatching = 0;
    this.drawCallsAfterBatching = 0;
  }

  endFrame(): void {
    const now = performance.now();
    if (this.frameStartMs > 0) {
      this.frameCostTotalMs += now - this.frameStartMs;
      this.frameCostSamples++;
    }

    if (now - this.facingWindowStartMs >= 1000) {
      this.facingSwitchesPerSecond = this.facingSwitches * 1000 / Math.max(1, now - this.facingWindowStartMs);
      this.facingSwitches = 0;
      this.facingWindowStartMs = now;
    }
  }

  recordFacingSwitch(): void {
    this.facingSwitches++;
  }

  snapshot(): AnimationMetricsSnapshot {
    return {
      riggedEntitiesRendered: this.riggedEntitiesRendered,
      fullIkSolves: this.fullIkSolves,
      simplifiedSolves: this.simplifiedSolves,
      instancedQuadsSubmitted: this.instancedQuadsSubmitted,
      drawCallsBeforeBatching: this.drawCallsBeforeBatching,
      drawCallsAfterBatching: this.drawCallsAfterBatching,
      facingSectorSwitchesPerSecond: this.facingSwitchesPerSecond,
      lateCombatEventsDiscarded: this.lateCombatEventsDiscarded,
      staleCombatEventsDiscarded: this.staleCombatEventsDiscarded,
      attackVisualResetsDueToEpochMismatch: this.attackVisualResetsDueToEpochMismatch,
      shieldDamageEvents: this.shieldDamageEvents,
      shieldBreakEvents: this.shieldBreakEvents,
      guardCrushEvents: this.guardCrushEvents,
      averageAnimationUpdateMs: this.frameCostSamples > 0 ? this.frameCostTotalMs / this.frameCostSamples : 0,
    };
  }

  publishIfDue(post: (snapshot: AnimationMetricsSnapshot) => void, nowMs: number): void {
    if (!import.meta.env.DEV || nowMs - this.lastPublishMs < 1000) return;
    this.lastPublishMs = nowMs;
    post(this.snapshot());
  }
}

export const animationMetrics = new AnimationMetrics();
