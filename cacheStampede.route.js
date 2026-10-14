import express from "express";
import Product from "./product.model.js";
import { client } from "./server.js";
const router = express.Router();

//TTL JITTER STRATEGIC :-Keys alag-alag time par expire hoti hain, load spread ho sakta hai.
//without TTL JITTER:- concuurent req jaaeeyga db ek he sath all key expiry hone k baad cache
// TTL Jitter kab useful hai?
// Maan lo tumhari application mein alag-alag keys hain:
// Redis key	TTL
// product:all	315 sec
// product:category:mobile	342 sec
// product:category:laptop	307 sec
// product:123	351 sec
// Ab ye keys alag-alag time par expire hongi. Isse bahut saari keys ek saath expire hone ka risk kam hota hai. Ise Cache Avalanche ko reduce karna kehte hain.
router.get("/fetchAllProduct", async (req, res) => {
  try {
    //STRATEGIC
    // Expiry ek saath na hone do — isse Cache Avalanche ka risk bhi kam hota hai. (TTL Jitter)
    // Cache expire ho jaaye toh sirf ek request DB hit kare — ye Cache Stampede control karne ki strategy hai.
    const cachedProduct = await client.get("product:all");
    if (cachedProduct) {
      return res.status(200).json({
        source: "Redis",
        products: JSON.parse(cachedProduct),
      });
    }
    const products = await Product.find();
    // TTL Jitter
    const baseTTL = 300;
    const jitter = Math.floor(Math.random() * 60);
    const ttl = baseTTL + jitter;
    await client.set("product:all", JSON.stringify(products), { EX: ttl });

    return res.status(200).json({
      source: "database",
      products,
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error" });
  }
});

// Single-Flight / Request Coalescing:-cache expire hone par 100 requests aayein, lekin DB query sirf ek baar chale aur sabko wahi result mile.
// Without Single-Flight100 GET requests → Cache MISS100 DB queries Same listing ke liye unnecessary load

// With Single-Flight :-100 GET requests → Cache MISS 1 DB query Ek request fetch karti hai; baaki wait karti hain.Same result → Redis + all waiting requests
// Benefit	            Trade-off
// DB load kam hota hai.	Waiting requests ko query complete hone tak wait karna padta hai
// Same data ke duplicate DB reads kam hote hain.	Code thoda complex hota hai
// DB overload ka risk kam hota hai	Agar DB query fail ho, sab waiting requests fail ho sakti hain
// Response result sabko reuse hota hai	In-memory implementation sirf ek Node.js process ke andar coordination karti hai

// Production note: Multiple Node.js instances par coordination chahiye toh distributed locking ya Redis-based coordination consider kar sakte ho. Lekin distributed lock mein timeout, lock expiry aur failure handling bhi carefully karni padti hai.

router.get("/fetchProduct/Single-Flight", async (req, res) => {
  const cachedProduct = await client.get("product:all");
  if (cachedProduct) {
    return res.status(200).json({
      socurce: "redis",
      products: JSON.stringify(cachedProduct),
    });
  }
  // 2. Agar DB fetch already chal raha hai,
  // toh wahi promise reuse karo
  let productFetchPromise = null;
  if (!productFetchPromise) {
    productFetchPromise = (async () => {
      const products = await Product.find();

      await client.set("product:all", JSON.stringify(products), { EX: 300 });

      return products;
    })().finally(() => {
      productFetchPromise = null;
    });
  }

  // 3. Sabhi concurrent requests same result wait karengi
  const products = await productFetchPromise;
  return res.status(200).json({
    source: "database",
    products,
  });
});
