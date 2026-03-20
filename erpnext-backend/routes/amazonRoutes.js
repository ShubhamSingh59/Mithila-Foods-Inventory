//const express = require('express');
//const router = express.Router();
//const SellingPartnerAPI = require('amazon-sp-api');
//const Papa = require('papaparse');
//// https://sellingpartnerapi-na.amazon.com/orders/v0/orders/{orderId}

//// ==== Making of the client and calling the apis ====//
//const spClient = new SellingPartnerAPI({
//    region: 'eu',
//    refresh_token: process.env.SPAPI_REFRESH_TOKEN,
//    credentials: {
//        SELLING_PARTNER_APP_CLIENT_ID: process.env.SPAPI_CLIENT_ID,
//        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.SPAPI_CLIENT_SECRET,
//        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
//        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
//        AWS_SELLING_PARTNER_ROLE: process.env.AWS_ROLE_ARN
//    },
//    options: {
//        use_sandbox: false // LIVE MODE
//    }
//});

//// === Now all the apis will be using the spClient === //
//// === Below is the example == //
///*
//{
//  operation:'<OPERATION_TO_CALL>',
//  endpoint:'<ENDPOINT_OF_OPERATION>',
//  path:{
//    ...
//  },
//  query:{
//    ...
//  },
//  body:{
//    ...
//  },
//  api_path:'<FULL_PATH_OF_OPERATION>',
//  method:'GET',
//  headers:{
//    ...
//  },
//  restricted_data_token:'<RESTRICTED_DATA_TOKEN>',
//  options:{
//    version:'<OPERATION_ENDPOINT_VERSION>',
//    restore_rate:'<RESTORE_RATE_IN_SECONDS>',
//    raw_result:false,
//    timeouts:{
//      ...
//    }
//  }
//}
//  */

//router.get('/orders', async (req, res) => {
//    try {
//        const offset = parseInt(req.query.offset) || 0;

//        // NEW: 12-Hour Math
//        const endDate = new Date();
//        endDate.setHours(endDate.getHours() - (offset * 12));
//        const startDate = new Date(endDate);
//        startDate.setHours(startDate.getHours() - 12);

//        console.log(`\n📥 [GET /orders] Target Time Window: ${startDate.toLocaleString()} to ${endDate.toLocaleString()}`);

//        const queryParams = {
//            MarketplaceIds: ['A21TJRUUN4KGV'], // India
//            CreatedAfter: startDate.toISOString()
//        };

//        if (offset > 0) {
//            queryParams.CreatedBefore = endDate.toISOString();
//        }

//        let allOrders = [];
//        let nextToken = null;
//        let pageCount = 0;

//        console.log(`🚀 Starting loop to outsmart Amazon's Oldest-First sorting...`);

//        // 2. Loop to collect the ENTIRE day's worth of orders
//        do {
//            pageCount++;
//            if (nextToken) queryParams.NextToken = nextToken;

//            const response = await spClient.callAPI({
//                operation: 'getOrders',
//                endpoint: 'orders',
//                query: queryParams
//            });

//            const fetchedOrders = response?.payload?.Orders || response?.Orders || [];
//            allOrders = allOrders.concat(fetchedOrders);
//            nextToken = response?.payload?.NextToken || response?.NextToken || null;

//            console.log(`   📦 Collected page ${pageCount} (${fetchedOrders.length} orders)...`);

//            if (pageCount >= 5) break; // Safety cap
//        } while (nextToken);

//        // 3. THE MASTER SORT: Forces the absolute newest orders in the 24h window to the top
//        allOrders.sort((a, b) => new Date(b.PurchaseDate) - new Date(a.PurchaseDate));

//        console.log(`✅ COMPLETE: Sent ${allOrders.length} perfectly sorted orders to React.`);

//        res.json({
//            status: "Success",
//            amazonData: { Orders: allOrders },
//            nextOffset: offset + 1 // Tells React to fetch the previous day next time
//        });

//    } catch (error) {
//        console.error("\n❌ [GET /orders] FATAL ERROR:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

