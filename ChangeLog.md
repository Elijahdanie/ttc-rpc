
## 16 September 2025
- Removed CORS from default middleware handles. CORS must now be explicitly enabled if required.


## 18 September 2025
- Fixed Errors where requestContext spilled into function arguments

## 19 September 2025
- Updated auth callback to accept an additional parameter, authContext, which is an array of strings for more granular authorization control.
- fixed the uuid in rpc client to support nodejs environment when there's no localstorage reference
- fixed a bug where rpcResponse was being returned when it was undefined