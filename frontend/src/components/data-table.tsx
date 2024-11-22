"use client"

import { AgGridReact } from 'ag-grid-react';
import { 
  GridReadyEvent,
  FirstDataRenderedEvent,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { useMemo, useRef, CSSProperties, useEffect } from 'react';
import { Table } from "@/components/ui/table"
import { SummaryTable } from "./summary-table"
import { Popover } from '@mui/material';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Calculator, Maximize2, Minimize2, X, ChevronDown, BarChart3, FileSpreadsheet } from 'lucide-react';
import { Card } from "@/components/ui/card";

interface DataTableProps {
  columns: Array<{
    accessorKey: string;
    header: string;
    field?: string;
    headerName?: string;
    type?: string;
    filter?: string | boolean;
    valueFormatter?: (params: any) => string;
    [key: string]: any;
  }>;
  data: any[];
  tableType: 'simple' | 'advanced' | 'summary';
}

// Define custom style interface to include CSS variables
interface CustomStyle extends CSSProperties {
  [key: string]: string | number | undefined;
}

const CHAR_WIDTH = 10; // Pixels per character (increased from 9 to 10 for better readability)
const MIN_CHARS = 20; // Minimum characters
const PADDING = 40; // Extra padding for headers (for sort icons, calc button, etc)

const styles = `
  .bank-details-modal {
    position: fixed;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 16px;
    z-index: 1004;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }

  /* Prevent text wrapping in table cells */
  .bank-details-modal td {
    white-space: nowrap;
  }

  /* Update the text color for column names */
  .bank-details-modal td:first-child {
    color: #1e40af; /* Tailwind's blue-800, a medium navy blue */
  }

  .context-menu {
    position: fixed;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    padding: 4px;
    min-width: 160px;
    z-index: 1002;
  }

  .context-menu-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #4b5563;
    border-radius: 4px;
  }

  .context-menu-item:hover {
    background-color: #f3f4f6;
    color: #4f46e5;
  }

  /* Style for sortable headers */
  .ag-header-cell {
    cursor: pointer;
  }

  /* Sort icons styling */
  .ag-header-cell-label {
    display: flex;
    align-items: center;
    width: 100%;
  }

  .ag-header-cell-sorted-asc::after,
  .ag-header-cell-sorted-desc::after {
    content: '';
    display: inline-block;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    margin-left: 4px;
    vertical-align: middle;
  }

  .ag-header-cell-sorted-asc::after {
    border-bottom: 4px solid #4f46e5;
  }

  .ag-header-cell-sorted-desc::after {
    border-top: 4px solid #4f46e5;
  }

  /* Ensure calculator button doesn't interfere with sort click */
  .calculator-button {
    z-index: 2;
  }

  /* Add these new styles for header handling */
  .ag-header-cell-nowrap {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  .ag-header-cell-label {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  /* Ensure header text doesn't wrap */
  .ag-header-cell-text {
    text-overflow: ellipsis !important;
    overflow: hidden !important;
    white-space: nowrap !important;
  }

  /* Add these styles for numeric formatting */
  .ag-cell.text-right {
    text-align: right !important;
    justify-content: flex-end !important;
  }

  .ag-header-cell-label {
    width: 100% !important;
  }

  /* Ensure numeric cells have proper padding */
  .ag-cell.text-right {
    padding-right: 12px !important;
  }
`;

interface BankDetailsModalProps {
  data: any;
  onClose: () => void;
  position: { x: number; y: number };
}

