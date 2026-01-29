
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