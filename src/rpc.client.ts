

export type callbackType = (method: string, params?: any) => Promise<any>;
export type mediaCallbackType = (method: string, params?: any, file?: any) => Promise<any>;

export type rpcResponseType<T = any> = {
    status: 'success' | 'error';
    data?: T;
}

let _Scid_server_cache: string = '';

const getDefault = () => {
    const fs = require('fs');
    const path = ".ttc_id.txt";
    if(fs.existsSync(path)){
        const scid = fs.readFileSync(path, "utf8");
        if(scid){
            return scid;
        }
    }
}

const saveScid = (scid: string) => {
    const fs = require('fs');
    const path = ".ttc_id.txt";
    fs.writeFileSync(path, scid);
}

const uuid = () => {
    const key = 'ttc_scid';
    let sid = (typeof localStorage !== 'undefined') ? localStorage.getItem(key) : _Scid_server_cache ? _Scid_server_cache : getDefault();
    if (!sid) {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, sid);
        } else {
            saveScid(sid);
        }
    }
    _Scid_server_cache = sid;
    return sid;
}


// Minimal EventSource interface
interface TTCEventSource {
    addEventListener(type: string, listener: (event: any) => void): void;
    removeEventListener(type: string, listener: (event: any) => void): void;
    close(): void;
}

type EventCallback = (data: any) => any;

export class SSEClient {

    private eventSource: TTCEventSource;
    private EventSourceClass: any;
    private callbackMap: Map<string, Map<EventCallback, (event: any) => void>> = new Map();

    constructor() {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined' && 'EventSource' in window) {
            // Use native browser EventSource
            this.EventSourceClass = window.EventSource;
        } else {
            // Node.js environment - will dynamically import
            this.EventSourceClass = null;
        }
    }

    async connect(url: string, scid: string, token_cb: () => Promise<string>,
        socket_cb: (socket: SSEClient) => Promise<any>) {
        // For Node.js, dynamically import eventsource if not already available
        if (!this.EventSourceClass && typeof window === 'undefined') {
            try {
                // Dynamic import for Node.js
                const { EventSource } = await import('eventsource');
                this.EventSourceClass = EventSource;
            } catch (error) {
                throw new Error('eventsource package is required for Node.js environments, Please install it with: npm install eventsource');
            }
        }

        const _url = `${url}/stream?scid=${scid}`;

        await fetch(`${_url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': await token_cb()
            }
        });

        // Create EventSource connection
        this.eventSource = new this.EventSourceClass(`${_url}`) as TTCEventSource;
        socket_cb(this);
    }

    on(event: string, cb: EventCallback) {
        // Create wrapper function that parses the data
        const wrapper = (eventObj: any) => {
            try {
                const data = eventObj.data ? JSON.parse(eventObj.data) : eventObj.data;
                cb(data);
            } catch (error) {
                // If parsing fails, pass the raw data
                cb(eventObj.data);
            }
        };
        
        // Store the mapping
        if (!this.callbackMap.has(event)) {
            this.callbackMap.set(event, new Map());
        }
        this.callbackMap.get(event)!.set(cb, wrapper);
        
        // Add the wrapper as listener
        this.eventSource.addEventListener(event, wrapper);
    }

    off(event: string, cb: EventCallback) {
        // Get the wrapper for this callback
        const eventCallbacks = this.callbackMap.get(event);
        if (eventCallbacks) {
            const wrapper = eventCallbacks.get(cb);
            if (wrapper) {
                // Remove the wrapper listener
                this.eventSource.removeEventListener(event, wrapper);
                // Clean up the mapping
                eventCallbacks.delete(cb);
                
                // Clean up empty event maps
                if (eventCallbacks.size === 0) {
                    this.callbackMap.delete(event);
                }
            }
        }
    }

    close() {
        if (this.eventSource) {
            this.eventSource.close();
            // Clear all callback mappings
            this.callbackMap.clear();
        }
    }
}


export class RPCClient {
    // keep static aliases for backward compatibility with existing calls
    static token_cb: () => Promise<string>;
    static url = 'http://localhost:3000/rpc';
    static _scid: string;
    static socket: SSEClient;

    constructor(url: string, token_cb: () => Promise<string>, socket_cb?: (socket: SSEClient) => Promise<any>) {
        RPCClient.token_cb = token_cb;
        RPCClient.url = url;
        RPCClient._scid = uuid()
        if(socket_cb)this.connectSocket(url, socket_cb);
    }

    static apiCallback: callbackType = async (method: string, params?: any) => {
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

     async connectSocket(url: string, socket_cb:(socket: SSEClient) => Promise<any>) {
            try {
                const socket = new SSEClient()
                socket.connect(url, RPCClient._scid, RPCClient.token_cb, socket_cb);
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
