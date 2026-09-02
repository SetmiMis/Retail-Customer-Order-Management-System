import { cn } from '../../lib/utils/cn';

type Variant = 'primary' | 'green' | 'red' | 'ghost' | 'wa' | 'call';
type Size = 'md' | 'sm';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: '',
  green: 'green',
  red: 'red',
  ghost: 'ghost',
  wa: 'wa',
  call: 'call',
};

export default function Button({
  variant = 'primary', size = 'md', loading, disabled, className, children, ...rest
}: ButtonProps) {
  return (
    <button
      className={cn('btn', VARIANT_CLASS[variant], size === 'sm' && 'sm', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spin" aria-hidden />}
      {children}
    </button>
  );
}
