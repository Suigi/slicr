export function SlicrIcon() {
  return (
    <svg className="slicr-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="slicr-lemon-fill" cx="32" cy="24" r="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff9bf" />
          <stop offset="0.65" stopColor="#f9df54" />
          <stop offset="1" stopColor="#e6be2b" />
        </radialGradient>
        <radialGradient id="slicr-rind-fill" cx="22" cy="18" r="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff58d" />
          <stop offset="1" stopColor="#f0c329" />
        </radialGradient>
      </defs>

      <circle cx="32" cy="32" r="29" fill="url(#slicr-rind-fill)" stroke="#b88612" strokeWidth="2" />
      <circle cx="32" cy="32" r="23" fill="url(#slicr-lemon-fill)" stroke="#f5e59a" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="5" fill="#fffde8" opacity="0.95" />

      <g stroke="#d9af1f" strokeWidth="2" strokeLinecap="round">
        <line x1="32" y1="32" x2="32" y2="11" />
        <line x1="32" y1="32" x2="46.8" y2="17.2" />
        <line x1="32" y1="32" x2="53" y2="32" />
        <line x1="32" y1="32" x2="46.8" y2="46.8" />
        <line x1="32" y1="32" x2="32" y2="53" />
        <line x1="32" y1="32" x2="17.2" y2="46.8" />
        <line x1="32" y1="32" x2="11" y2="32" />
        <line x1="32" y1="32" x2="17.2" y2="17.2" />
      </g>
    </svg>
  );
}
