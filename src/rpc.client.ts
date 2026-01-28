
import { io, Socket } from "socket.io-client";

export type callbackType = (method: string, params?: any) => Promise<any>;
export type mediaCallbackType = (method: string, params?: any, file?: any) => Promise<any>;

export type rpcResponseType<T = any> = {
    status: 'success' | 'error';
    data?: T;
}

let _Scid_server_cache: string = '';

const uuid = () => {
    const key = 'ttc_scid';
    let sid = (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : _Scid_server_cache;
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, sid);
        } else {
            _Scid_server_cache = sid;
        }
    }
    return sid;
}

export class RPCClient {
    // keep static aliases for backward compatibility with existing calls
    static token_cb: () => Promise<string>;
    static url = 'http://localhost:3000/rpc';
    static _scid: string;
    static socket: Socket;
    static transport: 'http' | 'socket' = 'http';

    constructor(url: string, token_cb: () => Promise<string>, socket_cb?: (socket: Socket) => Promise<any>) {
        RPCClient.token_cb = token_cb;
        RPCClient.url = url;
        RPCClient._scid = uuid()
        if(socket_cb)this.connectSocket(url, socket_cb);
    }

    seTransport(tp: 'http' | 'socket'){
        RPCClient.transport = tp;
    }

    static invokeSocket: callbackType = async (method: string, params?: any) => {
        if(RPCClient.socket) {
            return new Promise((resolve, reject) => {
                RPCClient.socket.emit('function_call', { method, params });
                RPCClient.socket.once('function_response', (response: any) => {
                    resolve(response);
                });

                // set a timeout for the response
                setTimeout(() => {
                    reject(new Error('Socket API call timed out'));
                }, 20000);
            });
        }
    }

    static apiCallback: callbackType = async (method: string, params?: any) => {
        if(RPCClient.transport === 'http'){
            return await RPCClient.invokeHttp(method, params);
        } else if(RPCClient.transport === 'socket'){
            return await RPCClient.invokeSocket(method, params);
        }
    }

    static invokeHttp: callbackType = async (method: string, params?: any) => {
        try {
            if (!RPCClient.token_cb) throw new Error('RPCClient.token_cb is not set');
            const token = await RPCClient.token_cb();
            const response = await fetch(`${RPCClient.url}/rpc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}:${RPCClient._scid}`,
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

    static mediaCallback: mediaCallbackType = async (method: string, params?: any, file?: any) => {
        try {
            if (!RPCClient.token_cb) throw new Error('RPCClient.token_cb is not set');
            const token = await RPCClient.token_cb();
            const formData = new FormData();
            formData.append('method', method);
            if (params) formData.append('params', JSON.stringify(params));
            if (file) formData.append('file', file);

            const response = await fetch(`${RPCClient.url}/rpc`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}:${RPCClient._scid}`,
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

    async connectSocket(url: string, socket_cb:(socket: Socket) => Promise<any>) {
        try {
            const socket = io(url, {
                auth: {
                    authorization: await RPCClient.token_cb(),
                    _scid: RPCClient._scid
                }
            });
            if(socket_cb)socket_cb(socket);
            RPCClient.socket = socket;
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
        async createUserWithSchema(userData: Partial<{ name: string, email: string, age: number }> ): Promise<rpcResponseType<any>> {
            return await RPCClient.apiCallback('UserService.createUserWithSchema', [userData]);
        },
        /**
         * Creates a user with automatic schema generation from TypeScript types
         *
         * @param {name: string, email: string, age: number}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async createUserAutoSchema(name: string, email: string, age: number): Promise<rpcResponseType<any>> {
            return await RPCClient.apiCallback('UserService.createUserAutoSchema', [name, email, age]);
        },
        /**
         * @param {userData: Partial<{  }> }
         * @returns {Promise<rpcResponseType<any>>}
         */
        async updateUser(userData: Partial<{  }> ): Promise<rpcResponseType<any>> {
            return await RPCClient.apiCallback('UserService.updateUser', [userData]);
        },
        /**
         * @param {}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async getAllUsers(): Promise<rpcResponseType<any>> {
            return await RPCClient.apiCallback('UserService.getAllUsers');
        },
        /**
         * Deletes a user by ID - requires authentication
         *
         * @param {userId: string, boss: any[]}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async deleteUser(userId: string, boss: any[]): Promise<rpcResponseType<any>> {
            return await RPCClient.apiCallback('UserService.deleteUser', [userId, boss]);
        },
        /**
         * Uploads a profile picture for a user with description
         *
         * @param {data: Partial<{ userId: string, description: string }> , file: any}
         * @returns {Promise<rpcResponseType<any>>}
         */
        async uploadProfilePicture(data: Partial<{ userId: string, description: string }> , file: any): Promise<rpcResponseType<any>> {
            return await RPCClient.mediaCallback('UserService.uploadProfilePicture', [data], file);
        },
    }

}
