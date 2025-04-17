import {ImgHTMLAttributes, useMemo, useState} from 'react';

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  name: string;
  size?: number;
  width?: number;
  height?: number;
  hoveredName?: string;
};

const images = import.meta.glob('@/assets/icons/*', {eager: true});

const getImage = (name: string) => {
  return images[`/src/assets/icons/${name}.svg`] as
    | {default: string}
    | undefined;
};

export default function Icon({
  name,
  size = 16,
  width = size,
  height = size,
  hoveredName,
  style,
  ...attributes
}: Props) {
  const [hovered, setHovered] = useState(false);
  const src = useMemo(
    () => getImage(hovered && hoveredName ? hoveredName : name)?.default,
    [hovered, hoveredName, name],
  );

  return (
    <img
      {...attributes}
      src={src}
      alt={`${name} icon`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        width: `${width / 16}rem`,
        height: `${height / 16}rem`,
        cursor: 'pointer',
      }}
    />
  );
}
