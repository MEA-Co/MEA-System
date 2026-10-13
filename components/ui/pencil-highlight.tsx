import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

import styles from './pencil-highlight.module.css';

/** Short editorial emphasis, not a selected, warning, or saved state. */
export function PencilHighlight({
  variant = 'marker',
  className,
  ...props
}: ComponentProps<'mark'> & { variant?: 'marker' | 'underline' }) {
  return (
    <mark
      data-slot="pencil-highlight"
      data-variant={variant}
      className={cn(styles.highlight, className)}
      {...props}
    />
  );
}
