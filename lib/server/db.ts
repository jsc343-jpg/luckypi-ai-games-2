export type Queryable = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rowCount: number | null; rows: Record<string, unknown>[] }>;
};

// Neon's HTTP driver only needs fetch, so it works in hosts that lack the raw TCP sockets the pg driver requires.
export async function createHttpDb(connectionString: string): Promise<Queryable> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(connectionString, { fullResults: true });
  return {
    query: async (text, values) => {
      const res = (await sql.query(text, values as unknown[] | undefined)) as unknown as {
        rows: Record<string, unknown>[];
        rowCount: number | null;
      };
      return { rows: res.rows ?? [], rowCount: res.rowCount ?? res.rows?.length ?? 0 };
    },
  };
}
