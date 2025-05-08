import stylex from '@stylexjs/stylex';
import {useState} from 'react';
import {Loading} from 'react-daisyui';
import Icon from '../custom/Icon';

const styles = stylex.create({
  container: {
    border: '1px solid #44DAC8',
    borderRadius: 8,
    color: '#44DAC8',
    ':hover': {
      background: '#44DAC8',
      borderRadius: 6,
      color: 'black',
    },
    ':active': {
      filter: 'brightness(0.8)',
    },
  },
});

type Props = {
  onClick: () => void;
  isLoading?: boolean;
  title: string;
};

export default function ResetButton({title, isLoading, onClick}: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      {...stylex.props(styles.container)}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="fbh fbac g6 py8 px20 hand">
        {isLoading ? (
          <Loading size="sm" />
        ) : (
          <Icon name={hovered ? 'video2' : 'video'} size={20} />
        )}
        <p className="f14">{title}</p>
      </div>
    </div>
  );
}
