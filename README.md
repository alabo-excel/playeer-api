# Playeer API

A Node.js/Express API with MongoDB and TypeScript for user management.

## Features

- User CRUD operations
- MongoDB integration with Mongoose
- TypeScript support
- Input validation
- Error handling
- RESTful API design

## Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # MongoDB Configuration
   MONGO_URI=mongodb://localhost:27017/playeer-api

   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication

#### Public Routes
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/logout` - Logout user

#### Protected Routes (require authentication)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/me` - Update current user profile
- `PUT /api/auth/change-password` - Change password

### Users

#### Protected Routes (require authentication)
- `GET /api/users` - Get all users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/active` - Get active users
- `GET /api/users/role/:role` - Get users by role

#### Admin Routes (require admin role)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## User Model Fields

- `firstName` (required) - User's first name
- `lastName` (required) - User's last name
- `email` (required, unique) - User's email address
- `password` (required) - User's password (min 6 characters)
- `username` (optional, unique) - Username (3-30 characters)
- `phoneNumber` (optional) - Phone number
- `dateOfBirth` (optional) - Date of birth
- `profilePicture` (optional) - Profile picture URL
- `isActive` (default: true) - Account status
- `isVerified` (default: false) - Email verification status
- `role` (default: 'user') - User role (user, admin, moderator)
- `lastLogin` (optional) - Last login timestamp

## Example Usage

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "password": "password123",
    "username": "johndoe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "password123"
  }'
```

### Get current user profile (with authentication)
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get all users (with authentication)
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Next Steps

1. Add authentication middleware (JWT)
2. Add password hashing with bcrypt
3. Add input validation middleware
4. Add rate limiting
5. Add logging
6. Add tests

## Development

- `npm run dev` - Start development server with nodemon
- `npm run build` - Build TypeScript to JavaScript 