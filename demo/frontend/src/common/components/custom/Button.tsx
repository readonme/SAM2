import stylex from '@stylexjs/stylex';
import React, {useCallback, useState} from 'react';
import {isMobile} from 'react-device-detect';

type ButtonProps = {
  width: number;
  height: number;
  disabled?: boolean;
  themeStyle?: boolean;
  keepState?: 'active' | 'inactive';
  defaultStroke?: string;
  defaultColor?: string;
  defaultFill?: string;
  activeStroke?: string;
  activeColor?: string;
  activeFill?: string;
  fullWidth?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
};

const styles = stylex.create({
  button: {
    ':hover': {
      filter: 'brightness(1.2)',
    },
    ':active': {
      filter: 'brightness(0.8)',
    },
  },
  themeFilter: {
    filter: 'brightness(0)',
  },
});

export default function CustomButton({
  width,
  height,
  disabled = false,
  themeStyle = false,
  keepState = 'active',
  defaultStroke = '#44DAC8',
  defaultColor = '#44DAC8',
  defaultFill = 'transparent',
  activeStroke = 'none',
  activeColor = 'black',
  activeFill = '#44DAC8',
  fullWidth = false,
  children,
  onClick,
}: ButtonProps) {
  const [hovered, setHovered] = useState(keepState === 'active');
  const corner = Math.min(width, height) / 5;
  const scaledWidth = fullWidth ? '100%' : `${width / 16}rem`;
  const scaledHeight = `${height / 16}rem`;
  const toggle = useCallback(async (value: boolean) => {
    if (value) {
      setHovered(true);
    } else {
      setHovered(false);
    }
  }, []);

  return (
    <div
      onClick={onClick}
      className={`${stylex.props(styles.button).className}`}
      style={{
        width: scaledWidth,
        pointerEvents: disabled ? 'none' : 'auto',
        filter: disabled ? 'opacity(0.4)' : undefined,
      }}>
      <div
        onMouseEnter={() => !keepState && !isMobile && toggle(true)}
        onMouseLeave={() => !keepState && !isMobile && toggle(false)}
        onTouchStart={() => !keepState && isMobile && toggle(true)}
        onTouchEnd={() => !keepState && isMobile && toggle(false)}
        className="center pr hand"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          color: hovered ? activeColor : defaultColor,
        }}>
        <svg
          className="pa wh100p"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none">
          <path
            d={`M0.5 ${corner}L${corner} 0.5H${width - 1}V${height - corner - 1}L${width - corner - 1} ${height - 1}H0.5V${corner}Z`}
            stroke={hovered ? activeStroke : defaultStroke}
            fill={hovered ? activeFill : defaultFill}
          />
        </svg>
        <div
          className={`${stylex.props(themeStyle && hovered && styles.themeFilter).className}`}
          style={{zIndex: 0}}>
          {children}
        </div>
      </div>
    </div>
  );
}
