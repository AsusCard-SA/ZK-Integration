export function networkErrorMessage(error, timeoutMessage) {
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return timeoutMessage;
  const causes = error?.cause?.errors || (error?.cause ? [error.cause] : []);
  const codes = [...new Set(causes.map(cause => cause?.code).filter(code => typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)))];
  return `${error?.message || 'Network error'}${codes.length ? ` (${codes.join(', ')})` : ''}`;
}
