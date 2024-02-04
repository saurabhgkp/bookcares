
const stripe = require("stripe")(process.env.STRIPE_KEY);
const Book = require("../models/Book");
const Purchase = require("../models/Purchase");
const uploadEmail = require("../processors/uploadEmail");
// const revenueIncrease = require("../utils/revenueIncrease");
const User = require('../models/usres');
function generatePurchaseId() {
    return `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-1`;
}

const asyncMiddlewareAuth = (handler) => {

    return async (req, res, next) => {
        try {
            console.log(req.body.role, "req.body.role")
            if (req.body.role !== "retailer") {
                return res.status(401).json({
                    status: 0,
                    message: "Request not authorized.",
                });
            }
            await handler(req, res, next);
        } catch (ex) {
            next(ex);
        }
    };
}

exports.createCheckoutSession = asyncMiddlewareAuth(async (req, res) => {

    const { bookId, quantity, userId } = req.body
    console.log(bookId, "bookId");
    let priceRs = await Book.findOne({ _id: bookId }, { price: 1, title: 1, _id: 0 });
    console.log(priceRs.price, "priceRs");
    // Create a Checkout Session for a single book in Indian Rupees (INR)
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'inr', // Set currency to Indian Rupee
                product_data: {
                    name: priceRs.title, // Replace with actual product name
                },

                unit_amount: priceRs.price * 100, // Replace with actual price in paise (e.g., 1000 INR = 100000 paise)
            },
            quantity: quantity || 1, // Default to 1 if quantity is not provided
        }],
        mode: 'payment',
        success_url: 'http://localhost:3000/success', // Replace with your success URL
        cancel_url: 'http://localhost:3000/cancel', // Replace with your cancel URL
        client_reference_id: userId, // Store the userId in the client_reference_id
        // reference_bookId: bookId
    })
    console.log(session.url, "req.body")
    // return res.redirect(303, session.url);
    res.json({ paymentUrl: session.url })
})

exports.webhook = asyncMiddlewareAuth(async (req, res) => {
    const payload = req.body;
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_KEY);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const userId = session.client_reference_id;
            const bookId = session.reference_bookId;
            const price = session.amount_total / 100
            const newPurchase = await Purchase.create({
                purchaseId: generatePurchaseId(),
                bookId: bookId,
                userId: userId,
                price: price,
                quantity: session.display_items[0].quantity,
                purchaseDate: new Date(),
            });
            const book = await Book.findOne({ bookId });
            if (!book) {
                return res.status(404).json({ error: 'Book not found' });
            }
            const revenueIncrease = price //* quantity;
            await Book.updateOne({ bookId }, { $inc: { sellCount: quantity } }); // Assuming sellCount represents the total sold quantity
            const authorsId = book.authorsId; // Assuming authors field is an array of author emails 
            let emails = await User.find({ _id: { $in: authorsId } }, { email: 1, _id: 0 });
            uploadEmail({
                emails,
                subject: "Purchase Notification ", // Subject line
                text: "Dear Author(s)", // plain text body
                html: `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
      <div style="margin:50px auto;width:70%;padding:20px 0">
        <div style="border-bottom:1px solid #eee">
          <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Books Care</a>
        </div>
        <p style="font-size:1.1em">Dear Author(s)</p>
        <p>
          Congratulations! Your book(s) have been purchased.
          Purchase Information:
          - Revenue Increase: $${revenueIncrease.toFixed(2)}

          Thank you for your contribution to our platform.
        
        
        </p>
        <h2 style="background: #4044ee;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">
           
            
            </h2>
        <p style="font-size:0.9em;">Regards,<br />Books Care</p>
        <hr style="border:none;border-top:1px solid #eee" />
        <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
          
          <p>	www.books.care </p><p>	5th Floor, 5A103 , Two Horizon Center, </p><p> Golf Course Road, DLF Phase-5, Sector- 43</p>Gurugram, Haryana-122002<p>
              
          </p>
        </div>
      </div>
    </div>`,
            })
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
    res.status(200).end();
})

