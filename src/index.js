{{ ... }}
  // Debug routes for development
  app.get('/api/debug/list-orders', withApiAuth(debug.listAllOrders));
  app.get('/api/debug/list-order-ids', withApiAuth(debug.listOrderIds));
  app.get('/api/debug/reset-delivery-password', withApiAuth(debug.resetDeliveryPassword));
  app.get('/api/debug/assign-delivery-orders', withApiAuth(debug.assignDeliveryOrders));
  app.get('/api/debug/delivery-assignments', withApiAuth(debug.listDeliveryAssignments));
  app.get('/api/debug/test-login', withApiAuth(debug.testLogin));
  // Debug order details tanpa autentikasi
  app.get('/api/debug/order-details', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    debug.debugOrderDetails(req, res, next);
  });
{{ ... }}
