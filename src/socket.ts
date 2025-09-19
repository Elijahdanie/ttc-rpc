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

        // handle, connection, disconnection and all that shiiz
        this.io.on("connection", async (socket) => {
            try {
                const auth = _authCb ? await _authCb(socket.handshake.auth.authorization, []) : true;
                if (!auth) {
                    console.log("Unauthorized client:", socket.id);
                    socket.disconnect();
                    return;
                } else {
                    if (_socketCb) _socketCb(socket);
                }

                // manage _scid
                if (socket.handshake.auth._scid) {
                    this.clients.set(socket.handshake.auth._scid, socket);
                }

                // remove from map on disconnect
                socket.on('disconnect', () => {
                    this.clients.delete(socket.handshake.auth._scid);
                });
            } catch (error) {
                console.log("Error authenticating client:", error);
                socket.disconnect();
                return;
            }
        });
    }
}