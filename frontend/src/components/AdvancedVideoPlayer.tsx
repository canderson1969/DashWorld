import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface QualitySources {
  '240p'?: string;
  '360p'?: string;
  '480p'?: string;
  '720p'?: string;
  '1080p'?: string;
}

interface QualityState {
  currentQuality: string;
  availableQualities: string[];
  switchQuality: (quality: string) => void;
  processingQualities: string[];
}

interface AdvancedVideoPlayerProps {
  src: string;
  autoplay?: boolean;
  qualitySources?: QualitySources;
  processingQualities?: string[]; // List of qualities still being processed
  hideQualitySelector?: boolean; // Hide built-in quality selector for external rendering
  onQualityStateReady?: (state: QualityState) => void; // Callback to expose quality controls externally
}

export const AdvancedVideoPlayer = ({ src, autoplay = false, qualitySources, processingQualities = [], hideQualitySelector = false, onQualityStateReady }: AdvancedVideoPlayerProps) => {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [frameRate, setFrameRate] = useState(30);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [showFrameInput, setShowFrameInput] = useState(false);
  const [frameInputValue, setFrameInputValue] = useState('');
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    // Initialize Video.js player
    const videoElement = document.createElement('video');
    videoElement.className = 'video-js vjs-big-play-centered';
    videoRef.current.appendChild(videoElement);

    const player = videojs(videoElement, {
      controls: true,
      autoplay: autoplay,
      preload: 'metadata',
      fluid: true,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        volumePanel: {
          inline: false
        }
      }
    });

    // Set video source with error handling
    try {
      player.src({ src, type: 'video/mp4' });
    } catch (error) {
      // Ignore errors when setting source (can happen during rapid unmount/remount)
      console.debug('Video source setting error (ignored):', error);
    }

    // Handle video loading errors gracefully (e.g., when video is aborted)
    player.on('error', () => {
      const errorCode = player.error()?.code;
      const errorMessage = player.error()?.message;

      // Ignore abort errors (code 20) and media errors (code 4) - these happen when switching videos
      if (
        errorCode === 20 ||
        errorCode === 4 ||
        errorMessage?.includes('aborted') ||
        errorMessage?.includes('fetching process')
      ) {
        return;
      }

      // Log other errors for debugging but don't crash
      console.warn('Video playback error:', {
        code: errorCode,
        message: errorMessage,
        src
      });
    });

    // Store saved volume
    const savedVolume = localStorage.getItem('videoVolume');
    if (savedVolume) {
      player.volume(parseFloat(savedVolume));
    }

    // Save volume on change
    player.on('volumechange', () => {
      const vol = player.volume();
      if (vol !== undefined) {
        localStorage.setItem('videoVolume', vol.toString());
      }
    });

    // Track playback rate
    player.on('ratechange', () => {
      const rate = player.playbackRate();
      if (rate !== undefined) {
        setPlaybackRate(rate);
      }
    });

    // Detect framerate and track frame count
    player.on('loadedmetadata', () => {
      const duration = player.duration();
      if (duration === undefined) return;

      // Try to get framerate from video metadata (if available)
      const videoElement = player.el().querySelector('video');
      if (videoElement) {
        // Most videos use 30fps, but we can try to detect
        // Common framerates: 23.976, 24, 25, 29.97, 30, 60
        const detectedFps = 30; // Default to 30 fps
        setFrameRate(detectedFps);
        setTotalFrames(Math.floor(duration * detectedFps));
      }
    });

    // Update current frame on time update
    player.on('timeupdate', () => {
      const currentTime = player.currentTime();
      if (currentTime === undefined) return;
      const frame = Math.floor(currentTime * frameRate);
      setCurrentFrame(frame);
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.dispose();
        } catch (error) {
          // Ignore errors during disposal (can happen if video is still loading)
          console.debug('Video disposal error (ignored):', error);
        }
        playerRef.current = null;
      }
    };
  }, [src, autoplay]);

  /**
   * Jump to specific frame number
   */
  const jumpToFrame = (frameNumber: number) => {
    if (playerRef.current) {
      const targetFrame = Math.max(0, Math.min(frameNumber, totalFrames - 1));
      const targetTime = targetFrame / frameRate;
      playerRef.current.currentTime(targetTime);
      setCurrentFrame(targetFrame);
    }
  };

  /**
   * Handle frame input submission
   */
  const handleFrameInputSubmit = () => {
    const frameNum = parseInt(frameInputValue, 10);
    if (!isNaN(frameNum)) {
      jumpToFrame(frameNum);
      setFrameInputValue('');
      setShowFrameInput(false);
    }
  };

  // Keyboard shortcuts
  const shortcuts = [
    {
      key: ' ',
      action: () => {
        if (playerRef.current) {
          if (playerRef.current.paused()) {
            playerRef.current.play();
          } else {
            playerRef.current.pause();
          }
        }
      },
      description: 'Play/Pause'
    },
    {
      key: 'k',
      action: () => {
        if (playerRef.current) {
          if (playerRef.current.paused()) {
            playerRef.current.play();
          } else {
            playerRef.current.pause();
          }
        }
      },
      description: 'Play/Pause'
    },
    {
      key: 'ArrowLeft',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(Math.max(0, playerRef.current.currentTime() - 5));
        }
      },
      description: 'Rewind 5s'
    },
    {
      key: 'ArrowRight',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(playerRef.current.currentTime() + 5);
        }
      },
      description: 'Forward 5s'
    },
    {
      key: 'j',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(Math.max(0, playerRef.current.currentTime() - 10));
        }
      },
      description: 'Rewind 10s'
    },
    {
      key: 'l',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(playerRef.current.currentTime() + 10);
        }
      },
      description: 'Forward 10s'
    },
    {
      key: ',',
      action: () => {
        if (playerRef.current && playerRef.current.paused()) {
          const frameDuration = 1 / frameRate;
          playerRef.current.currentTime(Math.max(0, playerRef.current.currentTime() - frameDuration));
        }
      },
      description: 'Previous frame'
    },
    {
      key: '.',
      action: () => {
        if (playerRef.current && playerRef.current.paused()) {
          const frameDuration = 1 / frameRate;
          playerRef.current.currentTime(playerRef.current.currentTime() + frameDuration);
        }
      },
      description: 'Next frame'
    },
    {
      key: 'Home',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(0);
        }
      },
      description: 'Jump to start'
    },
    {
      key: 'End',
      action: () => {
        if (playerRef.current) {
          playerRef.current.currentTime(playerRef.current.duration());
        }
      },
      description: 'Jump to end'
    },
    {
      key: 'ArrowUp',
      action: () => {
        if (playerRef.current) {
          const newVol = Math.min(1, playerRef.current.volume() + 0.1);
          playerRef.current.volume(newVol);
        }
      },
      description: 'Volume up'
    },
    {
      key: 'ArrowDown',
      action: () => {
        if (playerRef.current) {
          const newVol = Math.max(0, playerRef.current.volume() - 0.1);
          playerRef.current.volume(newVol);
        }
      },
      description: 'Volume down'
    },
    {
      key: 'm',
      action: () => {
        if (playerRef.current) {
          playerRef.current.muted(!playerRef.current.muted());
        }
      },
      description: 'Mute/Unmute'
    },
    {
      key: 'f',
      action: () => {
        if (playerRef.current) {
          if (playerRef.current.isFullscreen()) {
            playerRef.current.exitFullscreen();
          } else {
            playerRef.current.requestFullscreen();
          }
        }
      },
      description: 'Toggle fullscreen'
    },
    {
      key: '<',
      shift: true,
      action: () => {
        if (playerRef.current) {
          const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
          const currentRate = playerRef.current.playbackRate();
          const currentIndex = rates.indexOf(currentRate);
          if (currentIndex > 0) {
            playerRef.current.playbackRate(rates[currentIndex - 1]);
          }
        }
      },
      description: 'Decrease speed'
    },
    {
      key: '>',
      shift: true,
      action: () => {
        if (playerRef.current) {
          const rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
          const currentRate = playerRef.current.playbackRate();
          const currentIndex = rates.indexOf(currentRate);
          if (currentIndex < rates.length - 1) {
            playerRef.current.playbackRate(rates[currentIndex + 1]);
          }
        }
      },
      description: 'Increase speed'
    },
    {
      key: '?',
      action: () => setShowShortcuts(prev => !prev),
      description: 'Toggle shortcuts help'
    },
    {
      key: 'g',
      action: () => setShowFrameInput(prev => !prev),
      description: 'Jump to frame'
    },
    // Number keys 0-9 for seeking to percentage
    ...Array.from({ length: 10 }, (_, i) => ({
      key: i.toString(),
      action: () => {
        if (playerRef.current) {
          const percent = i / 10;
          playerRef.current.currentTime(playerRef.current.duration() * percent);
        }
      },
      description: `Jump to ${i * 10}%`
    }))
  ];

  useKeyboardShortcuts(shortcuts, !showShortcuts);

  /**
   * Auto-dismiss quality warning after 5 seconds
   */
  useEffect(() => {
    if (qualityWarning) {
      const timer = setTimeout(() => {
        setQualityWarning(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [qualityWarning]);

  /**
   * Switch video quality
   *
   * @param {string} quality - Quality label (240p, 360p, 480p, 720p, 1080p, auto)
   */
  const switchQuality = (quality: string) => {
    if (!playerRef.current || !qualitySources) return;

    // Check if the quality is still processing
    if (quality !== 'auto' && processingQualities.includes(quality)) {
      setQualityWarning(`${quality.toUpperCase()} is still being processed. Please wait or select another quality.`);
      return;
    }

    const player = playerRef.current;
    const currentTime = player.currentTime();
    const wasPaused = player.paused();

    let newSrc = src; // Default to auto (best available)

    if (quality !== 'auto') {
      const qualityFile = qualitySources[quality as keyof QualitySources];
      if (qualityFile) {
        newSrc = qualityFile;
      } else {
        // Quality doesn't exist yet
        setQualityWarning(`${quality.toUpperCase()} is not available yet. Please wait for processing to complete.`);
        return;
      }
    }

    // Change source and preserve playback position
    player.src({ src: newSrc, type: 'video/mp4' });
    player.one('loadedmetadata', () => {
      player.currentTime(currentTime);
      if (!wasPaused) {
        player.play();
      }
    });

    setCurrentQuality(quality);
  };

  /**
   * Get available quality options
   *
   * @returns {Array<string>} List of available quality labels (highest to lowest)
   */
  const getAvailableQualities = (): string[] => {
    if (!qualitySources) {
      return ['auto'];
    }

    const qualities: string[] = ['auto'];
    // Reverse order: highest quality first (1080p → 240p)
    const qualityOrder = ['1080p', '720p', '480p', '360p', '240p'];

    qualityOrder.forEach(q => {
      if (qualitySources[q as keyof QualitySources]) {
        qualities.push(q);
      }
    });

    return qualities;
  };

  // Expose quality state to parent component for external rendering
  useEffect(() => {
    if (onQualityStateReady && qualitySources) {
      onQualityStateReady({
        currentQuality,
        availableQualities: getAvailableQualities(),
        switchQuality,
        processingQualities
      });
    }
  }, [currentQuality, qualitySources, processingQualities, onQualityStateReady]);

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden">
        <div ref={videoRef} className="w-full" />

        {/* Playback rate indicator */}
        {playbackRate !== 1 && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm pointer-events-none">
            {playbackRate}x
          </div>
        )}

        {/* Frame jump input */}
        {showFrameInput && (
          <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Jump to Frame</h3>
                <button
                  onClick={() => setShowFrameInput(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frame Number (0 - {totalFrames - 1})
                </label>
                <input
                  type="number"
                  min="0"
                  max={totalFrames - 1}
                  value={frameInputValue}
                  onChange={(e) => setFrameInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleFrameInputSubmit();
                    } else if (e.key === 'Escape') {
                      setShowFrameInput(false);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  placeholder={`Current: ${currentFrame}`}
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFrameInput(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFrameInputSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  Jump
                </button>
              </div>

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                Press Enter to jump, Esc to cancel
              </p>
            </div>
          </div>
        )}

        {/* Quality warning notification */}
        {qualityWarning && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md pointer-events-none animate-fade-in">
            <div className="bg-yellow-600 bg-opacity-95 text-white px-6 py-3 rounded-lg text-sm shadow-2xl border border-yellow-500 flex items-center gap-3">
              <svg className="h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium">{qualityWarning}</span>
            </div>
          </div>
        )}

        {/* Processing indicator banner */}
        {processingQualities.length > 0 && (
          <div className="absolute bottom-20 left-4 right-4 z-40 pointer-events-none">
            <div className="bg-blue-600 bg-opacity-95 text-white px-4 py-2 rounded-lg text-sm shadow-lg border border-blue-500 flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Additional quality versions are still processing ({processingQualities.join(', ')})</span>
            </div>
          </div>
        )}

        {/* Keyboard shortcuts overlay */}
        {showShortcuts && (
          <div className="absolute inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowShortcuts(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Playback</h4>
                  <ShortcutItem shortcut="Space / K" description="Play/Pause" />
                  <ShortcutItem shortcut="← / →" description="Seek ±5s" />
                  <ShortcutItem shortcut="J / L" description="Seek ±10s" />
                  <ShortcutItem shortcut=", / ." description="Frame step" />
                  <ShortcutItem shortcut="G" description="Jump to frame" />
                  <ShortcutItem shortcut="Home / End" description="Jump to start/end" />
                  <ShortcutItem shortcut="0-9" description="Jump to 0%-90%" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Controls</h4>
                  <ShortcutItem shortcut="↑ / ↓" description="Volume ±10%" />
                  <ShortcutItem shortcut="M" description="Mute/Unmute" />
                  <ShortcutItem shortcut="F" description="Fullscreen" />
                  <ShortcutItem shortcut="Shift + < / >" description="Playback speed" />
                  <ShortcutItem shortcut="?" description="This help menu" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quality selector - inline below video, inherits page background */}
      {!hideQualitySelector && qualitySources && getAvailableQualities().length > 1 && (
        <div className="flex items-center gap-4 pt-4">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Quality</span>
          <div className="flex flex-wrap gap-2">
            {/* Auto quality option */}
            <button
              onClick={() => switchQuality('auto')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                currentQuality === 'auto'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Auto
            </button>

            {/* Available quality options */}
            {['1080p', '720p', '480p', '360p', '240p'].map((quality) => {
              const isAvailable = qualitySources && qualitySources[quality as keyof QualitySources];
              const isProcessing = processingQualities.includes(quality);
              const isDisabled = !isAvailable || isProcessing;

              if (!isAvailable && !isProcessing) return null;

              return (
                <button
                  key={quality}
                  onClick={() => !isDisabled && switchQuality(quality)}
                  disabled={isDisabled}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                    currentQuality === quality
                      ? 'bg-blue-600 text-white'
                      : isDisabled
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  {quality}
                  {isProcessing && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Shortcut item component for help overlay
 */
const ShortcutItem = ({ shortcut, description }: { shortcut: string; description: string }) => (
  <div className="flex items-center justify-between text-sm">
    <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded font-mono text-xs">
      {shortcut}
    </kbd>
    <span className="text-gray-600 dark:text-gray-400 ml-4">{description}</span>
  </div>
);
