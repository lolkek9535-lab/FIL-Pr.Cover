import { startHttpServer } from "../src/server/http";
import { setHttpBaseUrl } from "../src/server/mcp";
const port = Number(process.env.PORT);
if (!port) throw new Error("Run this local test server through portless");
setHttpBaseUrl(`http://localhost:${port}`);
startHttpServer(port);
