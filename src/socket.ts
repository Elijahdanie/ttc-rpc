import { Server, Socket } from "socket.io";
import { ttc } from "./rpc.decorator";

export class ttcSocket {
    clients: Map<string, Socket> = new Map();
    private io: Server;

    constructor(_httpServer: any, _authCb: (token: string, authContext: string[]) => Promise<any>, _socketCb: (socket: Socket) => Promise<any>) {
        this.io = new Server(_httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        // Add connection error handling
        this.io.on("connect_error", (error) => {
            console.log("Socket.IO connection error:", error);
        });

        // handle, connection, disconnection and all that shiiz
        this.io.on("connection", async (socket) => {
            
            console.log(socket.handshake);
            try {
                const auth = _authCb ? await _authCb(socket.handshake.auth.authorization, []) : true;
                if (!auth) {
                    socket.disconnect(true);
                    return;
                } else {
                    if (_socketCb) _socketCb(socket);
                }

                const existing = this.clients.get(socket.handshake.auth._scid);
                if (existing) {
                    existing.disconnect(true);
                }

                this.clients.set(socket.handshake.auth._scid, socket);

                
                socket.on('disconnect', (reason) => {
                    const existing = this.clients.get(socket.handshake.auth._scid);
                    if(existing && existing.id === socket.id) {
                        this.clients.delete(socket.handshake.auth._scid);
                    }
                });

                socket.on('connect_error', (error) => {
                    console.log("Socket connection error for client:", socket.id, error);
                });

                // Handle socket errors
                socket.on('error', (error) => {
                    console.log("Socket error for client:", socket.id, error);
                });

            } catch (error) {
                console.log("Error authenticating client:", socket.id, error);
                socket.disconnect(true);
                return;
            }
        });
    }
}