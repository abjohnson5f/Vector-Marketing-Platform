import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="w-full h-full border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
};

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`bg-[#141416] animate-pulse rounded-xl ${className}`} />
);

export const CardSkeleton: React.FC = () => (
  <div className="origin-card p-6 space-y-4">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
);

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="origin-card overflow-hidden">
    <div className="bg-[#141416] p-4">
      <div className="flex gap-8">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
    </div>
    <div className="divide-y divide-[#212124]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex gap-8">
          {[1, 2, 3, 4, 5].map(j => (
            <Skeleton key={j} className="h-4 w-20" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const ChartSkeleton: React.FC = () => (
  <div className="h-[240px] w-full bg-[#141416] rounded-xl animate-pulse flex items-end justify-around p-4">
    {Array.from({ length: 7 }).map((_, i) => (
      <div 
        key={i} 
        className="bg-[#212124] rounded-t-lg w-8" 
        style={{ height: `${30 + Math.random() * 60}%` }}
      />
    ))}
  </div>
);

export default LoadingSpinner;

