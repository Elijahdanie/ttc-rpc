import "reflect-metadata";
import Container from "typedi";
import { Response, Request } from "express";
import { object, ZodSchema, z, string, number, boolean, any, unknown, array } from "zod";
// import zodToJsonSchema from "zod-to-json-schema";
import { handleDefaultMiddleWare } from "./server";
import { SSEManager, SSESocket } from "./sse";
import { SSECache } from "./sse-retry-cache";

export type statusType = 'success' | 'error' | 'notFound' | 'unauthorized';

export type ClassType<T = any> = new (...args: any[]) => T;

const zodToJsonSchema = z.toJSONSchema;

export type rpcResponseType = {
    status: statusType;
    data?: any;
}

// Types for client callbacks
export type callbackType = (method: string, params?: any) => Promise<any>;
export type mediaCallbackType = (method: string, params?: any, file?: File) => Promise<any>;

// Generic response type with type parameter
export type rpcResponseTypeGeneric<T = any> = {
    status: 'success' | 'error';
    data?: T;
}

export type registryInfo = DecoratorConfig & {
    param_index: number;
    params: Record<string, any>;
}

export type DecoratorConfig = {
    parameterSchema?: ZodSchema<any>;
    outputSchema?: ZodSchema<any>;
    auth?: boolean | string[];
    doc?: string;
    param_index?: number,
    hide?: boolean,
    response?: boolean,
    spread?: boolean;
    endpoint?: string;
    media?: boolean;
    validate?: boolean;
};

export class ttc {
    private static app: any;
    private static generateClient: boolean;
    static socket: SSEManager;

    private static rpcRegistry: Record<string, registryInfo> = {};

    static authCb: (token: string, authContext: string[], funcName: string) => Promise<any>;
    private static socketCb: (socket: SSESocket) => Promise<any>;

    // Helper function to convert TypeScript types to Zod schemas
    private static createZodSchemaFromParams(paramNames: string[], paramTypes: any[]): ZodSchema<any> {
        if (paramNames.length === 0) {
            return z.object({});
        }

        const schemaFields: Record<string, any> = {};

        paramNames.forEach((name, index) => {
            const type = paramTypes[index];
            const typeName = type?.name?.toLowerCase() || 'unknown';

            switch (typeName) {
                case 'string':
                    schemaFields[name] = z.string();
                    break;
                case 'number':
                    schemaFields[name] = z.number();
                    break;
                case 'boolean':
                    schemaFields[name] = z.boolean();
                    break;
                case 'array':
                    schemaFields[name] = z.array(z.any());
                    break;
                case 'object':
                    schemaFields[name] = z.object({}).passthrough();
                    break;
                case 'date':
                    schemaFields[name] = z.date();
                    break;
                default:
                    // For unknown types, use z.any()
                    schemaFields[name] = z.any();
                    break;
            }
        });

        return z.object(schemaFields);
    }

    // Helper function to extract type names from Zod schemas
    private static getZodTypeName(properties: Record<string, any>): Record<string, any> {
        const params: Record<string, any> = {};
        for (const key in properties) {
            if (properties.hasOwnProperty(key)) {
                if (properties[key].type === 'object' && properties[key].properties) {
                    params[key] = ttc.getZodTypeName(properties[key].properties);
                } else {
                    params[key] = properties[key].type || "any";
                }
            }
        }
        return params;
    }

    static instance<T extends ClassType | string>(name: T):
        T extends ClassType ? InstanceType<T> :
        T extends string ? any :
        never {
        const finalName = typeof name === 'string' ? name : name.name;
        const cls = Container.get(finalName);

        if (!cls) {
            return null as any;
        }

        return cls as any;
    }

    static describe = (config?: DecoratorConfig) => (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) => {
        const className = target.constructor.name;
        const method = descriptor.value;

        let params: Record<string, any> = {};
        let generatedInputSchema: ZodSchema<any> | undefined;

        const paramRegex = /\(([^)]*)\)/;
        const paramsMatch = paramRegex.exec(method.toString());
        const paramNames = paramsMatch
            ? paramsMatch[1]
                .split(",")
                .map((p) => {
                    if (p.includes('=')) {
                        const parts = p.split('=');
                        p = parts[0].trim();
                        return p;
                    }
                    return p.trim();
                })
                .filter(Boolean)
            : [];

