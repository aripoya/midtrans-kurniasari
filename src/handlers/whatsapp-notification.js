/**
 * WhatsApp Notification Handler
 * Sends notifications to outlets when new orders are created
 */

/**
 * Send WhatsApp notification to outlet
 * @param {string} phoneNumber - Outlet phone number (format: 628xxx)
 * @param {object} orderData - Order information
 * @param {object} env - Environment variables
 */
export async function sendOutletWhatsAppNotification(phoneNumber, orderData, env) {
  try {
    // Validate phone number format
    if (!phoneNumber) {
      console.warn('⚠️ No phone number provided for WhatsApp notification');
      return { success: false, error: 'No phone number' };
    }

    // Normalize phone number to international format (628xxx)
    let normalizedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = '62' + normalizedPhone.substring(1);
    } else if (!normalizedPhone.startsWith('62')) {
      normalizedPhone = '62' + normalizedPhone;
    }

    // Format order details for WhatsApp message
    const message = formatOrderNotificationMessage(orderData);

    console.log('📱 Sending WhatsApp notification:', {
      phone: normalizedPhone,
      orderId: orderData.orderId,
      outletName: orderData.outletName
    });

    // Check if WhatsApp API credentials are configured
    const waApiUrl = env.WHATSAPP_API_URL;
    const waApiToken = env.WHATSAPP_API_TOKEN;

    if (!waApiUrl || !waApiToken) {
      console.warn('⚠️ WhatsApp API not configured. Skipping notification.');
      console.log('📝 Message that would be sent:', message);
      return { success: false, error: 'WhatsApp API not configured' };
    }

    // Detect API type based on URL
    const isFacebookAPI = waApiUrl.includes('graph.facebook.com');
    const isTwilioAPI = waApiUrl.includes('twilio.com');
    
    let requestBody;
    let requestHeaders = {
      'Content-Type': 'application/json'
    };

    if (isFacebookAPI) {
      // Meta Cloud API format
      requestHeaders['Authorization'] = `Bearer ${waApiToken}`;
      requestBody = {
        messaging_product: 'whatsapp',
        to: normalizedPhone,
        type: 'text',
        text: { body: message }
      };
    } else if (isTwilioAPI) {
      // Twilio API format
      const [accountSid] = waApiUrl.match(/Accounts\/([^\/]+)/) || [];
      requestHeaders['Authorization'] = `Basic ${btoa(`${accountSid}:${waApiToken}`)}`;
      requestBody = {
        To: `whatsapp:+${normalizedPhone}`,
        From: env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
        Body: message
      };
    } else {
      // Generic API format (Fonnte, Wablas, etc)
      requestHeaders['Authorization'] = `Bearer ${waApiToken}`;
      requestBody = {
        phone: normalizedPhone,
        message: message,
        type: 'text'
      };
    }

    // Send WhatsApp message via API
    console.log('📤 Sending request to WhatsApp API:', {
      url: waApiUrl,
      phone: normalizedPhone,
      messagePreview: message.substring(0, 100) + '...'
    });

    const response = await fetch(waApiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    console.log('📥 WhatsApp API Response:', {
      status: response.status,
      ok: response.ok,
      data: responseData
    });

    if (!response.ok) {
      console.error('❌ WhatsApp API error:', {
        status: response.status,
        statusText: response.statusText,
        response: responseData
      });
      return { success: false, error: responseData.message || responseData.error?.message || 'WhatsApp API error', details: responseData };
    }

    console.log('✅ WhatsApp notification sent successfully:', {
      phone: normalizedPhone,
      orderId: orderData.orderId,
      responseData
    });

    return { success: true, data: responseData };

  } catch (error) {
    console.error('❌ Error sending WhatsApp notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Format order data into WhatsApp message
 * @param {object} orderData - Order information
 * @returns {string} Formatted message
 */
function formatOrderNotificationMessage(orderData) {
  const {
    orderId,
    customerName,
    customerPhone,
    totalAmount,
    outletName,
    lokasi_pengiriman,
    shipping_area,
    tipe_pesanan,
    items = []
  } = orderData;

  // Format items list
  let itemsList = '';
  if (items && items.length > 0) {
    itemsList = items.map((item, index) => 
      `${index + 1}. ${item.name} - ${item.quantity}x @ Rp ${Number(item.product_price || item.price).toLocaleString('id-ID')}`
    ).join('\n');
  }

  // Build message
  const message = `
🔔 *PESANAN BARU MASUK*

📦 *Order ID:* ${orderId}
🏪 *Outlet:* ${outletName || 'N/A'}

👤 *Pelanggan:*
Nama: ${customerName}
Telepon: ${customerPhone || '-'}

📍 *Pengiriman:*
Tipe: ${tipe_pesanan || 'Pesan Antar'}
Area: ${shipping_area || 'Dalam Kota'}
Lokasi: ${lokasi_pengiriman || '-'}

🛒 *Produk:*
${itemsList || 'Tidak ada detail produk'}

💰 *Total:* Rp ${Number(totalAmount).toLocaleString('id-ID')}

⏰ Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

Silakan cek dashboard untuk detail lengkap dan proses pesanan ini.
`.trim();

  return message;
}

/**
 * Get outlet phone number from database
 * @param {string} outletId - Outlet ID
 * @param {object} env - Environment variables
 * @returns {Promise<string|null>} Phone number or null
 */
export async function getOutletPhoneNumber(outletId, env) {
  try {
    if (!outletId || !env.DB) {
      return null;
    }

    // Try to get phone from outlets_unified table
    const outlet = await env.DB.prepare(
      'SELECT phone FROM outlets_unified WHERE id = ?'
    ).bind(outletId).first();

    if (outlet && outlet.phone) {
      return outlet.phone;
    }

    // Fallback: try to get phone from users table (outlet manager)
    const manager = await env.DB.prepare(
      'SELECT phone FROM users WHERE outlet_id = ? AND role = ? LIMIT 1'
    ).bind(outletId, 'outlet_manager').first();

    return manager?.phone || null;

  } catch (error) {
    console.error('Error getting outlet phone number:', error);
    return null;
  }
}

/**
 * Send notification to multiple outlets
 * @param {Array<string>} outletIds - Array of outlet IDs
 * @param {object} orderData - Order information
 * @param {object} env - Environment variables
 */
export async function sendMultipleOutletNotifications(outletIds, orderData, env) {
  const results = [];

  for (const outletId of outletIds) {
    try {
      const phoneNumber = await getOutletPhoneNumber(outletId, env);
      
      if (!phoneNumber) {
        console.warn(`⚠️ No phone number found for outlet: ${outletId}`);
        results.push({ outletId, success: false, error: 'No phone number' });
        continue;
      }

      const result = await sendOutletWhatsAppNotification(phoneNumber, orderData, env);
      results.push({ outletId, ...result });

    } catch (error) {
      console.error(`Error sending notification to outlet ${outletId}:`, error);
      results.push({ outletId, success: false, error: error.message });
    }
  }

  return results;
}
