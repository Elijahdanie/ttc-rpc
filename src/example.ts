import express from "express";
import { config } from "dotenv";
import { ttc } from "./index";
import { UserService } from "./test-service";

config();
const app = express();
export const PORT = process.env.PORT || 3000;

ttc.init({
  app,
  modules: [UserService], // Add the test service
  generate_client: true,
  authCb: (token) => {
    // Simple token verification for testing
    console.log('Verifying token:', token);
    return Promise.resolve({ userId: 'test-user', role: 'admin' });
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
