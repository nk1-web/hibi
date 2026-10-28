// 予定から開ける外部アプリ。URL スキームは iOS 側で「開きますか」と確認される。
export const LINKS = [
  { id: 'none', label: 'なし' },
  { id: 'shortcut', label: 'ショートカットを実行', field: 'ショートカット名', url: (v) => `shortcuts://run-shortcut?name=${encodeURIComponent(v)}` },
  { id: 'url', label: 'URL を指定', field: 'URL', url: (v) => v },
  { id: 'music', label: 'ミュージック', url: () => 'music://' },
  { id: 'spotify', label: 'Spotify', url: () => 'spotify:' },
  { id: 'youtube', label: 'YouTube', url: () => 'youtube://' },
  { id: 'maps', label: 'マップ', url: () => 'maps://' },
  { id: 'gmaps', label: 'Google マップ', url: () => 'comgooglemaps://' },
  { id: 'calendar', label: 'カレンダー', url: () => 'calshow:' },
  { id: 'health', label: 'ヘルスケア', url: () => 'x-apple-health://' },
  { id: 'notion', label: 'Notion', url: () => 'notion://' },
  { id: 'line', label: 'LINE', url: () => 'line://' },
];

export const findLink = (id) => LINKS.find((l) => l.id === id) || LINKS[0];

export function linkUrl(link) {
  if (!link || link.kind === 'none') return null;
  const def = findLink(link.kind);
  if (def.field && !link.value?.trim()) return null;
  return def.url(link.value?.trim());
}

export function linkLabel(link) {
  if (!link || link.kind === 'none') return '';
  const def = findLink(link.kind);
  if (link.kind === 'shortcut') return link.value;
  if (link.kind === 'url') return 'リンク';
  return def.label;
}

export function openLink(link) {
  const url = linkUrl(link);
  if (url) window.location.href = url;
}
