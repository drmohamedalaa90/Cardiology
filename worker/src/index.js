import postgres from "postgres";

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/health") return new Response("ACL API");
    const sql = postgres(env.ACL_DB.connectionString, { max: 1 });
    try {
      const result = await sql`SELECT 1 AS ok`;
      return Response.json({ connected: result[0].ok === 1 });
    } finally {
      await sql.end();
    }
  }
};
