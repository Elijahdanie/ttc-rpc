import express from "express";
import { config } from "dotenv";
import { ttc } from "./index";
import { UserService } from "./test-service";
import { RPCClient } from "./rpc.client";

config();
const app = express();
export const PORT = process.env.PORT || 3004;

ttc.init({
  app,
  modules: [UserService], // Add the test service
  generate_client: true,
  authCb: async (token) => {
    // Simple token verification for testing
    return token;
  },
  middleware: "default",
}).listen(PORT);

console.log(`
🚀 TTC-RPC Server started on port ${PORT}

Test endpoints:
- POST /rpc with { "method": "UserService.createUserAutoSchema", "params": ["John", "john@example.com", 30] }
- POST /rpc with { "method": "UserService.getAllUsers", "params": [] }
- GET /methods to see generated client code
- GET /api-docs to see full API documentation (JSON)

The server now automatically generates Zod schemas from TypeScript parameter types!
`);


const client = new RPCClient(`http://localhost:${PORT}`, async () => 'test-token', async (socket)=>{});

// Example client calls
async function runClientExamples() {
  try {
    await client.seTransport('socket');
    const response = await client.UserService.createUserAutoSchema("Alice", "alice@example.com", 30);
    console.log("Create User Response:", response);
  } catch (error) {
    
  }
}

setTimeout(()=> runClientExamples(), 1000);