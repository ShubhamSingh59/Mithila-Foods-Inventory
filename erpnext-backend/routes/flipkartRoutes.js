//const express = require('express');
//const router = express.Router();

//// Helper Function: Always get a fresh token before calling Flipkart
//async function getFlipkartToken() {
//    const appId = process.env.FLIPKART_APP_ID;
//    const appSecret = process.env.FLIPKART_APP_SECRET;

//    // 1. Safety Check: Did the .env file load properly?
//    if (!appId || !appSecret) {
//        throw new Error("Missing Keys! Node.js cannot find FLIPKART_APP_ID in your .env file.");
//    }

//    // 2. Encode the credentials
//    const credentials = `${appId.trim()}:${appSecret.trim()}`; // .trim() removes accidental spaces!
//    const encodedCredentials = Buffer.from(credentials).toString('base64');
//    const tokenUrl = 'https://api.flipkart.net/oauth-service/oauth/token?grant_type=client_credentials&scope=Seller_Api';

//    const response = await fetch(tokenUrl, {
//        method: 'GET',
//        headers: { 'Authorization': `Basic ${encodedCredentials}` }
//    });

//    const data = await response.json();

//    // 3. Print the EXACT error from Flipkart if they reject us
//    if (!response.ok) {
//        console.log("🛑 FLIPKART EXACT REJECTION MESSAGE:");
//        console.dir(data, { depth: null, colors: true });
//        throw new Error(data.error_description || "Flipkart rejected the keys");
//    }

//    return data.access_token;
//}
//// 1. Fetch Flipkart Orders (24-Hour Chunks)
//router.get('/orders', async (req, res) => {
//    try {
//        const offset = parseInt(req.query.offset) || 0;
//        const endDate = new Date();
//        endDate.setDate(endDate.getDate() - offset);

//        const startDate = new Date(endDate);
//        startDate.setDate(startDate.getDate() - 1);

//        console.log(`\n⏳ Fetching LIVE Flipkart Orders (Offset: ${offset} days)...`);

//        // 1. Get fresh token
//        const token = await getFlipkartToken();

//        // 2. Flipkart uses a POST request to search for orders
//        const searchUrl = 'https://api.flipkart.net/sellers/v3/orders/search';
//        const requestBody = {
//            filter: {
//                orderDate: {
//                    fromDate: startDate.toISOString(),
//                    toDate: endDate.toISOString()
//                }
//            }
//        };

//        const response = await fetch(searchUrl, {
//            method: 'POST',
//            headers: {
//                'Authorization': `Bearer ${token}`,
//                'Content-Type': 'application/json'
//            },
//            body: JSON.stringify(requestBody)
//        });

//        const data = await response.json();

//        // Flipkart returns an array of "orderItems". We will let the React frontend group them.
//        const fetchedItems = data.orderItems || [];

//        // Sort newest first
//        fetchedItems.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

//        console.log(`✅ Retrieved ${fetchedItems.length} Flipkart items.`);

//        res.json({
//            status: "Success",
//            flipkartData: { Items: fetchedItems },
//            nextOffset: offset + 1
//        });

//    } catch (error) {
//        console.error("❌ Flipkart API Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

//module.exports = router;