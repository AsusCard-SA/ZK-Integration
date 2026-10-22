export function deviceDateKey(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    ...(timezone ? { timeZone: timezone } : {}),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const part = (type) => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
