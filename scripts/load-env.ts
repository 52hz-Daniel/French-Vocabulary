import { createRequire } from "node:module";

// @next/env is published as CommonJS. Node 22 cannot reliably synthesize its
// named exports when this project is executed as native ESM through tsx.
const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());