        // Get parameter types from reflection
        const types = Reflect.getMetadata("design:paramtypes", target, propertyKey) || [];
        const paramTypes = types.map((type: any) => type?.name || "unknown");

        if (config?.parameterSchema) {
            // Use provided schema
            const schemaAsJson = zodToJsonSchema(config.parameterSchema) as any;
            const schemaProperties = ttc.getZodTypeName(schemaAsJson.properties || {});

            // If the method has one argument, assume the schema defines its type.
            if (paramNames.length === 1) {
                const singleParam = paramNames[0];
                // If the schemaProperties describes the inner fields of the single parameter
                // (e.g. { name: 'string', email: 'string' }) keep it as the param value.
                // If schemaProperties describes a single primitive (e.g. { userId: 'string' }),
                // unwrap it to avoid double-nesting: { userId: { userId: 'string' } } -> { userId: 'string' }.
                if (Object.keys(schemaProperties).length === 1 && schemaProperties.hasOwnProperty(singleParam)) {
                    params[singleParam] = schemaProperties[singleParam];
                } else {
                    params[singleParam] = schemaProperties;
                }
            } else {
                // Otherwise, map schema properties to parameter names.
                params = schemaProperties;
            }
            generatedInputSchema = config.parameterSchema;
        } else {
            // Generate schema from parameter types
            if (paramNames.length > 0) {
                generatedInputSchema = ttc.createZodSchemaFromParams(paramNames, types);

                // Extract params from generated schema for compatibility
                const schemaAsJson = zodToJsonSchema(generatedInputSchema) as any;
                const schemaProperties = ttc.getZodTypeName(schemaAsJson.properties || {});

                if (paramNames.length === 1) {
                    const singleParam = paramNames[0];
                    if (Object.keys(schemaProperties).length === 1 && schemaProperties.hasOwnProperty(singleParam)) {
                        params[singleParam] = schemaProperties[singleParam];
                    } else {
                        params[singleParam] = schemaProperties;
                    }
                } else {
                    params = schemaProperties;
                }
            } else {
                // No parameters, create empty schema
                generatedInputSchema = z.object({});
            }
        }

        if (!Container.has(className)) {
            Container.set(className, new target.constructor());
        }

