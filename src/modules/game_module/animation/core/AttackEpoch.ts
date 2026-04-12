const EPOCH_WRAP = 256;
const EPOCH_HALF_WRAP = EPOCH_WRAP / 2;

export function sameAttackEpoch(a: number | undefined, b: number | undefined): boolean {
  return normalizeEpoch(a) === normalizeEpoch(b);
}

export function isEpochOlder(candidate: number, current: number): boolean {
  const delta = positiveModulo(normalizeEpoch(candidate) - normalizeEpoch(current), EPOCH_WRAP);
  return delta > EPOCH_HALF_WRAP;
}

export function normalizeEpoch(epoch: number | undefined): number {
  return (epoch ?? 0) & 0xff;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