//// Fetch Actual Items/SKUs for a specific order
//router.get('/order-items/:orderId', async (req, res) => {
//    try {
//        const orderId = req.params.orderId;
//        // console.log(`⏳ Fetching SKUs for Order: ${orderId}...`);

//        const response = await spClient.callAPI({
//            operation: 'getOrderItems',
//            endpoint: 'orders',
//            path: { orderId: orderId }
//        });

//        const extractedItems = response.payload?.OrderItems || response.OrderItems || [];

//        res.json({
//            status: "Success",
//            orderId: orderId,
//            items: extractedItems
//        });

//    } catch (error) {
//        console.error(`❌ Amazon API Error for ${req.params.orderId}:`, error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});


//// Get Shipping Quotes & Pickup Dates (Step 1 of Shipping)
//router.post('/shipping-quotes', async (req, res) => {
//    try {
//        // These come from the React Shipping Modal we built!
//        const { orderId, weightGrams, length, width, height, items } = req.body;

//        console.log(`\n🚚 Requesting Amazon Shipping Quotes for ${orderId}...`);

//        // Amazon strictly requires the exact physical address the truck is driving to.
//        // For now, we hardcode your client's warehouse. Later, this can come from ERPNext.
//        const myWarehouseAddress = {
//            Name: "Mithila Foods Warehouse",
//            AddressLine1: "Plot No 42, Industrial Area",
//            City: "Mumbai",
//            StateOrProvinceCode: "MH",
//            PostalCode: "400001",
//            CountryCode: "IN",
//            Email: "dispatch@mithilafoods.com",
//            Phone: "+919876543210"
//        };

//        // Format the items exactly how Amazon requires them for shipping
//        const formattedItems = items.map(item => ({
//            OrderItemId: item.OrderItemId,
//            Quantity: item.QuantityOrdered
//        }));

//        const response = await spClient.callAPI({
//            operation: 'getEligibleShipmentServices',
//            endpoint: 'merchantFulfillment',
//            body: {
//                ShipmentRequestDetails: {
//                    AmazonOrderId: orderId,
//                    ItemList: formattedItems,
//                    ShipFromAddress: myWarehouseAddress,
//                    PackageDimensions: {
//                        Length: length,
//                        Width: width,
//                        Height: height,
//                        Unit: "centimeters" // Must be exactly "centimeters" or "inches"
//                    },
//                    Weight: {
//                        Value: weightGrams,
//                        Unit: "g" // "g" for grams, "oz" for ounces
//                    },
//                    ShippingServiceOptions: {
//                        DeliveryExperience: "DeliveryConfirmationWithoutSignature",
//                        CarrierWillPickUp: true // Tells Amazon to send a truck
//                    }
//                }
//            }
//        });

//        // Amazon sends back a list of valid shipping options (ATS, Bluedart, etc.)
//        const shippingServices = response?.payload?.ShippingServiceList || response?.ShippingServiceList || [];

//        console.log(`✅ Found ${shippingServices.length} eligible shipping services.`);

//        res.json({
//            status: "Success",
//            quotes: shippingServices
//        });

//    } catch (error) {
//        console.error("❌ Amazon Shipping Quote Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

//// 4. Buy the Label & Schedule Pickup (Step 2 of Shipping)
//router.post('/create-shipment', async (req, res) => {
//    try {
//        // We need the original box details PLUS the specific service ID the user chose
//        const { orderId, weightGrams, length, width, height, items, shippingServiceId } = req.body;

//        console.log(`\n💳 Purchasing Shipping Label for ${orderId}...`);
//        console.log(`📦 Selected Courier Service ID: ${shippingServiceId}`);

//        // Must match the exact address we used for the quote
//        const myWarehouseAddress = {
//            Name: "Mithila Foods Warehouse",
//            AddressLine1: "Plot No 42, Industrial Area",
//            City: "Mumbai",
//            StateOrProvinceCode: "MH",
//            PostalCode: "400001",
//            CountryCode: "IN",
//            Email: "dispatch@mithilafoods.com",
//            Phone: "+919876543210"
//        };

