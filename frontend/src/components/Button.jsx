import React from 'react';
import clsx from 'clsx';

const baseStyles =
  'inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const Button = ({
  children,
  variant = 'primary',
  className,
  ...rest
}) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-emerald-500',
    secondary:
      'bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:outline-slate-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-300'
  };

  return (
    <button className={clsx(baseStyles, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
};
