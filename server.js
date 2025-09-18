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
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fonction pour créer une image SVG simple avec initiale
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

// Créer les images par défaut si elles n'existent pas
function createDefaultImages() {
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Créer dossier pour les fichiers attachés
  const attachmentsDir = path.join(__dirname, 'public', 'attachments');
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
  }

  // Image utilisateur par défaut (garder le SVG pour les autres)
  const defaultImagePath = path.join(uploadsDir, 'default-avatar.svg');
  if (!fs.existsSync(defaultImagePath)) {
    const defaultSvg = createProfileImage('U', '#6c757d');
    fs.writeFileSync(defaultImagePath, defaultSvg);
    console.log("Création de default-avatar.svg");
  }
}

// Créer les images par défaut au démarrage
createDefaultImages();

// Initialisation de la base de données
const db = new sqlite3.Database("chat.db");

// Fonction pour vérifier et migrer la base de données
function migrateDatabase() {
  return new Promise((resolve, reject) => {
    // Vérifier si la table messages existe
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='messages'", (err, result) => {
      if (err) {
        console.log("Erreur lors de la vérification de la table:", err);
        reject(err);
        return;
      }

      if (!result) {
        console.log("Table messages n'existe pas encore, elle sera créée");
        resolve();
        return;
      }

      // Vérifier si les colonnes messageType existent
      db.all("PRAGMA table_info(messages)", (err, columns) => {
        if (err) {
          console.log("Erreur lors de la vérification des colonnes:", err);
          reject(err);
          return;
        }

        const hasMessageType = columns.some(col => col.name === 'messageType');
        const hasAttachmentUrl = columns.some(col => col.name === 'attachmentUrl');
        const hasAttachmentName = columns.some(col => col.name === 'attachmentName');
        const hasAttachmentSize = columns.some(col => col.name === 'attachmentSize');

        let alterQueries = [];

        if (!hasMessageType) {
          alterQueries.push("ALTER TABLE messages ADD COLUMN messageType TEXT DEFAULT 'text'");
        }
        if (!hasAttachmentUrl) {
          alterQueries.push("ALTER TABLE messages ADD COLUMN attachmentUrl TEXT");
        }
        if (!hasAttachmentName) {
          alterQueries.push("ALTER TABLE messages ADD COLUMN attachmentName TEXT");
        }
        if (!hasAttachmentSize) {
          alterQueries.push("ALTER TABLE messages ADD COLUMN attachmentSize INTEGER");
        }

        if (alterQueries.length === 0) {
          console.log("Base de données déjà à jour");
          resolve();
          return;
        }

        console.log("Migration de la base de données en cours...");
        
        // Exécuter les requêtes de migration
        let completed = 0;
        alterQueries.forEach((query, index) => {
          db.run(query, (err) => {
            if (err) {
              console.log(`Erreur migration ${index}:`, err.message);
              // Ne pas rejeter, continuer avec les autres
            } else {
              console.log(`Migration ${index + 1}/${alterQueries.length} réussie`);
            }
            
            completed++;
            if (completed === alterQueries.length) {
              console.log("Migration terminée");
              resolve();
            }
          });
        });
      });
    });
  });
}

// Fonction pour créer/mettre à jour l'admin
function setupAdmin() {
  return new Promise((resolve, reject) => {
    // Déterminer l'image admin à utiliser
    let adminProfilePic = '/uploads/admin.svg'; // Par défaut
    const logoPath = path.join(__dirname, 'public', 'logo.png');
    
    if (fs.existsSync(logoPath)) {
      adminProfilePic = '/logo.png';
      console.log("✅ Utilisation de logo.png pour l'admin");
    } else {
      // Créer admin.svg si logo.png n'existe pas
      const adminImagePath = path.join(__dirname, 'public', 'uploads', 'admin.svg');
      if (!fs.existsSync(adminImagePath)) {
        const adminSvg = createProfileImage('A', '#dc3545');
        fs.writeFileSync(adminImagePath, adminSvg);
        console.log("Création de admin.svg");
      }
    }

    const adminPassword = bcrypt.hashSync("admin", 10);

    // Vérifier si l'admin existe déjà
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, existingAdmin) => {
      if (err) {
        console.log("Erreur lors de la vérification de l'admin:", err);
        reject(err);
        return;
      }

      if (existingAdmin) {
        // Mettre à jour l'admin existant
        db.run("UPDATE users SET password = ?, profilePic = ?, isAdmin = 1 WHERE username = 'admin'", 
          [adminPassword, adminProfilePic], 
          function(updateErr) {
            if (updateErr) {
              console.log("Erreur mise à jour admin:", updateErr);
              reject(updateErr);
            } else {
              console.log("✅ Admin mis à jour avec l'image:", adminProfilePic);
              resolve();
            }
          }
        );
      } else {
        // Créer un nouvel admin
        db.run("INSERT INTO users (username, password, isAdmin, profilePic) VALUES (?, ?, 1, ?)", 
          ["admin", adminPassword, adminProfilePic], 
          function(insertErr) {
            if (insertErr) {
              console.log("Erreur création admin:", insertErr);
              reject(insertErr);
            } else {
              console.log("✅ Admin créé avec l'image:", adminProfilePic);
              resolve();
            }
          }
        );
      }
    });
  });
}

