import { RPCClient } from "./rpc.client";
import { ttc } from "./rpc.decorator";

const PORT = 3056;
const client = new RPCClient(`http://localhost:${PORT}`, async () => 'test-token', async (socket) => {
    console.log('Socket connected')
  socket.on("message", (data) => {
    console.log(data, 'SHIT EVENT GOTTEN');
  })
});

const cmd = process.argv[2];
console.log(cmd);

setTimeout(()=>{
    if(cmd === 'send'){
      client.UserService.deleteUser("userid", []).then(res=>console.log(res)).catch(err=>console.log(err))
      // process.exit(0)
    }
}, 1000)