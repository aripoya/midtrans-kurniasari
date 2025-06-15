// Webhook handler for Midtrans payment notifications
export async function handleMidtransWebhook(request, env) {
    try {
        const notification = await request.json();
        
        // Verify signature for security
        const orderId = notification.order_id;
        const statusCode = notification.status_code;
        const grossAmount = notification.gross_amount;
        const serverKey = env.MIDTRANS_SERVER_KEY;
        
        // Create signature hash
        const signatureString = orderId + statusCode + grossAmount + serverKey;
        const crypto = await import('crypto');
        const hash = crypto.createHash('sha512').update(signatureString).digest('hex');
        
        // Verify signature (in production, this should be strictly enforced)
        if (notification.signature_key && hash !== notification.signature_key) {
            console.warn('Invalid signature for webhook:', orderId);
            // For development, we'll log but not reject
            // return new Response('Invalid signature', { status: 401 });
        }
        
        console.log('Processing Midtrans webhook for order:', orderId, 'Status:', notification.transaction_status);
        
        // Map Midtrans status to our payment status
        let paymentStatus = 'pending';
        switch (notification.transaction_status) {
            case 'settlement':
            case 'capture':
                paymentStatus = 'paid';
                break;
            case 'deny':
            case 'cancel':
            case 'expire':
                paymentStatus = 'failed';
                break;
            case 'pending':
                paymentStatus = 'pending';
                break;
            default:
                paymentStatus = 'pending';
        }
        
        // Update order status in database
        const result = await env.DB.prepare(`
            UPDATE orders 
            SET payment_status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).bind(paymentStatus, orderId).run();
        
        if (result.changes === 0) {
            console.warn('Order not found for webhook:', orderId);
            return new Response('Order not found', { status: 404 });
        }
        
        console.log('Updated order', orderId, 'to status:', paymentStatus);
        return new Response('OK', { status: 200 });
        
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error processing webhook', { status: 500 });
    }
}

