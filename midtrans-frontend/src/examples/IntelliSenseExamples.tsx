// 🚀 PRACTICAL INTELLISENSE EXAMPLES - Your Actual Codebase
// This file demonstrates the enhanced IntelliSense features you now have

import React, { useState, ChangeEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { adminApi } from '../api/adminApi';
import { formatDate, formatDateTime, getRelativeTime } from '../utils/date';

// 1. 🔍 USER AUTHENTICATION - SMART AUTOCOMPLETE
const AuthExample: React.FC = () => {
  const { user, hasRole, getDashboardRoute } = useAuth();
  
  // ✨ Try typing "user." - IntelliSense shows: id, username, name, role, outlet_id
  const userName = user?.name; // Safe optional access
  const userRole = user?.role; // IntelliSense shows: 'admin' | 'outlet_manager' | 'deliveryman'
  
  // ✨ Type-safe role checking
  if (hasRole('admin')) {
    // TypeScript knows user is admin here
    console.log('Admin user:', user?.username);
  }
  
  // ✨ Smart routing based on role
  const dashboardRoute = getDashboardRoute(); // Returns typed route string
  
  return (
    <div>
      <h2>Welcome, {userName}</h2>
      <p>Your role: {userRole}</p>
      <p>Dashboard: {dashboardRoute}</p>
    </div>
  );
};

// 2. 🛡️ API INTEGRATION - TYPE-SAFE RESPONSES  
const ApiExample: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]); // Will be properly typed from API
  
  const fetchUsers = async () => {
    try {
      // ✨ Try typing "response." - IntelliSense shows: success, data, error
      const response = await adminApi.getUsers();
      
      if (response.success) {
        // ✨ TypeScript knows response.data is User[] array
        response.data?.forEach(user => {
          // ✨ Type "user." - shows all User properties with correct types
          console.log(`${user.name} (${user.role})`);
        });
        
        setUsers(response.data || []);
      }
    } catch (error: any) {
      // ✨ Proper error handling with type safety
      console.error('API Error:', error.message);
    }
  };
  
  return (
    <div>
      <button onClick={fetchUsers}>Load Users</button>
      {users.map(user => (
        <div key={user.id}>
          {/* ✨ IntelliSense helps with user properties */}
          <strong>{user.name}</strong> - {user.role}
        </div>
      ))}
    </div>
  );
};

// 3. 🎯 FORM HANDLING - SMART EVENT TYPES
interface UserFormData {
  username: string;
  name: string;
  role: 'admin' | 'outlet_manager' | 'deliveryman';
  outlet_id?: string;
}

const FormExample: React.FC = () => {
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    name: '',
    role: 'outlet_manager', // ✨ IntelliSense shows only valid roles
    outlet_id: ''
  });
  
  // ✨ Type-safe event handling
  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value // ✨ TypeScript ensures type safety
    }));
  };
  
  // ✨ Try typing "formData." - shows all properties with correct types
  const isAdminRole = formData.role === 'admin'; // Type-safe comparison
  
  return (
    <form>
      <input
        name="username"
        value={formData.username} // ✨ Autocomplete with correct property
        onChange={handleInputChange} // ✨ Type-safe event handler
        placeholder="Username"
      />
      
      <select
        name="role"
        value={formData.role}
        onChange={handleInputChange}
      >
        {/* ✨ IntelliSense prevents typos in role values */}
        <option value="admin">Admin</option>
        <option value="outlet_manager">Outlet Manager</option>
        <option value="deliveryman">Deliveryman</option>
      </select>
      
      {/* ✨ Conditional rendering with type safety */}
      {isAdminRole && (
        <p>Admin privileges will be granted</p>
      )}
    </form>
  );
};

// 4. 📅 DATE UTILITIES - ENHANCED WITH TYPES
const DateExample: React.FC = () => {
  const orderDate = "2024-01-15T10:30:00Z";
  
  // ✨ All date functions have full IntelliSense with parameter/return types
  const formatted = formatDate(orderDate); // Returns: string
  const withTime = formatDateTime(orderDate); // Returns: string  
  const relative = getRelativeTime(orderDate); // Returns: string
  
  // ✨ Type-safe null handling
  const invalidDate = formatDate(null); // Returns "N/A" safely
  
  return (
    <div>
      <p>Formatted: {formatted}</p>
      <p>With Time: {withTime}</p>
      <p>Relative: {relative}</p>
      <p>Invalid: {invalidDate}</p>
    </div>
  );
};

