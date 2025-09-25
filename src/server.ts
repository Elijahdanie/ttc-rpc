import bodyParser from "body-parser";
import multer from "multer";
import { ttc } from "./rpc.decorator";
import { generateFullAPIDocumentation } from "./rpc-info";



export const handleDefaultMiddleWare = (app: any) => {
    // Configure multer for file upload
    const storage = multer.memoryStorage();
    const upload = multer({
        storage,
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit
        },
        fileFilter: (req: any, file: any, cb: any) => {
            // Allow all file types for now, but you can add restrictions here
            cb(null, true);
        },
    });

    // Middleware
    app.use(bodyParser.json());

    // RPC Endpoint
    app.use("/rpc", upload.single("file") as any, async (req, res) => {
        try {
            // console.log('Received RPC request:', req.body);
            if (typeof req.body !== "object") {
                console.log("Invalid request format:", req.body);
                return res.status(400).json({ error: "Invalid request format" });
            }
            
            const rpcResponse = await ttc.invoke(
                req.body.method,
                req.body.params,
                {
                    request: req,
                    response: res
                }
            );
            if (rpcResponse) {
                return res.json(rpcResponse);
            }
        } catch (error: any) {
            console.log("Error processing RPC request:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
            return res.status(500).json({ error: errorMessage });
        }
    });

    app.get("/methods", async (req, res) => {
        const sapikey = req.query.sapikey;
        const secret = process.env.TTC_API_SECRET;
        if (sapikey !== secret) {
            return res.status(401).json({ error: "Unauthorized" });
        }
      const methods = await ttc.generateClientScript();
      console.log("Available RPC methods:", methods);
      res.type("text/javascript").send(methods);
    });

    // API Documentation endpoint
    app.get("/api-docs", async (req, res) => {
      try {
        if(!await ttc.authCb(req.headers.authorization as string, [])) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const apiDocs = generateFullAPIDocumentation();
        res.json(apiDocs);
      } catch (error: any) {
        console.log("Error generating API documentation:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return res.status(500).json({ error: errorMessage });
      }
    });
};