// Créer les tables et migrer
db.serialize(async () => {
  console.log("🚀 Initialisation de la base de données...");

  // Table des utilisateurs
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profilePic TEXT,
    isAdmin BOOLEAN DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.log("Erreur création table users:", err);
    } else {
      console.log("✅ Table users OK");
    }
  });

  // Table des messages (version de base)
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    username TEXT,
    message TEXT,
    profilePic TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id)
  )`, (err) => {
    if (err) {
      console.log("Erreur création table messages:", err);
    } else {
      console.log("✅ Table messages OK");
    }
  });

  try {
    // Migrer la base de données si nécessaire
    await migrateDatabase();
    console.log("✅ Migration terminée");

    // Créer/mettre à jour l'admin
    await setupAdmin();
    console.log("✅ Admin configuré");

  } catch (error) {
    console.log("❌ Erreur lors de l'initialisation:", error);
  }
});

// Configuration Multer pour les photos de profil
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "public/uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seules les images sont autorisées"));
    }
  }
});

// Configuration Multer pour les attachments de chat
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const attachmentDir = "public/attachments/";
    if (!fs.existsSync(attachmentDir)) {
      fs.mkdirSync(attachmentDir, { recursive: true });
    }
    cb(null, attachmentDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const attachmentUpload = multer({
  storage: attachmentStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB pour les documents
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  }
});

// Fonction pour obtenir l'icône du type de fichier
function getFileIcon(mimetype) {
  if (mimetype.startsWith('image/')) return '🖼️';
  if (mimetype === 'application/pdf') return '📄';
  if (mimetype.includes('word') || mimetype.includes('document')) return '📝';
  if (mimetype.includes('excel') || mimetype.includes('sheet')) return '📊';
  if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return '📋';
  if (mimetype === 'text/plain') return '📄';
  if (mimetype.includes('zip') || mimetype.includes('rar')) return '🗜️';
  return '📎';
}

// Fonction pour formater la taille du fichier
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Fonction pour créer une image de profil automatique basée sur l'initiale
function createUserProfileImage(username) {
  const initial = username.charAt(0).toUpperCase();
  const colors = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6f42c1', '#fd7e14'];
  const colorIndex = username.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];
  
  const svg = createProfileImage(initial, color);
  const filename = `profile_${username}_${Date.now()}.svg`;
  const filepath = path.join(__dirname, 'public', 'uploads', filename);
  
  fs.writeFileSync(filepath, svg);
  return `/uploads/${filename}`;
}

// Routes API

// Connexion utilisateur
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  
  console.log(`🔐 Tentative de connexion: ${username}`);
  
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) {
      console.log("❌ Erreur DB:", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }
    
    if (!user) {
      console.log("❌ Utilisateur non trouvé:", username);
      return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    }
    
    const passwordValid = bcrypt.compareSync(password, user.password);
    if (!passwordValid) {
      console.log("❌ Mot de passe incorrect pour:", username);
      return res.status(401).json({ error: "Nom d'utilisateur ou mot de passe incorrect" });
    }
    
    console.log(`✅ Connexion réussie: ${username} (Admin: ${user.isAdmin})`);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        profilePic: user.profilePic,
        isAdmin: user.isAdmin
      }
    });
  });
});

// Upload d'attachement
app.post("/api/upload-attachment", attachmentUpload.single("attachment"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier sélectionné" });
  }

  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    url: `/attachments/${req.file.filename}`,
    icon: getFileIcon(req.file.mimetype),
    formattedSize: formatFileSize(req.file.size)
  };

  res.json({
    success: true,
    file: fileInfo
  });
});

// Récupérer tous les utilisateurs (admin seulement)
app.get("/api/users", (req, res) => {
  db.all("SELECT id, username, profilePic, isAdmin, createdAt FROM users", (err, users) => {
    if (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
    res.json(users);
  });
});

// Ajouter un utilisateur (admin seulement)
app.post("/api/users", profileUpload.single("profilePic"), (req, res) => {
  const { username, password, isAdmin } = req.body;
  
  let profilePic;
  if (req.file) {
    profilePic = `/uploads/${req.file.filename}`;
  } else {
    // Créer une image de profil automatique avec l'initiale
    profilePic = createUserProfileImage(username);
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run(
    "INSERT INTO users (username, password, profilePic, isAdmin) VALUES (?, ?, ?, ?)",
    [username, hashedPassword, profilePic, isAdmin === "true"],
    function(err) {
      if (err) {
        return res.status(400).json({ error: "Nom d'utilisateur déjà utilisé" });
      }
      res.json({ success: true, userId: this.lastID });
    }
  );
});

// Supprimer un utilisateur (admin seulement)
app.delete("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  
  // Récupérer l'utilisateur pour supprimer sa photo de profil si c'est une image générée
  db.get("SELECT profilePic FROM users WHERE id = ? AND id != 1", [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Erreur serveur" });
    }
    
    db.run("DELETE FROM users WHERE id = ? AND id != 1", [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: "Utilisateur non trouvé ou impossible à supprimer" });
      }
      
      // Supprimer la photo de profil si c'est une image générée
      if (user && user.profilePic && user.profilePic.includes('profile_')) {
        const imagePath = path.join(__dirname, 'public', user.profilePic);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      res.json({ success: true });
    });
  });
});

// Récupérer l'historique des messages
app.get("/api/messages", (req, res) => {
  db.all(
    "SELECT * FROM messages ORDER BY timestamp ASC LIMIT 100",
    (err, messages) => {
      if (err) {
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json(messages);
    }
  );
});

// Gestion Socket.IO
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("👤 Nouvel utilisateur connecté:", socket.id);

  // Authentification socket
  socket.on("authenticate", (userData) => {
    connectedUsers.set(socket.id, userData);
    socket.broadcast.emit("userJoined", userData.username);
    
    // Envoyer la liste des utilisateurs connectés
    const activeUsers = Array.from(connectedUsers.values());
    io.emit("activeUsers", activeUsers);
    console.log(`✅ ${userData.username} authentifié`);
  });

  // Nouveau message texte
  socket.on("chatMessage", (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const messageData = {
      userId: user.id,
      username: user.username,
      message: data.message,
      profilePic: user.profilePic,
      messageType: 'text',
      timestamp: new Date().toISOString()
    };

    // Sauvegarder en base
    db.run(
      "INSERT INTO messages (userId, username, message, profilePic, messageType) VALUES (?, ?, ?, ?, ?)",
      [messageData.userId, messageData.username, messageData.message, messageData.profilePic, messageData.messageType],
      function(err) {
        if (err) {
          console.log("❌ Erreur sauvegarde message:", err);
        }
      }
    );

    // Diffuser le message
    io.emit("chatMessage", messageData);
  });

  // Nouveau message avec attachement
  socket.on("attachmentMessage", (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return;

    const messageData = {
      userId: user.id,
      username: user.username,
      message: data.message || '',
      profilePic: user.profilePic,
      messageType: 'attachment',
      attachmentUrl: data.attachmentUrl,
      attachmentName: data.attachmentName,
      attachmentSize: data.attachmentSize,
      attachmentIcon: data.attachmentIcon,
      formattedSize: data.formattedSize,
      timestamp: new Date().toISOString()
    };

    // Sauvegarder en base
    db.run(
      "INSERT INTO messages (userId, username, message, profilePic, messageType, attachmentUrl, attachmentName, attachmentSize) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [messageData.userId, messageData.username, messageData.message, messageData.profilePic, messageData.messageType, messageData.attachmentUrl, messageData.attachmentName, messageData.attachmentSize],
      function(err) {
        if (err) {
          console.log("❌ Erreur sauvegarde attachment:", err);
        }
      }
    );

    // Diffuser le message
    io.emit("chatMessage", messageData);
  });

  // Utilisateur se déconnecte
  socket.on("disconnect", () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit("userLeft", user.username);
      connectedUsers.delete(socket.id);
      
      // Mettre à jour la liste des utilisateurs connectés
      const activeUsers = Array.from(connectedUsers.values());
      io.emit("activeUsers", activeUsers);
      console.log(`👋 ${user.username} déconnecté`);
    }
  });
});

server.listen(PORT, () => {
  console.log("\n🚀 =================================");
  console.log(`   Chat Entreprise démarré !`);
  console.log(`   Port: ${PORT}`);
  console.log("   Connexion: admin / admin");
  console.log("=================================\n");
});