const BankDetailsModal = ({ data, onClose, position }: BankDetailsModalProps) => {
  // Add useEffect for escape key handling
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Helper function to check if a value is numeric
  const isNumeric = (value: any): boolean => {
    return !isNaN(parseFloat(value)) && isFinite(value);
  };

  // Helper function to format values based on their type
  const formatValue = (key: string, value: any): string => {
    // Skip formatting for these fields
    if (key === 'CATEGORY' || key === 'BANK_NAME' || key === 'DATE') {
      return String(value);
    }
    
    // Format numbers using Indian locale
    if (isNumeric(value)) {
      return new Intl.NumberFormat('en-IN').format(Number(value));
    }

    return String(value);
  };

  return (
    <Card 
      className="bank-details-modal"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '480px',
        maxWidth: '520px'
      }}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-[14px] font-semibold text-indigo-900 whitespace-nowrap overflow-hidden text-ellipsis">
          {data['BANK_NAME']}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 hover:bg-indigo-100 flex-shrink-0"
        >
          <X className="h-4 w-4 text-indigo-600" />
        </Button>
      </div>
      <div className="text-[13px]">
        <table className="w-full border-collapse">
          <tbody className="divide-y divide-gray-200">
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="py-0.5 pr-4 font-medium text-blue-800 w-1/2 whitespace-nowrap" title={key}>
                  {key}
                </td>
                <td className="py-0.5 text-right whitespace-nowrap" title={formatValue(key, value)}>
                  {formatValue(key, value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// First, add these statistical utility functions
const calculateStatistics = {
  // Central Tendency
  mean: (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length,
  median: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  mode: (values: number[]): number => {
    const freq: { [key: string]: number } = {};
    values.forEach(num => {
      freq[num.toString()] = (freq[num.toString()] || 0) + 1;
    });
    
    const mode = Object.entries(freq).reduce((a, [key, value]) => {
      const prevValue = freq[a.toString()] || 0;
      return value > prevValue ? Number(key) : Number(a);
    }, Number(Object.keys(freq)[0]));

    return mode;
  },

  // Dispersion
  variance: (values: number[]) => {
    const mean = calculateStatistics.mean(values);
    return values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  },
  standardDeviation: (values: number[]) => Math.sqrt(calculateStatistics.variance(values)),
  coefficientOfVariation: (values: number[]) => {
    const mean = calculateStatistics.mean(values);
    return (calculateStatistics.standardDeviation(values) / mean) * 100;
  },

  // Distribution Shape
  skewness: (values: number[]) => {
    const mean = calculateStatistics.mean(values);
    const std = calculateStatistics.standardDeviation(values);
    const n = values.length;
    return (values.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / n) / Math.pow(std, 3);
  },
  kurtosis: (values: number[]) => {
    const mean = calculateStatistics.mean(values);
    const std = calculateStatistics.standardDeviation(values);
    const n = values.length;
    return (values.reduce((a, b) => a + Math.pow(b - mean, 4), 0) / n) / Math.pow(std, 4);
  },

  // Quartiles and Range
  quartiles: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q2Idx = Math.floor(sorted.length * 0.5);
    const q3Idx = Math.floor(sorted.length * 0.75);
    return {
      Q1: sorted[q1Idx],
      Q2: sorted[q2Idx],
      Q3: sorted[q3Idx],
      IQR: sorted[q3Idx] - sorted[q1Idx]
    };
  },
  range: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[sorted.length - 1] - sorted[0];
  },

  // Additional Metrics
  geometricMean: (values: number[]) => {
    return Math.exp(values.reduce((a, b) => a + Math.log(Math.abs(b)), 0) / values.length);
  },
  harmonicMean: (values: number[]) => {
    return values.length / values.reduce((a, b) => a + 1 / Math.abs(b), 0);
  },
  trimmedMean: (values: number[], trim: number = 0.1) => {
    const sorted = [...values].sort((a, b) => a - b);
    const trimCount = Math.floor(values.length * trim);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    return calculateStatistics.mean(trimmed);
  },

  // Add new calculations
  percentiles: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    };
    
    return {
      p10: getPercentile(10),
      p25: getPercentile(25),
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90)
    };
  },

  outliers: (values: number[]) => {
    const q = calculateStatistics.quartiles(values);
    const iqr = q.Q3 - q.Q1;
    const lowerBound = q.Q1 - (1.5 * iqr);
    const upperBound = q.Q3 + (1.5 * iqr);
    return values.filter(v => v < lowerBound || v > upperBound).length;
  },

  uniqueValues: (values: number[]) => new Set(values).size,

  missingValues: (values: number[]) => values.filter(v => v === null || v === undefined || Number.isNaN(v)).length,

  boxPlotData: (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const q = calculateStatistics.quartiles(sorted);
    const iqr = q.Q3 - q.Q1;
    const whiskerBottom = Math.max(q.Q1 - 1.5 * iqr, sorted[0]);
    const whiskerTop = Math.min(q.Q3 + 1.5 * iqr, sorted[sorted.length - 1]);
    
    return {
      min: whiskerBottom,
      q1: q.Q1,
      median: q.Q2,
      q3: q.Q3,
      max: whiskerTop,
      outliers: sorted.filter(v => v < whiskerBottom || v > whiskerTop)
    };
  }
};

