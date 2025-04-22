import Logger from '@/common/logger/Logger';
import {activeBackgroundEffectAtom} from '@/demo/atoms';
import {MAX_FILE_SIZE_IN_MB, MAX_VIDEO_UPLOAD_SIZE} from '@/demo/DemoConfig';
import {spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {useAtomValue} from 'jotai';
import {useEffect, useState} from 'react';
import {FileRejection, FileWithPath, useDropzone} from 'react-dropzone';
import Icon from '../custom/Icon';
import useMessagesSnackbar from '../snackbar/useMessagesSnackbar';
import useToolbarTabs from '../toolbar/useToolbarTabs';
import useVideoEffect from '../video/editor/useVideoEffect';
import {EffectIndex} from '../video/effects/Effects';

const styles = stylex.create({
  uploadButton: {
    color: 'black',
    background: '#44DAC8',
    position: 'absolute',
    bottom: spacing[3],
    right: spacing[3],
    borderRadius: 8,
    zIndex: 1,
  },
});

export default function UploadBackgroundButton() {
  const [tabIndex] = useToolbarTabs();
  const {enqueueMessage} = useMessagesSnackbar();
  const [error, setError] = useState<string | null>(null);
  const activeEffect = useAtomValue(activeBackgroundEffectAtom);
  const setEffect = useVideoEffect();
  const {getRootProps, getInputProps} = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.png', '.jpg'],
    },
    multiple: false,
    maxFiles: 1,
    onDrop: async (
      acceptedFiles: FileWithPath[],
      fileRejections: FileRejection[],
    ) => {
      setError(null);
      // Check if any of the files (only 1 file allowed) is rejected. The
      // rejected file has an error (e.g., 'file-too-large'). Rendering an
      // appropriate message.
      if (fileRejections.length > 0 && fileRejections[0].errors.length > 0) {
        const code = fileRejections[0].errors[0].code;
        if (code === 'file-too-large') {
          setError(
            `File too large. Try a video under ${MAX_FILE_SIZE_IN_MB} MB`,
          );
          return;
        }
      }
      if (acceptedFiles.length === 0) {
        setError('File not accepted. Please try again.');
        return;
      }
      if (acceptedFiles.length > 1) {
        setError('Too many files. Please try again with 1 file.');
        return;
      }
      if (activeEffect.name === 'EraseBackground') {
        setEffect('EraseBackground', EffectIndex.BACKGROUND, {
          image: await createImageBitmap(acceptedFiles[0]),
          numVariants: 4,
          variant: 3,
        });
      }
    },
    onError: error => {
      Logger.error(error);
      setError('File not supported.');
    },
    maxSize: MAX_VIDEO_UPLOAD_SIZE,
  });

  useEffect(() => {
    if (error) {
      enqueueMessage(error, {type: 'warning', expire: false});
      setError(null);
    }
  }, [enqueueMessage, error]);

  return (
    tabIndex === 1 &&
    activeEffect.name === 'EraseBackground' && (
      <div
        className="cursor-pointer"
        {...stylex.props(styles.uploadButton)}
        {...getRootProps()}>
        <input {...getInputProps()} />
        <div className="fbh fbac g8 f14 py8 px16 hand">
          <Icon name="image" size={14} />
          Add Background Image
        </div>
      </div>
    )
  );
}
