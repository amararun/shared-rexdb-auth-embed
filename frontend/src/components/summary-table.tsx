import { cn } from '@/lib/utils';

interface SummaryTableProps {
  columns: Array<{ accessorKey: string; header: string }>;
  data: any[];
}

export function SummaryTable({ columns, data }: SummaryTableProps) {
  // Format numbers for numeric columns
  const formatValue = (value: any, key: string) => {
    if (value === null || value === undefined) return '';
    
    // Text columns
    if (key === 'CATEGORY' || key === 'BANK_NAME' || key === 'DATE') {
      return value;
    }
    
    // Numeric formatting for all other columns
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full">
      <table className="w-full border-collapse border border-gray-200">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((column, index) => (
              <th
                key={index}
                className={cn(
                  "border border-gray-200 px-2 py-1", // Reduced padding
                  "text-xs font-medium text-gray-500 uppercase tracking-wider", // Smaller font
                  "whitespace-nowrap", // Prevent wrapping
                  column.accessorKey !== 'CATEGORY' && 
                  column.accessorKey !== 'BANK_NAME' && 
                  column.accessorKey !== 'DATE' && 
                  "text-right" // Right align numeric columns
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              className="bg-white"
            >
              {columns.map((column, colIndex) => (
                <td
                  key={colIndex}
                  className={cn(
                    "border border-gray-200 px-2 py-1", // Reduced padding
                    "text-xs text-gray-900", // Smaller font
                    "whitespace-nowrap", // Prevent wrapping
                    column.accessorKey !== 'CATEGORY' && 
                    column.accessorKey !== 'BANK_NAME' && 
                    column.accessorKey !== 'DATE' && 
                    "text-right" // Right align numeric columns
                  )}
                >
                  {formatValue(row[column.accessorKey], column.accessorKey)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 