export function isMySqlDatabaseUrl(
  url: string | undefined
): url is string {
  return Boolean(url && /^mysql(s|2)?(\+.*)?:/.test(url));
}
