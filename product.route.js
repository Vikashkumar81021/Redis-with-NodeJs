import express from "express";
import Product from "./product.model.js";
import { client } from "./server.js";
const router = express.Router();
router.post("/product", async (req, res) => {
  try {
    const product = await Product.create(req.body);

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