//        const formattedItems = items.map(item => ({
//            OrderItemId: item.OrderItemId,
//            Quantity: item.QuantityOrdered
//        }));

//        const response = await spClient.callAPI({
//            operation: 'createShipment',
//            endpoint: 'merchantFulfillment',
//            body: {
//                ShipmentRequestDetails: {
//                    AmazonOrderId: orderId,
//                    ItemList: formattedItems,
//                    ShipFromAddress: myWarehouseAddress,
//                    PackageDimensions: { Length: length, Width: width, Height: height, Unit: "centimeters" },
//                    Weight: { Value: weightGrams, Unit: "g" },
//                    ShippingServiceOptions: {
//                        DeliveryExperience: "DeliveryConfirmationWithoutSignature",
//                        CarrierWillPickUp: true
//                    }
//                },
//                ShippingServiceId: shippingServiceId // 💡 Here is the confirmed choice!
//            }
//        });

//        // Amazon buries the actual PDF label deep inside the response
//        const shipment = response?.payload?.Shipment || response?.Shipment;
//        const trackingNumber = shipment?.TrackingId;

//        // This is a massive string of random characters (Base64) representing the PDF file
//        const labelBase64 = shipment?.Label?.FileContents?.Contents;

//        console.log(`✅ SUCCESS! Label generated. Tracking Number: ${trackingNumber}`);

//        // Send the tracking number and the PDF string back to the React frontend
//        res.json({
//            status: "Success",
//            trackingNumber: trackingNumber,
//            labelBase64: labelBase64
//        });

//    } catch (error) {
//        console.error("❌ Amazon Label Purchase Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});
//// ==========================================
//// 🛡️ SAFE MODE: Mock Bulk Shipping Endpoint
//// ==========================================
//router.post('/test-bulk-shipment', async (req, res) => {
//    try {
//        const { orderId } = req.body;
//        console.log(`\n🛡️ SAFE MODE: Simulating label purchase for Order: ${orderId}`);

//        // Simulate Amazon processing time (1.5 seconds)
//        await new Promise(resolve => setTimeout(resolve, 1500));

//        // A microscopic, valid Base64 PDF string for testing
//        const dummyBase64PDF = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCjEzIDAgb2JqCiAgICA+PgogID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgoyNyAwIG9iago+PgplbmRvYmoKCjUgMCBvYmoKPDwgL0xlbmd0aCAzOCA+PgpzdHJlYW0KQlQKICAvRjEgMTggVGYKICA1MCAxMDAgVGQKICAoVEVTVCBMQUJFTCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjcyIDAwMDAwIG4gCjAwMDAwMDAzNjAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQ5CiUlRU9GCg==";

//        res.json({
//            status: "Success",
//            trackingNumber: `MOCK-TRK-${Math.floor(Math.random() * 90000) + 10000}`,
//            labelBase64: dummyBase64PDF
//        });

//    } catch (error) {
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

////// ISOLATED TEST: Mock Buy Shipping & Generate PDF (100% SAFE)
////router.post('/test-ship-order', async (req, res) => {
////    try {
////        console.log("🛡️ SAFE MODE: Simulating Amazon Shipping Label Purchase...");

////        // Simulate the time it takes Amazon to process the request (1.5 seconds)
////        await new Promise(resolve => setTimeout(resolve, 1500));

////        // This is a microscopic, valid Base64 string for a blank PDF that says "Test"
////        // It prevents your client's account from actually being charged!
////        const dummyBase64PDF = "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgMjAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCjEzIDAgb2JqCiAgICA+PgogID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgoyNyAwIG9iago+PgplbmRvYmoKCjUgMCBvYmoKPDwgL0xlbmd0aCAzOCA+PgpzdHJlYW0KQlQKICAvRjEgMTggVGYKICA1MCAxMDAgVGQKICAoVEVTVCBMQUJFTCkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNjAgMDAwMDAgbiAKMDAwMDAwMDE0NyAwMDAwMCBuIAowMDAwMDAwMjcyIDAwMDAwIG4gCjAwMDAwMDAzNjAgMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNDQ5CiUlRU9GCg==";

