import cx from 'classnames';

import {createAsAble} from '../../utils/createAsAble';

type GridRowProps = {
  children?: React.ReactNode;
  className?: string;
};

export const GridRow = createAsAble<GridRowProps>('div', (AsAble, props) => {
  const {children, className, ...restProps} = props;

  return (
    <AsAble className={cx('row', className)} {...restProps}>
      {children}
    </AsAble>
  );
});
