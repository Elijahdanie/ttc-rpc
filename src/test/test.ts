import { RPCClient } from "./rpc.client";



const PORT = 3056;
const client = new RPCClient(`http://localhost:${PORT}`, async () => 'ttc_ck_a24d8a0146e847709b7637aca39955e1', async (socket) => {
    console.log('Socket connected')
  socket.on("function_call", (data) => {
    console.log(data, 'TEST EVENT GOTTEN');
  })

  socket.on("client_connected", data=>console.log(data))

  socket.on("client_disconnected", data => console.log(data))
});

const cmd = process.argv[2];
console.log(cmd);

// setTimeout(()=>{
    if(cmd === 'send'){
      client.UserService.deleteUser("send message to me, i am debugging something", []).then(res=>console.log(res)).catch(err=>console.log(err))
      // process.exit(0)
    }
setTimeout(()=>{
}, 10000)