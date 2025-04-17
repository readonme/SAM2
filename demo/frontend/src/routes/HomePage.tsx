import video from '@/assets/videos/sam2_720px_dark.mp4';
import {MediaDisplay} from '@/common/components/custom/Asset';
import Icon from '@/common/components/custom/Icon';
import LoadingStateScreen from '@/common/loading/LoadingStateScreen';
import Logger from '@/common/logger/Logger';
import {sessionAtom, uploadingStateAtom, VideoData} from '@/demo/atoms';
import stylex from '@stylexjs/stylex';
import {useSetAtom} from 'jotai';
import {graphql, useLazyLoadQuery} from 'react-relay';
import {useNavigate} from 'react-router-dom';
import {HomePageQuery} from './__generated__/HomePageQuery.graphql';
import useUploadVideo from './useUploadVideo';

export function HomePage() {
  const navigate = useNavigate();
  const setSession = useSetAtom(sessionAtom);
  const setUploadingState = useSetAtom(uploadingStateAtom);
  const onUpload = (videoData: VideoData) => {
    navigate(
      {pathname: location.pathname, search: location.search},
      {state: {video: videoData}},
    );
    setUploadingState('default');
    setSession(null);
  };
  const {getRootProps, getInputProps, isUploading, error} = useUploadVideo({
    onUpload,
    onUploadError: (error: Error) => {
      setUploadingState('error');
      Logger.error(error);
    },
    onUploadStart: () => {
      setUploadingState('uploading');
    },
  });
  const data = useLazyLoadQuery<HomePageQuery>(
    graphql`
      query HomePageQuery {
        videos {
          edges {
            node {
              id
              path
              posterPath
              url
              posterUrl
              height
              width
              posterUrl
            }
          }
        }
      }
    `,
    {},
  );

  return isUploading ? (
    <div>
      <LoadingStateScreen
        title="Uploading video..."
        description="Sit tight while we upload your video."
      />
    </div>
  ) : error ? (
    <div>
      <LoadingStateScreen
        title="Did we just break the internet?"
        description={error}
      />
    </div>
  ) : (
    <div className="p24 fbv g24">
      <div className="fbv g12">
        <p className="f16 bold">Tutorial</p>
        <MediaDisplay
          className={`br12 ${stylex.props(styles.tutorial).className}`}
          src={video}
          type="video"
        />
      </div>
      <div className="fbv g12">
        <p className="f16 bold">Upload or Select a video to try with DEVA</p>
        <div className={`${stylex.props(styles.cardContainer).className}`}>
          <div className="cursor-pointer" {...getRootProps()}>
            <input {...getInputProps()} />
            <div
              className={`${stylex.props(styles.upload).className} center fbv`}>
              <Icon name="add" size={32} />
              <p className="f16 pt8">Upload</p>
              <p className="f12 label3 pt4">Max 70MB</p>
            </div>
          </div>
          {data.videos.edges.map(({node}) => (
            <MediaDisplay
              key={node.id}
              src={node.url}
              poster={node.posterUrl}
              className={`${stylex.props(styles.card).className}`}
              onClick={() => onUpload(node)}
              objectFit="cover"
              type="video"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = stylex.create({
  cardContainer: {
    display: 'grid',
    gap: '16px',
    gridTemplateColumns: {
      default: '1fr 1fr 1fr',
      '@media screen and (min-width: 1920px)': '1fr 1fr 1fr 1fr',
      '@media screen and (min-width: 2560px)': '1fr 1fr 1fr 1fr 1fr',
    },
  },
  card: {
    minHeight: '211px',
    borderRadius: '12px',
  },
  tutorial: {
    background: 'black',
    maxHeight: 300,
  },
  upload: {
    minHeight: 211,
    borderRadius: 12,
    background: '#2B353F',
    ':hover': {
      background: '#1C232A',
    },
  },
});
