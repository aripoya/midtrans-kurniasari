<<<<<<< HEAD
# Order Management System

A modern order management application with Midtrans payment gateway integration, built with Cloudflare Workers and a responsive frontend.

## 🚀 Live Demo

**Frontend Application**: https://lxdpofbi.manus.space

## ✨ Features

### Frontend
- **Modern UI/UX**: Beautiful gradient design with responsive layout
- **Order Creation**: Easy-to-use form for creating new orders
- **Item Management**: Add/remove multiple items with automatic total calculation
- **Order Dashboard**: View and manage all orders with status tracking
- **Payment Integration**: Simulated Midtrans payment link generation
- **Real-time Notifications**: User feedback for all actions
- **Mobile Responsive**: Works perfectly on all device sizes

### Backend (Cloudflare Workers)
- **RESTful API**: Complete order management endpoints
- **Midtrans Integration**: Payment gateway integration with webhook support
- **Database Schema**: D1 database setup for orders and items
- **CORS Support**: Cross-origin requests enabled
- **Security**: Webhook signature verification

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Tailwind), Vanilla JavaScript
- **Backend**: Cloudflare Workers, D1 Database
- **Payment**: Midtrans Payment Gateway
- **Deployment**: Cloudflare Pages & Workers

## 📁 Project Structure

```
order-management-app/
├── src/                          # Cloudflare Workers backend
│   ├── worker.js                 # Main worker file
│   └── handlers/
│       ├── orders.js             # Order management handlers
│       └── webhook.js            # Payment webhook handler
├── order-management-frontend/    # Frontend application
│   ├── index.html               # Main HTML file (working version)
│   ├── src/                     # React source (alternative)
│   └── dist/                    # Built files
├── schema.sql                   # Database schema
├── wrangler.toml               # Cloudflare Workers config
├── DEPLOYMENT_GUIDE.md         # Deployment instructions
├── MIDTRANS_GUIDE.md          # Midtrans setup guide
└── TESTING_RESULTS.md         # Testing documentation
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd order-management-app
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Create `.env` file with your Midtrans credentials:
```env
MIDTRANS_SERVER_KEY=your_server_key
MIDTRANS_CLIENT_KEY=your_client_key
MIDTRANS_IS_PRODUCTION=false
```

### 4. Deploy Backend
```bash
npx wrangler deploy
```

### 5. Deploy Frontend
The frontend is already deployed at: https://lxdpofbi.manus.space

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

=======
# midtrans-kurniasari
>>>>>>> d6e2b2501ce318de78327c7d424661ad1f2ed1e1