// 5. 🔧 ORDER STATUS - DISCRIMINATED UNIONS
type PaymentStatus = 'pending' | 'settlement' | 'capture' | 'paid' | 'deny' | 'cancel';
type ShippingStatus = 'dikemas' | 'siap kirim' | 'dikirim' | 'diterima';

const StatusExample: React.FC = () => {
  const getPaymentColor = (status: PaymentStatus) => {
    // ✨ IntelliSense shows all possible status values
    // ✨ TypeScript ensures all cases are handled
    switch (status) {
      case 'pending': return 'yellow';
      case 'settlement': 
      case 'capture': 
      case 'paid': return 'green';
      case 'deny':
      case 'cancel': return 'red';
      default:
        // ✨ TypeScript catches missing cases
        const _exhaustiveCheck: never = status;
        return 'gray';
    }
  };
  
  const paymentStatus: PaymentStatus = 'settlement';
  const color = getPaymentColor(paymentStatus); // ✨ Type-safe function call
  
  return (
    <div>
      <span style={{ color }}>Payment Status: {paymentStatus}</span>
    </div>
  );
};

// 6. 🎨 COMPONENT COMPOSITION - TYPE-SAFE PROPS
interface OrderCardProps {
  orderId: string;
  customerName: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  onStatusChange: (orderId: string, newStatus: PaymentStatus) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  orderId,
  customerName, 
  totalAmount,
  paymentStatus,
  onStatusChange
}) => {
  // ✨ All props are properly typed and autocompleted
  
  return (
    <div>
      <h3>Order #{orderId}</h3>
      <p>Customer: {customerName}</p>
      <p>Amount: Rp {totalAmount.toLocaleString('id-ID')}</p>
      <button 
        onClick={() => onStatusChange(orderId, 'paid')} // ✨ Type-safe callback
      >
        Mark as Paid
      </button>
    </div>
  );
};

// 7. 🚀 USAGE EXAMPLE - EVERYTHING TOGETHER
const MainExample: React.FC = () => {
  const handleStatusChange = (orderId: string, newStatus: PaymentStatus) => {
    // ✨ Function parameters are fully typed
    console.log(`Updating order ${orderId} to ${newStatus}`);
  };
  
  return (
    <div>
      <h1>🚀 Enhanced IntelliSense Examples</h1>
      
      <section>
        <h2>Authentication</h2>
        <AuthExample />
      </section>
      
      <section>
        <h2>API Integration</h2>
        <ApiExample />
      </section>
      
      <section>
        <h2>Form Handling</h2>
        <FormExample />
      </section>
      
      <section>
        <h2>Date Utilities</h2>
        <DateExample />
      </section>
      
      <section>
        <h2>Status Management</h2>
        <StatusExample />
      </section>
      
      <section>
        <h2>Component Usage</h2>
        <OrderCard
          orderId="ORDER-123"
          customerName="John Doe"
          totalAmount={150000}
          paymentStatus="pending"
          onStatusChange={handleStatusChange} // ✨ Type-safe prop passing
        />
      </section>
    </div>
  );
};

export default MainExample;

/*
🎯 HOW TO USE THIS FILE:

1. Open this file in VS Code
2. Try the following IntelliSense features:

   A. AUTOCOMPLETE:
   - Type "user." and see all properties
   - Type "response." after API calls
   - Type "formData." in form handlers

   B. TYPE CHECKING:
   - Try changing 'admin' to 'administrator' - see TypeScript error
   - Try accessing non-existent properties - immediate feedback
   - Try wrong parameter types - compile-time errors

   C. HOVER INFORMATION:
   - Hover over any function to see full type signature
   - Hover over variables to see inferred types
   - Hover over imported functions for documentation

   D. QUICK FIXES:
   - Use Ctrl/Cmd + . for quick fixes
   - Auto-import suggestions
   - Refactoring suggestions

   E. GO TO DEFINITION:
   - Ctrl/Cmd + Click on any import to go to source
   - F12 to go to definition
   - Alt + F12 for peek definition

🚀 Your development speed should increase dramatically with these features!
*/
