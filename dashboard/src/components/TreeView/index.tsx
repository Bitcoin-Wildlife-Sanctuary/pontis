'use client';

import cx from 'classnames';
import {forwardRef, Fragment, useLayoutEffect, useRef} from 'react';
import {useTheme} from 'styled-components';

import {drawLineFromTo, getFromToCords} from '@/utils/svg';

import {Icon} from '../Icon';
import {Col, Row} from '../Layout';

type TreeViewComponentProps<TItem> = {
  inverted?: boolean;
  items: TItem[][];
  renderItem: (item: NonNullable<TItem>, index: number) => React.ReactNode;
  keyExtractor: (item: NonNullable<TItem>, index: number) => string;
};

type TreeViewLevelProps<TItem> = {
  inverted?: boolean;
  level: TItem[];
  levelIdx: number;
  renderItem: (item: NonNullable<TItem>, index: number) => React.ReactNode;
  keyExtractor: (item: NonNullable<TItem>, index: number) => string;
  shouldRenderSeparator: boolean;
};

const horizontalClassName = 'd-none d-md-flex d-lg-none d-xxl-flex flex-shrink-0';
const verticalClassName = 'd-flex d-md-none d-lg-flex d-xxl-none flex-shrink-0';

const TreeViewComponent = <TItem,>({inverted, items, renderItem, keyExtractor}: TreeViewComponentProps<TItem>) => {
  return (
    <TreeViewContainer>
      {items.map((level, levelIdx) => (
        <TreeViewLevel
          key={levelIdx.toString()}
          inverted={inverted}
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

const TreeViewLevel = <TItem,>({
  inverted,
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

    const separator = separatorRef.current;
    let leftContainer = containerRef.current as HTMLElement;

    // We get the right, by skipping 2 siblings (2 svg separator elements).
    // TODO: make it more robust
    let rightContainer = leftContainer.nextSibling?.nextSibling?.nextSibling as HTMLElement;
    if (!rightContainer) return;

    const linePath = separator.querySelector('path.separator-line') as SVGPathElement;

    if (inverted) {
      [leftContainer, rightContainer] = [rightContainer, leftContainer];
    }

    //
    // Get the tree elements
    //
    const elems: [HTMLElement, HTMLElement?, HTMLElement?][] = [];

    for (let i = 0; i < leftContainer.children.length; i += 1) {
      const elem = leftContainer.children[i] as HTMLElement;

      if (elem.getBoundingClientRect().height > 0) {
        const leftElem = rightContainer.children[i * 2];
        const rightElem = rightContainer.children[i * 2 + 1];

        let left: HTMLElement | undefined;
        if (leftElem && leftElem.getBoundingClientRect().height > 0) {
          left = leftElem as HTMLElement;
        }

        let right: HTMLElement | undefined;
        if (rightElem && rightElem.getBoundingClientRect().height > 0) {
          right = rightElem as HTMLElement;
        }

        // make sure we have at least a start and an end element
        if (!left && !right) continue;

        elems.push([elem, left, right]);
      }
    }

    //
    // Draw the separator
    //
    const drawSeparator = () => {
      const svgRect = separator.getBoundingClientRect();

      let linePathData = '';

      for (const elem of elems) {
        const [from, to1, to2] = elem;

        const fromRect = from.getBoundingClientRect();

        if (to1) {
          const to1Rect = to1.getBoundingClientRect();
          const cords = inverted
            ? getFromToCords(svgRect, to1Rect, fromRect)
            : getFromToCords(svgRect, fromRect, to1Rect);

          linePathData += drawLineFromTo(cords.from, cords.to);
        }

        if (to2) {
          const to2Rect = to2.getBoundingClientRect();
          const cords = inverted
            ? getFromToCords(svgRect, to2Rect, fromRect)
            : getFromToCords(svgRect, fromRect, to2Rect);

          linePathData += drawLineFromTo(cords.from, cords.to);
        }
      }

      linePath.setAttribute('d', linePathData);

      separator.style.display = 'block';
    };

    // Initial draw
    drawSeparator();

    // Draw on resize
    const resizeObserver = new ResizeObserver(() => drawSeparator());
    resizeObserver.observe(leftContainer);

    return () => {
      resizeObserver.unobserve(leftContainer);
    };
  });

  return (
    <Fragment>
      <Col ref={containerRef} $gap="xxsmall" $justify="space-around">
        {level.map((item, itemIdx) => {
          if (!item || (typeof item === 'object' && 'type' in item && item.type === 'EMPTY')) {
            return <div key={itemIdx} />;
          }

          return <Fragment key={keyExtractor(item, itemIdx)}>{renderItem(item, itemIdx)}</Fragment>;
        })}
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
          width={20}
          height="100%"
          style={{display: 'none'}}
        >
          <path d="" fill="none" stroke="currentColor" strokeWidth="3" className="separator-line" />
        </svg>
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
