// Vercel integrations may add a custom prefix to variable names (for example STORAGE_URL),
// so after the standard names we also look for a value with the expected shape.
function findByValue(preferred: string[], test: (value: string) => boolean): string | undefined {
  for (const name of preferred) {
    const value = process.env[name];
    if (value) return value;
  }
  for (const value of Object.values(process.env)) {
    if (value && test(value)) return value;
  }
  return undefined;
}

const runtime = globalThis as unknown as { __runtimeDbUrl?: string };

export const isPostgresUrl = (value: string) => /^postgres(ql)?:\/\/\S+$/.test(value);

// Some hosts never pass environment variables to the app, so an admin can enter the
// address by hand. It lives only in server memory and must be re-entered after a restart.
export function setRuntimeDatabaseUrl(url: string | null) {
  if (url) runtime.__runtimeDbUrl = url;
  else delete runtime.__runtimeDbUrl;
}

export function hasRuntimeDatabaseUrl(): boolean {
  return Boolean(runtime.__runtimeDbUrl);
}

export function databaseUrl(): string | undefined {
  return (
    findByValue(["DATABASE_URL", "POSTGRES_URL"], (value) => /^postgres(ql)?:\/\//.test(value)) ??
    runtime.__runtimeDbUrl
  );
}

export function blobToken(): string | undefined {
  return findByValue(["BLOB_READ_WRITE_TOKEN"], (value) => value.startsWith("vercel_blob_rw_"));
}