////        console.log("✅ SAFE MODE: Dummy Label Generated!");

////        // We return the data in the EXACT structure Amazon will eventually use, 
////        // so your frontend code won't have to change later!
////        res.json({
////            status: "Success",
////            message: "This is a safe test label. No money was charged.",
////            shippingData: {
////                payload: {
////                    Shipment: {
////                        Label: {
////                            FileContents: {
////                                Contents: dummyBase64PDF
////                            }
////                        }
////                    }
////                }
////            }
////        });

////    } catch (error) {
////        console.error("❌ Test Shipping Error:", error.message);
////        res.status(500).json({ status: "Failed", error: error.message });
////    }
////});

//// ==========================================
//// 📦 FBA INVENTORY: Real-Time Stock Levels
//// ==========================================
//router.get('/fba-inventory', async (req, res) => {
//    try {
//        const nextTokenParam = req.query.nextToken;

//        console.log(`\n📊 [GET /fba-inventory] Fetching live FBA stock...`);

//        let queryParams = {
//            details: 'true', // We need this 'true' to get the exact stock breakdown
//            granularityType: 'Marketplace',
//            granularityId: 'A21TJRUUN4KGV', // India
//            marketplaceIds: 'A21TJRUUN4KGV' // India
//        };

//        // If the user clicks "Load More", we use the token
//        if (nextTokenParam && nextTokenParam !== 'null' && nextTokenParam !== 'undefined') {
//            queryParams.nextToken = nextTokenParam;
//        }

//        const response = await spClient.callAPI({
//            operation: 'getInventorySummaries',
//            endpoint: 'fbaInventory',
//            query: queryParams
//        });

//        // Extract the array of SKUs and the pagination token
//        const inventoryList = response?.payload?.inventorySummaries || response?.inventorySummaries || [];
//        const returnedNextToken = response?.payload?.nextToken || response?.nextToken || null;

//        console.log(`✅ FBA Inventory retrieved: ${inventoryList.length} SKUs found.`);

//        res.json({
//            status: "Success",
//            inventory: inventoryList,
//            nextToken: returnedNextToken
//        });

//    } catch (error) {
//        console.error("\n❌ [GET /fba-inventory] Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});


//// ==========================================
//// 💰 FINANCES: Next Payout & Real P&L Breakdown (LIVE DATA ONLY)
//// ==========================================
//router.get('/finances/next-payout', async (req, res) => {
//    try {
//        // 1. Dynamic Date Logic: Get the 1st day of the CURRENT month
//        const today = new Date();
//        const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        
//        console.log(`\n💰 [GET /finances/next-payout] Fetching live Amazon payouts for the past ${today.getDate()} days of this month...`);

//        const groupResponse = await spClient.callAPI({
//            operation: 'listFinancialEventGroups',
//            endpoint: 'finances',
//            query: { 
//                FinancialEventGroupStartedAfter: startDate.toISOString(), 
//                MaxResultsPerPage: 100 // Safely grab all groups for the month
//            }
//        });

//        const groups = groupResponse?.payload?.FinancialEventGroupList || groupResponse?.FinancialEventGroupList || [];

//        // Find the open one, or fallback to the most recent closed one
//        let nextPayout = groups.find(g => g.ProcessingStatus === 'Open');
//        if (!nextPayout && groups.length > 0) nextPayout = groups[0];

//        if (!nextPayout) {
//            console.log("No financial groups found for this account this month.");
//            return res.json({ status: "Success", payout: null, breakdown: null, accountReserve: 0 });
//        }

//        const groupId = nextPayout.FinancialEventGroupId;
//        let grossSales = 0;
//        let amazonFees = 0;
//        let refunds = 0;

//        // 2. Fetch the specific transactions inside this group to calculate the breakdown
//        if (groupId) {
//            console.log(`📊 Fetching exact event breakdown for Group ID: ${groupId}`);

