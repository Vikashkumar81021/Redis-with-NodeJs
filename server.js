import express from "express";
import { createClient } from "redis";
import { connectDB } from "./db.js";
import productRoute from "./product.route.js";

const app = express();
app.use(express.json());

export const client = createClient({
  url: "redis://127.0.0.1:6380",
});

client.on("error", (err) => {
  console.error("Redis Error:", err.message);
});

app.use("/api", productRoute);

async function startServer() {
  try {
    await connectDB();
    await client.connect();

    console.log("Redis connected!");

    app.listen(3000, () => {
      console.log("Server is listening on 3000");
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
