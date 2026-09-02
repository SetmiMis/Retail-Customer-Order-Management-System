import { cn } from '../../lib/utils/cn';

export default function Card({
  children, className, style, as: Comp = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section';
}) {
  return (
    <Comp className={cn('card', className)} style={style}>
      {children}
    </Comp>
  );
}
