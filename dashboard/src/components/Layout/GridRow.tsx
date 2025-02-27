import cx from 'classnames';

import {createAsAble} from '../../utils/createAsAble';

type GridRowProps = {
  children?: React.ReactNode;
  className?: string;
  flex?: boolean;
};

export const GridRow = createAsAble<GridRowProps>('div', (AsAble, props) => {
  const {children, className, flex, ...restProps} = props;

  return (
    <AsAble className={cx('row', {'d-flex': flex}, className)} {...restProps}>
      {children}
    </AsAble>
  );
});
