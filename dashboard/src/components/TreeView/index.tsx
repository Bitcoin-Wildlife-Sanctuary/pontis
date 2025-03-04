import cx from 'classnames';

import {Icon} from '../Icon';
import {Col, Row} from '../Layout';

type TreeViewProps = {
  children?: React.ReactNode;
};

const horizontalClassName = 'd-none d-md-flex d-lg-none d-xxl-flex flex-shrink-0';
const verticalClassName = 'd-flex d-md-none d-lg-flex d-xxl-none flex-shrink-0';

const TreeViewContainer: React.FC<TreeViewProps> = ({children}) => {
  return (
    <>
      <Col
        $padding="xsmall"
        style={{
          paddingLeft: 0,
          paddingRight: 0,
        }}
        className={verticalClassName}
      >
        {children}
      </Col>

      <Row
        $alignItems="center"
        $padding="xsmall"
        className={horizontalClassName}
        style={{overflow: 'auto', paddingLeft: 0}}
      >
        {children}
      </Row>
    </>
  );
};

const TreeViewSeparator: React.FC = () => {
  return (
    <>
      <Icon className={horizontalClassName} name="DoubleArrowRight" color="border" width={28} height={50} />
      <Icon className={cx(verticalClassName, 'align-self-center')} name="ArrowDown" color="border" width={32} />
    </>
  );
};

const TreeView = TreeViewContainer as typeof TreeViewContainer & {
  Container: typeof TreeViewContainer;
  Separator: typeof TreeViewSeparator;
};

TreeView.Container = TreeViewContainer;
TreeView.Separator = TreeViewSeparator;

export {TreeView};
