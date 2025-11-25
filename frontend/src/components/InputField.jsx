import React from 'react';
import clsx from 'clsx';

export const InputField = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  autoComplete,
  required,
  className,
  ...rest
}) => (
  <label className="flex flex-col gap-1 text-sm text-slate-200">
    <span>{label}</span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      className={clsx(
        'w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
        className
      )}
      {...rest}
    />
  </label>
);
