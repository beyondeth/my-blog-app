interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 'md' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center">
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mx-auto ${sizeClasses[size]}`}></div>
        <p className="mt-4 text-gray-600 text-sm">{message}</p>
      </div>
    </div>
  );
} 