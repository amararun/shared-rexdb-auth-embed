import * as React from "react"
import { cn } from "@/lib/utils"
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  columns: Array<{ accessorKey: string; header: string }>;
  data: any[];
  variant?: 'default' | 'striped';
}

const Table = React.forwardRef<
  HTMLTableElement,
  TableProps
>(({ className, columns, data: initialData, variant = 'default', ...props }, ref) => {
  const [data, setData] = React.useState(initialData);
  const [sortConfig, setSortConfig] = React.useState<{
    key: string;
    direction: 'asc' | 'desc' | null;
  }>({ key: '', direction: null });
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Format numbers for numeric columns
  const formatValue = (value: any, key: string) => {
    if (value === null || value === undefined) return '';
    
    // Date formatting
    if (key === 'DATE') {
      return value; // Assuming date is already in correct format
    }
    
    // Text columns
    if (key === 'CATEGORY' || key === 'BANK_NAME') {
      return value;
    }
    
    // Numeric formatting for all other columns
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }

    setSortConfig({ key, direction });

    if (direction === null) {
      setData(initialData);
      return;
    }

    const sortedData = [...data].sort((a, b) => {
      if (a[key] === b[key]) return 0;
      
      // Special handling for date columns
      if (key === 'DATE') {
        const dateA = new Date(a[key]);
        const dateB = new Date(b[key]);
        return direction === 'asc' ? 
          dateA.getTime() - dateB.getTime() : 
          dateB.getTime() - dateA.getTime();
      }
      
      if (direction === 'asc') {
        return a[key] < b[key] ? -1 : 1;
      } else {
        return a[key] > b[key] ? -1 : 1;
      }
    });

    setData(sortedData);
  };

  // Pagination
  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full">
      {/* Pagination Controls - Reduced top padding */}
      <div className="flex items-center justify-between py-0.5 px-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">Rows per page:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border rounded px-2 py-0.5 text-xs appearance-none pr-8"
            >
              {[5, 10, 15, 25, 50].map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table - Added negative margin top to pull table up closer to controls */}
      <div className="relative w-full overflow-auto -mt-1">
        <table
          ref={ref}
          className={cn(
            "w-full caption-bottom text-[13.5px]",
            className
          )}
          {...props}
        >
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead 
                  key={index}
                  onClick={() => handleSort(column.accessorKey)}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 h-7 px-2", // Reduced height
                    column.accessorKey !== 'CATEGORY' && 
                    column.accessorKey !== 'BANK_NAME' && 
                    column.accessorKey !== 'DATE' && 
                    "text-right" // Right align numeric columns
                  )}
                >
                  <div className="flex items-center gap-1 justify-between">
                    {column.header}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow 
                key={rowIndex}
                className={variant === 'striped' && rowIndex % 2 === 0 ? 'bg-white' : undefined}
              >
                {columns.map((column, colIndex) => (
                  <TableCell 
                    key={colIndex}
                    className={cn(
                      "py-0 px-2", // Reduced padding
                      "whitespace-nowrap", // Prevent wrapping
                      column.accessorKey !== 'CATEGORY' && 
                      column.accessorKey !== 'BANK_NAME' && 
                      column.accessorKey !== 'DATE' && 
                      "text-right" // Right align numeric columns
                    )}
                  >
                    {formatValue(row[column.accessorKey], column.accessorKey)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
    </div>
  );
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-8 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} 