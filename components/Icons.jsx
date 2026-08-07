const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
const S = ({ children, ...r }) => (
  <svg viewBox="0 0 24 24" {...p} {...r}>{children}</svg>
);

export const Scissors = (r) => (
  <S {...r}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></S>
);
export const Grid = (r) => (
  <S {...r}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></S>
);
export const Calendar = (r) => (
  <S {...r}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></S>
);
export const Users = (r) => (
  <S {...r}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></S>
);
export const Dollar = (r) => (
  <S {...r}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></S>
);
export const Chat = (r) => (
  <S {...r}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></S>
);
export const Settings = (r) => (
  <S {...r}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.36.44.63.82.76H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></S>
);
export const ChevronDown = (r) => (<S {...r}><path d="m6 9 6 6 6-6" /></S>);
export const ChevronLeft = (r) => (<S {...r}><path d="m15 18-6-6 6-6" /></S>);
export const ChevronRight = (r) => (<S {...r}><path d="m9 18 6-6-6-6" /></S>);
export const X = (r) => (<S {...r}><path d="M18 6 6 18M6 6l12 12" /></S>);
export const Plus = (r) => (<S {...r}><path d="M12 5v14M5 12h14" /></S>);
export const Pencil = (r) => (
  <S {...r}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></S>
);
export const Trash = (r) => (
  <S {...r}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></S>
);
export const Search = (r) => (<S {...r}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></S>);
export const Phone = (r) => (
  <S {...r}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></S>
);
export const Mail = (r) => (<S {...r}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></S>);
export const MapPin = (r) => (<S {...r}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></S>);
export const Upload = (r) => (
  <S {...r}><path d="M20 16.6A5 5 0 0 0 18 7h-1.3A8 8 0 1 0 3 14.9" /><path d="M12 12v9M8 16l4-4 4 4" /></S>
);
export const Mic = (r) => (
  <S {...r}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10a7 7 0 0 1-14 0M12 17v5" /></S>
);
export const ImgIcon = (r) => (
  <S {...r}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="1.6" /><path d="m21 15-5-5L5 21" /></S>
);
export const Clock = (r) => (<S {...r}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></S>);
export const Send = (r) => (<S {...r}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></S>);
export const Building = (r) => (
  <S {...r}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></S>
);
export const Save = (r) => (
  <S {...r}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></S>
);
export const Refresh = (r) => (
  <S {...r}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></S>
);
export const UserMinus = (r) => (
  <S {...r}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6" /></S>
);
export const UserCheck = (r) => (
  <S {...r}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></S>
);
export const TrendUp = (r) => (<S {...r}><path d="M22 7 13.5 15.5 8.5 10.5 2 17" /><path d="M16 7h6v6" /></S>);
export const CalCheck = (r) => (
  <S {...r}><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" /></S>
);
export const Receipt = (r) => (
  <S {...r}><path d="M4 2v20l2.5-1.5L9 22l2.5-1.5L14 22l2.5-1.5L19 22V2l-2.5 1.5L14 2l-2.5 1.5L9 2 6.5 3.5z" /><path d="M8 8h8M8 12h8" /></S>
);
export const Money = (r) => (
  <S {...r}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></S>
);
export const Note = (r) => (
  <S {...r}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></S>
);
export const Copy = (r) => (
  <S {...r}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></S>
);
/* Poste de barbero — icono VIP */
export const BarberPole = ({ size = 20, ...r }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...r}>
    <rect x="8" y="2" width="8" height="3" rx="1.2" fill="#8e9aa8" />
    <rect x="8" y="19" width="8" height="3" rx="1.2" fill="#8e9aa8" />
    <rect x="8.6" y="5" width="6.8" height="14" rx="3.4" fill="#f2f4f7" />
    <g clipPath="url(#bp)">
      <path d="M6 15.5 14 4.5M6 19 14 8M6 22.5 14 11.5" stroke="#e03b3b" strokeWidth="2.4" />
      <path d="M8 18.6 16 7.6M8 22 16 11" stroke="#2f6fd0" strokeWidth="2.4" />
    </g>
    <defs><clipPath id="bp"><rect x="8.6" y="5" width="6.8" height="14" rx="3.4" /></clipPath></defs>
  </svg>
);
/* El logo oficial de BarberOS vive en public/barberos-logo.svg */
