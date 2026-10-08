export function ChatListSkeleton() {
  return (
    <div className="divide-y">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-16 px-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`flex gap-2 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
        >
          {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-muted animate-pulse flex-shrink-0" />}
          <div className={`max-w-md rounded-lg p-3 bg-muted animate-pulse ${i % 2 === 0 ? 'w-48' : 'w-64'}`}>
            <div className="h-4 bg-muted-foreground/20 rounded mb-2" />
            <div className="h-3 bg-muted-foreground/20 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
