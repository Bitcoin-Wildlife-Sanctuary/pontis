import {createElement, forwardRef} from 'react';

type AsType = keyof JSX.IntrinsicElements | React.JSXElementConstructor<any>;
type AsAbleComponent<P = object, As extends AsType = 'div'> = P & {
  as?: As;
} & React.ComponentPropsWithoutRef<As>;

const CreateAsAbleComponent = <TDefaultAs extends AsType = 'div'>(defaultAs: TDefaultAs) => {
  const Component = forwardRef<any, AsAbleComponent<object, TDefaultAs>>((props, ref) => {
    const {as, children, ...restProps} = props;

    return createElement(as ?? defaultAs, {...restProps, ref}, children);
  });
  Component.displayName = 'AsAbleComponent';

  return Component;
};

export const createAsAble = <TProps extends object = object, TDefaultAs extends AsType = 'div'>(
  defaultAs: TDefaultAs,
  component: <TAs extends AsType>(
    AsAble: React.FC<AsAbleComponent<object, TDefaultAs>>,
    props: AsAbleComponent<TProps, TAs>,
  ) => React.ReactNode,
): (<TAs extends AsType = TDefaultAs>(props: AsAbleComponent<TProps, TAs>) => React.ReactNode) => {
  const asAbleWithDefault = CreateAsAbleComponent(defaultAs);

  return component.bind(null, asAbleWithDefault as any);
};
