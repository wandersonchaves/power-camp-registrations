export function Progress50(props: { confirmed: number }) {
  const pct = Math.max(
    0,
    Math.min(100, Math.round((props.confirmed / 50) * 100)),
  );

  return (
    <div className="w-48">
      <div className="flex items-center justify-between text-[11px] text-gray-600">
        <span>{props.confirmed}/50</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-gray-900"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
