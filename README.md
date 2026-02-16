# ISP Wallet Platform

A comprehensive wallet management platform for Internet Service Providers (ISPs) with features for billing, account management, and service provisioning.

## Project Structure

### Backend
- **config/**: Environment and application configurations
- **middleware/**: Express middleware for authentication, validation, and error handling
- **modules/**: Feature modules (auth, wallet, services, admin, notification, reporting)
- **utils/**: Utility functions and helpers
- **types/**: TypeScript type definitions

### Frontend-User
User-facing application with features for wallet management and service provisioning.

### Frontend-Admin
Admin dashboard for managing users, wallets, services, and viewing audit logs.

## Getting Started

1. Install dependencies in each directory
2. Configure environment variables using `.env.example` files
3. Run development servers

## Features

- User authentication with OTP verification
- Wallet management and balance tracking
- Service provisioning (Home Internet, Hotspot, Mobile Recharge, Electricity)
- Admin dashboard and reporting
- Audit logging
- Excel data import/export
