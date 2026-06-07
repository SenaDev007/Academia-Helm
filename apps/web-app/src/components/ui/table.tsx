/**
 * Table Component
 * 
 * Composant table minimal pour débloquer le build Vercel
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-x-auto">
        <table
          ref={ref}
          className={cn('w-full caption-bottom text-xs md:text-sm', className)}
          {...props}
        />
      </div>
    );
  }
);

Table.displayName = 'Table';

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
    );
  }
);

TableHeader.displayName = 'TableHeader';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
      />
    );
  }
);

TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b transition-colors hover:bg-gray-50 data-[state=selected]:bg-gray-100',
          className
        )}
        {...props}
      />
    );
  }
);

TableRow.displayName = 'TableRow';

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-3 md:px-6 py-3 md:py-4 text-left align-middle font-medium text-gray-500 text-xs md:text-sm [&:has([role=checkbox])]:pr-0',
          className
        )}
        {...props}
      />
    );
  }
);

TableHead.displayName = 'TableHead';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn('px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm [&:has([role=checkbox])]:pr-0', className)}
        {...props}
      />
    );
  }
);

TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
