export function KilnMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#121214" />
      <path
        d="M8 22.5V9.5h5.2c3.4 0 5.5 1.7 5.5 4.4 0 1.8-1 3.2-2.7 3.9L22 22.5h-3.3l-5.2-4.7H11.2V22.5H8Zm3.2-7.2h1.9c1.7 0 2.7-.8 2.7-2.1s-1-2.1-2.7-2.1h-1.9v4.2Z"
        fill="#d8d4cc"
      />
    </svg>
  );
}
