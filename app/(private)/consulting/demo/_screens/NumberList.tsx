export function NumberList({ numbers }: { numbers: Array<number> }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {numbers.map((number, index) => (
        <span
          key={`${number}-${index}`}
          className="flex size-10 items-center justify-center rounded-lg border bg-background font-mono text-sm font-semibold shadow-xs"
        >
          {number}
        </span>
      ))}
    </div>
  );
}
