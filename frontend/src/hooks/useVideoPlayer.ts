import { useState, useRef, useEffect } from 'react';
import videojs from 'video.js';
import Player from 'video.js/dist/types/player';

interface UseVideoPlayerOptions {
  autoplay?: boolean;
  controls?: boolean;
  preload?: string;
}

/**
 * Hook to manage Video.js player instance and state
 *
 * @param {UseVideoPlayerOptions} options - Video.js player options
 * @returns {Object} Player instance, ref, and control functions
 */
export function useVideoPlayer(options: UseVideoPlayerOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  /**
   * Initialize Video.js player
   */
  const initializePlayer = (videoElement: HTMLVideoElement, src: string) => {
    if (!videoElement) return;

    const player = videojs(videoElement, {
      controls: options.controls ?? true,
      autoplay: options.autoplay ?? false,
      preload: options.preload ?? 'metadata',
      fluid: true,
      responsive: true,
    });

    player.src({ src, type: 'video/mp4' });

    player.on('ready', () => {
      setIsReady(true);
    });

    player.on('timeupdate', () => {
      setCurrentTime(player.currentTime() || 0);
    });

    player.on('durationchange', () => {
      setDuration(player.duration() || 0);
    });

    player.on('play', () => {
      setIsPlaying(true);
    });

    player.on('pause', () => {
      setIsPlaying(false);
    });

    player.on('volumechange', () => {
      setVolumeState(player.volume() || 0);
    });

    player.on('ratechange', () => {
      setPlaybackRateState(player.playbackRate() || 1);
    });

    playerRef.current = player;
    videoRef.current = videoElement;
  };

  /**
   * Play video
   */
  const play = () => {
    playerRef.current?.play();
  };

  /**
   * Pause video
   */
  const pause = () => {
    playerRef.current?.pause();
  };

  /**
   * Toggle play/pause
   */
  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  /**
   * Seek to specific time in seconds
   */
  const seek = (time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime(time);
    }
  };

  /**
   * Skip forward by seconds
   */
  const skipForward = (seconds: number) => {
    if (playerRef.current) {
      const newTime = Math.min(currentTime + seconds, duration);
      seek(newTime);
    }
  };

  /**
   * Skip backward by seconds
   */
  const skipBackward = (seconds: number) => {
    if (playerRef.current) {
      const newTime = Math.max(currentTime - seconds, 0);
      seek(newTime);
    }
  };

  /**
   * Set volume (0-1)
   */
  const setVolume = (vol: number) => {
    if (playerRef.current) {
      playerRef.current.volume(Math.max(0, Math.min(1, vol)));
    }
  };

  /**
   * Toggle mute
   */
  const toggleMute = () => {
    if (playerRef.current) {
      playerRef.current.muted(!playerRef.current.muted());
    }
  };

  /**
   * Set playback rate
   */
  const setPlaybackRate = (rate: number) => {
    if (playerRef.current) {
      playerRef.current.playbackRate(rate);
    }
  };

  /**
   * Toggle fullscreen
   */
  const toggleFullscreen = () => {
    if (playerRef.current) {
      if (playerRef.current.isFullscreen()) {
        playerRef.current.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen();
      }
    }
  };

  return {
    videoRef,
    playerRef,
    isReady,
    currentTime,
    duration,
    isPlaying,
    volume,
    playbackRate,
    initializePlayer,
    play,
    pause,
    togglePlay,
    seek,
    skipForward,
    skipBackward,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleFullscreen,
  };
}
