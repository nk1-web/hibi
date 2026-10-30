// 線の太さと角の丸みをそろえた手描きアイコン。絵文字は使わない。
const svg = (d, w = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const icons = {
  today: svg('<circle cx="12" cy="12" r="8.25"/><path d="M12 7.25V12l3.1 1.9"/>'),
  calendar: svg('<rect x="3.75" y="5" width="16.5" height="15.25" rx="3.75"/><path d="M3.75 9.9h16.5M8.25 3v3.6M15.75 3v3.6"/>'),
  todo: svg('<path d="M4.5 7.25l1.9 1.9 3.35-3.4M4.5 15.75l1.9 1.9 3.35-3.4M13 7.5h6.5M13 16h6.5"/>'),
  grip: svg('<path d="M6.5 9h11M6.5 12h11M6.5 15h11"/>', 1.8),
  diary: svg('<path d="M6.25 3.75h10a2.5 2.5 0 0 1 2.5 2.5v11.5a2.5 2.5 0 0 1-2.5 2.5h-10z"/><path d="M6.25 3.75v16.5M10 8.5h5M10 11.75h3.25"/>'),
  settings: svg('<path d="M4.5 7.5h8.75M17.75 7.5h1.75M4.5 16.5h1.75M10.75 16.5h8.75"/><circle cx="15.5" cy="7.5" r="2.15"/><circle cx="8.5" cy="16.5" r="2.15"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 2),
  bell: svg('<path d="M6.75 10.75a5.25 5.25 0 0 1 10.5 0v2.9l1.6 2.6H5.15l1.6-2.6z"/><path d="M10.1 19.1a2 2 0 0 0 3.8 0"/>'),
  bellSmall: svg('<path d="M6.75 10.75a5.25 5.25 0 0 1 10.5 0v2.9l1.6 2.6H5.15l1.6-2.6z"/><path d="M10.1 19.1a2 2 0 0 0 3.8 0"/>', 2.2),
  close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 2),
  check: svg('<path d="M5.5 12.5l4.25 4.25L18.5 7.75"/>', 2.1),
  checkCircle: svg('<circle cx="12" cy="12" r="8.25"/><path d="M8.25 12.25l2.5 2.5 5-5.25"/>'),
  chevronL: svg('<path d="M14.75 5.5L8.25 12l6.5 6.5"/>', 2),
  chevronR: svg('<path d="M9.25 5.5l6.5 6.5-6.5 6.5"/>', 2),
  arrowUpRight: svg('<path d="M7.5 16.5l9-9M9.5 7.5h7v7"/>', 2),
  pen: svg('<path d="M14.75 5.25l4 4L9 19H5v-4z"/><path d="M12.75 7.25l4 4"/>'),
  skip: svg('<circle cx="12" cy="12" r="8.25"/><path d="M8.5 15.5l7-7"/>'),
  trash: svg('<path d="M4.75 7h14.5M9.75 7V4.75h4.5V7M6.75 7l.85 11.25a1.75 1.75 0 0 0 1.75 1.5h5.3a1.75 1.75 0 0 0 1.75-1.5L17.25 7"/>'),
  undo: svg('<path d="M8.5 6.5L4.75 10.25 8.5 14"/><path d="M4.75 10.25h9.5a5 5 0 0 1 0 10h-2.5"/>'),
  copy: svg('<rect x="8.25" y="8.25" width="11" height="11" rx="2.75"/><path d="M15.75 8.25V6.5a1.75 1.75 0 0 0-1.75-1.75H6.5A1.75 1.75 0 0 0 4.75 6.5V14a1.75 1.75 0 0 0 1.75 1.75h1.75"/>'),
  link: svg('<path d="M10.25 13.75a3.75 3.75 0 0 0 5.3 0l3-3a3.75 3.75 0 0 0-5.3-5.3l-1 1"/><path d="M13.75 10.25a3.75 3.75 0 0 0-5.3 0l-3 3a3.75 3.75 0 0 0 5.3 5.3l1-1"/>'),
};