//            const eventResponse = await spClient.callAPI({
//                operation: 'listFinancialEventsByGroupId',
//                endpoint: 'finances',
//                path: { eventGroupId: groupId },
//                query: { MaxResultsPerPage: 100 } 
//            });

//            const events = eventResponse?.payload?.FinancialEvents || eventResponse?.FinancialEvents || {};

//            // A. Sum up normal Shipment Events (Sales and Fees)
//            const shipmentEvents = events.ShipmentEventList || [];
//            shipmentEvents.forEach(shipment => {
//                (shipment.ShipmentItemList || []).forEach(item => {
//                    // Add up the money the customer paid
//                    (item.ItemChargeList || []).forEach(charge => {
//                        if (charge.ChargeAmount?.CurrencyAmount) {
//                            grossSales += charge.ChargeAmount.CurrencyAmount;
//                        }
//                    });
//                    // Add up the fees Amazon took (these come in as negative numbers)
//                    (item.ItemFeeList || []).forEach(fee => {
//                        if (fee.FeeAmount?.CurrencyAmount) {
//                            amazonFees += fee.FeeAmount.CurrencyAmount;
//                        }
//                    });
//                });
//            });

//            // B. Sum up Refund Events
//            const refundEvents = events.RefundEventList || [];
//            refundEvents.forEach(refund => {
//                (refund.ShipmentItemAdjustmentList || []).forEach(item => {
//                    // Money returned to customer (comes in as negative)
//                    (item.ItemChargeAdjustmentList || []).forEach(charge => {
//                        if (charge.ChargeAmount?.CurrencyAmount) {
//                            refunds += charge.ChargeAmount.CurrencyAmount;
//                        }
//                    });
//                    // Amazon refunding their fees to you (comes in as positive)
//                    (item.ItemFeeAdjustmentList || []).forEach(fee => {
//                        if (fee.FeeAmount?.CurrencyAmount) {
//                            amazonFees += fee.FeeAmount.CurrencyAmount;
//                        }
//                    });
//                });
//            });
//        }

//        const breakdown = {
//            grossSales: grossSales,
//            amazonFees: amazonFees,
//            refunds: refunds
//        };

//        // 3. Extract the REAL Account Level Reserve (Zero mock data)
//        const reserveAmount = nextPayout?.AccountLevelReserve?.CurrencyAmount || 0;

//        res.json({
//            status: "Success",
//            payout: nextPayout,
//            breakdown: breakdown,
//            accountReserve: reserveAmount 
//        });

//    } catch (error) {
//        console.error("\n❌ [GET /finances/next-payout] Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

////// ==========================================
////// 🏢 FBA LOCATIONS: MOCK DATA FOR UI TESTING
////// ==========================================
////router.get('/fba-locations', async (req, res) => {
////    try {
////        console.log(`\n📄 [GET /fba-locations] Sending Mock FC Inventory Data...`);

////        // Simulate a tiny network delay so the React "Loading..." state shows for a second
////        await new Promise(resolve => setTimeout(resolve, 800));

////        // Realistic mock data matching the exact columns Amazon's CSV would provide
////        const mockFcData = [
////            { sku: "ALMONDS-500G", fc: "BOM4", location: "Mumbai, MH", fulfillable: 145, reserved: 20 },
////            { sku: "ALMONDS-500G", fc: "PNQ3", location: "Pune, MH", fulfillable: 80, reserved: 5 },
////            { sku: "ALMONDS-500G", fc: "DEL4", location: "Delhi, DL", fulfillable: 12, reserved: 0 },
            
////            { sku: "CASHEW-250G", fc: "BOM4", location: "Mumbai, MH", fulfillable: 210, reserved: 45 },
////            { sku: "CASHEW-250G", fc: "BLR8", location: "Bangalore, KA", fulfillable: 0, reserved: 15 },
            
////            { sku: "WALNUT-200G", fc: "DEL4", location: "Delhi, DL", fulfillable: 55, reserved: 2 }
////        ];

////        res.json({
////            status: "Success",
////            data: mockFcData
////        });

