# Order Management System v1.0.0

A comprehensive order management and administration system for Kurniasari, built with Cloudflare Workers backend and React/TypeScript frontend. Features multi-role authentication, outlet management, delivery tracking, and photo upload capabilities.

## 🚀 Production Deployment

**Backend API**: https://order-management-app-production.wahwooh.workers.dev
**Admin Dashboard**: React/TypeScript application (midtrans-frontend)

### ⚠️ Important: Production Backend Configuration

**The frontend MUST be built to use the production backend environment:**

- ✅ **USE**: `https://order-management-app-production.wahwooh.workers.dev` (Production backend)
- ❌ **DO NOT USE**: `wrangler dev` or local development server for production

**Why Production Backend Only:**
- Production backend has proper JWT secrets configured
- Production database contains actual user data with correct bcrypt hashes
- Production environment has all necessary environment variables and secrets
- Local development server lacks proper authentication setup

**For Windsurf IDE and Development:**
- Frontend configuration is set to **always use production backend**
- No local backend setup required for development
- All API calls go directly to production environment
- This ensures consistent authentication and data access

## ✨ Features

### Admin Dashboard (React/TypeScript)
- **Multi-Role Authentication**: Admin, Outlet Manager, Deliveryman roles
- **Order Management**: Complete CRUD operations for orders and items
- **Outlet Management**: Multi-outlet support with outlet-specific access
- **Delivery Tracking**: Real-time delivery status updates and assignment
- **Photo Upload System**: Cloudflare Images integration for order photos
- **User Management**: Create, update, and manage system users
- **Real-time Notifications**: Live updates for order status changes
- **Audit Trail**: Complete tracking of order status changes with user history
- **Responsive Design**: Modern UI with Chakra UI and Tailwind CSS

### Backend (Cloudflare Workers)
- **RESTful API**: 25+ endpoints for complete system management
- **JWT Authentication**: Role-based access control with session management
- **Multi-Database Support**: D1 Database with relational schema
- **Cloudflare Images**: Professional image upload and optimization
- **Midtrans Integration**: Payment gateway with webhook support
- **Real-time Sync**: Polling-based real-time updates
- **CORS Support**: Cross-origin requests with security headers

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Chakra UI + Tailwind CSS
- **State Management**: React Context + Hooks
- **Authentication**: JWT with role-based routing

### Backend  
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 + Cloudflare Images
- **Authentication**: JWT with bcrypt password hashing
- **Payment**: Midtrans Payment Gateway
- **Deployment**: Cloudflare Pages & Workers

## 📁 Project Structure

```
order-management-app/
├── src/                          # Cloudflare Workers backend
│   ├── worker.js                 # Main worker file
│   └── handlers/
│       ├── orders.js             # Order management handlers
│       ├── auth.js               # Authentication handlers
│       ├── admin.js              # Admin management handlers
│       ├── notifications.js      # Notification handlers
│       ├── cloudflare-images.js  # Image upload handlers
│       └── webhook.js            # Payment webhook handler
├── midtrans-frontend/            # React/TypeScript Admin Dashboard
│   ├── src/                      # Source code
│   │   ├── components/           # React components
│   │   ├── pages/               # Page components
│   │   ├── api/                 # API client services
│   │   └── contexts/            # React contexts
│   ├── public/                  # Static assets
│   └── dist/                    # Built files
├── database-schema-relational.sql # Complete database schema
├── wrangler.toml               # Cloudflare Workers config
├── APP_DOCUMENTATION_COMPREHENSIVE.md # Complete system documentation
├── DEPLOYMENT_GUIDE.md         # Deployment instructions
├── MIDTRANS_GUIDE.md          # Midtrans setup guide
└── TESTING_RESULTS.md         # Testing documentation
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd midtrans-kurniasari
```

### 2. Install Frontend Dependencies
```bash
cd midtrans-frontend
npm install
```

### 3. Frontend Configuration (Production Backend)
**Frontend is pre-configured to use production backend:**
- API URL: `https://order-management-app-production.wahwooh.workers.dev`
- No local backend setup required
- All authentication and data access through production environment

### 4. Start Development Server
```bash
# In midtrans-frontend directory
npm run dev
```

### 5. Access Admin Dashboard
- **URL**: `http://localhost:5173/admin/login`
- **Username**: `admin`
- **Password**: `password123`

### 6. Backend Management (Production Only)
**Backend is managed through Cloudflare Workers:**
```bash
# Deploy backend changes (if needed)
npx wrangler deploy --env production
```

### 5. Deploy Frontend
The frontend is already deployed at: https://tagihan.kurniasari.id

## 📖 API Documentation

### Endpoints

#### Create Order
```http
POST /api/orders
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+6281234567890",
  "items": [
    {
      "name": "Product A",
      "price": 50000,
      "quantity": 2
    }
  ]
}
```

#### Get Orders
```http
GET /api/orders
```

#### Payment Webhook
```http
POST /api/webhook/midtrans
```

## 🔧 Configuration

### Midtrans Setup
1. Register at [Midtrans](https://midtrans.com)
2. Get your Server Key and Client Key
3. Configure webhook URL in Midtrans dashboard
4. Update environment variables

### Database Setup
1. Create D1 database in Cloudflare
2. Run the schema.sql file
3. Update wrangler.toml with database binding

## 🧪 Testing

The application includes:
- ✅ Order creation flow
- ✅ Payment link generation
- ✅ Responsive design testing
- ✅ Form validation
- ✅ Error handling

See `TESTING_RESULTS.md` for detailed test results.

## 📱 Screenshots

### Order Creation Form
![Order Form](https://via.placeholder.com/800x600?text=Order+Creation+Form)

### Order Management Dashboard
![Dashboard](https://via.placeholder.com/800x600?text=Order+Dashboard)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Midtrans](https://midtrans.com) for payment gateway services
- [Cloudflare](https://cloudflare.com) for hosting and edge computing
- [Tailwind CSS](https://tailwindcss.com) for styling framework

## 📞 Support

For support, email support@example.com or create an issue in this repository.

---

**Made with ❤️ for modern order management**

