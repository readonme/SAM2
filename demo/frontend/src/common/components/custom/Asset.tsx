import {useMemo, useRef} from 'react';

type Props = React.HTMLAttributes<HTMLElement> & {
  src: string;
  poster?: string;
  controls?: boolean;
  className?: string;
  objectFit?: 'contain' | 'cover';
  type: 'image' | 'video' | 'auto';
};

export function MediaDisplay({
  src,
  poster,
  controls,
  className,
  objectFit = 'contain',
  type: propType,
  ...rest
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const extension = useMemo(() => {
    return src.split('.').pop()?.toLowerCase() ?? '';
  }, [src]);

  const type = useMemo<'image' | 'video'>(() => {
    if (propType !== 'auto') {
      return propType;
    }

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];

    if (imageExtensions.includes(extension)) {
      return 'image';
    }
    if (videoExtensions.includes(extension)) {
      return 'video';
    }

    return 'image'; // fallback
  }, [extension, propType]);

  const play = () => {
    timerRef.current = setTimeout(() => {
      videoRef.current?.play();
    }, 1000);
  };

  const pause = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    videoRef.current?.pause();
  };

  return type === 'video' ? (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      controls={controls}
      style={{objectFit}}
      className={`hand ${className}`}
      onMouseEnter={() => !controls && play()}
      onMouseLeave={() => !controls && pause()}
      {...rest}
    />
  ) : (
    <img
      src={src}
      style={{objectFit}}
      className={`hand ${className}`}
      {...rest}
    />
  );
}
