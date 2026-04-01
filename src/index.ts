// Main exports for the ttc-rpc package
export { ttc } from './rpc.decorator';
export { handleDefaultMiddleWare } from './server';
export { SSESocket } from './sse';
// Export RPC info utilities
export { 
  generateRPCMethodsInfo, 
  generateRPCMethodsList, 
  generateFullAPIDocumentation,
  type RPCMethodInfo,
  type RPCServiceInfo
} from './rpc-info';

// Export types
export type { 
  statusType, 
  rpcResponseType,
  callbackType,
  mediaCallbackType,
  rpcResponseTypeGeneric
} from './rpc.decorator';

// Re-export commonly used dependencies
export type { Request, Response } from 'express';
export type { ZodSchema } from 'zod';
