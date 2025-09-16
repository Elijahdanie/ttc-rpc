import { Socket, io } from "socket.io-client"; 

export type callbackType = (method: string, params?: any) => Promise<any>;
export type mediaCallbackType = (method: string, params?: any, file?: File) => Promise<any>;

export type rpcResponseType<T = any> = {
    status: 'success' | 'error';
    data?: T;
}

const uuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);


export class RPCClient {
    // keep static aliases for backward compatibility with existing calls
    static token_cb: () => Promise<string>;
    static url = 'http://localhost:3000/rpc';
    client_id: string;

    constructor(url: string, token_cb: () => Promise<string>, socket_cb:(socket: Socket) => Promise<any>) {
        RPCClient.token_cb = token_cb;
        RPCClient.url = url;
        this.client_id = uuid()
        if(socket_cb)this.connectSocket(url, socket_cb);
    }

    apiCallback: callbackType = async (method: string, params?: any) => {
        try {
            if (!RPCClient.token_cb) throw new Error('RPCClient.token_cb is not set');
            const token = await RPCClient.token_cb();
            const response = await fetch(`${RPCClient.url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ method, params })
            });
            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error calling API:", error);
            throw error;
        }
    }

    mediaCallback: mediaCallbackType = async (method: string, params?: any, file?: File) => {
        try {
            if (!RPCClient.token_cb) throw new Error('RPCClient.token_cb is not set');
            const token = await RPCClient.token_cb();
            const formData = new FormData();
            formData.append('method', method);
            if (params) formData.append('params', JSON.stringify(params));
            if (file) formData.append('file', file);

            const response = await fetch(`${RPCClient.url}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });
            if (!response.ok) {
                throw new Error(`Media API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error calling Media API:", error);
            throw error;
        }
    }

    private async connectSocket(url: string, socket_cb:(socket: Socket) => Promise<any>) {
        try {
            const socket = io(url, {
                auth: {
                    token: await RPCClient.token_cb(),
                    client_id: this.client_id
                }
            });
            if(socket_cb)socket_cb(socket);
        } catch (error: any) {
            console.error('Error initializing socket:', error.message);
        }
    }

    UserService = {
        /**
         * Creates a new user with validation for name, email, and age
         *
         * @param {userData: Partial<{ name: string, email: string, age: number }> }
         * @returns {Promise<rpcResponseType<any>>}
         */
        async createUserWithSchema(userData: Partial<{ name: string, email: string, age: number }>): Promise<rpcResponseType<any>> {
            return await this.apiCallback('UserService.createUserWithSchema', [userData]);
        },
        /**
         * Creates a user with automatic schema generation from TypeScript types
         *
         * @param {name: string, email: string, age: number}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async createUserAutoSchema(name: string, email: string, age: number): Promise<rpcResponseType<any>> {
            return await this.apiCallback('UserService.createUserAutoSchema', [name, email, age]);
        },
        /**
         * @param {userData: Partial<{ userData: Partial<{  }>  }> }
         * @returns {Promise<rpcResponseType<any>>}
         */
        async updateUser(userData: Partial<{ userData: Partial<{}> }>): Promise<rpcResponseType<any>> {
            return await this.apiCallback('UserService.updateUser', [userData]);
        },
        /**
         * @param {}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async getAllUsers(): Promise<rpcResponseType<any>> {
            return await this.apiCallback('UserService.getAllUsers');
        },
        /**
         * Deletes a user by ID - requires authentication
         *
         * @param {userId: Partial<{ userId: string }> }
         * @returns {Promise<rpcResponseType<any>>}
         */
        async deleteUser(userId: Partial<{ userId: string }>): Promise<rpcResponseType<any>> {
            return await this.apiCallback('UserService.deleteUser', [userId]);
        },
        /**
         * Uploads a profile picture for a user with description
         *
         * @param {userId: string, description: string, file: File}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async uploadProfilePicture(userId: string, description: string, file: File): Promise<rpcResponseType<any>> {
            return await this.mediaCallback('UserService.uploadProfilePicture', [userId, description], file);
        },
    }

}
