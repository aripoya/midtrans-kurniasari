// Function for updating shipping status using adminApi
const handleUpdateStatus = async (id, shippingStatus, adminNote, shippingArea, pickupMethod, adminApi, setIsUpdating, setOrder, setSavedAdminNote, toast) => {
  setIsUpdating(true);
  try {
    // Normalisasi nilai untuk memastikan sesuai dengan ekspektasi backend
    // Backend mengharapkan nilai string yang valid atau null, bukan undefined
    const normalizedStatus = shippingStatus?.trim() || null;
    const normalizedAdminNote = adminNote?.trim() || null;
    const normalizedShippingArea = shippingArea?.trim() || null;
    const normalizedPickupMethod = 
      normalizedShippingArea === 'dalam-kota' && pickupMethod ? pickupMethod.trim() : null;
    
    // Validasi status sebelum mengirim ke server
    const allowedStatuses = ['dikemas', 'siap kirim', 'sedang dikirim', 'received'];
    if (normalizedStatus && !allowedStatuses.includes(normalizedStatus)) {
      throw new Error(`Status tidak valid. Nilai yang diperbolehkan: ${allowedStatuses.join(', ')}`);
    }
    
    // Validasi shipping area
    const allowedShippingAreas = ['dalam-kota', 'luar-kota'];
    if (normalizedShippingArea && !allowedShippingAreas.includes(normalizedShippingArea)) {
      throw new Error(`Area pengiriman tidak valid. Nilai yang diperbolehkan: ${allowedShippingAreas.join(', ')}`);
    }
    
    // Validasi pickup method jika shipping area adalah dalam-kota
    if (normalizedShippingArea === 'dalam-kota') {
      const allowedPickupMethods = ['sendiri', 'ojek-online'];
      if (normalizedPickupMethod && !allowedPickupMethods.includes(normalizedPickupMethod)) {
        throw new Error(`Metode pengambilan tidak valid. Nilai yang diperbolehkan: ${allowedPickupMethods.join(', ')}`);
      }
    }
    
    // Buat objek data dengan nilai yang sudah dinormalisasi dan validasi
    const shippingData = {};
    
    // Hanya tambahkan field yang memiliki nilai
    if (normalizedStatus) shippingData.status = normalizedStatus;
    if (normalizedAdminNote !== null) shippingData.admin_note = normalizedAdminNote;
    if (normalizedShippingArea) shippingData.shipping_area = normalizedShippingArea;
    if (normalizedPickupMethod) shippingData.pickup_method = normalizedPickupMethod;
    
    // Validasi apakah ada data yang akan diupdate
    if (Object.keys(shippingData).length === 0) {
      throw new Error('Tidak ada data yang diubah. Masukkan minimal satu field untuk diperbarui.');
    }
    
    console.log('Mengirim data update ke server:', {
      orderId: id,
      shippingData
    });
    
    // Debugging: tampilkan URL yang akan dipanggil
    console.log(`API URL: ${import.meta.env.VITE_API_BASE_URL}/api/orders/${id}/details`);
    
    const response = await adminApi.updateOrderDetails(id, shippingData);
    console.log('Response dari server:', response);
    
    if (response.error) {
      console.error('Error response dari server:', response.error);
      throw new Error(response.error);
    }

    // Update local state if successful
    setOrder(prev => {
      const updated = {
        ...prev,
        shipping_status: normalizedStatus || prev.shipping_status,
        shipping_area: normalizedShippingArea || prev.shipping_area,
        pickup_method: normalizedPickupMethod || prev.pickup_method
      };
      console.log('State order diperbarui:', updated);
      return updated;
    });
    setSavedAdminNote(normalizedAdminNote || '');
    
    // Show success notification
    toast({
      title: "Status pesanan berhasil diperbarui",
      description: `Data pesanan berhasil diperbarui`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  } catch (err) {
    console.error('Error saat memperbarui status pesanan:', err);
    toast({
      title: "Gagal memperbarui informasi pesanan",
      description: err.message || 'Terjadi kesalahan pada server',
      status: "error",
      duration: 5000,
      isClosable: true,
    });
  } finally {
    setIsUpdating(false);
  }
};

export default handleUpdateStatus;
