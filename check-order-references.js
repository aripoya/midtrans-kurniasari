// Script to check what's preventing specific orders from being deleted
// Usage: node check-order-references.js

const orderIds = [
  'ORDER-1754706500097-GBPMO',
  'ORDER-1754699525295-57W8S', 
  'ORDER-1753686690947-QERGY',
  'ORDER-1753439340127-DQSXV',
  'ORDER-1752899956004-ZDQCU',
  'ORDER-1752870058566-3ZEQH',
  'ORDER-1752037059362-FLO3E',
  'ORDER-1751868494891-JZXWN'
];

console.log('=== PRODUCTION ORDER DELETION CHECK ===');
console.log('Checking references for these orders:');
orderIds.forEach(id => console.log(`- ${id}`));
console.log('\n');

// This would need to be run in the production environment
// Copy these queries to check in Cloudflare Dashboard > D1 Database

const queries = {
  order_items: `SELECT order_id, COUNT(*) as count FROM order_items WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(',')}) GROUP BY order_id;`,
  
  shipping_images: `SELECT order_id, COUNT(*) as count FROM shipping_images WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(',')}) GROUP BY order_id;`,
  
  notifications: `SELECT order_id, COUNT(*) as count FROM notifications WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(',')}) GROUP BY order_id;`,
  
  audit_logs: `SELECT order_id, COUNT(*) as count FROM audit_logs WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(',')}) GROUP BY order_id;`,
  
  order_update_logs: `SELECT order_id, COUNT(*) as count FROM order_update_logs WHERE order_id IN (${orderIds.map(id => `'${id}'`).join(',')}) GROUP BY order_id;`,
  
  // Check for any other potential tables with order_id references
  all_tables: `SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%order_id%';`
};

console.log('=== COPY THESE QUERIES TO RUN IN CLOUDFLARE DASHBOARD ===\n');

Object.entries(queries).forEach(([table, query]) => {
  console.log(`-- Check ${table} table:`);
  console.log(query);
  console.log('');
});

console.log('=== ADDITIONAL DEBUG QUERIES ===\n');

orderIds.forEach(orderId => {
  console.log(`-- Debug for ${orderId}:`);
  console.log(`SELECT 'orders' as table_name, COUNT(*) as count FROM orders WHERE id = '${orderId}'`);
  console.log(`UNION ALL SELECT 'order_items', COUNT(*) FROM order_items WHERE order_id = '${orderId}'`);
  console.log(`UNION ALL SELECT 'shipping_images', COUNT(*) FROM shipping_images WHERE order_id = '${orderId}'`);
  console.log(`UNION ALL SELECT 'notifications', COUNT(*) FROM notifications WHERE order_id = '${orderId}'`);
  console.log(`UNION ALL SELECT 'audit_logs', COUNT(*) FROM audit_logs WHERE order_id = '${orderId}'`);
  console.log(`UNION ALL SELECT 'order_update_logs', COUNT(*) FROM order_update_logs WHERE order_id = '${orderId}';`);
  console.log('');
});
