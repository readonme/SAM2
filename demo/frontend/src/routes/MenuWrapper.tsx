import Icon from '@/common/components/custom/Icon';
import Image from '@/common/components/custom/Image';
import stylex from '@stylexjs/stylex';
import {useState} from 'react';
import {Location, useLocation} from 'react-router-dom';
import DemoPage, {LocationState} from './DemoPage';
import {HomePage} from './HomePage';

const nameDict: Record<string, string> = {
  home: 'Home',
};

export default function MenuWrapper() {
  const pathname = ['home'] as const;
  const [expandMenu, setExpandMenu] = useState(true);
  const [active, setActive] = useState<'home'>('home');
  const {state} = useLocation() as Location<LocationState | null>;

  return (
    <div className="flex h-screen w-screen">
      <div
        className={`${stylex.props(styles.menu).className} fbv pr ${
          expandMenu ? 'w-[232px]' : 'w-[72px] fbac'
        }`}>
        {expandMenu ? (
          <Image className="ml26" name="logo2" width={102} height={24} />
        ) : (
          <Image name="logo" width={24} height={24} />
        )}
        <Icon
          size={32}
          name={expandMenu ? 'menu' : 'menu2'}
          hoveredName={expandMenu ? 'menu3' : 'menu4'}
          className={`right-4 top-6 ${expandMenu ? 'pa' : 'my28'}`}
          onClick={() => setExpandMenu(!expandMenu)}
        />
        <div
          className={`flex flex-1 flex-col gap-1 overflow-auto ${
            expandMenu ? 'py-[28px] pl-4' : 'items-center'
          }`}>
          {pathname.map(name => (
            <div
              key={name}
              className={expandMenu ? '' : 'tooltip oh'}
              data-tip={nameDict[name]}>
              <div
                className={`fbh fbac g8 p10 br8 hand ${
                  stylex.props(
                    styles.menuItem,
                    active === name && styles.menuItemActive,
                  ).className
                } ${!expandMenu ? 'w-fit' : 'w-[200px]'}`}
                onClick={() => setActive(name)}>
                <Icon name={active === name ? `${name}2` : name} size={20} />
                {expandMenu && <p className="text-base">{nameDict[name]}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col h-full oa">
        {active === 'home' && (
          <div className="fb1 pr">
            <div style={{display: state?.video ? 'none' : 'flex'}}>
              <HomePage />
            </div>
            {state?.video && <DemoPage />}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = stylex.create({
  menu: {
    borderRight: '1px solid #FFFFFF1F',
    paddingTop: '28px',
  },
  menuItem: {
    opacity: 0.6,
    ':hover': {
      backgroundColor: '#ffffff14',
      opacity: 1,
    },
  },
  menuItemActive: {
    backgroundColor: '#ffffff14',
    opacity: 1,
  },
});
