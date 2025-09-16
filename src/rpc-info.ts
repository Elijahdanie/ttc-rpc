import { ttc } from './rpc.decorator';
import { zodToTs, printNode } from 'zod-to-ts';
import { ZodSchema } from 'zod';

export interface RPCMethodInfo {
    name: string;
    description?: string;
    permission?: boolean;
    input_schema?: string;
    output_schema?: string;
}

export interface RPCServiceInfo {
    [serviceName: string]: RPCMethodInfo[];
}

interface RegistryEntry {
    params: Record<string, any>;
    inputSchema?: ZodSchema<any>;
    outputSchema?: ZodSchema<any>;
    auth?: boolean;
    doc?: string;
    spread?: boolean;
    endpoint?: string;
    media?: boolean;
}

/**
 * Generates a JSON representation of all registered RPC methods
 * @returns Object containing services and their method information
 */
export function generateRPCMethodsInfo(): RPCServiceInfo {
    const services: RPCServiceInfo = {};
    
    // Get the registry through the public method
    const registry = ttc.getRegistry();
    
    for (const [fullMethodName, registryEntryRaw] of Object.entries(registry)) {
        const registryEntry = registryEntryRaw as RegistryEntry;
        const [serviceName, methodName] = fullMethodName.split('.');
        
        // Skip spread methods as they're handled differently
        if (registryEntry.spread) {
            continue;
        }
        
        // Initialize service array if it doesn't exist
        if (!services[serviceName]) {
            services[serviceName] = [];
        }
        
        const methodInfo: RPCMethodInfo = {
            name: methodName,
            description: registryEntry.doc,
            permission: registryEntry.auth
        };
        
        // Convert input schema to TypeScript type if it exists
        if (registryEntry.inputSchema) {
            try {
                const { node } = zodToTs(registryEntry.inputSchema, `${serviceName}_${methodName}_Input`);
                methodInfo.input_schema = printNode(node);
            } catch (error) {
                console.warn(`Failed to convert input schema for ${fullMethodName}:`, error);
                methodInfo.input_schema = null;
            }
        }
        
        // Convert output schema to TypeScript type if it exists
        if (registryEntry.outputSchema) {
            try {
                const { node } = zodToTs(registryEntry.outputSchema, `${serviceName}_${methodName}_Output`);
                methodInfo.output_schema = printNode(node);
            } catch (error) {
                console.warn(`Failed to convert output schema for ${fullMethodName}:`, error);
                methodInfo.output_schema = null;
            }
        }
        
        services[serviceName].push(methodInfo);
    }
    
    return services;
}

/**
 * Generates a flattened array of all RPC method information
 * @returns Array of method information objects
 */
export function generateRPCMethodsList(): RPCMethodInfo[] {
    const services = generateRPCMethodsInfo();
    const methods: RPCMethodInfo[] = [];
    
    for (const [serviceName, serviceMethods] of Object.entries(services)) {
        for (const method of serviceMethods) {
            // Add service context to method name for uniqueness
            methods.push({
                ...method,
                name: `${serviceName}.${method.name}`
            });
        }
    }
    
    return methods;
}

/**
 * Generates a comprehensive API documentation object
 * @returns Complete API documentation with metadata
 */
export function generateAPIDocumentation() {
    return {
        meta: {
            generator: 'ttc-rpc',
            version: '1.0.0',
            generated_at: new Date().toISOString(),
            total_services: 0,
            total_methods: 0
        },
        services: {} as RPCServiceInfo,
        methods: [] as RPCMethodInfo[]
    };
}

/**
 * Generates complete API documentation with metadata
 * @returns Full API documentation object
 */
export function generateFullAPIDocumentation() {
    const services = generateRPCMethodsInfo();
    const methods = generateRPCMethodsList();
    
    return {
        meta: {
            generator: 'ttc-rpc',
            version: '1.0.0',
            generated_at: new Date().toISOString(),
            total_services: Object.keys(services).length,
            total_methods: methods.length
        },
        services,
        methods
    };
}
