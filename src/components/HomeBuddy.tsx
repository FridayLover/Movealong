/**
 * HomeBuddy — the MoveAlong agent as a small home-like character.
 * Clean geometric house (roof + warm body + door) with blinking eyes and a
 * waving arm. Pure inline SVG so it stays crisp at icon size; animation is
 * CSS-driven (buddyBlink / buddyWave in globals.css) and reduced-motion safe.
 */
export default function HomeBuddy({
  size = 44,
  waving = false,
  className = "",
}: {
  size?: number;
  waving?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Baan, your MoveAlong home buddy"
      className={className}
    >
      {/* chimney */}
      <rect x="44" y="8" width="7" height="12" rx="1.5" fill="#b45309" />
      {/* roof */}
      <path d="M6 27.5 32 7l26 20.5c.8.6.4 2-0.7 2H6.7c-1.1 0-1.5-1.4-.7-2Z" fill="#9a3412" />
      <rect x="4" y="27" width="56" height="5" rx="2.5" fill="#7c2d12" />
      {/* body */}
      <path d="M13 32h38v19a5 5 0 0 1-5 5H18a5 5 0 0 1-5-5V32Z" fill="#fff7ed" stroke="#e8dccb" strokeWidth="1.5" />
      {/* waving arm (right side) */}
      <g className={`buddy-arm${waving ? " waving" : ""}`}>
        <path d="M51 40c4.5-.6 7-3 8.2-6.8" stroke="#9a3412" strokeWidth="4" strokeLinecap="round" />
        <circle cx="59.6" cy="33" r="3.1" fill="#f59e0b" stroke="#9a3412" strokeWidth="1.4" />
      </g>
      {/* face: blinking eyes + smile */}
      <g className="buddy-eyes">
        <circle cx="25" cy="40" r="2.7" fill="#1c1917" />
        <circle cx="39" cy="40" r="2.7" fill="#1c1917" />
        <circle cx="25.9" cy="39.1" r=".9" fill="#fff" />
        <circle cx="39.9" cy="39.1" r=".9" fill="#fff" />
      </g>
      <path d="M28.5 45.2c1.1 1.3 2.3 1.9 3.5 1.9s2.4-.6 3.5-1.9" stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20.5" cy="44.5" r="2.4" fill="#fda4af" opacity=".55" />
      <circle cx="43.5" cy="44.5" r="2.4" fill="#fda4af" opacity=".55" />
      {/* door */}
      <path d="M29 56v-4.6a3 3 0 0 1 6 0V56h-6Z" fill="#b45309" />
      <circle cx="33.6" cy="52.4" r=".8" fill="#fde68a" />
    </svg>
  );
}
