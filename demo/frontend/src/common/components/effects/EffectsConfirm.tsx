import stylex from '@stylexjs/stylex';
import {useCallback, useRef, useState} from 'react';
import {Loading} from 'react-daisyui';
import CustomButton from '../custom/Button';
import Icon from '../custom/Icon';
import {Modal} from '../custom/Modal';
import useDownloadVideo from '../toolbar/useDownloadVideo';
import useVideo from '../video/editor/useVideo';

const styles = stylex.create({
  videoContainer: {
    width: 771,
    height: 438,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default function EffectsConfirm() {
  const [open, setOpen] = useState(false);
  const {download, state} = useDownloadVideo();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const video = useVideo();

  const handleConfirm = useCallback(() => {
    const canvas = video?.getCanvas();
    const ctx = canvasRef.current?.getContext('2d');
    canvas && ctx?.drawImage(canvas, 0, 0);
    setOpen(true);
  }, [video]);

  return (
    <div className="m20">
      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="p24 fbv g24">
          <p className="f18 bold center">
            Congratulations! Your video is ready!
          </p>
          <canvas
            ref={canvasRef}
            className={`${stylex.props(styles.videoContainer).className}`}
            width={video?.width}
            height={video?.height}
          />
          <div className="fbh fbje">
            <CustomButton
              width={160}
              height={42}
              onClick={download}
              disabled={state === 'encoding'}>
              <div className="fbh fbac g4 f15">
                {state === 'encoding' ? (
                  <Loading size="sm" />
                ) : (
                  <Icon name="download" size={20} />
                )}
                Download
              </div>
            </CustomButton>
          </div>
        </div>
      </Modal>
      <CustomButton
        width={360}
        height={44}
        themeStyle
        fullWidth
        onClick={handleConfirm}>
        <div className="f15 fbh fbac g6">
          Confirm
          <Icon name="arrow" size={10} />
        </div>
      </CustomButton>
    </div>
  );
}
