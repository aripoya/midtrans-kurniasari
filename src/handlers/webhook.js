// Enhanced webhook handler for production Midtrans integration
import crypto from 'node:crypto';

export async function handleMidtransWebhook(request, env) {
    try {
        const body = await request.text();
        const notification = JSON.parse(body);
        
        // Verify webhook signature
        const serverKey = env.MIDTRANS_SERVER_KEY;
        if (!serverKey) {
            console.error('Midtrans server key not configured');
            return new Response('Server key not configured', { status: 500 });
        }

        // Create signature hash
        const signatureKey = notification.order_id + notification.status_code + notification.gross_amount + serverKey;
        const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');

        if (signature !== notification.signature_key) {
            console.error('Invalid webhook signature');
            return new Response('Invalid signature', { status: 401 });
        }

        // Process notification based on transaction status
        const orderId = notification.order_id;
        const transactionStatus = notification.transaction_status;
        const fraudStatus = notification.fraud_status;

        let paymentStatus = 'pending';

        // Determine payment status based on Midtrans response
        if (transactionStatus === 'capture') {
            if (fraudStatus === 'challenge') {
                paymentStatus = 'challenge';
            } else if (fraudStatus === 'accept') {
                paymentStatus = 'paid';
            }
        } else if (transactionStatus === 'settlement') {
            paymentStatus = 'paid';
        } else if (transactionStatus === 'cancel' || 
                   transactionStatus === 'deny' || 
                   transactionStatus === 'expire') {
            paymentStatus = 'failed';
        } else if (transactionStatus === 'pending') {
            paymentStatus = 'pending';
        } else if (transactionStatus === 'refund') {
            paymentStatus = 'refunded';
        } else if (transactionStatus === 'partial_refund') {
            paymentStatus = 'partial_refund';
        }

        // Update order status in database
        if (env.DB) {
            try {
                await env.DB.prepare(`
                    UPDATE orders 
                    SET payment_status = ?, 
                        payment_response = ?,
                        updated_at = ?
                    WHERE id = ?
                `).bind(
                    paymentStatus,
                    JSON.stringify(notification),
                    new Date().toISOString(),
                    orderId
                ).run();

                console.log(`Order ${orderId} status updated to: ${paymentStatus}`);
            } catch (dbError) {
                console.error('Database update error:', dbError);
            }
        }

        // Optional: Send notification email or trigger other actions
        if (paymentStatus === 'paid') {
            await handleSuccessfulPayment(orderId, notification, env);
        } else if (paymentStatus === 'failed') {
            await handleFailedPayment(orderId, notification, env);
        }

        // Log the webhook for debugging
        console.log('Webhook processed:', {
            orderId,
            transactionStatus,
            paymentStatus,
            timestamp: new Date().toISOString()
        });

        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('Webhook processing error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function handleSuccessfulPayment(orderId, notification, env) {
    try {
        // Get order details
        if (env.DB) {
            const order = await env.DB.prepare(`
                SELECT * FROM orders WHERE id = ?
            `).bind(orderId).first();

            if (order) {
                console.log(`Payment successful for order ${orderId}:`, {
                    customerName: order.customer_name,
                    customerEmail: order.customer_email,
                    amount: order.total_amount
                });

                // Here you can add:
                // - Send confirmation email to customer
                // - Update inventory
                // - Trigger fulfillment process
                // - Send notification to admin
            }
        }
    } catch (error) {
        console.error('Error handling successful payment:', error);
    }
}

async function handleFailedPayment(orderId, notification, env) {
    try {
        // Get order details
        if (env.DB) {
            const order = await env.DB.prepare(`
                SELECT * FROM orders WHERE id = ?
            `).bind(orderId).first();

            if (order) {
                console.log(`Payment failed for order ${orderId}:`, {
                    customerName: order.customer_name,
                    customerEmail: order.customer_email,
                    amount: order.total_amount,
                    reason: notification.status_message
                });

                // Here you can add:
                // - Send payment failure notification to customer
                // - Release reserved inventory
                // - Log for analytics
            }
        }
    } catch (error) {
        console.error('Error handling failed payment:', error);
    }
}

// Utility function to verify Midtrans notification authenticity
export function verifyMidtransSignature(notification, serverKey) {
    const signatureKey = notification.order_id + 
                        notification.status_code + 
                        notification.gross_amount + 
                        serverKey;
    
    const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');
    return signature === notification.signature_key;
}

// Function to check transaction status directly from Midtrans
export async function checkTransactionStatus(orderId, env) {
    try {
        const isProduction = env.MIDTRANS_IS_PRODUCTION === 'true';
        const serverKey = env.MIDTRANS_SERVER_KEY;
        
        if (!serverKey) {
            throw new Error('Midtrans server key not configured');
        }

        const midtransUrl = isProduction 
            ? `https://api.midtrans.com/v2/${orderId}/status`
            : `https://api.sandbox.midtrans.com/v2/${orderId}/status`;

        const midtransAuth = btoa(serverKey + ':');
        
        const response = await fetch(midtransUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${midtransAuth}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Midtrans API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking transaction status:', error);
        throw error;
    }
}

