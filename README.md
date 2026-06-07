# TTC-RPC

A lightweight TypeScript RPC framework with decorators, schema validation, and automatic client generation. TTC-RPC (Tentacles RPC) allows you to build type-safe APIs quickly using decorators and provides automatic TypeScript client generation.

## Features

- 🎯 **Decorator-based API definition** - Use simple decorators to expose methods as RPC endpoints
- 🔐 **Built-in authentication support** - Optional authentication with custom callback functions
- 📝 **Schema validation with Zod** - Type-safe input/output validation using Zod schemas
- 🤖 **Automatic schema generation** - Generate Zod schemas from TypeScript parameter types
- 🔄 **Automatic client generation** - Generate TypeScript clients automatically
- 📁 **File upload support** - Handle file uploads in your RPC methods
- 🛡️ **TypeScript first** - Full TypeScript support with type inference
- 🚀 **Express.js integration** - Built on top of Express.js for reliability
- 🎛️ **Flexible routing** - Support for both standard RPC calls and custom endpoints

## Installation

```bash
npm install ttc-rpc
# or
yarn add ttc-rpc
```

**Peer Dependencies:**
- `zod 4` - Required for schema validation
- we do not support zod 3 anymore

## Quick Start

### 1. Create a Service Class

```typescript
import { ttc } from 'ttc-rpc';
import { z } from 'zod';

// Define input/output schemas
const CreateUserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number()
});

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  age: z.number(),
  createdAt: z.date()
});

export class UserService {
  
  @ttc.describe({
    parameterSchema: CreateUserSchema,
    outputSchema: UserResponseSchema
  })
  async createUser(userData: z.infer<typeof CreateUserSchema>) {
    // Access request context if needed
    const { request, response, auth } = ttc.requestContext(arguments);
    
    return {
      id: '123',
      ...userData,
      createdAt: new Date()
    };
  }

  // 🆕 Automatic schema generation from TypeScript types
  @ttc.describe()
  async updateUser(name: string, email: string, age: number) {
    // TTC-RPC automatically generates:
    // z.object({ name: z.string(), email: z.string(), age: z.number() })
    return {
      id: '124',
      name,
      email,
      age,
      updatedAt: new Date()
    };
  }

  @ttc.describe({
    auth: true // Requires authentication
  })
  async getUser(id: string) {
    const { auth } = ttc.requestContext(arguments);
    console.log('Authenticated user:', auth);
    
    return {
      id,
      name: 'John Doe',
      email: 'john@example.com'
    };
  }

  @ttc.describe({
    media: true // Supports file uploads
  })
  async uploadAvatar(userId: string) {
    const { file } = ttc.requestContext(arguments);
    
    if (!file) {
      throw new Error('No file uploaded');
    }
    
    return { 
      message: 'Avatar uploaded successfully',
      filename: file.originalname,
      size: file.size
    };
  }
}
```

### 2. Initialize the Server

```typescript
import express from 'express';
import { ttc } from 'ttc-rpc';
import { UserService } from './services/UserService';

const app = express();

ttc.init({
  app,
  modules: [UserService], // Register your service classes
  generate_client: true, // Generate TypeScript client
  authCb: async (token: string) => {
    // Implement your authentication logic
    // Verify JWT token, check database, etc.
    return { userId: '123', role: 'admin' };
  },
  middleware: 'default' // Use built-in middleware
}).listen(3000);
```

### 3. Making RPC Calls

#### Standard RPC Endpoint (`/rpc`)

```javascript
// POST to /rpc
{
  "method": "UserService.createUser",
  "params": [{
    "name": "John Doe",
    "email": "john@example.com",
    "age": 30
  }]
}
```

#### File Upload

```javascript
// POST to /rpc with form-data
const formData = new FormData();
formData.append('method', 'UserService.uploadAvatar');
formData.append('params', JSON.stringify(['user123']));
formData.append('file', fileInput.files[0]);

fetch('/rpc', {
  method: 'POST',
  body: formData
});
```

### 4. Using Generated Client

When `generate_client: true` is set, a TypeScript client is automatically generated.

The `RPCClient` constructor takes the server URL, a token callback, and an optional socket callback:

```typescript
import { RPCClient } from './rpc.client';

// Create the client with the RPC endpoint URL and an async token callback
const client = new RPCClient('http://localhost:3000', async () => {
  // return an auth token (for example from localStorage or your auth provider)
  return localStorage.getItem('authToken') || '';
}, async (socket) => {
  // Optional socket callback for real-time features
  socket.on('connect', () => console.log('Connected to server'));
});

// The generated client methods use the built-in static helpers `RPCClient.apiCallback`
// and `RPCClient.mediaCallback` which perform the HTTP requests to the configured
// `RPCClient.url` and add an Authorization header using the token returned by
// the token callback. If you need custom behavior you can override those static
// callbacks:

// RPCClient.apiCallback = async (method: string, params?: any) => { /* custom */ };
// RPCClient.mediaCallback = async (method: string, params?: any, file?: File) => { /* custom */ };

// Fully typed client calls
const user = await client.UserService.createUserWithSchema({
  name: 'John',
  email: 'john@example.com',
  age: 30
});

const file = new File([new Blob(['sample file'])], 'avatar.jpg');
const avatar = await client.UserService.uploadProfilePicture({ 
  userId: 'user123', 
  description: 'Profile avatar' 
}, file);
```

