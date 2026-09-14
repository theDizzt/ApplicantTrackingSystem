import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { Scene1, Scene2, Scene3, Scene4, Scene5, Scene6 } from './video_scenes/Scenes';
import { SceneDurations, useVideoPlayer } from '../../lib/video/hooks';

const SCENE_DURATIONS: SceneDurations = {
  hook: 4200,
  screen: 4800,
  interview: 4700,
  career: 5000,
  voice: 5000,
  close: 4800,
};

export default function VideoTemplate() {
  const durations = useMemo(() => SCENE_DURATIONS, []);
  const { currentScene } = useVideoPlayer({ durations });
  const sceneBackgrounds = ['#07142f', '#07142f', '#0a1838', '#081631', '#071b34', '#07142f'];

  return (
    <main className="video-root" style={{ background: sceneBackgrounds[currentScene] }}>
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: '-20%',
          zIndex: -1,
          background: 'radial-gradient(circle at 84% 15%, rgba(41,215,232,.13), transparent 27%), radial-gradient(circle at 12% 88%, rgba(43,99,255,.2), transparent 34%), linear-gradient(135deg, #07142f 0%, #0b1d45 62%, #07142f 100%)',
        }}
        animate={{ rotate: [0, 1.5, 0], scale: [1, 1.03, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: .15,
          zIndex: -1,
          backgroundImage: 'linear-gradient(rgba(160,190,255,.11) 1px, transparent 1px), linear-gradient(90deg, rgba(160,190,255,.11) 1px, transparent 1px)',
          backgroundSize: '7.5% 7.5%',
        }}
        animate={{ backgroundPosition: ['0% 0%', '7.5% 7.5%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div aria-hidden="true" style={{ position: 'absolute', left: 0, top: '10%', width: '1px', height: '76%', background: 'linear-gradient(transparent, rgba(111,156,255,.5), transparent)', transformOrigin: 'top', zIndex: 1 }} animate={{ y: ['-3%', '3%', '-3%'] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="grain" />

      <AnimatePresence mode="sync" initial={false}>
        {currentScene === 0 && <Scene1 key="hook" sceneIndex={currentScene} />}
        {currentScene === 1 && <Scene2 key="screen" sceneIndex={currentScene} />}
        {currentScene === 2 && <Scene3 key="interview" sceneIndex={currentScene} />}
        {currentScene === 3 && <Scene4 key="career" sceneIndex={currentScene} />}
        {currentScene === 4 && <Scene5 key="voice" sceneIndex={currentScene} />}
        {currentScene === 5 && <Scene6 key="close" sceneIndex={currentScene} />}
      </AnimatePresence>
    </main>
  );
}