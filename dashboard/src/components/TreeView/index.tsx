'use client';

import cx from 'classnames';
import {forwardRef, Fragment, useLayoutEffect, useRef} from 'react';
import {useTheme} from 'styled-components';

import {Icon} from '../Icon';
import {Col, Row} from '../Layout';

type TreeViewComponentProps<TItem extends object> = {
  items: TItem[][];
  renderItem: (item: TItem, index: number) => React.ReactNode;
  keyExtractor: (item: TItem, index: number) => string;
};

type TreeViewLevelProps<TItem extends object> = {
  level: TItem[];
  levelIdx: number;
  renderItem: (item: TItem, index: number) => React.ReactNode;
  keyExtractor: (item: TItem, index: number) => string;
  shouldRenderSeparator: boolean;
};

const horizontalClassName = 'd-none d-md-flex d-lg-none d-xxl-flex flex-shrink-0';
const verticalClassName = 'd-flex d-md-none d-lg-flex d-xxl-none flex-shrink-0';

const TreeViewComponent = <TItem extends object>({items, renderItem, keyExtractor}: TreeViewComponentProps<TItem>) => {
  return (
    <TreeViewContainer>
      {items.map((level, levelIdx) => (
        <TreeViewLevel
          key={levelIdx.toString()}
          level={level}
          levelIdx={levelIdx}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          shouldRenderSeparator={levelIdx !== items.length - 1}
        />
      ))}
    </TreeViewContainer>
  );
};

const TreeViewLevel = <TItem extends object>({
  level,
  renderItem,
  keyExtractor,
  shouldRenderSeparator,
}: TreeViewLevelProps<TItem>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const separatorRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current || !separatorRef.current) {
      return;
    }

    // If the level container doesn't have at least 2 children, we dont need to calculate the separator position
    if (containerRef.current.children.length < 2) {
      return;
    }

    const container = containerRef.current;
    const separator = separatorRef.current;

    const drawSeparator = () => {
      //
      // Get the necessary elements
      //
      const left1 = container.children[0] as HTMLElement;
      const left2 = container.children[container.children.length - 1] as HTMLElement;

      // We get the right, by skipping 2 siblings (2 svg separator elements).
      // TODO: make it more robust
      const right = container.nextSibling?.nextSibling?.nextSibling as HTMLElement;
      if (!right) return;

      const placeholder = separator.parentElement?.querySelector('.separator-placeholder') as HTMLElement;
      const linePath = separator.querySelector('path.separator-line') as SVGPathElement;
      const arrowPath = separator.querySelector('path.separator-arrow') as SVGPathElement;

      //
      // Get and set the necessary rects of the elements
      //
      const svgRect = separator.getBoundingClientRect();
      const left1Rect = left1.getBoundingClientRect();
      const left2Rect = left2.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      //
      // Get middle points of the rects
      //
      const left1MidY = left1Rect.top + left1Rect.height / 2;
      const left2MidY = left2Rect.top + left2Rect.height / 2;
      const rightMidY = rightRect.top + rightRect.height / 2;

      //
      // Coordinates are relative to the viewport, so we need to adjust them
      //
      const leftX = left1Rect.right - svgRect.left;
      const rightX = rightRect.left - svgRect.left;

      const left1Y = left1MidY - svgRect.top;
      const left2Y = left2MidY - svgRect.top;
      const rightY = rightMidY - svgRect.top;

      //
      // Calculate and set the path data
      //
      const leftSideWidth = (rightX - leftX) / 3;
      const arrowSize = 12.55;

      const linePathData = `
        M${leftX},${left1Y} l ${leftSideWidth} 0 l 0 ${rightY - left1Y} l ${rightX - leftSideWidth - arrowSize} 0
        M${leftX},${left2Y} l ${leftSideWidth} 0 l 0 ${rightY - left2Y} l ${rightX - leftSideWidth - arrowSize} 0
      `;
      linePath.setAttribute('d', linePathData);

      arrowPath.setAttribute('transform', `translate(${rightX - 14}, ${rightY - 12})`);
      arrowPath.style.display = 'initial';

      if (placeholder) placeholder.style.display = 'none';
      separator.style.display = 'block';
    };

    // Initial draw
    drawSeparator();

    // Draw on resize
    const resizeObserver = new ResizeObserver(() => drawSeparator());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.unobserve(container);
    };
  });

  return (
    <Fragment>
      <Col ref={containerRef} $gap="xxsmall" $justify="center">
        {level.map((item, itemIdx) => (
          <Fragment key={keyExtractor(item, itemIdx)}>{renderItem(item, itemIdx)}</Fragment>
        ))}
      </Col>

      {shouldRenderSeparator && <TreeViewSeparator ref={separatorRef} />}
    </Fragment>
  );
};

const TreeViewContainer = ({children}: React.PropsWithChildren) => {
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
        $alignItems="stretch"
        $padding="xsmall"
        style={{overflow: 'auto', paddingLeft: 0}}
        className={horizontalClassName}
      >
        {children}
      </Row>
    </>
  );
};

const TreeViewSeparator = forwardRef<SVGSVGElement>((props, ref) => {
  const theme = useTheme();

  return (
    <>
      <Col className={horizontalClassName}>
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          color={theme.colors.border}
          width={30}
          height="100%"
          style={{display: 'none'}}
        >
          <path d="" fill="none" stroke="currentColor" strokeWidth="3" className="separator-line" />

          <path
            d="M13.0607 13.0607C13.6464 12.4749 13.6464 11.5251 13.0607 10.9393L3.51472 1.3934C2.92893 0.807612 1.97918 0.807612 1.3934 1.3934C0.807612 1.97918 0.807612 2.92893 1.3934 3.51472L9.87868 12L1.3934 20.4853C0.807612 21.0711 0.807612 22.0208 1.3934 22.6066C1.97918 23.1924 2.92893 23.1924 3.51472 22.6066L13.0607 13.0607ZM1 13.5H12V10.5H1V13.5Z"
            fill="currentColor"
            className="separator-arrow"
            style={{display: 'none'}}
          />
        </svg>

        <Col className="separator-placeholder" $flex={1} $alignItems="center" $justify="center">
          <Icon name="ArrowRight" color="border" width={32} />
        </Col>
      </Col>

      <Icon className={cx(verticalClassName, 'align-self-center')} name="ArrowDown" color="border" width={32} />
    </>
  );
});
TreeViewSeparator.displayName = 'TreeViewSeparator';

const TreeView = TreeViewComponent as typeof TreeViewComponent & {
  Container: typeof TreeViewContainer;
  Level: typeof TreeViewLevel;
  Separator: typeof TreeViewSeparator;
};

TreeView.Container = TreeViewContainer;
TreeView.Level = TreeViewLevel;
TreeView.Separator = TreeViewSeparator;

export {TreeView};
