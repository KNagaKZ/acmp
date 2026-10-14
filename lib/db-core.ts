export type Value = string | number | boolean | null;
export type Row = Record<string, unknown>;
export type QueryResult = { rows: Row[]; count: number };
export type Runner = (query: string, values: Value[]) => Promise<QueryResult>;

// Only placeholders in source SQL are converted. Values always use driver parameters.
export function parameterize(query: string) {
  let index = 0;
  return query.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, (token) => token === "?" ? `$${++index}` : token);
}

export function createDatabase(run: Runner) {
  return {
    prepare(query: string) {
      const sql = parameterize(query);
      return {
        async all(...values: Value[]): Promise<unknown[]> { return (await run(sql, values)).rows; },
        async get(...values: Value[]): Promise<unknown> { return (await run(sql, values)).rows[0]; },
        async run(...values: Value[]) {
          const returnsId = /^\s*insert\s+into\s+acmp\.(teachers|students|student_rewards|student_groups|ranklist_entries)\b/i.test(sql) && !/\breturning\b/i.test(sql);
          const result = await run(returnsId ? `${sql} RETURNING id` : sql, values);
          return { changes: result.count, lastInsertRowid: result.rows[0]?.id as number | undefined };
        },
      };
    },
  };
}
