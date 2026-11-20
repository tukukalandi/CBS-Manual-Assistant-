export function IndiaPostLogo({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="8" fill="#C8102E" />
      <path d="M7 13.5H27.5L23.5 17.5H7V13.5Z" fill="#FFCD00" />
      <path d="M9.5 19.5H33L29 23.5H9.5V19.5Z" fill="#FFFFFF" />
      <path d="M12 25.5H27.5L23.5 29.5H12V25.5Z" fill="#FFCD00" />
    </svg>
  );
}
