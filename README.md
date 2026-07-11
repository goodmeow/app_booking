# 360Books-WebApps

360Booking adalah aplikasi manajemen penjadwalan meeting dengan fitur real-time menggunakan React, Node.js, dan Socket.io.

## 🚀 Tech Stack

### Frontend

- **React 17.0.2** - Library UI
- **Vite 4.0.4** - Build tool dan dev server
- **Material-UI** - Component library
- **Redux Toolkit** - State management
- **React Router 5.3.4** - Client-side routing
- **Socket.io Client** - Real-time communication
- **FullCalendar** - Calendar component
- **Bootstrap** - CSS framework

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time WebSocket server
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Webpack 5** - Server bundling

## 📋 Prerequisites

Pastikan Anda telah menginstall:

- **Node.js** (v16 atau lebih baru)
- **npm** atau **yarn**
- **PostgreSQL** database

## 🛠️ Installation

1. **Clone repository**

   ```bash
   git clone https://github.com/kouuzaki/360Books-WebApps.git
   cd 360Books-WebApps
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Setup environment variables**

   Buat file `.env` di root directory:

   ```env
   NODE_ENV=development
   SSR=false
   PORT=3000
   SERVER_PORT=5000
   HOST=localhost
   HTTPS=false

   # Database Configuration
   PGUSER=your_postgres_user
   PGHOST=localhost
   PGDATABASE=your_database_name
   PGPASSWORD=your_password
   PGPORT=5432

   # JWT Secret
   JWT_SECRET=your_jwt_secret_key

   # Redis (optional)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_KEY=
   REDIS_DB=0

   # Employee & Room Suffix
   EMPLOYEE_SUFFIX=your_employee_suffix
   ROOM_SUFFIX=your_room_suffix
   ```

   Untuk production, buat file `.env.production`:

   ```env
   NODE_ENV=production
   SSR=false
   PORT=3000
   SERVER_PORT=5000
   HOST=your_production_host
   HTTPS=false

   # Database dan konfigurasi lainnya sesuai production
   ```

## 🔧 Development

### Start Development Server

**Opsi 1: Jalankan frontend dan backend bersamaan**

```bash
npm run development
```

**Opsi 2: Jalankan secara terpisah**

Frontend (port 3000):

```bash
npm run dev:client
```

Backend (port 5000):

```bash
npm run dev:server
```

### Development URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **WebSocket**: ws://localhost:5000

## 🏗️ Build untuk Production

### Build Complete Application

```bash
npm run build
```

Command ini akan menjalankan:

1. `npm run build:client` - Build frontend ke `dist/client/`
2. `npm run build:server` - Bundle backend ke `dist/server/`
3. `npm run create:server:package` - Generate package.json untuk production

### Build Individual Components

**Build frontend saja:**

```bash
npm run build:client
```

**Build backend saja:**

```bash
npm run build:server
```

**Generate production package.json:**

```bash
npm run create:server:package
```

## 🚀 Production Deployment

### Start Production Server

```bash
npm start
```

Server akan berjalan di:

- **Application**: http://localhost:5000 (melayani frontend dan API)
- **API Endpoints**: http://localhost:5000/api

### Production Structure

```
dist/
├── client/           # Built frontend files
│   ├── index.html
│   ├── assets/
│   ├── vite.config.js
│   ├── node_modules/    -> symlink to root
│   └── README.md
├── server/           # Bundled backend
│   ├── server.bundle.js
│   ├── node_modules/    -> symlink to root
│   ├── .env.*
│   └── README.md
```

### Standalone Frontend Serving

Jika ingin serve frontend secara terpisah menggunakan Vite preview:

```bash
cd dist/client
npm install
npm run preview
```

### Standalone Mode (Frontend + Backend Terpisah)

**Jalankan frontend dan backend secara standalone:**

```bash
npm run start:standalone
```

**Atau jalankan secara terpisah:**

Frontend dengan Vite preview (port 3000):

```bash
npm run start:standalone:client
```

Backend standalone (port 5000):

```bash
npm run start:standalone:server
```

#### Standalone URLs:

- **Frontend**: http://localhost:3000 (Vite preview server)
- **Backend API**: http://localhost:5000/api
- **WebSocket**: ws://localhost:5000

## 📁 Project Structure

```
360Books-WebApps/
├── client/                 # Frontend source code
│   ├── App.js             # Main App component
│   ├── entry-client.js    # Client entry point
│   ├── MainRouter.js      # Route configuration
│   ├── auth/              # Authentication components
│   ├── core/              # Core components
│   │   ├── Dashboard.js   # Main dashboard
│   │   ├── Menu.js        # Navigation
│   │   └── calendar/      # Calendar components
│   ├── redux/             # State management
│   │   ├── store.js
│   │   ├── api.js
│   │   ├── services/      # API services
│   │   └── middleware/    # Redux middleware
│   ├── user/              # User management
│   └── config/            # Client configuration
├── server/                # Backend source code
│   ├── server.js          # Main server file
│   ├── express.js         # Express configuration
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── socket/           # WebSocket handlers
│   └── utils/            # Utilities
├── config/               # Server configuration
├── public/              # Static assets
├── dist/               # Built files (generated)
├── package.json        # Dependencies & scripts
├── vite.config.js     # Vite configuration
└── webpack.config.cjs # Webpack configuration
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration

### Events

- `GET /api/events` - Get all events
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Users

- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Rooms

- `GET /api/rooms` - Get all rooms
- `POST /api/rooms` - Create new room

## 🔄 Real-time Features

Aplikasi menggunakan Socket.io untuk fitur real-time:

- **Live event updates** - Event yang dibuat/diupdate langsung tersinkronisasi
- **Room management** - Real-time room availability
- **User notifications** - Notifikasi real-time untuk user

### Socket Events

- `room:join` - Join room for updates
- `response:event` - Event data updates

## 🧪 Scripts Available

```bash
# Development
npm run development      # Start frontend + backend
npm run dev:client      # Start frontend only
npm run dev:server      # Start backend only

# Build
npm run build           # Build complete application
npm run build:client    # Build frontend only
npm run build:server    # Build backend only

# Production
npm start              # Start production server (unified)
npm run start:dev      # Start server in dev mode

# Standalone Mode
npm run start:standalone           # Start both frontend & backend standalone
npm run start:standalone:client   # Start frontend with Vite preview
npm run start:standalone:server   # Start backend standalone

# Utilities
npm run preview        # Preview built frontend
npm run create:server:package  # Generate production package.json
```

## 🐛 Troubleshooting

### Common Issues

1. **"React is not defined" error**

   - Pastikan semua komponen yang menggunakan JSX mengimpor React
   - Sudah diperbaiki dengan menambahkan `jsxRuntime: 'classic'` di Vite config

2. **"Failed to resolve module specifier 'dotenv'"**

   - File client menggunakan `client/config/client-config.js` yang tidak mengimpor dotenv
   - Server menggunakan `config/config.js` yang mengimpor dotenv

3. **404 pada assets**

   - Pastikan server production melayani static files dari `dist/client/`
   - Vite config menggunakan `base: "/"` untuk absolute paths

4. **Database connection error**
   - Periksa konfigurasi PostgreSQL di file `.env`
   - Pastikan database service berjalan

### Development Tips

- Gunakan browser DevTools Network tab untuk monitor API calls
- WebSocket connection terlihat di DevTools Application tab
- Redux DevTools extension untuk debugging state
- Hot reload aktif di development mode

## 📝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👥 Team

- **Frontend**: React, Vite, Material-UI
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL
- **Real-time**: WebSocket dengan Socket.io

---

**Developed with ❤️ for 360Booking Management System**
