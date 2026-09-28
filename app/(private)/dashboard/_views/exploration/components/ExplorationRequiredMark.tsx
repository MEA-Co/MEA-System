export function ExplorationRequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-1 text-red-500">
        *
      </span>
      <span className="sr-only">필수</span>
    </>
  );
}
