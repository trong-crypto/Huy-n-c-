// Original decorative geometry, never a calculated hexagram.
export function CelestialArt({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={`celestial-art${compact ? " celestial-art--compact" : ""}`} viewBox="0 0 600 600" fill="none" aria-hidden="true" focusable="false">
      <circle cx="300" cy="300" r="268" className="orbit orbit--outer" />
      <circle cx="300" cy="300" r="248" className="orbit" />
      <circle cx="300" cy="300" r="235" className="orbit orbit--dashed" />
      <circle cx="300" cy="300" r="174" className="orbit" />
      <circle cx="300" cy="300" r="165" className="orbit orbit--inner" />
      <path d="M300 95 445 155 505 300 445 445 300 505 155 445 95 300 155 155Z" className="orbit" />
      <path d="m300 136 164 164-164 164-164-164Z" className="orbit orbit--inner" />
      {Array.from({ length: 32 }, (_, index) => (
        <path key={index} d={index % 4 === 0 ? "M300 39v17" : "M300 45v7"} transform={`rotate(${index * 11.25} 300 300)`} className="compass-tick" />
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <g key={index} transform={`rotate(${index * 45} 300 300)`} className="compass-tick">
          <path d="M281 87h38M281 96h15m8 0h15M281 105h38" />
          <circle cx="300" cy="130" r="2" fill="currentColor" stroke="none" />
        </g>
      ))}
      <circle cx="300" cy="300" r="106" className="celestial-core" />
      <circle cx="300" cy="300" r="95" className="orbit" />
      <path d="M300 205a47.5 47.5 0 0 1 0 95 47.5 47.5 0 0 0 0 95 95 95 0 0 1 0-190Z" fill="currentColor" opacity=".88" />
      <circle cx="300" cy="252.5" r="10" fill="#24133f" />
      <circle cx="300" cy="347.5" r="10" fill="currentColor" />
      <path d="M300 9v18m-9-9h18M573 300h18m-9-9v18M300 573v18m-9-9h18M9 300h18m-9-9v18" className="compass-tick" />
      <circle cx="70" cy="155" r="3" fill="currentColor" />
      <circle cx="527" cy="447" r="3" fill="currentColor" />
      <path d="m498 67 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="currentColor" />
      <path d="m100 483 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="currentColor" />
    </svg>
  );
}

export function BrandSymbol() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <path d="m24 2 16 8 6 14-8 16-14 6-16-8-6-14 8-16Z" stroke="currentColor" />
    <circle cx="24" cy="24" r="15" stroke="currentColor" opacity=".5" />
    <path d="M16 18h16M16 24h6m4 0h6M16 30h16" stroke="currentColor" strokeWidth="2.4" />
  </svg>;
}

export function TimeSymbol() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <circle cx="24" cy="24" r="20" stroke="currentColor" opacity=".5" />
    <path d="M8 24h32M24 5v5m0 28v5" stroke="currentColor" />
    <circle cx="12" cy="24" r="4" fill="#24133f" stroke="currentColor" />
    <circle cx="24" cy="24" r="6" fill="currentColor" />
    <circle cx="36" cy="24" r="4" fill="#24133f" stroke="currentColor" />
  </svg>;
}
