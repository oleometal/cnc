//export { Application,Router, send } from 'https://deno.land/x/oak/mod.ts'
export {
  listenAndServe,
  serve,
} from "https://deno.land/std@0.100.0/http/server.ts";
export { serveFile } from "https://deno.land/std@0.100.0/http/file_server.ts";
export { existsSync } from "https://deno.land/std@0.100.0/fs/exists.ts";
export { readAll } from "https://deno.land/std@0.100.0/io/util.ts";