// Update the drawBoxPlot function with thinner lines
const drawBoxPlot = (data: ReturnType<typeof calculateStatistics.boxPlotData>, width = 200, height = 40) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const padding = 10;
  const plotWidth = width - (padding * 2);
  
  const scale = (value: number) => {
    const range = data.max - data.min;
    return padding + ((value - data.min) / range) * plotWidth;
  };

  // Set thinner line width for all strokes
  ctx.lineWidth = 0.5; // Reduced from default 1.0

  // Draw box
  ctx.beginPath();
  ctx.strokeStyle = '#4f46e5';
  ctx.fillStyle = '#e0e7ff';
  
  // Box
  const boxLeft = scale(data.q1);
  const boxRight = scale(data.q3);
  ctx.fillRect(boxLeft, height/4, boxRight - boxLeft, height/2);
  ctx.strokeRect(boxLeft, height/4, boxRight - boxLeft, height/2);

  // Median line
  ctx.beginPath();
  ctx.moveTo(scale(data.median), height/4);
  ctx.lineTo(scale(data.median), height * 3/4);
  ctx.strokeStyle = '#312e81';
  ctx.stroke();

  // Whiskers
  ctx.beginPath();
  ctx.moveTo(scale(data.min), height/2);
  ctx.lineTo(scale(data.q1), height/2);
  ctx.moveTo(scale(data.q3), height/2);
  ctx.lineTo(scale(data.max), height/2);
  ctx.strokeStyle = '#4f46e5';
  ctx.stroke();

  // Outliers
  data.outliers.forEach(value => {
    ctx.beginPath();
    ctx.arc(scale(value), height/2, 1.5, 0, Math.PI * 2); // Reduced radius from 2 to 1.5
    ctx.fillStyle = '#ef4444';
    ctx.fill();
  });

  return canvas.toDataURL();
};

// Update the createScalableHistogram function with thinner lines
const createScalableHistogram = (values: number[], width = 200, height = 40) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Calculate percentile-based boundaries
  const percentiles = calculateStatistics.percentiles(values);
  const boundaries = [
    Math.min(...values),
    percentiles.p10,
    percentiles.p25,
    percentiles.p50,
    percentiles.p75,
    percentiles.p90,
    Math.max(...values)
  ];

  // Count values in each bin
  const bins = boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];
    return {
      start,
      end,
      count: values.filter(v => v >= start && v <= end).length
    };
  });

  // Draw histogram
  const padding = 4;
  const maxCount = Math.max(...bins.map(b => b.count));
  const barWidth = (width - (padding * 2)) / bins.length;
  
  // Set thinner line width for all strokes
  ctx.lineWidth = 0.5; // Reduced from default 1.0
  
  // Draw bars
  bins.forEach((bin, i) => {
    const barHeight = (bin.count / maxCount) * (height - padding * 2);
    const x = padding + (i * barWidth);
    const y = height - padding - barHeight;
    
    ctx.fillStyle = '#e0e7ff';
    ctx.strokeStyle = '#4f46e5';
    ctx.beginPath();
    ctx.rect(x, y, barWidth - 0.5, barHeight); // Reduced gap between bars
    ctx.fill();
    ctx.stroke();
  });

  return canvas.toDataURL();
};

// Update the StatsData type to include new metrics
type StatsData = {
  centralTendency: {
    mean: number;
    median: number;
    mode: number;
    trimmedMean: number;
  };
  dispersion: {
    variance: number;
    standardDeviation: number;
    coefficientOfVariation: number;
  };
  distribution: {
    skewness: number;
    kurtosis: number;
  };
  position: {
    quartiles: {
      Q1: number;
      Q2: number;
      Q3: number;
      IQR: number;
    };
    range: number;
  };
  percentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  dataQuality: {
    uniqueValues: number;
    missingValues: number;
    outlierCount: number;
  };
  boxPlot: ReturnType<typeof calculateStatistics.boxPlotData>;
};

