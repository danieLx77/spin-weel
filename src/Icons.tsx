export function WheelIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="13" />
      <circle cx="16" cy="16" r="3" />
      <path d="M16 3v10m0 6v10M3 16h10m6 0h10M7 7l7 7m4 4 7 7M7 25l7-7m4-4 7-7" />
    </svg>
  );
}
export function GridIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function ActionIcon(props: {
  name:
    | "spin"
    | "plus"
    | "close"
    | "up"
    | "down"
    | "shield"
    | "list"
    | "download"
    | "upload";
}) {
  const paths = {
    spin: "M20 7V3m0 0h-4m4 0-4 4a8 8 0 1 0 3 9",
    plus: "M12 5v14M5 12h14",
    close: "m6 6 12 12M6 18 18 6",
    up: "m6 15 6-6 6 6",
    down: "m6 9 6 6 6-6",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    upload: "M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[props.name]} />
    </svg>
  );
}
