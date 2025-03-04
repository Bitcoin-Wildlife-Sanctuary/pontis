'use client';

import {Globals} from 'csstype';
import {useTheme} from 'styled-components';

import * as Icons from '@/assets/icons';
import {Theme} from '@/types';

type IconNames = keyof typeof Icons;

type IconProps = React.SVGProps<SVGSVGElement> & {
  name: IconNames;
  color?: keyof Theme['colors'] | Globals;
  size?: number;
  width?: number;
  height?: number;
};

export const Icon: React.FC<IconProps> = ({name, color = 'text', size, width, height, ...props}) => {
  const theme = useTheme();

  const IconComponent = Icons[name];

  return (
    <IconComponent
      color={theme.colors[color as keyof Theme['colors']] ?? color}
      {...props}
      width={size ?? width}
      height={size ?? height}
    />
  );
};
