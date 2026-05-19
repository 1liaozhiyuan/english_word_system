export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="surface rounded-lg p-5" key={index}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="skeleton h-10 w-10 rounded-lg" />
              <div className="skeleton h-12 w-12 rounded-lg" />
            </div>
            <div className="skeleton h-7 w-20 rounded-full" />
          </div>
          <div className="skeleton mt-5 h-7 w-2/3 rounded" />
          <div className="skeleton mt-3 h-4 w-full rounded" />
          <div className="skeleton mt-2 h-4 w-4/5 rounded" />
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="skeleton h-16 rounded-lg" />
            <div className="skeleton h-16 rounded-lg" />
          </div>
        </div>
      ))}
    </>
  );
}
