import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// 注意：DATABASE_URL 在 Docker build 阶段（next build 静态分析路由模组）
// 也必须是语法上有效的连线字串，否则 @auth/drizzle-adapter 的型别侦测会直接噴錯；
// build 阶段不需要真的连得上 DB（postgres.js 是惰性连线），见 Dockerfile 的 build-time ARG。

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL, { ssl: "require" });

export const db = drizzle(client, { schema });
