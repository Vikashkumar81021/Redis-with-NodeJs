import express from "express";
import Product from "./product.model.js";
import { client } from "./server.js";
const router = express.Router();
router.post("/product", async (req, res) => {
  try {
    const product = await Product.create(req.body);
    //CACHE INVALIDATION
    //if we want ki prouct create hote he user ko show hona chaaheye toh product create time cache clear kr do
    //agar sytem ye accpetable ki user ko thore der k liye old product show kr skte ho tb TTL ENGOUGH HAII
    client.del("product:all");
    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});
router.get("/product", async (req, res) => {
  try {
    const cachedProduct = await client.get("product:all");
    if (cachedProduct) {
      return res.status(200).json({
        source: "redis",
        products: JSON.parse(cachedProduct),
      });
    }
    const products = await Product.find();
    //ISME PRBLM HAI AGGR EK HE SATH SAARE KEY EXPIRY HO JAAENEGE EXPIRY K AAGR 1000 AA GAY TOH DB LATENCY INCREASE ESSE HANDLE KRN E K LIYE HM TTL JITTER YA EK HOTA HAI EK REQ DB HIT BAKI REQ SAME CACHE USE
    await client.set("product:all", JSON.stringify(products), { EX: 300 });

    return res.status(200).json({
      source: "database",
      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
