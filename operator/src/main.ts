import { operator } from "./sandbox";
import { serve } from "./server";

async function startServer() {
    serve(await operator());
}
  
startServer().catch(console.error);
