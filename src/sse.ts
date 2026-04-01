import { Request, Response, Express } from "express";
import { SSECache } from "./sse-retry-cache";



export type SSESocket = {
    id: string;
    emit: (event: string, data: any) => Promise<boolean>
}

export type TTCSSEEventData = {
    event: string;
    data: any,
    eta: number
}

export class SSEManager {

    clients: Map<string, SSESocket> = new Map();

    constructor(server: Express, _authCb: (token: string, authContext: string[], funcName: string,) => Promise<any>,
        _socketCb: (socket: SSESocket) => Promise<any>) {
        server.use('/stream', async (request: Request, response: Response) => {
            const token = request.headers.authorization;
            const auth = _authCb ? await _authCb(token as string, [], '') : true;
            if (auth) {
                await this.connect(request, response);
                // Get client socket and call socket callback
                const clientId = request.query.scid as string;
                const socket = this.clients.get(clientId);
                if (socket) {
                    // Send 'open' event to trigger client's EventSource.onopen
                    await socket.emit('connect', {
                        timestamp: new Date().toISOString(),
                        clientId: clientId,
                        message: 'Connection established'
                    });
                    // Call user's socket callback
                    await _socketCb(socket);
                    await this.processRetryCache(clientId);
                }
            } else {
                response.status(401).json({
                    message: 'Unauthorized'
                })
            }
        })

    }

    get = (id: string) => {
        return this.clients.get(id);
    }


    wrapperFunc = (clientId: string, response: Response): SSESocket => {
        return {
            id: clientId,
            emit: (event: string, data) => {
                return new Promise((resolve, reject) => {
                    if (response) {
                        try {
                            // Proper SSE format: event: <event-name>\ndata: <data>\n\n
                            const dataString = typeof data === 'object' ? JSON.stringify(data) : data;
                            const clientEvent = `event: ${event}\ndata: ${dataString}\n\n`;
                            console.log(clientEvent);
                            response.write(clientEvent, (error) => {
                                // console.log(error, 'error');
                                if (error) {
                                    SSECache.cache(clientId, {
                                        event,
                                        data,
                                        eta: Date.now()
                                    });
                                    reject(false);
                                } else {
                                    resolve(true)
                                }
                            });
                            return true;
                        } catch (error) {
                            console.log(`Failed to send event to client ${clientId}:`, error);
                            this.clients.delete(clientId);
                            return false;
                        }
                    }
                    return false;
                })
            }
        }
    }

    connect = async (request: Request, response: Response) => {
        const clientId = request.query.scid as string;

        // console.log(`New SSE connection from client: ${clientId}`);

        // Set SSE headers
        response.setHeader('Content-Type', 'text/event-stream');
        response.setHeader('Cache-Control', 'no-cache');
        response.setHeader('Connection', 'keep-alive');
        response.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

        // Send initial connection event
        const connectEvent = `event: connected\ndata: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            clientId: clientId
        })}\n\n`;

        // console.log('Sending connect event:', connectEvent);
        response.write(connectEvent);

        // Store the response for later events
        this.clients.set(clientId, this.wrapperFunc(clientId, response));

        // Handle client disconnect
        request.on('close', () => {
            console.log(`Client ${clientId} disconnected`);
            this.clients.delete(clientId);
        });

        // Keep connection alive with heartbeat (every 10 seconds for testing)
        const heartbeatInterval = setInterval(() => {
            if (this.clients.has(clientId)) {
                try {
                    const heartbeatEvent = `event: ping\ndata: ${JSON.stringify({
                        timestamp: new Date().toISOString(),
                        clientId: clientId
                    })}\n\n`;
                    response.write(heartbeatEvent);
                    // console.log(`Sent heartbeat to ${clientId}`);
                } catch (error) {
                    // Client disconnected, clean up
                    console.log(`Error sending heartbeat to ${clientId}:`, error.message);
                    clearInterval(heartbeatInterval);
                    this.clients.delete(clientId);
                }
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 10000); // Every 10 seconds for testing

        // Store interval for cleanup
        response.on('finish', () => {
            console.log(`Response finished for client ${clientId}`);
            clearInterval(heartbeatInterval);
            this.clients.delete(clientId);
        });
    }

    processRetryCache = async (_scid: string) => {
        const socket = this.clients.get(_scid);
        const cachedSet = SSECache.get(_scid);

        if (cachedSet && cachedSet.size > 0) {
            for (const payload of cachedSet) {
                await socket.emit(payload.event, payload.data);
                // cachedSet.delete(payload)
                // console.log('emmiting', cachedSet)
            }
            // console.log('deleting', _scid)
            SSECache.delete(_scid);
        }
    }
}