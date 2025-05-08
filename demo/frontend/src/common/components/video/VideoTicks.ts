type Tick = {
  time: number; // 秒
  label?: string; // 大刻度才有 label
  isMajor: boolean;
  progress: number;
};

function formatTime(sec: number): string {
  const rounded = Math.round(sec);
  if (rounded < 60) {
    return `${rounded}s`;
  }
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function generateVideoTicks(
  totalFrames: number,
  fps: number,
  maxTicks = 4,
  minTicks = 2,
): Tick[] {
  const duration = totalFrames / fps;

  // 可选的刻度间隔（秒）
  const intervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

  // 找合适的大刻度间隔，让大刻度数量在合理范围内
  const majorInterval =
    intervals.find(interval => {
      const count = Math.floor(duration / interval);
      return count >= minTicks && count <= maxTicks;
    }) ?? 60;

  // 每个大刻度分几个小刻度（常见为 4 个）
  const minorPerMajor = 4;
  const minorInterval = majorInterval / minorPerMajor;

  const ticks: Tick[] = [];

  for (let t = 0; t <= duration; t += minorInterval) {
    const isMajor =
      Math.abs(t % majorInterval) < 0.001 ||
      Math.abs((t % majorInterval) - majorInterval) < 0.001;
    const time = parseFloat(t.toFixed(3));

    ticks.push({
      time,
      isMajor,
      label: isMajor ? formatTime(t) : undefined,
      progress: time / duration,
    });
  }

  return ticks;
}
