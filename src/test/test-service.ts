import { z } from 'zod';
import { Response } from 'express';
import { ttc } from '../rpc.decorator';

// Example service to demonstrate automatic schema generation
export class UserService {

  streamObjects: Map<string, Response>;

  constructor() {
    this.streamObjects = new Map();
  }

  // Method with explicit schema and documentation
  @ttc.describe({
    doc: "Creates a new user with validation for name, email, and age",
    inputSchema: z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().min(0)
    })
  })
  async createUserWithSchema(userData: { name: string; email: string; age: number }) {
    console.log('Creating user with data:', userData);
    return {
      id: '123',
      ...userData,
      createdAt: new Date()
    };
  }

  // Method with automatic schema generation and documentation
  @ttc.describe({
    doc: "Creates a user with automatic schema generation from TypeScript types"
  })
  async createUserAutoSchema(name: string = 'elijah', email: string, age: number = 100) {
    // The decorator will automatically create:
    // z.object({ name: z.string(), email: z.string(), age: z.number() })
    return {
      id: '124',
      name,
      email,
      age,
      createdAt: new Date()
    };
  }

  // Method with single object parameter - auto schema generation
  @ttc.describe({})
  async updateUser(userData: { id: string; name?: string; email?: string }) {
    // Will generate schema based on the object type if possible
    return {
      ...userData,
      updatedAt: new Date()
    };
  }

  // Method with no parameters
  @ttc.describe({})
  async getAllUsers() {
    return [
      { id: '1', name: 'John', email: 'john@example.com' },
      { id: '2', name: 'Jane', email: 'jane@example.com' }
    ];
  }

  // Method with authentication and documentation
  @ttc.describe({
    auth: true,
    doc: "Deletes a user by ID - requires authentication"
  })
  async deleteUser(userId: string, boss: string[]) {
    const { auth, _scid } = ttc.requestContext(arguments);
    console.log('User performing deletion:', auth, _scid);
    setTimeout(() => {
      ttc.emit(_scid, "message", { success: true, deletedId: userId });
      // const socket = ttc.io(_scid);
      // if(socket){
      //   socket.emit("message", { success: true, deletedId: userId })
      // } else {

      // }
    }, 3000);
    return "done"
  }

  // Method with file upload and documentation
  @ttc.describe({
    media: true,
    doc: "Uploads a profile picture for a user with description",
    inputSchema: z.object({
      userId: z.string(),
      description: z.string()
    })
  })
  async uploadProfilePicture(data: { userId: string, description: string }) {
    const { file, _scid } = ttc.requestContext(arguments);
    const { userId, description } = data;
    return "done"
  }

}
