// Time helpers shared by the audio player, chapters and transcript.

// "01:02:03.500", "2:03", "75.5" or 75.5 -> seconds; anything else -> null.
export function parseClock(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const parts = value.trim().split(":");
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  const seconds = parts.reduce((total, part) => total * 60 + Number(part), 0);
  return Number.isFinite(seconds) ? seconds : null;
}

// 75 -> "1:15", 3723 -> "1:02:03"
export function formatTime(value: number): string {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

// 3723 -> "1 hour 2 minutes 3 seconds" (for screen readers)
export function spokenTime(value: number): string {
  const total = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const units: [number, string][] = [
    [Math.floor(total / 3600), "hour"],
    [Math.floor((total % 3600) / 60), "minute"],
    [total % 60, "second"],
  ];
  const spoken = units.filter(([count]) => count > 0).map(([count, unit]) => `${count} ${unit}${count === 1 ? "" : "s"}`);
  return spoken.length > 0 ? spoken.join(" ") : "0 seconds";
}

// 754 -> "13 min", 4663 -> "1 h 18 min"
export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const minutes = Math.max(1, Math.round(value / 60));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}