## Method Documentation

TTC-RPC supports adding documentation to your RPC methods using the `doc` field. This documentation is automatically included in the generated client code as JSDoc comments, providing better IntelliSense and developer experience.

### Adding Documentation

```typescript
import { ttc } from 'ttc-rpc';
import { z } from 'zod';

const CreateUserInput = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  age: z.number().min(18, "Must be 18 or older")
});

export class UserService {
  @ttc.describe({
    doc: "Creates a new user account with email validation",
    parameterSchema: CreateUserInput
  })
  async createUser(userData: z.infer<typeof CreateUserInput>) {
    return { id: generateId(), ...userData, createdAt: new Date() };
  }
  async createUser(userData: CreateUserInput) {
    return { id: generateId(), ...userData, createdAt: new Date() };
  }

  @ttc.describe({
    auth: true,
    doc: "Retrieves user profile - requires authentication"
  })
  async getUserProfile(userId: string) {
    return await database.users.findById(userId);
  }

  @ttc.describe({
    media: true,
    doc: "Uploads user avatar image (max 5MB, JPG/PNG only)"
  })
  async uploadAvatar(userId: string, description?: string) {
    const { file } = ttc.requestContext(arguments);
    return await uploadToStorage(file, userId);
  }
}
```

### Generated Client with Documentation

The client generation automatically includes your documentation:

```typescript
// Generated client code includes JSDoc comments
UserService = {
  /**
   * Creates a new user account with email validation
   *
   * @param {userData: CreateUserInput}
   * @returns {Promise<rpcResponseType<User>>}
   */
  async createUser(userData: CreateUserInput): Promise<rpcResponseType<User>> {
    return await RPCClient.apiCallback('UserService.createUser', [userData]);
  },

  /**
   * Retrieves user profile - requires authentication
   *
   * @param {userId: string}
   * @returns {Promise<rpcResponseType<UserProfile>>}
   */
  async getUserProfile(userId: string): Promise<rpcResponseType<UserProfile>> {
    return await RPCClient.apiCallback('UserService.getUserProfile', [userId]);
  },

  /**
   * Uploads user avatar image (max 5MB, JPG/PNG only)
   *
   * @param {userId: string, description: string, file: File}
   * @returns {Promise<rpcResponseType<UploadResult>>}
   */
  async uploadAvatar(userId: string, description: string, file: File): Promise<rpcResponseType<UploadResult>> {
    return await RPCClient.mediaCallback('UserService.uploadAvatar', [userId, description], file);
  }
}
```

### Benefits of Documentation

- **Better IDE Support**: IntelliSense shows method descriptions
- **Self-Documenting APIs**: No need for separate API documentation
- **Type Safety**: Combined with TypeScript types for complete developer experience
- **Team Collaboration**: Clear method purposes for team members
- **Generated Docs**: Documentation flows through to generated clients automatically

## Automatic Schema Generation

TTC-RPC can automatically generate Zod schemas from your TypeScript method parameters when `parameterSchema` is not explicitly provided. This feature uses TypeScript's reflection capabilities to create validation schemas.

### How It Works

When you don't provide an `parameterSchema`, TTC-RPC:

1. **Analyzes parameter types** using TypeScript's `reflect-metadata`
2. **Maps TypeScript types to Zod schemas**:
   - `string` → `z.string()`
   - `number` → `z.number()`
   - `boolean` → `z.boolean()`
   - `Date` → `z.date()`
   - `Array` → `z.array(z.any())`
   - `object` → `z.object({}).passthrough()`
   - `unknown/any` → `z.any()`
3. **Creates a composite schema** that validates all parameters
4. **Validates input automatically** during RPC calls

### Examples

```typescript
import { ttc } from 'ttc-rpc';
import { z } from 'zod';

export class ExampleService {
  // ✅ Automatic schema: z.object({ name: z.string(), age: z.number() })
  @ttc.describe()
  async createUser(name: string, age: number) {
    return { id: '123', name, age };
  }

  // ✅ Automatic schema: z.object({ id: z.string(), active: z.boolean() })
  @ttc.describe()
  async updateStatus(id: string, active: boolean) {
    return { success: true };
  }

  // ✅ Automatic schema: z.object({}) (no parameters)
  @ttc.describe()
  async getAllUsers() {
    return [];
  }

  // ✅ Mixed: explicit parameterSchema overrides automatic generation
  @ttc.describe({
    parameterSchema: z.object({
      email: z.string().email(),
      age: z.number().min(18)
    })
  })
  async createAdult(email: string, age: number) {
    // Uses the explicit schema with email validation and age minimum
    return { success: true };
  }
}
```