export function DataTable({ columns, data, tableType = 'simple' }: DataTableProps) {
  const gridRef = useRef<AgGridReact>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [activeColumn, setActiveColumn] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [bankDetailsData, setBankDetailsData] = useState<any>(null);
  const [bankDetailsPosition, setBankDetailsPosition] = useState({ x: 0, y: 0 });

  const handleStatsClick = (element: HTMLElement, colId: string) => {
    const stats = calculateStats(colId);
    if (stats) {
      setStatsData(stats);
      setActiveColumn(colId);
      setAnchorEl(element);
    }
  };

  const columnDefs = useMemo(() => [
    // Add calculator column as first column
    {
      headerName: '',
      field: 'calculator',
      width: 50,
      cellRenderer: (params: any) => (
        <div className="flex items-center justify-center cursor-pointer">
          <Calculator 
            className="h-4 w-4 text-indigo-600 hover:text-indigo-700"
            onClick={(e) => {
              e.stopPropagation();
              handleBankDetailsClick(e, params.data);
            }}
          />
        </div>
      ),
      pinned: 'left' as 'left' | 'right',
      sortable: false,
      filter: false,
      suppressMenu: true,
      suppressMovable: true,
      lockPosition: true
    },
    // Then add all other columns
    ...columns.map((col) => {
      const headerText = col.headerName || col.header || '';
      let charCount = Math.max(headerText.length, MIN_CHARS);
      const columnWidth = (charCount * CHAR_WIDTH) + PADDING;

      const baseConfig = {
        field: col.field || col.accessorKey,
        headerName: col.headerName || col.header,
        sortable: true,
        filter: true,
        resizable: true,
        width: columnWidth,
        minWidth: columnWidth,
        suppressSizeToFit: true,
        suppressHeaderMenuButton: true,
        cellStyle: { 
          padding: '4px 8px',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        },
        headerClass: 'ag-header-cell-nowrap'
      };

      // Add numeric-specific configurations
      if (col.type === 'INTEGER' || col.type === 'NUMERIC') {
        return {
          ...baseConfig,
          filter: 'agNumberColumnFilter',
          valueFormatter: (params: any) => {
            if (params.value === null || params.value === undefined) return '';
            return new Intl.NumberFormat('en-IN', {
              maximumFractionDigits: 2,
              minimumFractionDigits: 0,
              style: 'decimal'
            }).format(params.value);
          },
          cellClass: 'text-right', // Right align numbers
          headerComponent: (params: any) => (
            <div className="flex items-center justify-between w-full px-2">
              <span className="cursor-pointer flex-grow" onClick={() => params.progressSort()}>
                {col.headerName || col.header}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-100/60 calculator-button"
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  handleStatsClick(e.currentTarget, col.field || col.accessorKey);
                }}
              >
                <BarChart3 className="h-3.5 w-3.5 text-gray-500" />
              </Button>
            </div>
          )
        };
      }

      // Non-numeric columns
      return {
        ...baseConfig,
        filter: 'agTextColumnFilter'
      };
    })
  ], [columns]);

  const calculateStats = (colId: string): StatsData | null => {
    const values = data
      .map(row => row[colId])
      .filter(val => val !== null && val !== undefined && !isNaN(Number(val)))
      .map(Number);

    if (values.length === 0) return null;

    return {
      centralTendency: {
        mean: calculateStatistics.mean(values),
        median: calculateStatistics.median(values),
        mode: calculateStatistics.mode(values),
        trimmedMean: calculateStatistics.trimmedMean(values),
      },
      dispersion: {
        variance: calculateStatistics.variance(values),
        standardDeviation: calculateStatistics.standardDeviation(values),
        coefficientOfVariation: calculateStatistics.coefficientOfVariation(values),
      },
      distribution: {
        skewness: calculateStatistics.skewness(values),
        kurtosis: calculateStatistics.kurtosis(values),
      },
      position: {
        quartiles: calculateStatistics.quartiles(values),
        range: calculateStatistics.range(values),
      },
      percentiles: calculateStatistics.percentiles(values),
      dataQuality: {
        uniqueValues: calculateStatistics.uniqueValues(values),
        missingValues: calculateStatistics.missingValues(values),
        outlierCount: calculateStatistics.outliers(values)
      },
      boxPlot: calculateStatistics.boxPlotData(values)
    };
  };

  const renderTable = () => {
    switch (tableType) {
      case 'simple':
        return (
          <div className="p-4">
            <Table
              columns={columns.map(col => ({
                ...col,
                header: col.header,
                accessorKey: col.accessorKey,
                cell: ({ row }: any) => {
                  if (col.accessorKey === 'BANK_NAME' || col.accessorKey === 'CATEGORY') {
                    return (
                      <div className="flex items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis" 
                           style={{ maxWidth: '300px' }}>
                        {col.accessorKey === 'BANK_NAME' && (
                          <FileSpreadsheet 
                            className="h-3.5 w-3.5 text-gray-500 cursor-pointer flex-shrink-0 hover:text-gray-700" 
                            onClick={(e) => handleBankDetailsClick(e, row.original)}
                          />
                        )}
                        <span className="truncate">{row.getValue(col.accessorKey)}</span>
                      </div>
                    );
                  }
                  return (
                    <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                      {row.getValue(col.accessorKey)}
                    </div>
                  );
                }
              }))}
              data={data}
              variant="striped"
            />
          </div>
        );

      case 'summary':
        return <SummaryTable columns={columns} data={data} />;

      case 'advanced':
        if (!columns.length || !data.length) {
          return <div className="p-4">No data available</div>;
        }

        return (
          <div className="p-4 relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-6 top-3 z-10 hover:bg-gray-100/60 text-gray-600 flex items-center gap-2"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Collapse</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Expand</span>
                </>
              )}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
            <style>
              {`
                .ag-theme-alpine {
                  --ag-header-height: 28px !important;
                  --ag-row-height: 28px !important;
                  --ag-header-padding: 4px !important;
                  --ag-cell-horizontal-padding: 4px !important;
                  --ag-font-size: 12px !important;
                  transition: height 0.3s ease-in-out;
                }
                .ag-header-cell-centered .ag-header-cell-label {
                  justify-content: center;
                }
                .ag-header-cell-text {
                  line-height: 28px !important;
                }
                /* Prevent text wrapping in all cells */
                .ag-cell {
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                }
                /* Remove bottom spacing */
                .ag-root-wrapper {
                  border: none !important;
                }
                /* Move pagination to top */
                .ag-root-wrapper {
                  flex-direction: column-reverse;
                }
                .ag-paging-panel {
                  border-top: none !important;
                  border-bottom: 1px solid #e5e7eb;
                }
              `}
            </style>
            <div 
              className="ag-theme-alpine" 
              style={{ 
                width: '100%',
                border: '1px solid #e5e7eb',
                height: isExpanded ? '85vh' : 'auto',
                minHeight: '200px',
                position: isExpanded ? 'fixed' : 'relative',
                top: isExpanded ? '55%' : 'auto',
                left: isExpanded ? '50%' : 'auto',
                transform: isExpanded ? 'translate(-50%, -50%)' : 'none',
                zIndex: isExpanded ? 50 : 1,
                maxWidth: isExpanded ? '98vw' : '100%',
                backgroundColor: 'white',
                boxShadow: isExpanded ? '0 0 0 100vmax rgba(0,0,0,0.4)' : 'none',
                padding: isExpanded ? '40px 20px 20px 20px' : '0',
              } as CustomStyle}
            >
              {isExpanded && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-4 top-2 hover:bg-gray-100/60 text-gray-600 flex items-center gap-2"
                  onClick={() => setIsExpanded(false)}
                >
                  <span className="text-sm font-medium">Close</span>
                  <X className="h-4 w-4" />
                </Button>
              )}
              <AgGridReact
                ref={gridRef}
                rowData={data}
                columnDefs={columnDefs}
                defaultColDef={{
                  sortable: true,
                  filter: true,
                  resizable: true,
                  floatingFilter: true,
                  suppressHeaderMenuButton: true,
                  suppressSizeToFit: false,
                  autoHeaderHeight: false,
                  wrapHeaderText: false,
                }}
                onGridReady={(params: GridReadyEvent) => {
                  params.api.sizeColumnsToFit();
                  // Force refresh after mounting
                  setTimeout(() => {
                    params.api.redrawRows();
                  }, 100);
                }}
                onFirstDataRendered={(params: FirstDataRenderedEvent) => {
                  params.api.sizeColumnsToFit();
                }}
                suppressRowClickSelection={true}
                enableCellTextSelection={true}
                domLayout={isExpanded ? 'normal' : 'autoHeight'}
                pagination={true}
                paginationPageSize={isExpanded ? 25 : 10}
                paginationPageSizeSelector={[5, 10, 15, 25, 50]}
                suppressColumnVirtualisation={true}
              />
            </div>
          </div>
        );

      default:
        return <div>Invalid table type</div>;
    }
  };

  const handleBankDetailsClick = (event: React.MouseEvent | MouseEvent, data: any) => {
    event.preventDefault();
    event.stopPropagation();

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const modalWidth = 400;
    const modalHeight = 400; // Approximate modal height

    // Calculate center Y position only
    const centerY = viewportHeight / 2;

    // Position modal slightly towards the center but still near the click
    const x = Math.min(
      Math.max(20, event.clientX - modalWidth/4), // Don't go too far left
      viewportWidth - modalWidth - 20 // Don't go off screen right
    );

    // Always position vertically near the center
    const y = centerY - modalHeight/2;

    setBankDetailsPosition({ 
      x: x, 
      y: y 
    });
    setBankDetailsData(data);
  };

  return (
    <>
      {renderTable()}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        {statsData && (
          <div className="p-3 min-w-[320px] max-w-[420px] text-[13.5px]">
            <div className="font-bold text-[15px] mb-1 text-indigo-900 border-b border-indigo-200 pb-1.5">
              Statistics for {columns.find(col => col.accessorKey === activeColumn)?.header || activeColumn}
            </div>
            
            {/* Validation Note */}
            <div className="text-[12px] text-gray-500 italic mb-3">
              Calculations under validation & enhancement
            </div>
            
            {/* Central Tendency */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Central Tendency</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700 w-1/2">Mean</td>
                    <td className="py-0.5 text-right">{statsData.centralTendency.mean.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Median</td>
                    <td className="py-0.5 text-right">{statsData.centralTendency.median.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Mode</td>
                    <td className="py-0.5 text-right">{statsData.centralTendency.mode.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Trimmed Mean</td>
                    <td className="py-0.5 text-right">{statsData.centralTendency.trimmedMean.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Box Plot */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Distribution Plot</h3>
              <img 
                src={drawBoxPlot(statsData.boxPlot)} 
                alt="Box Plot"
                className="w-full h-[40px] my-1 bg-white"
              />
            </div>

            {/* Histogram - Add this new section */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Percentile Distribution</h3>
              <img 
                src={createScalableHistogram(data.map(row => Number(row[activeColumn])).filter(v => !isNaN(v)))} 
                alt="Histogram"
                className="w-full h-[40px] my-1 bg-white"
              />
              <div className="flex justify-between text-[11px] text-gray-500 mt-0.5">
                <span>Min</span>
                <span>P25</span>
                <span>Median</span>
                <span>P75</span>
                <span>Max</span>
              </div>
            </div>

            {/* Dispersion */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Dispersion</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Variance</td>
                    <td className="py-0.5 text-right">{statsData.dispersion.variance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Std Dev</td>
                    <td className="py-0.5 text-right">{statsData.dispersion.standardDeviation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">CV (%)</td>
                    <td className="py-0.5 text-right">{statsData.dispersion.coefficientOfVariation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Distribution */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Distribution Shape</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Skewness</td>
                    <td className="py-0.5 text-right">{statsData.distribution.skewness.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Kurtosis</td>
                    <td className="py-0.5 text-right">{statsData.distribution.kurtosis.toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Position */}
            <div>
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Position</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Q1</td>
                    <td className="py-0.5 text-right">{statsData.position.quartiles.Q1.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Q2</td>
                    <td className="py-0.5 text-right">{statsData.position.quartiles.Q2.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Q3</td>
                    <td className="py-0.5 text-right">{statsData.position.quartiles.Q3.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">IQR</td>
                    <td className="py-0.5 text-right">{statsData.position.quartiles.IQR.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Range</td>
                    <td className="py-0.5 text-right">{statsData.position.range.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Percentiles */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Percentiles</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(statsData.percentiles).map(([key, value]) => (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="py-0.5 pr-4 font-medium text-gray-700">{key.toUpperCase()}</td>
                      <td className="py-0.5 text-right">{value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Data Quality */}
            <div className="mb-3">
              <h3 className="font-semibold text-indigo-800 mb-1.5 text-[13.5px]">Data Quality</h3>
              <table className="w-full border-collapse">
                <tbody className="divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Unique Values</td>
                    <td className="py-0.5 text-right">{statsData.dataQuality.uniqueValues}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Missing Values</td>
                    <td className="py-0.5 text-right">{statsData.dataQuality.missingValues}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-0.5 pr-4 font-medium text-gray-700">Outliers</td>
                    <td className="py-0.5 text-right">{statsData.dataQuality.outlierCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Popover>
      {bankDetailsData && (
        <BankDetailsModal
          data={bankDetailsData}
          onClose={() => setBankDetailsData(null)}
          position={bankDetailsPosition}
        />
      )}
      <style>{styles}</style>
    </>
  );
} 