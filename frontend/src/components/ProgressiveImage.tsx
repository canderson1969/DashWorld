import { useState, useEffect } from 'react';

interface ProgressiveImageProps {
  /**
   * Small thumbnail URL (80x45) - Loads first as blur placeholder
   */
  smallSrc: string;

  /**
   * Medium thumbnail URL (320x180) - Main image for grid views
   */
  mediumSrc: string;

  /**
   * Large thumbnail URL (1280x720) - Optional, for detail views
   */
  largeSrc?: string;

  /**
   * Alt text for accessibility
   */
  alt: string;

  /**
   * CSS class names
   */
  className?: string;

  /**
   * Whether to apply blur effect (for graphic content)
   */
  shouldBlur?: boolean;
}

/**
 * Progressive image component that loads small thumbnail first, then higher quality versions
 * Implements blur-up technique for smooth loading experience
 *
 * @param {ProgressiveImageProps} props - Component props
 * @returns {JSX.Element} Progressive image component
 */
export function ProgressiveImage({
  smallSrc,
  mediumSrc,
  largeSrc,
  alt,
  className = '',
  shouldBlur = false
}: ProgressiveImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(smallSrc);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Start with small image (already loaded or cached)
    setCurrentSrc(smallSrc);
    setIsLoading(true);

    // Preload medium image
    const mediumImg = new Image();
    mediumImg.onload = () => {
      setCurrentSrc(mediumSrc);

      // If large image is provided, preload it too
      if (largeSrc) {
        const largeImg = new Image();
        largeImg.onload = () => {
          setCurrentSrc(largeSrc);
          setIsLoading(false);
        };
        largeImg.onerror = () => {
          // If large fails, stay with medium
          setIsLoading(false);
        };
        largeImg.src = largeSrc;
      } else {
        setIsLoading(false);
      }
    };

    mediumImg.onerror = () => {
      // If medium fails, stay with small
      setIsLoading(false);
    };

    mediumImg.src = mediumSrc;
  }, [smallSrc, mediumSrc, largeSrc]);

  const isSmallImage = currentSrc === smallSrc;
  const blurClass = isSmallImage && isLoading ? 'blur-sm' : '';
  const contentBlurClass = shouldBlur ? 'blur-xl' : '';

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`${className} ${blurClass} ${contentBlurClass} transition-all duration-300`}
      loading="lazy"
    />
  );
}
