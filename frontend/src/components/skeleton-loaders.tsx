export function TableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 bg-gray-200 rounded flex-1 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg space-y-4">
      <div className="h-6 bg-gray-200 rounded animate-pulse w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="p-6 bg-white border border-gray-200 rounded-lg">
      <div className="flex justify-between items-start mb-4">
        <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
        <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
      </div>
      <div className="h-8 bg-gray-200 rounded animate-pulse w-16" />
    </div>
  );
}
