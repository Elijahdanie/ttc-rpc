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
            console.log("New socket connection attempt:", socket.id);
            console.log("Handshake auth:", socket.handshake.auth);
            
            try {
                const auth = _authCb ? await _authCb(socket.handshake.auth.authorization, []) : true;
                if (!auth) {
                    console.log("Unauthorized client:", socket.id);
                    socket.disconnect(true);
                    return;
                } else {
                    console.log("Client authenticated:", socket.id);
                    if (_socketCb) _socketCb(socket);
                }

                // manage _scid
                if (socket.handshake.auth._scid) {
                    this.clients.set(socket.handshake.auth._scid, socket);
                    console.log("Client registered with _scid:", socket.handshake.auth._scid);
                } else {
                    console.log("Warning: Client connected without _scid:", socket.id);
                }

                // remove from map on disconnect
                socket.on('disconnect', (reason) => {
                    console.log("Client disconnected:", socket.id, "Reason:", reason);
                    this.clients.delete(socket.handshake.auth._scid);
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