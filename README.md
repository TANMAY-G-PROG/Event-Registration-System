# 🎊 Event Registration System

<div align="center">

![License](https://img.shields.io/badge/License-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-19+-blue)

A full-stack platform for organizing, managing, and participating in college events with registration, payments, certificate generation, and participant management.

</div>

---

## 🚀 Overview

The Event Registration System streamlines college event management by providing a centralized platform for event organizers and participants.

### Key Benefits

- Event creation and management
- Online registration system
- Razorpay payment integration
- Automated certificate generation
- Email notifications
- Participant analytics and reporting
- Role-based authentication and authorization

---

## ✨ Features

### 🎫 Event Management
- Create, update, and manage events
- Event categorization and filtering
- Capacity and registration control
- Event status tracking

### 📝 Registration System
- One-click event registration
- Registration tracking
- Waitlist management
- Registration history

### 💳 Payment Integration
- Razorpay integration
- Secure online payments
- Payment status tracking
- Receipt generation

### 🎓 Certificate Management
- Automatic PDF certificate generation
- QR code verification
- Certificate download and sharing

### 📧 Communication
- Email notifications via Brevo
- Registration confirmations
- Event reminders and announcements

### 🔐 Security
- JWT Authentication
- Role-based access control
- Secure password hashing
- Redis session management

---

## 🛠 Tech Stack

### Frontend
- React
- Vite
- Framer Motion
- React Router

### Backend
- Node.js
- Express.js
- JWT Authentication
- Redis

### Database & Services
- Supabase (PostgreSQL)
- Razorpay
- Brevo
- Cloudinary

### Deployment
- Azure App Service
- GitHub Actions

---

## 🏗 Architecture

```text
React Frontend
       │
       ▼
Express Backend API
       │
       ▼
Supabase Database

External Services:
• Razorpay
• Brevo
• Cloudinary
• Redis
```

---

## 📦 Prerequisites

- Node.js 18+
- npm 9+
- Supabase Account
- Razorpay Account
- Brevo Account
- Cloudinary Account
- Redis Instance

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/TANMAY-G-PROG/Event-Registration-System.git
cd Event-Registration-System
```

### Backend Setup

```bash
cd backend
npm install
```

Create `.env`

```env
PORT=5000

SUPABASE_URL=
SUPABASE_KEY=

JWT_SECRET=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

BREVO_API_KEY=

CLOUDINARY_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

REDIS_URL=
```

Run backend

```bash
npm start
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local`

```env
VITE_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=
```

Run frontend

```bash
npm run dev
```

---

## 🎮 Usage

### Student

- Browse available events
- Register for events
- Make payments
- Download certificates
- Track registrations

### Organizer

- Create and manage events
- Monitor registrations
- Export participant lists
- Generate certificates
- View analytics

---

## 📁 Project Structure

```text
Event-Registration-System/
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── middleware/
│   ├── services/
│   └── config/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   └── hooks/
│
├── .github/
├── README.md
└── LICENSE
```

---

## 🚢 Deployment

### Azure App Service

```bash
az webapp create \
  --resource-group myResourceGroup \
  --name event-registration-app \
  --runtime "NODE|18-lts"
```

Configure environment variables and deploy using GitHub Actions.

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push the branch
5. Open a Pull Request

---

## 📜 License

This project is licensed under the ISC License.

---

## 👨‍💻 Authors

### Tanmay G Shetty
GitHub: https://github.com/TANMAY-G-PROG

### Suchit KS
GitHub: https://github.com/SuchitKS

---

## 📧 Contact

For issues, suggestions, or feature requests:

- Open a GitHub Issue
- Contact the maintainers

---

<div align="center">

⭐ If you found this project useful, consider starring the repository.

</div>
