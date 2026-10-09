const PATHS = {
  arrow: <path d="M3 8h10M9 4l4 4-4 4" />,
  back: <path d="M13 8H3M7 4L3 8l4 4" />,
  chevron: <path d="M6 4l4 4-4 4" />,
  down: <path d="M4 6l4 4 4-4" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  check: <path d="M3.5 8.5l3 3 6-7" />,
  crown: <path d="M2.5 12.5h11M3 11l-1-6 3.5 2.5L8 3l2.5 4.5L14 5l-1 6z" />,
  bolt: <path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" />,
  chat: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />,
  reply: <path d="M6 4L2.5 7.5 6 11M2.5 7.5H10a3.5 3.5 0 013.5 3.5v1" />,
  layers: (
    <>
      <path d="M8 2L1.5 5.5 8 9l6.5-3.5z" />
      <path d="M1.5 8.5L8 12l6.5-3.5" />
    </>
  ),
};

export function Icon({ name, size = 14 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
