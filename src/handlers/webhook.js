// Enhanced webhook handler for production Midtrans integration
import crypto from 'node:crypto';

// Centralized function to update order status from a Midtrans notification/status object
export async function updateOrderStatusFromMidtrans(notification, env) {
    console.log('[Webhook Handler] Received notification for update:', JSON.stringify(notification, null, 2));
    const { order_id: orderId, transaction_status: transactionStatus, fraud_status: fraudStatus } = notification;

    let paymentStatus = 'pending';
    if (transactionStatus === 'capture') {
        if (fraudStatus === 'challenge') {
            paymentStatus = 'challenge';
        } else if (fraudStatus === 'accept') {
            paymentStatus = 'paid';
        }
    } else if (transactionStatus === 'settlement') {
        paymentStatus = 'paid';
    } else if (['cancel', 'deny', 'expire'].includes(transactionStatus)) {
        paymentStatus = 'failed';
    } else if (transactionStatus === 'pending') {
        paymentStatus = 'pending';
    } else if (transactionStatus === 'refund' || transactionStatus === 'partial_refund') {
        paymentStatus = 'refunded';
    }

    console.log(`[Webhook Handler] Determined internal payment status: '${paymentStatus}' for order: ${orderId}`);

    if (env.DB) {
        try {
            console.log(`[Webhook Handler] Attempting to update database for order ${orderId}...`);
            // NOTE: The 'status' and 'payment_response' columns were removed from this query
            // because they do not exist in the current D1 production database schema.
            const info = await env.DB.prepare(`
                UPDATE orders 
                SET payment_status = ?,
                    updated_at = ?
                WHERE id = ?
            `).bind(
                paymentStatus,
                new Date().toISOString(),
                orderId
            ).run();

            console.log('[Webhook Handler] Database update result:', JSON.stringify(info, null, 2));

            if (info.success && info.meta.rows_written > 0) {
                 console.log(`[Webhook Handler] Successfully updated ${info.meta.rows_written} row(s) for order ${orderId}.`);
            } else if (info.success) {
                 console.warn(`[Webhook Handler] DB update for order ${orderId} reported success, but no rows were written. This might happen if the status was already correct.`, info);
            } else {
                 console.error(`[Webhook Handler] DB update for order ${orderId} failed.`, info);
            }

            if (paymentStatus === 'paid') {
                await handleSuccessfulPayment(orderId, notification, env);
            } else if (paymentStatus === 'failed') {
                await handleFailedPayment(orderId, notification, env);
            }

            return { success: true, payment_status: paymentStatus, transaction_status: transactionStatus };
        } catch (dbError) {
            console.error(`[Webhook Handler] FATAL: Database update failed for order ${orderId}:`, dbError);
            return { success: false, error: dbError.message, payment_status: paymentStatus, transaction_status: transactionStatus };
        }
    } else {
        console.error('[Webhook Handler] FATAL: DB environment not available!');
        return { success: false, error: 'Database connection not available', payment_status: paymentStatus, transaction_status: transactionStatus };
    }
}

export async function handleMidtransWebhook(request, env) {
    try {
        console.log('[WEBHOOK] Received webhook notification');
        const notification = await request.json();
        console.log('[WEBHOOK] Request body:', notification);

        // Verify webhook signature
        const serverKey = env.MIDTRANS_SERVER_KEY;
        if (!serverKey) {
            console.error('[WEBHOOK] Midtrans server key not configured');
            return new Response('Server key not configured', { status: 500 });
        }

        const signatureKey = notification.order_id + notification.status_code + notification.gross_amount + serverKey;
        const signature = crypto.createHash('sha512').update(signatureKey).digest('hex');

        if (signature !== notification.signature_key) {
            console.error('[WEBHOOK] Invalid webhook signature');
            return new Response('Invalid signature', { status: 401 });
        }

        // Process notification using the new reusable function
        const updateResult = await updateOrderStatusFromMidtrans(notification, env);

        if (updateResult.success) {
            console.log(`[WEBHOOK] Successfully processed webhook for order ${notification.order_id}. Status: ${updateResult.paymentStatus}`);
            return new Response('OK', { status: 200 });
        } else {
            console.error(`[WEBHOOK] Failed to process webhook for order ${notification.order_id}:`, updateResult.error);
            return new Response('Webhook processing failed', { status: 500 });
        }

    } catch (error) {
        console.error('[WEBHOOK] Webhook processing error:', error);
        if (error instanceof SyntaxError) {
             return new Response('Invalid JSON body', { status: 400 });
        }
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

        // Use TextEncoder and btoa for Base64 encoding in Cloudflare Workers
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

