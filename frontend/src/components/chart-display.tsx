

interface ChartDisplayProps {
  charts: { url: string; timestamp: number }[];
}

const DEFAULT_CHART_IMAGE = '/images/default-chart.png';

export const ChartDisplay: React.FC<ChartDisplayProps> = ({ charts }) => {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">
        {charts.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <img 
              src={DEFAULT_CHART_IMAGE}
              alt="Default Chart"
              className="w-full max-w-md rounded-lg shadow-sm opacity-70"
            />
          </div>
        ) : (
          charts.map((chart, index) => (
            <div key={chart.timestamp} className="relative">
              <img 
                src={chart.url} 
                alt={`Chart ${index + 1}`} 
                className="w-full rounded-lg shadow-sm"
              />
              <div className="absolute top-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
                {new Date(chart.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}; 