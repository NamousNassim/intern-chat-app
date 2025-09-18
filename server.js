const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(express.static("public"));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers for production
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    uptime: process.uptime()
  });
});

// Root route redirect
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// ...rest of your existing server.js code stays the same...

// Your existing functions (createProfileImage, createDefaultImages, etc.) remain unchanged
function createProfileImage(initial, color = '#007bff', size = 200) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}"/>
      <text x="${size/2}" y="${size/2 + 10}" 
            font-family="Arial, sans-serif" 
            font-size="${size * 0.4}" 
            font-weight="bold" 
            text-anchor="middle" 
            dominant-baseline="middle" 
            fill="white">${initial}</text>
    </svg>
  `;
  return svg;
}

function createDefaultImages() {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const attachmentsDir = path.join(__dirname, 'public', 'attachments');
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  const defaultImagePath = path.join(uploadsDir, 'default-avatar.svg');
  if (!fs.existsSync(defaultImagePath)) {
    const defaultSvg = createProfileImage('U', '#6c757d');
    fs.writeFileSync(defaultImagePath, defaultSvg);
    console.log("✅ Création de default-avatar.svg");
  }
}

createDefaultImages();

// Database initialization with better error handling
const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erreur connexion base de données:', err);
  } else {
    console.log('✅ Base de données SQLite connectée');
  }
});

// ...keep all your existing migration and setup functions...
// (migrateDatabase, setupAdmin, all routes, socket handling, etc.)

// Update the final server listen
server.listen(PORT, '0.0.0.0', () => {
  console.log("\n🚀 =====================================");
  console.log(`   🎯 Chat Entreprise Online!`);
  console.log(`   🌐 Port: ${PORT}`);
  console.log(`   🔧 Environment: ${NODE_ENV}`);
  console.log(`   🔑 Login: admin / admin`);
  if (NODE_ENV === 'production') {
    console.log(`   🔗 Your app is live on Railway!`);
  }
  console.log("=====================================\n");
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    if (db) {
      db.close();
    }
    process.exit(0);
  });
});