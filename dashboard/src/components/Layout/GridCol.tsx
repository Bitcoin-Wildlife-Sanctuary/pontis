import cx from 'classnames';

import {createAsAble} from '../../utils/createAsAble';

type Column = number | 'auto';

type GridColProps = {
  children?: React.ReactNode;
  className?: string;
  span?: Column;
  sm?: Column;
  md?: Column;
  lg?: Column;
  xl?: Column;
  xxl?: Column;
  auto?: boolean;
};

export const GridCol = createAsAble<GridColProps>('div', (AsAble, props) => {
  const {children, className, span = -1, sm = -1, md = -1, lg = -1, xl = -1, xxl = -1, auto, ...restProps} = props;

  return (
    <AsAble
      className={cx(
        {'col-auto': auto},
        {[`col-${span}`]: span !== -1},
        {[`col-sm-${sm}`]: sm !== -1},
        {[`col-md-${md}`]: md !== -1},
        {[`col-lg-${lg}`]: lg !== -1},
        {[`col-xl-${xl}`]: xl !== -1},
        {[`col-xxl-${xxl}`]: xxl !== -1},
        className,
      )}
      {...restProps}
    >
      {children}
    </AsAble>
  );
});
