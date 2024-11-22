export const getColumnConfig = (type: string) => {
  switch (type.toUpperCase()) {
    case 'INTEGER':
    case 'NUMERIC':
      return {
        filter: 'agNumberColumnFilter',
        sortable: true,
        type: 'numericColumn',
        valueFormatter: (params: any) => {
          return params.value ? new Intl.NumberFormat('en-IN').format(params.value) : '';
        }
      };
    case 'DATE':
    case 'TIMESTAMP':
      return {
        filter: 'agDateColumnFilter',
        sortable: true,
        valueFormatter: (params: any) => {
          return params.value ? new Date(params.value).toLocaleDateString() : '';
        }
      };
    default:
      return {
        filter: 'agTextColumnFilter',
        sortable: true
      };
  }
};

export const convertValue = (value: string, type: string): any => {
  if (!value) return null;
  
  switch (type.toUpperCase()) {
    case 'INTEGER':
      return parseInt(value.replace(/[^0-9-]/g, ''), 10) || null;
    case 'NUMERIC':
      return parseFloat(value.replace(/[^0-9.-]/g, '')) || null;
    case 'DATE':
    case 'TIMESTAMP':
      return new Date(value).toISOString();
    default:
      return value;
  }
}; 