### Benefits

- **Less boilerplate**: No need to write schemas for simple parameter types
- **Type safety**: Automatic validation based on your TypeScript types
- **Consistent**: Works seamlessly with explicit schemas
- **Flexible**: Can mix automatic and explicit schemas in the same service

### Limitations

- Complex object types default to `z.any()` or `z.object({}).passthrough()`
- For advanced validation (email, min/max, regex), use explicit schemas
- Generic types may not be perfectly inferred

## API Reference

### `@ttc.describe(config?)`

Decorator to expose a method as an RPC endpoint.

#### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `auth` | `boolean` | Require authentication for this method | `false` |
| `doc` | `string` | Documentation description for the method | `undefined` |
| `media` | `boolean` | Enable file upload support | `false` |
| `spread` | `boolean` | Create custom endpoint instead of standard RPC, removes function from the client script | `false` |
| `endpoint` | `string` | Custom endpoint path (enables spread) | `undefined` |
| `parameterSchema` | `ZodSchema` | Zod schema for input validation | `undefined` |
| `outputSchema` | `ZodSchema` | Zod schema for output validation | `undefined` |

#### Examples

```typescript
// Basic method
@ttc.describe()
async basicMethod(param: string) { }

// With authentication and documentation
@ttc.describe({ 
  auth: true,
  doc: "Secure method that requires authentication"
})
async secureMethod() { }

// With file upload and documentation
@ttc.describe({ 
  media: true,
  doc: "Upload a file with additional metadata"
})
async uploadMethod() { }

// Custom endpoint with documentation
@ttc.describe({ 
  endpoint: '/api/users/create',
  parameterSchema: CreateUserSchema,
  doc: "Creates a new user via REST endpoint"
})
async createUserEndpoint() { }

// With validation and documentation
@ttc.describe({
  doc: "Validates user data and creates a new user record",
  parameterSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ id: z.string(), name: z.string() })
})
async validatedMethod(data: { name: string }) { }
```

### `ttc.requestContext(arguments)`

Access Express.js request context within RPC methods.

Returns:
```typescript
{
  request: Request;   // Express request object
  response: Response; // Express response object
  auth: any;         // Result from authCb function
  file: any;         // Uploaded file (for media methods)
}
```

### `ttc.init(config)`

Initialize the RPC server.

#### Configuration

| Option | Type | Description | Required |
|--------|------|-------------|----------|
| `app` | `Express` | Express application instance | ✅ |
| `modules` | `any[]` | Array of service classes | ✅ |
| `authCb` | `(token: string) => Promise<any>` | Authentication callback | ✅ |
| `generate_client` | `boolean` | Generate TypeScript client | ❌ |
| `middleware` | `'default' \| 'custom'` | Middleware configuration | ❌ |

### `ttc.listen(port)`

Start the server on specified port.

## Advanced Usage

### Custom Authentication

```typescript
import jwt from 'jsonwebtoken';
import { ttc } from 'ttc-rpc';

ttc.init({
  app,
  modules: [UserService],
  authCb: async (token: string) => {
    try {
      // Remove 'Bearer ' prefix
      const jwtToken = token.replace('Bearer ', '');
      
      // Verify JWT token
      const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
      
      // Fetch user from database
      const user = await getUserById(decoded.userId);
      
      return user;
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
});
```

### Custom Middleware

```typescript
ttc.init({
  app,
  modules: [UserService],
  authCb: authCallback,
  middleware: 'custom' // Don't use default middleware
});

// Add your own middleware
app.use(express.json());
app.use(cors());
// ... other middleware
```

### Spread Endpoints

Create REST-like endpoints instead of RPC calls:

```typescript
import { ttc } from 'ttc-rpc';

export class ApiController {
  @ttc.describe({
    spread: true,
    endpoint: '/api/users/:id'
  })
  async getUser() {
    const { request } = ttc.requestContext(arguments);
    const userId = request.params.id;
    // ...
  }
}
```

This creates a `GET /api/users/:id` endpoint instead of requiring RPC calls.

## Response Format

All RPC calls return a standardized response:

```typescript
type rpcResponseType = {
  status: 'success' | 'error' | 'notFound' | 'unauthorized';
  data?: any;
}
```

**Success Response:**
```json
{
  "status": "success",
  "data": { "id": "123", "name": "John" }
}
```

**Error Response:**
```json
{
  "status": "error",
  "data": "Error message"
}
```

## Built-in Endpoints

### `/rpc` - Main RPC endpoint
POST endpoint for all RPC method calls.

## Socket.IO Support

TTC-RPC includes built-in Socket.IO support for real-time communication:

```typescript
// When creating the client, provide a socket callback
const client = new RPCClient('http://localhost:3000', async () => {
  return localStorage.getItem('authToken') || '';
}, async (socket) => {
  socket.on('connect', () => {
    console.log('Connected to server');
  });
  
  socket.on('notification', (data) => {
    console.log('Received notification:', data);
  });
});
```

## License

MIT
