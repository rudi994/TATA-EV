const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const BoltIcon = (p) => <svg {...base} {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
export const SearchIcon = (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
export const DownloadIcon = (p) => <svg {...base} {...p}><path d="M12 3v12m0 0 5-5m-5 5-5-5M4 19h16" /></svg>
export const RefreshIcon = (p) => <svg {...base} {...p}><path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4" /></svg>
export const LogoutIcon = (p) => <svg {...base} {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11" /></svg>
export const CloseIcon = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
export const ChevronIcon = (p) => <svg {...base} {...p}><path d="m6 9 6 6 6-6" /></svg>
export const CopyIcon = (p) => <svg {...base} {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
export const PinIcon = (p) => <svg {...base} {...p}><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
export const PlugIcon = (p) => <svg {...base} {...p}><path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5" /></svg>
export const AlertIcon = (p) => <svg {...base} {...p}><path d="M12 3 2 20h20zM12 10v4M12 17h.01" /></svg>
export const RepeatIcon = (p) => <svg {...base} {...p}><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></svg>
export const SortIcon = ({ dir, ...p }) => (
  <svg {...base} width={12} height={12} {...p}>
    <path d="m7 9 5-5 5 5" opacity={dir === 'asc' ? 1 : 0.3} /><path d="m7 15 5 5 5-5" opacity={dir === 'desc' ? 1 : 0.3} />
  </svg>
)
