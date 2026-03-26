
## 16 September 2025
- Removed CORS from default middleware handles. CORS must now be explicitly enabled if required.


## 18 September 2025
- Fixed Errors where requestContext spilled into function arguments

## 19 September 2025
- Updated auth callback to accept an additional parameter, authContext, which is an array of strings for more granular authorization control.
- fixed the uuid in rpc client to support nodejs environment when there's no localstorage reference
- fixed a bug where rpcResponse was being returned when it was undefined

## 2 October 2025
- Upgraded to zod 4, replaced zod-to-ts with a custom zodToTs function since the package
has not been updated to zod 4

## 29 December 2025
- Fixed a bug where the function schemas return null for nested objects

## 28 January 2026
- Added socket transport support for the rpc calls
- call client.setTransport('socket | http') to switch between transports

## 29 January 2026
- Fixed a bug were ttc _scid was not being sent in the socket transport authorization header

## 31 January 2026
- Fixed error where socket response returned nested status messages

## 4 February 2026
- Added options to the rpc decorator to allow configuration of request size limits for both JSON body and file uploads. These can be set using the `options` property in the decorator configuration.

## 19 March 2026

## 19 March 2026
- Added 'hide' option to DecoratorConfig to hide functions from API documentation while keeping them accessible via RPC client
- Added 'response' option to DecoratorConfig to control whether functions return data in response (default: true)
- Modified rpc-info.ts to skip hidden methods when generating API documentation
- Updated server.ts to comment out /methods and /api-docs endpoints by default
- Version bump to 2.1.6

- Added a meta decorator option for custom metadata users can apply to their function
- Further modifications meta was removed because it was'nt practical
- Added hide option to the describe decorator, this option hides the function from the docs but makes it available in the rpc.client.ts, this is used specifically by the ttc-origin-server to limit what functions ai can see or not but still accessible via the web client