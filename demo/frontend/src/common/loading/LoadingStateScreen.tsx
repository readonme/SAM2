/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Modified by Real Matrix in 2025
 */
import {spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {PropsWithChildren, ReactNode} from 'react';
import {Link} from 'react-router-dom';
import CustomButton from '../components/custom/Button';
import css from './Loading.module.css';

const styles = stylex.create({
  container: {
    backgroundColor: '#000',
    position: 'absolute',
    minHeight: '100%',
    width: '100%',
    zIndex: 999,
    left: 0,
    top: 0,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '36rem',
    marginHorizontal: 'auto',
    paddingVertical: '6rem',
    paddingHorizontal: spacing[8],
    textAlign: 'center',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  link: {
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});

type Props = PropsWithChildren<{
  title: string;
  description?: string | ReactNode;
  linkProps?: {
    to: string;
    label: string;
  };
}>;

export default function LoadingStateScreen({
  title,
  description,
  children,
  linkProps,
}: Props) {
  return (
    <div className={`center ${stylex.props(styles.container).className}`}>
      <div {...stylex.props(styles.content)}>
        <div {...stylex.props(styles.loadingContainer)}>
          <div className={css.loader} />
        </div>
        <h2 className="f18 pt32" style={{fontWeight: 500}}>
          {title}
        </h2>
        {description != null && (
          <div className="label3 f13 pt12">{description}</div>
        )}
        {children}
        {linkProps != null && (
          <Link to={linkProps.to} className="pt24 center">
            <CustomButton
              width={linkProps.label.length * 8 + 48}
              height={44}
              keepState={null}
              defaultStroke="#FFFFFF66"
              defaultColor="#FFFFFFCC">
              {linkProps.label}
            </CustomButton>
          </Link>
        )}
      </div>
    </div>
  );
}
