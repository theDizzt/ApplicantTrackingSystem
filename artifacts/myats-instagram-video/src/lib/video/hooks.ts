import { useEffect, useMemo, useState } from 'react';

export type SceneKey = 'hook' | 'screen' | 'interview' | 'career' | 'voice' | 'close';
export type SceneDurations = Record<SceneKey, number>;

export function useVideoPlayer({ durations }: { durations: SceneDurations }) {
  const keys = useMemo(() => Object.keys(durations) as SceneKey[], [durations]);
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    const startedAt = window.performance.now();
    (window as Window & { startRecording?: () => void }).startRecording?.();
    const tick = window.setInterval(() => {
      const elapsed = window.performance.now() - startedAt;
      const total = keys.reduce((sum, key) => sum + durations[key], 0);
      const at = elapsed % total;
      let cursor = 0;
      let next = 0;
      keys.forEach((key, index) => {
        if (at >= cursor) next = index;
        cursor += durations[key];
      });
      setCurrentScene(next);
    }, 80);
    return () => {
      window.clearInterval(tick);
      (window as Window & { stopRecording?: () => void }).stopRecording?.();
    };
  }, [durations, keys]);

  return { currentScene };
}