////    } catch (error) {
////        console.error("\n❌ [GET /fba-locations] Error:", error.message);
////        res.status(500).json({ status: "Failed", error: error.message });
////    }
////});

//// ==========================================
//// 🏢 FBA LOCATIONS: LIVE REPORTS API ENGINE
//// ==========================================
//router.get('/fba-locations', async (req, res) => {
//    try {
//        console.log(`\n📄 [GET /fba-locations] Step 1: Requesting Live FC Inventory Report...`);

//        // Step 1: Tell Amazon to generate the report
//        const createReportRes = await spClient.callAPI({
//            operation: 'createReport',
//            endpoint: 'reports',
//            body: {
//                reportType: 'GET_FBA_FULFILLMENT_CURRENT_INVENTORY_DATA',
//                marketplaceIds: ['A21TJRUUN4KGV'] // India Marketplace
//            }
//        });

//        const reportId = createReportRes.reportId || createReportRes.payload?.reportId;
//        if (!reportId) throw new Error("Failed to create report. Amazon did not return a Report ID.");
        
//        console.log(`⏳ Report ID: ${reportId} created. Waiting for Amazon to process...`);

//        // Step 2: Poll Amazon every 5 seconds until the report is DONE
//        let reportStatus = "IN_PROGRESS";
//        let documentId = null;
//        let attempts = 0;

//        // Loop runs until Amazon finishes, or we hit a 60-second timeout
//        while (reportStatus !== "DONE" && reportStatus !== "FATAL" && reportStatus !== "CANCELLED") {
//            attempts++;
//            if (attempts > 12) { 
//                throw new Error("Report generation timed out. Amazon is taking too long.");
//            }

//            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

//            const statusRes = await spClient.callAPI({
//                operation: 'getReport',
//                endpoint: 'reports',
//                path: { reportId: reportId }
//            });

//            reportStatus = statusRes.processingStatus || statusRes.payload?.processingStatus;
//            console.log(`   Attempt ${attempts}: Status is ${reportStatus}...`);

//            if (reportStatus === "DONE") {
//                documentId = statusRes.reportDocumentId || statusRes.payload?.reportDocumentId;
//            }
//        }

//        if (!documentId) throw new Error(`Report failed with status: ${reportStatus}`);

//        console.log(`✅ Step 3: Report DONE! Fetching document URL...`);

//        // Step 3: Get the secure download URL from Amazon
//        const docRes = await spClient.callAPI({
//            operation: 'getReportDocument',
//            endpoint: 'reports',
//            path: { reportDocumentId: documentId }
//        });

//        const downloadUrl = docRes.url || docRes.payload?.url;
        
//        // Step 4: Download the raw text file and parse it into clean JSON
//        console.log(`📥 Downloading and parsing raw file...`);
        
//        // Use native fetch to grab the file content
//        const fileResponse = await fetch(downloadUrl);
//        const rawText = await fileResponse.text();

//        // Amazon sends this specific report as Tab-Separated Values (TSV)
//        Papa.parse(rawText, {
//            delimiter: "\t", // Tell the parser to look for tabs, not commas
//            header: true,
//            skipEmptyLines: true,
//            complete: function(results) {
//                const parsedData = results.data;
                
//                // Map Amazon's ugly column names into the clean keys our React UI expects
//                const formattedData = parsedData.map(row => ({
//                    sku: row.sku,
//                    fc: row['fulfillment-center-id'],
//                    location: "Amazon FC", // This report doesn't provide city/state, just the FC code
//                    fulfillable: parseInt(row['sellable-quantity']) || 0,
//                    reserved: parseInt(row['unsellable-quantity']) || 0 
//                })).filter(item => item.sku && item.fc); // Filter out any broken rows

//                console.log(`🎉 Success! Parsed ${formattedData.length} FC location records.`);
                
//                res.json({
//                    status: "Success",
//                    data: formattedData
//                });
//            }
//        });

//    } catch (error) {
//        console.error("\n❌ [GET /fba-locations] Error:", error.message);
//        res.status(500).json({ status: "Failed", error: error.message });
//    }
//});

//module.exports = router;