        const key = `${className}.${propertyKey}`;
        // console.log(key, config.response);
        ttc.rpcRegistry[key] = {
            params,
            hide: config.hide,
            response: config.response === undefined ? true: config.response,
            param_index: config.param_index ? config.param_index : paramNames.length,
            parameterSchema: generatedInputSchema,
            outputSchema: config?.outputSchema,
            auth: config?.auth,
            media: config?.media,
            doc: config?.doc,
            spread: config?.spread ? config.spread : config?.endpoint ? true : false,
            endpoint: config?.endpoint,
            validate: config?.validate
        };
        // console.log(key, params, 'Generated schema:', generatedInputSchema);
    }

    static requestContext(args: IArguments): {
        request: Request;
        response: Response;
        auth: any;
        file: any;
        _scid: string;
    } {
        const context = args[args.length - 1];
        if (!context) {
            return {} as any;
        }
        return {
            request: context.request as Request,
            response: context.response as Response,
            auth: context.auth,
            file: context.file,
            _scid: context._scid
        };
    }

    static io(_scid: string) {
        if (!_scid) return null;
        if (!this.socket) return null;
        if (!this.socket.clients) return null;
        if (!this.socket.clients.has(_scid)) return null;
        return this.socket.clients.get(_scid);
    }

    static emit(_scid: string, event: string, data: any) {
        if (this.io(_scid)) {
            this.io(_scid).emit(event, data);
        } else {
            SSECache.cache(_scid, {
                event,
                data,
                eta: Date.now()
            });
        }
    }

    static process_auth(token: string) {
        try {
            const result = token.split(":");

            return {
                bearer: result[0],
                _scid: result[1] || null
            }

        } catch (error) {
            return {
                bearer: token,
                _scid: null
            }
        }
    }

    static async invoke(method: string, args: any[], requestConfig: {
        request: Request,
        response: Response
    }): Promise<rpcResponseType> {

        const [className, methodName] = method.split(".");
        let auth_data = null;
        if (!Container.has(className)) {
            // throw new Error(`Service ${className} not found`);
            return {
                status: 'notFound',
                data: `${className} does not exist in api`,
            }
        }

        const serviceInstance: any = Container.get(className);

        if (!serviceInstance[methodName]) {
            return {
                status: 'notFound',
                data: `function ${methodName} does not exist in ${className} module`,
            }
        }

        const funcRegistry = this.rpcRegistry[method];

        // split _scid from authorization inluded or not
        const edited_auth_args = this.process_auth(requestConfig.request.headers.authorization || '');

        if (funcRegistry.auth) {
            if (!requestConfig.request.headers.authorization) {
                return {
                    status: 'unauthorized',
                    data: 'No authorization token provided'
                };
            }
            if (!this.authCb) {
                return {
                    status: 'error',
                    data: 'Internal server error: No auth callback defined'
                };
            }
            const authContext = Array.isArray(funcRegistry.auth) ? funcRegistry.auth : [];

            try {
                auth_data = this.authCb ? await this.authCb(edited_auth_args.bearer, authContext, method) : true;
            } catch (error) {
                return {
                    status: 'unauthorized',
                    data: `${error.message || 'Unauthorized'}`
                };
            }
        }

        // console.log(`Invoking RPC method: ${method} with args:`, args);

        if (funcRegistry.media) {
            // form data collates prameters as string so we need to convert it to object
            args = typeof args === 'string' ? JSON.parse(args as string) : args;
        }

        // Ensure args is an array
        if (!Array.isArray(args)) {
            args = args ? [args] : [];
        }

        // Validate input using schema if available
        if (funcRegistry.validate && funcRegistry.parameterSchema && args.length > 0) {
            try {
                // For single parameter methods, validate the first argument directly
                if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
                    const validatedArgs = funcRegistry.parameterSchema.parse(args[0]);
                    args[0] = validatedArgs;
                } else if (args.length > 1) {
                    // For multiple parameters, create an object from parameter names and validate
                    const paramNames = Object.keys(funcRegistry.params);
                    const paramObj: Record<string, any> = {};

                    paramNames.forEach((name, index) => {
                        if (index < args.length) {
                            paramObj[name] = args[index];
                        }
                    });

                    const validatedObj = funcRegistry.parameterSchema.parse(paramObj);

                    // Update args array with validated values
                    paramNames.forEach((name, index) => {
                        if (index < args.length) {
                            args[index] = validatedObj[name];
                        }
                    });
                }
            } catch (validationError: any) {
                return {
                    status: 'error',
                    data: `Validation error: ${validationError.message}`
                };
            }
        }

        // console.log(args, 'VALIDATED INPUT ARGS')

        args[funcRegistry.param_index] = {
            request: requestConfig.request,
            response: requestConfig.response,
            auth: auth_data,
            file: requestConfig.request.file,
            _scid: edited_auth_args._scid
        };

        try {
            const response = await serviceInstance[methodName](...args);
            if (response) {
                return {
                    status: 'success',
                    data: response
                }
            } else if (!funcRegistry.response) {
                return {
                    status: 'success'
                }
            }
        } catch (error: any) {
            return {
                status: 'error',
                data: error.message
            }
        }
    }

    static init(config: {
        app: any;
        modules: any[];
        authCb?: (token: string, authContext: string[]) => Promise<any>;
        socketCb?: (socket: SSESocket) => Promise<any>;
        generate_client?: boolean;
        options?: {
            requestSizeLimit?: string;
            maxFileSize?: number;
        };
        middleware?: 'default' | 'custom';
    }) {

        const { app, modules, authCb, middleware, generate_client, socketCb } = config;

        // just to trick TypeScript into recognizing the service decorators
        this.authCb = authCb;
        this.socketCb = socketCb;
        this.app = app;
        this.generateClient = generate_client || false;

        //  process spread endpoints 
        for (const [methodKey, register] of Object.entries(this.rpcRegistry)) {
            if (register.spread) {
                const [className, methodName] = methodKey.split(".");
                let endpoint = register.endpoint || `/${className}/${methodName}`;
                if (!endpoint.startsWith('/')) {
                    endpoint = '/' + endpoint;
                }
                console.log(`ttc function "${methodKey}" Mapped to endpoint ${endpoint}`);
                app.use(endpoint, async (req, res) => {
                    const rpcResponse = await ttc.invoke(methodKey, [req.body], {
                        request: req,
                        response: res
                    });
                    if (rpcResponse)
                        return res.json(rpcResponse);
                });
            }
        }

        if (!middleware || middleware === 'default') {
            handleDefaultMiddleWare(app, config.options || {});
        }

        return this;
    }

    static listen(port: number | string) {
        if (!this.app) {
            throw new Error("App not initialized");
        }
        // const server = require('http').createServer(this.app);
        this.socket = new SSEManager(this.app, this.authCb, this.socketCb);
        this.app.listen(port, () => {
            console.log(`[server]: Server is running on port ${port}`);
            if (this.generateClient) {
                const script = ttc.generateClientScript();
                require('fs').writeFileSync(`src/rpc.client.ts`, script, 'utf8');
            }
        });
    }

    static getRegistry() {
        return this.rpcRegistry;
    }

    private static formatType(type: any): string {
        if (type === 'array') {
            return 'any[]';
        }
        if (typeof type === 'string') {
            return type.toLowerCase();
        }
        if (typeof type === 'object' && type !== null) {
            const properties = Object.entries(type)
                .map(([key, value]) => `${key}: ${this.formatType(value)}`)
                .join(', ');
            return `Partial<{ ${properties} }> `;
        }
        return 'any';
    }

    private static formatOutputType(schemaJson: any): string {
        if (!schemaJson) return 'any';

        // Handle basic types
        if (schemaJson.type === 'string') {
            // Handle string enums
            if (schemaJson.enum) {
                return schemaJson.enum.map((val: any) => `'${val}'`).join(' | ');
            }
            // Handle string formats
            if (schemaJson.format === 'date-time') return 'string';
            if (schemaJson.format === 'email') return 'string';
            if (schemaJson.format === 'uuid') return 'string';
            if (schemaJson.format === 'uri') return 'string';
            return 'string';
        }

        if (schemaJson.type === 'number' || schemaJson.type === 'integer') {
            return 'number';
        }

        if (schemaJson.type === 'boolean') return 'boolean';

        if (schemaJson.type === 'array') {
            const itemType = schemaJson.items ? this.formatOutputType(schemaJson.items) : 'any';
            return `${itemType}[]`;
        }

        // Handle objects
        if (schemaJson.type === 'object' && schemaJson.properties) {
            const required = schemaJson.required || [];
            const properties = Object.entries(schemaJson.properties)
                .map(([key, prop]: [string, any]) => {
                    const optional = !required.includes(key) ? '?' : '';
                    return `${key}${optional}: ${this.formatOutputType(prop)}`;
                })
                .join('; ');
            return `{ ${properties} }`;
        }

        // Handle allOf (merging schemas)
        if (schemaJson.allOf) {
            const mergedTypes = schemaJson.allOf.map((schema: any) => this.formatOutputType(schema));
            // For allOf, we need to intersect the types
            return mergedTypes.join(' & ');
        }

        // Handle enums at top level
        if (schemaJson.enum) {
            return schemaJson.enum.map((val: any) => `'${val}'`).join(' | ');
        }

        // Handle unions (anyOf, oneOf)
        if (schemaJson.anyOf || schemaJson.oneOf) {
            const unions = schemaJson.anyOf || schemaJson.oneOf;
            return unions.map((union: any) => this.formatOutputType(union)).join(' | ');
        }

        // Handle additionalProperties or any type
        if (schemaJson.additionalProperties === true || Object.keys(schemaJson).length === 0) {
            return 'any';
        }

        return 'any';
    }

    static generateClientScript(clientName = "RPCClient") {
        // Collect methods by service
        const services: Record<string, string[]> = {};
        for (const key in ttc.rpcRegistry) {
            const [service, method] = key.split(".");
            if (!services[service]) {
                services[service] = [];
            }

            const registryEntry = ttc.rpcRegistry[key];

            if (registryEntry.spread) {
                // Skip spread methods for client generation
                continue;
            }

            const params = registryEntry.params;
            const outputSchema = registryEntry.outputSchema;
            const isMediaMethod = registryEntry.media;
            const methodDoc = registryEntry.doc; // Get the documentation

            const paramNames = Object.keys(params);

            // Generate output type from output schema
            let returnType = "any";
            if (outputSchema) {
                try {
                    const outputSchemaAsJson = zodToJsonSchema(outputSchema) as any;
                    returnType = this.formatOutputType(outputSchemaAsJson);
                } catch (error) {
                    console.warn(`Failed to generate output type for ${key}:`, error);
                    returnType = "any";
                }
            }

            // Add file parameter for media methods
            const allParams = isMediaMethod ? [...paramNames, 'file'] : paramNames;

            // Build parameter list with types for function signature
            const paramSignature = allParams
                .map(p => p === 'file' ? `${p}: any` : `${p}: ${this.formatType(params[p])}`)
                .join(", ");

            // Build type comment
            const typeComment = allParams
                .map(p => p === 'file' ? `${p}: any` : `${p}: ${this.formatType(params[p])}`)
                .join(", ");

            // Choose the appropriate callback based on media method
            const callbackMethod = isMediaMethod ? 'mediaCallback' : 'apiCallback';
            const callbackParams = isMediaMethod
                ? `'${key}'${paramNames.length ? ", [" + paramNames.join(", ") + "]" : ", []"}, file`
                : `'${key}'${paramNames.length ? ", [" + paramNames.join(", ") + "]" : ""}`;

            // Build JSDoc comment with optional documentation
            const jsdocLines = [`        /**`];

            // Add method description if available
            if (methodDoc) {
                jsdocLines.push(`         * ${methodDoc}`);
                jsdocLines.push(`         *`);
            }

            // Add parameter documentation
            jsdocLines.push(`         * @param {${typeComment}}`);
            jsdocLines.push(`         * @returns {Promise<rpcResponseType<${returnType}>>}`);
            jsdocLines.push(`         */`);

            const methodImplementation = [
                ...jsdocLines,
                `        async ${method}(${paramSignature}): Promise<rpcResponseType<${returnType}>> {`,
                `            return await ${clientName}.${callbackMethod}(${callbackParams});`,
                `        },`,
            ].join("\n");
            services[service].push(methodImplementation);
        }

        // Build service objects
        let serviceBlocks = "";
        for (const service in services) {
            const methodBlocks = services[service].join("\n");
            serviceBlocks += `    ${service} = {\n${methodBlocks}\n    }\n`;
        }

        // Final output as a class with generic rpcResponseType
        return `

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
    onopen: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    readyState: number; // 0=CONNECTING, 1=OPEN, 2=CLOSED
}

type EventCallback = (data: any) => any;

export class SSEClient {

    private eventSource: TTCEventSource = {} as any;
    private EventSourceClass: any;
    private callbackMap: Map<string, Map<EventCallback, (event: any) => void>> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private lastHeartbeat: number = 0;
    private isConnected: boolean = false;
    private heartbeatTimeout = 30000; // 30 seconds

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

        const _url = \`\${url}/stream?scid=\${scid}\`;
        const token = await token_cb();

        // Create EventSource connection
        this.eventSource = new this.EventSourceClass(_url, {
            fetch: (input: any, init: any) =>
                fetch(input, {
                    ...init,
                    headers: {
                        ...init.headers,
                        Authorization: token
                    },
                }),
        }) as TTCEventSource;

        // Set up standard EventSource handlers
        this.eventSource.onopen = () => {
            // console.log('[SSEClient] Connection established');
            this.isConnected = true;
            this.startHeartbeat();
        };

        this.eventSource.onerror = (error) => {
            // console.error('[SSEClient] Connection error:', error);
            this.handleDisconnect('error', error);
        };

        // Wait for 'open' event before calling socket callback
        this.eventSource.addEventListener('connect', async () => {
            // console.log('[SSEClient] SSE open event received');
            await socket_cb(this);
        });

        // Listen for server-sent heartbeat/ping events
        this.eventSource.addEventListener('ping', () => {
            this.lastHeartbeat = Date.now();
        });
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

    private startHeartbeat() {
        this.lastHeartbeat = Date.now();

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (!this.isConnected) return;

            // Check if we've missed heartbeats
            const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;
            if (timeSinceLastHeartbeat > this.heartbeatTimeout) {
                console.warn('[SSEClient] Heartbeat timeout, assuming disconnect');
                this.handleDisconnect('timeout', \`No heartbeat for \${timeSinceLastHeartbeat}ms\`);
            }

            // Check EventSource readyState
            if (this.eventSource.readyState === 2) { // CLOSED
                console.warn('[SSEClient] EventSource in CLOSED state');
                this.handleDisconnect('closed', 'EventSource readyState is CLOSED');
            }
        }, 5000); // Check every 5 seconds
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private handleDisconnect(reason: string, details?: any) {
        if (!this.isConnected) return;

        this.isConnected = false;
        this.stopHeartbeat();

        // Trigger disconnect event for all registered callbacks
        this.triggerDisconnectEvent(reason, details);
    }

    private triggerDisconnectEvent(reason: string, details?: any) {
        const disconnectCallbacks = this.callbackMap.get('disconnect');
        if (disconnectCallbacks) {
            const disconnectData = { reason, details, timestamp: Date.now() };

            // Call each disconnect callback
            for (const [callback, wrapper] of disconnectCallbacks.entries()) {
                try {
                    callback(disconnectData);
                } catch (error) {
                    console.error('[SSEClient] Error in disconnect callback:', error);
                }
            }
        }
    }

    close() {
        if (this.eventSource) {
            this.handleDisconnect('manual', 'Manual close called');
            this.eventSource.close();
            // Clear all callback mappings
            this.callbackMap.clear();
            this.stopHeartbeat();
        }
    }

    getConnectionState() {
        return {
            isConnected: this.isConnected,
            readyState: this.eventSource?.readyState ?? -1,
            lastHeartbeat: this.lastHeartbeat,
            timeSinceLastHeartbeat: Date.now() - this.lastHeartbeat
        };
    }
}


export class ${clientName} {
    // keep static aliases for backward compatibility with existing calls
    static token_cb: () => Promise<string>;
    static url = 'http://localhost:3000/rpc';
    static _scid: string;
    static socket: SSEClient;

    constructor(url: string, token_cb: () => Promise<string>, socket_cb?: (socket: SSEClient) => Promise<any>) {
        ${clientName}.token_cb = token_cb;
        ${clientName}.url = url;
        ${clientName}._scid = uuid()
        if(socket_cb)this.connectSocket(url, socket_cb);
    }

    static apiCallback: callbackType = async (method: string, params?: any) => {
        try {
            if (!${clientName}.token_cb) throw new Error('${clientName}.token_cb is not set');
            const token = await ${clientName}.token_cb();
            const response = await fetch(\`\${${clientName}.url}/rpc\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: \`Bearer \${token}:\${${clientName}._scid}\`,
                },
                body: JSON.stringify({ method, params })
            });
            if (!response.ok) {
                throw new Error(\`API error: \${response.status} \${response.statusText}\`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error calling API:", error);
            throw error;
        }
    }

    static mediaCallback: mediaCallbackType = async (method: string, params?: any, file?: any) => {
        try {
            if (!${clientName}.token_cb) throw new Error('${clientName}.token_cb is not set');
            const token = await ${clientName}.token_cb();
            const formData = new FormData();
            formData.append('method', method);
            if (params) formData.append('params', JSON.stringify(params));
            if (file) formData.append('file', file);

            const response = await fetch(\`\${${clientName}.url}/rpc\`, {
                method: 'POST',
                headers: {
                    Authorization: \`Bearer \${token}:\${${clientName}._scid}\`,
                },
                body: formData
            });
            if (!response.ok) {
                throw new Error(\`Media API error: \${response.status} \${response.statusText}\`);
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
                socket.connect(url, ${clientName}._scid, RPCClient.token_cb, socket_cb);
                ${clientName}.socket = socket;
            } catch (error: any) {
                console.error('Error initializing socket:', error.message);
            }
        }


${serviceBlocks}
}
`;
    }
}
