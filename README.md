# 🎊 Event Registration System - College Event Management Platform

<div align="center">

![License](https://img.shields.io/badge/License-ISC-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-19.1+-blue)
![Status](https://img.shields.io/badge/Status-Active%20Development-yellow)

**A comprehensive web application for organizing, managing, and participating in college events with real-time registration, payment processing, and certificate generation.**

[Live Demo](#-live-demo) • [Features](#-key-features) • [Installation](#-installation) • [Usage](#-usage) • [API Documentation](#-api-documentation)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [Project Architecture](#-project-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Configuration](#-configuration)
- [Usage](#-usage)
  - [Running Locally](#running-locally)
  - [Using the Platform](#using-the-platform)
  - [API Examples](#api-examples)
- [API Documentation](#-api-documentation)
- [Features Explained](#-features-explained)
- [File Structure](#-file-structure)
- [Database Schema](#-database-schema)
- [Authentication](#-authentication)
- [Payment Integration](#-payment-integration)
- [Certificate Generation](#-certificate-generation)
- [Troubleshooting](#-troubleshooting)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 🎯 Overview

**Event Registration System** is a full-stack web application designed to streamline college event management. It enables event organizers to create, manage, and track events while allowing students to discover, register, and participate in events seamlessly.

### Key Use Cases

- **Event Organizers**: Create events, set capacities, manage registrations, send communications
- **Students**: Discover events, register with one click, make payments, get certificates
- **Administrators**: Monitor all events, generate reports, manage user permissions

### Why This Project?

College events are crucial for student engagement, but manual management is error-prone and time-consuming. This platform provides:

✅ **Automated Registration** - One-click event registration  
✅ **Payment Integration** - Seamless Razorpay payment processing  
✅ **Real-time Updates** - Live event tracking and notifications  
✅ **Certificate Generation** - Auto-generated PDF certificates  
✅ **Data Management** - Export reports as Excel files  
✅ **Multi-User Roles** - Organizers, students, admins  
✅ **Email Notifications** - Automated emails via Brevo  

---

## ✨ Key Features

### 🎫 Event Management
- **Create Events**: Organizers can create events with details (date, time, capacity, location)
- **Event Discovery**: Browse all available events with filters and search
- **Event Details**: Rich event pages with descriptions, speaker info, schedules
- **Event Categories**: Organize events by type (workshops, seminars, cultural, sports, etc.)
- **Event Status**: Track events (upcoming, ongoing, completed, cancelled)

### 📝 Registration System
- **One-Click Registration**: Quick registration with form auto-fill
- **Registration Limits**: Set capacity limits and waitlisting
- **Registration Confirmation**: Email confirmations with event details
- **Bulk Registration**: Register multiple students at once
- **Registration History**: Track all past and upcoming registrations

### 💳 Payment Integration
- **Razorpay Integration**: Secure payment processing for paid events
- **Multiple Payment Methods**: Credit/debit cards, UPI, wallets
- **Payment Status Tracking**: Real-time payment confirmation
- **Refund Management**: Process refunds for cancelled registrations
- **Invoice Generation**: Automated payment receipts

### 🎓 Certificate Management
- **Auto-Generated Certificates**: PDF certificates created after event completion
- **Custom Templates**: Personalized certificate designs
- **Digital Distribution**: Email certificates to participants
- **Certificate Verification**: QR code for certificate validation

### 📊 Analytics & Reporting
- **Event Statistics**: Attendance rates, registration trends
- **Export Reports**: Download participant lists as Excel files
- **Participant Analytics**: Demographic insights
- **Revenue Tracking**: Payment and refund analytics

### 📧 Communication
- **Email Notifications**: Event updates, registration confirmations, reminders
- **Brevo Integration**: Professional email service with templates
- **Bulk Messaging**: Send announcements to all participants
- **SMS Support**: (Optional) SMS notifications via gateway

### 🔐 Security & Session Management
- **User Authentication**: JWT-based authentication system
- **Session Management**: Redis-based session storage
- **Password Hashing**: Bcrypt for secure password storage
- **Role-Based Access**: Different permission levels for users
- **CORS Protection**: Cross-origin request security

### 🎨 User Experience
- **Responsive Design**: Mobile-friendly interface
- **Real-time Updates**: Live event information
- **Dark Mode**: Eye-friendly dark theme option
- **Smooth Animations**: Framer Motion for transitions
- **Accessibility**: WCAG compliant design

---

## 🛠 Technology Stack

### Backend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Framework** | Express.js | 4.18.2 | Web framework |
| **Database** | Supabase | Latest | PostgreSQL hosting |
| **Authentication** | JWT | 9.0.3 | Token-based auth |
| **Password Security** | Bcrypt | 5.1.1 | Password hashing |
| **Session Store** | Redis | 4.6.7 | Session management |
| **Email Service** | Brevo | 2.2.0 | Email sending |
| **Payment Gateway** | Razorpay | 2.9.6 | Payment processing |
| **File Upload** | Cloudinary | 2.5.1 | Image/file hosting |
| **File Processing** | Multer | 1.4.5 | File upload handling |
| **Excel Export** | ExcelJS | 4.4.0 | Excel file generation |
| **PDF Generation** | jsPDF | 3.0.3 | PDF creation |
| **CORS** | CORS | 2.8.5 | Cross-origin support |
| **Environment** | Dotenv | 16.5.0 | Config management |

### Frontend
| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 19.1.1 | UI library |
| **Build Tool** | Vite | 7.1.7 | Fast build tool |
| **Routing** | React Router | 7.9.4 | Page navigation |
| **Animation** | Framer Motion | 12.23.24 | Smooth animations |
| **Icons** | Lucide React | 0.553.0 | Icon library |
| **PDF Generation** | jsPDF + PDF-Lib | 3.0.3 + 1.17.1 | PDF creation |
| **QR Code** | QRCode | 1.5.3 | QR code generation |
| **Data Tables** | Custom | - | Excel/CSV handling |
| **3D Graphics** | Three.js | 0.180.0 | 3D visualizations |
| **Styling** | CSS3 | - | Custom styling |
| **Linting** | ESLint | 9.36.0 | Code quality |

### DevOps & Deployment
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Hosting** | Azure App Service | Production hosting |
| **Database** | Supabase (PostgreSQL) | Data persistence |
| **File Storage** | Cloudinary | Image/document storage |
| **Email** | Brevo (Sendinblue) | Email delivery |
| **Payment** | Razorpay | Payment processing |
| **Session Store** | Redis | Session persistence |
| **CI/CD** | GitHub Actions | Automated deployment |

---

## 🏗 Project Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Pages:                                                │  │
│  │  - Home (Event Discovery)                             │  │
│  │  - Event Details                                      │  │
│  │  - User Dashboard                                     │  │
│  │  - Event Management (Organizer)                       │  │
│  │  - Authentication (Login/Register)                    │  │
│  │  - Certificate Viewer                                 │  │
│  │  - Participant List                                   │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Components:                                           │  │
│  │  - Event Cards, Event Form, Registration Form         │  │
│  │  - Navigation, Header, Footer                         │  │
│  │  - Payment Modal, Certificate Display                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                        ↕ (HTTP/REST API)
┌──────────────────────────────────────────────────────────────┐
│              Backend API (Express.js + Node.js)              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  API Routes:                                           │  │
│  │  - /auth (login, register, logout)                    │  │
│  │  - /events (CRUD operations)                          │  │
│  │  - /registrations (register, list, cancel)            │  │
│  │  - /payments (process, verify, refund)                │  │
│  │  - /certificates (generate, verify)                   │  │
│  │  - /participants (list, export)                       │  │
│  │  - /admin (user management)                           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Services:                                             │  │
│  │  - Auth Service (JWT)                                 │  │
│  │  - Email Service (Brevo)                              │  │
│  │  - Payment Service (Razorpay)                         │  │
│  │  - Certificate Service (PDF generation)               │  │
│  │  - Storage Service (Cloudinary)                       │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Middleware:                                           │  │
│  │  - Authentication, CORS, Error Handling               │  │
│  │  - Session Management (Redis)                         │  │
│  │  - Request Logging                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                        ↕ (SQL/Database Access)
┌──────────────────────────────────────────────────────────────┐
│           Data Layer (Supabase + PostgreSQL)                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Tables:                                               │  │
│  │  - users, events, registrations, payments             │  │
│  │  - certificates, participants, audit_logs             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                        ↕
┌──────────────────────────────────────────────────────────────┐
│                 External Services                            │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────────┐ │
│  │  Brevo      │ │  Razorpay    │ │  Cloudinary           │ │
│  │  (Email)    │ │  (Payments)  │ │  (File Storage)       │ │
│  └─────────────┘ └──────────────┘ └───────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Prerequisites

### System Requirements
- **OS**: Linux, macOS, or Windows (WSL2 recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Disk Space**: 2GB available
- **Internet**: Required for external services

### Software Requirements

**Node.js (Backend & Frontend)**
```bash
Node.js 18+ or 20+
npm 9+ (comes with Node.js) or yarn 1.22+
```

**Verification Commands**
```bash
node --version    # Should be v18.0.0 or higher
npm --version     # Should be 9.0.0 or higher
```

### Required Accounts & API Keys
Create accounts and obtain API keys for:

1. **Supabase** (Database)
   - Visit: https://supabase.com
   - Create project and get `SUPABASE_URL` and `SUPABASE_KEY`

2. **Razorpay** (Payment Gateway)
   - Visit: https://razorpay.com
   - Get `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

3. **Brevo** (Email Service)
   - Visit: https://brevo.com
   - Get `BREVO_API_KEY`

4. **Cloudinary** (File Storage)
   - Visit: https://cloudinary.com
   - Get `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

5. **Redis** (Session Store)
   - Local: `redis-server` or
   - Cloud: Redis Cloud (https://redis.com/try-free/)

---

## 🚀 Installation

### Backend Setup

#### Step 1: Clone Repository
```bash
git clone https://github.com/TANMAY-G-PROG/Event-Registration-System.git
cd Event-Registration-System
```

#### Step 2: Navigate to Backend
```bash
cd backend
```

#### Step 3: Install Dependencies
```bash
npm install
```

**Expected packages:**
- express, cors, dotenv
- @supabase/supabase-js
- jsonwebtoken, bcrypt
- @getbrevo/brevo (for emails)
- razorpay (for payments)
- cloudinary, multer (for file uploads)
- redis, connect-redis (for sessions)
- exceljs (for reports)

#### Step 4: Create Environment File
Create `backend/.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRE=7d
SESSION_SECRET=your_session_secret

# Email Service (Brevo)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=your_sender_email@college.edu
BREVO_SENDER_NAME="College Events"

# Payment Gateway (Razorpay)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# File Storage (Cloudinary)
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Redis (Session Store)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password (if needed)

# CORS Configuration
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Environment
LOG_LEVEL=debug
DEBUG=true
```

#### Step 5: Start Backend
```bash
npm start
```

**Expected output:**
```
Server running on http://localhost:5000
Connected to Supabase database
Redis connection established
Ready for API requests
```

---

### Frontend Setup

#### Step 1: Navigate to Frontend
```bash
cd frontend
```

#### Step 2: Install Dependencies
```bash
npm install
```

#### Step 3: Create Environment File
Create `frontend/.env.local`:

```env
# API Configuration
VITE_API_URL=http://localhost:5000
VITE_API_TIMEOUT=30000

# Application Settings
VITE_APP_NAME=Event Registration System
VITE_APP_VERSION=1.0.0

# External Services
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_CERTIFICATES=true
VITE_ENABLE_PAYMENTS=true

# File Upload
VITE_MAX_FILE_SIZE=10485760  # 10MB in bytes
```

#### Step 4: Start Frontend
```bash
npm run dev
```

**Expected output:**
```
VITE v7.1.7  ready in 245 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

## ⚙️ Configuration

### Environment Variables Explained

#### Backend Configuration

**Database Connection**
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJhbGc...  # Anon public key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Service role (keep secret)
```

**Authentication**
```env
JWT_SECRET=your_very_secure_secret_key_at_least_32_chars_long
JWT_EXPIRE=7d  # Token expiration time
SESSION_SECRET=another_secure_secret
```

**Payment Processing**
```env
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx  # Keep secret
```

**Email Configuration**
```env
BREVO_API_KEY=your_api_key
BREVO_SENDER_EMAIL=events@college.edu
BREVO_SENDER_NAME=College Events Team
```

#### Frontend Configuration

**API Integration**
```env
VITE_API_URL=http://localhost:5000
# Change to production URL when deploying
VITE_API_URL=https://api.yourdomain.com
```

**Payment Integration**
```env
VITE_RAZORPAY_KEY_ID=rzp_live_xxxxx  # Public key only
```

### Database Setup

#### Creating Tables (Supabase)

Run these SQL queries in Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'student',
  college_id VARCHAR(50),
  phone VARCHAR(20),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date_time TIMESTAMP NOT NULL,
  location VARCHAR(255),
  capacity INT DEFAULT 100,
  registered_count INT DEFAULT 0,
  category VARCHAR(100),
  image_url TEXT,
  is_paid BOOLEAN DEFAULT false,
  price DECIMAL(10, 2),
  status VARCHAR(50) DEFAULT 'upcoming',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Registrations table
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  status VARCHAR(50) DEFAULT 'registered',
  attendance_status VARCHAR(50) DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates table
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id),
  user_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  certificate_url TEXT,
  certificate_hash VARCHAR(255),
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_revoked BOOLEAN DEFAULT false
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_events_organizer ON events(organizer_id);
CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_certificates_user ON certificates(user_id);
```

---

## 🎮 Usage

### Running Locally

#### Terminal 1: Start Backend
```bash
cd backend
npm start
```

#### Terminal 2: Start Frontend
```bash
cd frontend
npm run dev
```

#### Access Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Docs**: http://localhost:5000/api/docs (if configured)

### Using the Platform

#### As a Student

1. **Sign Up**
   - Click "Register" on homepage
   - Enter email, password, name
   - Verify email (if enabled)
   - Complete profile

2. **Browse Events**
   - View all upcoming events
   - Filter by category, date, price
   - Search for specific events

3. **Register for Event**
   - Click "Register" on event card
   - Fill registration form
   - Pay if event is paid
   - Receive confirmation email

4. **Manage Registrations**
   - View dashboard with registered events
   - Cancel registration if allowed
   - Download event details
   - Access received certificate

#### As an Organizer

1. **Create Event**
   - Go to Dashboard → Create Event
   - Fill event details (title, date, location, capacity)
   - Upload event image
   - Set price if needed
   - Publish event

2. **Manage Event**
   - View registrations
   - Send announcements to participants
   - Export participant list
   - Monitor attendance

3. **After Event**
   - Mark attendance
   - Generate certificates
   - Share feedback form
   - View analytics

---

## 📚 API Documentation

### Base URL
```
Development: http://localhost:5000/api
Production: https://yourdomain.com/api
```

### Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <your_jwt_token>
```

### Authentication Endpoints

#### POST /auth/register
Register new user.

**Request:**
```json
{
  "email": "student@college.edu",
  "password": "SecurePass123!",
  "name": "John Doe",
  "college_id": "CSE-2023-001"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "student@college.edu",
    "name": "John Doe",
    "role": "student"
  },
  "token": "eyJhbGc..."
}
```

---

#### POST /auth/login
User login.

**Request:**
```json
{
  "email": "student@college.edu",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGc..."
}
```

---

#### GET /auth/logout
User logout.

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### Event Endpoints

#### GET /events
Get all events.

**Query Parameters:**
```
?category=workshop&status=upcoming&search=Python&page=1&limit=10
```

**Response (200):**
```json
{
  "success": true,
  "events": [
    {
      "id": "uuid",
      "title": "Python Workshop",
      "date_time": "2026-06-15T10:00:00Z",
      "location": "Lab 101",
      "capacity": 50,
      "registered_count": 35,
      "category": "workshop",
      "is_paid": false,
      "image_url": "..."
    }
  ],
  "total": 42,
  "page": 1,
  "pages": 5
}
```

---

#### POST /events
Create new event (Organizer only).

**Request:**
```json
{
  "title": "Python Workshop",
  "description": "Learn Python basics",
  "date_time": "2026-06-15T10:00:00Z",
  "location": "Lab 101",
  "capacity": 50,
  "category": "workshop",
  "is_paid": false,
  "price": 0
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Event created successfully",
  "event": { ... }
}
```

---

#### GET /events/:id
Get event details.

**Response (200):**
```json
{
  "success": true,
  "event": {
    "id": "uuid",
    "title": "Python Workshop",
    "description": "Learn Python basics",
    "date_time": "2026-06-15T10:00:00Z",
    "location": "Lab 101",
    "capacity": 50,
    "registered_count": 35,
    "organizer": {
      "id": "uuid",
      "name": "Prof. Smith",
      "email": "smith@college.edu"
    }
  }
}
```

---

#### PUT /events/:id
Update event (Organizer only).

**Request:**
```json
{
  "title": "Advanced Python Workshop",
  "capacity": 60
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Event updated successfully",
  "event": { ... }
}
```

---

#### DELETE /events/:id
Delete event (Organizer only).

**Response (200):**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

---

### Registration Endpoints

#### POST /registrations
Register for event.

**Request:**
```json
{
  "event_id": "uuid",
  "phone": "9876543210",
  "attendance_required": true
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "registration": {
    "id": "uuid",
    "event_id": "uuid",
    "status": "registered",
    "registered_at": "2026-06-02T09:23:00Z"
  }
}
```

---

#### GET /registrations
Get user's registrations.

**Response (200):**
```json
{
  "success": true,
  "registrations": [
    {
      "id": "uuid",
      "event": { ... },
      "status": "registered",
      "registered_at": "2026-06-02T09:23:00Z",
      "payment_status": "completed"
    }
  ]
}
```

---

#### DELETE /registrations/:id
Cancel registration.

**Response (200):**
```json
{
  "success": true,
  "message": "Registration cancelled successfully"
}
```

---

### Payment Endpoints

#### POST /payments/create-order
Create Razorpay order.

**Request:**
```json
{
  "registration_id": "uuid",
  "amount": 500,
  "currency": "INR"
}
```

**Response (201):**
```json
{
  "success": true,
  "order": {
    "id": "order_xxxxx",
    "amount": 50000,
    "currency": "INR"
  }
}
```

---

#### POST /payments/verify
Verify payment.

**Request:**
```json
{
  "razorpay_order_id": "order_xxxxx",
  "razorpay_payment_id": "pay_xxxxx",
  "razorpay_signature": "signature_xxxxx",
  "registration_id": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "payment": { ... }
}
```

---

### Certificate Endpoints

#### POST /certificates/generate
Generate certificate (Organizer only).

**Request:**
```json
{
  "event_id": "uuid",
  "registration_ids": ["uuid1", "uuid2"]
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Certificates generated successfully",
  "certificates": [ ... ]
}
```

---

#### GET /certificates/:id
Get certificate (Verify).

**Response (200):**
```json
{
  "success": true,
  "certificate": {
    "id": "uuid",
    "user_name": "John Doe",
    "event_title": "Python Workshop",
    "issued_at": "2026-06-20T00:00:00Z",
    "is_valid": true
  }
}
```

---

### Participant Endpoints

#### GET /events/:id/participants
Get event participants (Organizer only).

**Query Parameters:**
```
?status=registered&attendance=present&page=1&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "participants": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@college.edu",
      "phone": "9876543210",
      "registration_status": "registered",
      "attendance_status": "present",
      "certificate_generated": true
    }
  ],
  "total": 35
}
```

---

#### POST /events/:id/participants/export
Export participant list as Excel (Organizer only).

**Query Parameters:**
```
?format=xlsx&include_emails=true&include_phones=true
```

**Response (200):**
Binary Excel file download

---

## 🎨 Features Explained in Detail

### Certificate Generation Process

```
1. Event Completes
   ↓
2. Organizer marks attendance in dashboard
   ↓
3. Click "Generate Certificates"
   ↓
4. Backend generates PDF certificates using jsPDF
   ↓
5. Certificates uploaded to Cloudinary
   ↓
6. Certificates emailed to participants via Brevo
   ↓
7. Certificates available for download and sharing
```

### Payment Flow

```
1. User registers for paid event
   ↓
2. System creates Razorpay order
   ↓
3. User redirected to Razorpay payment page
   ↓
4. User completes payment (card/UPI/wallet)
   ↓
5. Razorpay sends webhook callback
   ↓
6. Backend verifies payment signature
   ↓
7. Registration confirmed, confirmation email sent
   ↓
8. User can access event materials
```

### Session Management

- **Session Store**: Redis
- **Session Duration**: Configurable (default 24 hours)
- **Storage**: `connect-redis` middleware
- **Features**:
  - Auto-logout on browser close
  - Remember device option
  - Concurrent session limit (optional)

---

## 📁 File Structure

```
Event-Registration-System/
├── README.md                          # This file
├── .gitignore                         # Git ignore rules
├── .github/
│   └── workflows/
│       └── azure-deployment.yml       # CI/CD pipeline
│
├── backend/
│   ├── server.js                      # Entry point
│   ├── package.json                   # Dependencies
│   ├── .env.example                   # Environment template
│   │
│   ├── config/
│   │   ├── database.js                # Supabase connection
│   │   ├── redis.js                   # Redis setup
│   │   ├── cloudinary.js              # Cloudinary config
│   │   └── brevo.js                   # Email service config
│   │
│   ├── routes/
│   │   ├── auth.js                    # Auth endpoints
│   │   ├── events.js                  # Event endpoints
│   │   ├── registrations.js           # Registration endpoints
│   │   ├── payments.js                # Payment endpoints
│   │   ├── certificates.js            # Certificate endpoints
│   │   └── admin.js                   # Admin endpoints
│   │
│   ├── controllers/
│   │   ├── authController.js          # Auth logic
│   │   ├── eventController.js         # Event logic
│   │   ├── registrationController.js  # Registration logic
│   │   ├── paymentController.js       # Payment logic
│   │   └── certificateController.js   # Certificate logic
│   │
│   ├── middleware/
│   │   ├── auth.js                    # JWT verification
│   │   ├── error.js                   # Error handling
│   │   ├── cors.js                    # CORS config
│   │   ├── logger.js                  # Request logging
│   │   └── validation.js              # Input validation
│   │
│   ├── services/
│   │   ├── emailService.js            # Email sending
│   │   ├── paymentService.js          # Payment processing
│   │   ├── certificateService.js      # Certificate generation
│   │   ├── storageService.js          # File uploads
│   │   └── excelService.js            # Excel export
│   │
│   └── utils/
│       ├── validators.js              # Validation helpers
│       ├── errorHandler.js            # Error utilities
│       └── helpers.js                 # Utility functions
│
├── frontend/
│   ├── index.html                     # HTML entry
│   ├── package.json                   # Dependencies
│   ├── vite.config.js                 # Vite config
│   ├── .env.example                   # Environment template
│   │
│   ├── public/
│   │   ├── logo.png                   # College logo
│   │   ├── favicon.ico                # Favicon
│   │   └── images/                    # Static images
│   │
│   └── src/
│       ├── App.jsx                    # Root component
│       ├── main.jsx                   # Entry point
│       ├── index.css                  # Global styles
│       │
│       ├── pages/
│       │   ├── Home.jsx               # Home/event discovery
│       │   ├── EventDetails.jsx       # Event details page
│       │   ├── Login.jsx              # Login page
│       │   ├── Register.jsx           # Signup page
│       │   ├── Dashboard.jsx          # User dashboard
│       │   ├── CreateEvent.jsx        # Event creation
│       │   ├── EventManagement.jsx    # Event management
│       │   ├── Certificates.jsx       # Certificate viewer
│       │   ├── Participants.jsx       # Participant list
│       │   ├── ForgotPassword.jsx     # Password recovery
│       │   └── NotFound.jsx           # 404 page
│       │
│       ├── components/
│       │   ├── Header.jsx             # Navigation header
│       │   ├── Footer.jsx             # Footer
│       │   ├── EventCard.jsx          # Event card component
│       │   ├── EventForm.jsx          # Event form
│       │   ├── RegistrationForm.jsx   # Registration form
│       │   ├── PaymentModal.jsx       # Payment popup
│       │   ├── CertificateCard.jsx    # Certificate display
│       │   ├── Filter.jsx             # Event filters
│       │   ├── Navbar.jsx             # Navigation bar
│       │   └── LoadingSpinner.jsx     # Loading indicator
│       │
│       ├── services/
│       │   ├── api.js                 # API client
│       │   ├── auth.js                # Auth service
│       │   ├── events.js              # Event service
│       │   ├── payments.js            # Payment service
│       │   └── certificates.js        # Certificate service
│       │
│       ├── utils/
│       │   ├── constants.js           # Constants
│       │   ├── helpers.js             # Utility functions
│       │   ├── validators.js          # Form validators
│       │   └── formatting.js          # String/date formatting
│       │
│       ├── hooks/
│       │   ├── useAuth.js             # Auth hook
│       │   ├── useFetch.js            # Data fetching hook
│       │   ├── useForm.js             # Form handling hook
│       │   └── useLocalStorage.js     # Local storage hook
│       │
│       └── styles/
│           ├── variables.css          # CSS variables
│           ├── components.css         # Component styles
│           ├── pages.css              # Page styles
│           └── animations.css         # Animation styles
```

---

## 🗄️ Database Schema

### Users Table
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  role ENUM('student', 'organizer', 'admin'),
  college_id VARCHAR(50),
  phone VARCHAR(20),
  avatar_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Events Table
```sql
events (
  id UUID PRIMARY KEY,
  organizer_id UUID FOREIGN KEY,
  title VARCHAR(255),
  description TEXT,
  date_time TIMESTAMP,
  location VARCHAR(255),
  capacity INT,
  registered_count INT,
  category VARCHAR(100),
  image_url TEXT,
  is_paid BOOLEAN,
  price DECIMAL(10,2),
  status ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Registrations Table
```sql
registrations (
  id UUID PRIMARY KEY,
  user_id UUID FOREIGN KEY,
  event_id UUID FOREIGN KEY,
  status ENUM('registered', 'waitlisted', 'cancelled'),
  attendance_status ENUM('pending', 'present', 'absent'),
  registered_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Payments Table
```sql
payments (
  id UUID PRIMARY KEY,
  registration_id UUID FOREIGN KEY,
  user_id UUID FOREIGN KEY,
  amount DECIMAL(10,2),
  currency VARCHAR(10),
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  status ENUM('pending', 'success', 'failed', 'refunded'),
  payment_method VARCHAR(100),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### Certificates Table
```sql
certificates (
  id UUID PRIMARY KEY,
  registration_id UUID FOREIGN KEY,
  user_id UUID FOREIGN KEY,
  event_id UUID FOREIGN KEY,
  certificate_url TEXT,
  certificate_hash VARCHAR(255),
  issued_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_revoked BOOLEAN
)
```

---

## 🔐 Authentication

### JWT Token Structure
```
Header: { "alg": "HS256", "typ": "JWT" }
Payload: {
  "userId": "uuid",
  "email": "user@college.edu",
  "role": "student",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Password Security
- Hashing: Bcrypt with salt rounds 10
- Minimum length: 8 characters
- Requirements: Mix of letters, numbers, special chars

### Session Management
- Store: Redis
- Duration: 24 hours (configurable)
- Cookie: Secure, HttpOnly, SameSite

---

## 💳 Payment Integration

### Razorpay Setup

1. **Get API Keys**
   - Log in to Razorpay Dashboard
   - Go to Settings → API Keys
   - Copy Key ID and Key Secret

2. **Configure in Backend**
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```

3. **Payment Flow**
   ```
   Frontend creates order → Backend calls Razorpay
   → Razorpay payment gateway → User pays
   → Webhook notification → Verify signature
   → Update registration status
   ```

### Testing Payments
Use Razorpay test credentials:
- Test Card: 4111 1111 1111 1111
- Expiry: Any future date
- CVV: Any 3 digits

---

## 📜 Certificate Generation

### Process
1. Event completes
2. Organizer marks attendance
3. System generates PDF certificates
4. Uploads to Cloudinary
5. Emails to participants
6. Users can download/share

### Certificate Template
```
┌─────────────────────────────────────┐
│      COLLEGE LOGO                   │
│   CERTIFICATE OF PARTICIPATION      │
├─────────────────────────────────────┤
│                                     │
│   This is to certify that           │
│                                     │
│   _______________                   │
│   (Participant Name)                │
│                                     │
│   has successfully participated in  │
│                                     │
│   _______________                   │
│   (Event Name)                      │
│                                     │
│   Date: _______________             │
│   Signature: _______________        │
│   QR Code: [QR]                    │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### Backend Issues

#### Issue: Connection refused on port 5000
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solutions:**
1. Check if port is in use: `lsof -i :5000`
2. Kill process: `kill -9 <PID>`
3. Use different port: Change `PORT` in `.env`

---

#### Issue: Supabase connection fails
```
Error: Failed to connect to Supabase database
```

**Solutions:**
1. Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
2. Check internet connection
3. Verify database is running in Supabase dashboard
4. Check firewall/network restrictions

---

#### Issue: Redis connection error
```
Error: Failed to connect to Redis
```

**Solutions:**
1. Start Redis locally: `redis-server`
2. Or use Redis Cloud: Update `REDIS_URL` in `.env`
3. Verify Redis server is running: `redis-cli ping`

---

#### Issue: Email not sending
```
Error: Failed to send email via Brevo
```

**Solutions:**
1. Verify `BREVO_API_KEY` is correct
2. Check `BREVO_SENDER_EMAIL` is verified in Brevo
3. Monitor Brevo dashboard for delivery status
4. Check spam folder

---

#### Issue: Payment verification fails
```
Error: Payment signature verification failed
```

**Solutions:**
1. Verify `RAZORPAY_KEY_SECRET` is correct
2. Check order ID and payment ID match
3. Ensure webhook is configured in Razorpay
4. Check timestamp is within acceptable range

---

### Frontend Issues

#### Issue: CORS errors
```
Error: Access to XMLHttpRequest blocked by CORS policy
```

**Solutions:**
1. Check `VITE_API_URL` in `.env.local`
2. Verify backend CORS is configured
3. Check `ALLOWED_ORIGINS` in backend `.env`
4. Clear browser cache

---

#### Issue: Payment modal not opening
```
Razorpay modal fails to open
```

**Solutions:**
1. Check `VITE_RAZORPAY_KEY_ID` is set
2. Verify amount is in paisa (multiply by 100)
3. Check browser console for errors
4. Disable browser extensions (ad blockers)

---

#### Issue: Images not loading
```
Event images show broken image icons
```

**Solutions:**
1. Check Cloudinary credentials
2. Verify image URLs in database
3. Check file upload is working
4. Check CORS in Cloudinary dashboard

---

### Common Issues (Both)

#### Issue: 404 Not Found
```
API endpoint returns 404
```

**Solutions:**
1. Check endpoint path is correct
2. Verify backend is running
3. Check API documentation for correct path
4. Verify request method (GET/POST/PUT/DELETE)

---

#### Issue: Slow performance
```
Application loading slowly
```

**Solutions:**
1. Check database query performance
2. Add database indexes
3. Implement pagination
4. Cache frequently accessed data
5. Optimize image sizes

---

## 🐳 Deployment

### Azure App Service Deployment

#### Prerequisites
- Azure account
- GitHub repository connected
- Resource group created

#### Step 1: Create App Service
```bash
az appservice plan create \
  --name event-registration-plan \
  --resource-group myResourceGroup \
  --sku B1

az webapp create \
  --resource-group myResourceGroup \
  --plan event-registration-plan \
  --name event-registration-app \
  --runtime "NODE|18-lts"
```

#### Step 2: Configure Deployment
1. Go to Azure Portal → App Service
2. Settings → Deployment → GitHub Actions
3. Select repository and branch
4. Configure build settings

#### Step 3: Set Environment Variables
```bash
az webapp config appsettings set \
  --resource-group myResourceGroup \
  --name event-registration-app \
  --settings \
    SUPABASE_URL=your_url \
    SUPABASE_KEY=your_key \
    JWT_SECRET=your_secret \
    RAZORPAY_KEY_ID=your_key \
    RAZORPAY_KEY_SECRET=your_secret
```

---

### Docker Deployment

#### Create `Dockerfile`
```dockerfile
# Build stage
FROM node:18-alpine AS build

WORKDIR /app

# Copy and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Build frontend
COPY frontend ./frontend
RUN cd frontend && npm run build

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Copy backend
COPY --from=build /app/backend ./backend
RUN cd backend && npm ci --only=production

# Copy frontend build
COPY --from=build /app/frontend/dist ./public

EXPOSE 5000

CMD ["node", "backend/server.js"]
```

#### Build and Run
```bash
docker build -t event-registration:latest .
docker run -p 5000:5000 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_KEY=your_key \
  event-registration:latest
```

---

### Heroku Deployment

#### Step 1: Install Heroku CLI
```bash
npm install -g heroku
```

#### Step 2: Login and Create App
```bash
heroku login
heroku create event-registration-app
```

#### Step 3: Add Buildpacks
```bash
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add https://github.com/mars/create-react-app-buildpack.git
```

#### Step 4: Deploy
```bash
git push heroku main
```

#### Step 5: Set Config Variables
```bash
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_KEY=your_key
heroku config:set JWT_SECRET=your_secret
```

---

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
   ```bash
   Click "Fork" on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Event-Registration-System.git
   cd Event-Registration-System
   ```

3. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make changes**
   - Follow coding standards
   - Test thoroughly
   - Write commit messages clearly

5. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: Add feature description"
   ```

6. **Push to fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**
   - Go to GitHub
   - Click "Compare & pull request"
   - Describe changes in detail
   - Submit PR

### Coding Standards

**JavaScript/Node.js:**
- Use ES6+ syntax
- Follow Airbnb style guide
- Use async/await instead of callbacks
- Add error handling
- Write meaningful comments

**React:**
- Use functional components
- Use hooks for state management
- Prop validation with PropTypes
- Follow BEM for CSS classes
- Optimize re-renders with React.memo

**Git Commits:**
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Format code
refactor: Restructure code
test: Add tests
perf: Performance improvement
ci: CI/CD changes
```

### Areas for Contribution

- 🐛 **Bug Fixes**: Report and fix issues
- ✨ **Features**: Add new functionality
- 📚 **Documentation**: Improve guides
- 🧪 **Testing**: Write tests
- 🎨 **UI/UX**: Design improvements
- 🚀 **Performance**: Optimization
- 🔒 **Security**: Security audits

---

## 📜 License

This project is licensed under the **ISC License**. See [LICENSE](LICENSE) file for details.

---

## 📧 Contact

### Project Maintainers
- **Tanmay G Shetty** - [@TANMAY-G-PROG](https://github.com/TANMAY-G-PROG)
- **Suchit KS** - [@SuchitKS](https://github.com/SuchitKS)

### Support
- **Issues**: [GitHub Issues](https://github.com/TANMAY-G-PROG/Event-Registration-System/issues)
- **Email**: tanmay.121cr7@gmail.com
- **Discussions**: [GitHub Discussions](https://github.com/TANMAY-G-PROG/Event-Registration-System/discussions)

### Bug Reports
Please include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- System information (OS, browser, Node.js version)
- Screenshots/error logs if applicable

### Feature Requests
Please describe:
- What feature you'd like
- Why it's useful
- How you imagine it working

---

## 📈 Project Roadmap

### Version 1.1 (Q3 2026)
- [ ] Mobile app (React Native)
- [ ] SMS notifications
- [ ] Event repeat schedules
- [ ] Advanced filtering
- [ ] Event reviews/ratings

### Version 1.2 (Q4 2026)
- [ ] Analytics dashboard
- [ ] Promotional codes/discounts
- [ ] Event templates
- [ ] Team registration
- [ ] Event sponsorships

### Version 2.0 (2027)
- [ ] AI-based event recommendations
- [ ] Virtual event support
- [ ] Livestreaming integration
- [ ] Advanced payment options
- [ ] API marketplace

---

## 🙏 Acknowledgments

- **Express.js**: Web framework excellence
- **React**: UI library
- **Supabase**: Open source Firebase alternative
- **Razorpay**: Payment processing
- **Brevo**: Email service
- **Cloudinary**: File hosting
- All contributors and community members

---

## 📊 Project Statistics

- **Total Commits**: 50+
- **Contributors**: 2+
- **Lines of Code**: 5,000+
- **Test Coverage**: In progress
- **Last Updated**: March 30, 2026
- **Repository Size**: 14.4 MB

---

## ⭐ Show Your Support

If you find this project helpful:
- ⭐ **Star** the repository
- 🍴 **Fork** to use in your college
- 📢 **Share** with others
- 🐛 **Report bugs** to help improve
- 💡 **Suggest features**

---

<div align="center">

**Made with ❤️ by College Event Enthusiasts**

**[⬆ Back to Top](#-event-registration-system---college-event-management-platform)**

[View Issues](https://github.com/TANMAY-G-PROG/Event-Registration-System/issues) • [View PRs](https://github.com/TANMAY-G-PROG/Event-Registration-System/pulls) • [View Commits](https://github.com/TANMAY-G-PROG/Event-Registration-System/commits)

</div>
