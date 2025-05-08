// Modal.tsx
import stylex from '@stylexjs/stylex';
import {HTMLAttributes, ReactNode} from 'react';
import Icon from './Icon';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  showCloseIcon?: boolean;
  onClose: () => void;
  children: ReactNode;
}

const styles = stylex.create({
  modal: {
    backgroundColor: 'rgba(15, 17, 21, 0.8)',
    position: 'fixed',
    width: '100%',
    height: '100%',
    zIndex: 999,
    left: 0,
    top: 0,
  },
  card: {
    backgroundColor: '#1e2128',
    borderRadius: 12,
    position: 'relative',
  },
  icon: {
    cursor: 'pointer',
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export function Modal({
  open,
  showCloseIcon = true,
  onClose,
  children,
  ...rest
}: ModalProps) {
  return (
    <div
      style={{display: open ? 'flex' : 'none'}}
      className={`${stylex.props(styles.modal).className} center`}
      onClick={onClose}>
      <div
        className={`${stylex.props(styles.card).className}`}
        onClick={e => e.stopPropagation()}
        {...rest}>
        {showCloseIcon && (
          <Icon
            onClick={onClose}
            className={`m16 ${stylex.props(styles.icon).className}`}
            name="close"
            size={10}
          />
        )}
        {children}
      </div>
    </div>
  );
}
