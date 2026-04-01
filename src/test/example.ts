import express from "express";
import { config } from "dotenv";
import { UserService } from "./test-service";
import { ttc } from "../rpc.decorator";

config();
const app = express();
export const PORT = process.env.PORT || 3056;

ttc.init({
  app,
  modules: [UserService], // Add the test service
  generate_client: true,
  authCb: async (token) => {
    // Simple token verification for testing
    return true;
  },
  async socketCb(socket) {
    // console.log(socket);
  },
  middleware: "default",
}).listen(PORT);

console.log(`
🚀 TTC-RPC Server started on port ${PORT}
`);
