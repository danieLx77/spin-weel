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
    | "upload"
    | "expand"
    | "collapse"
    | "undo"
    | "settings"
    | "eye"
    | "eyeOff";
}) {
  const paths = {
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
    eyeOff:
      "m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8M10 10a3 3 0 0 0 4 4",
    settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
    expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
    collapse: "M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5",
    undo: "M9 4 4 9l5 5M4 9h10a6 6 0 0 1 0 12h-2",
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
