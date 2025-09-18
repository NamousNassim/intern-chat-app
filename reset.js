const fs = require('fs');
const path = require('path');

// Supprimer la base de données existante
const dbPath = path.join(__dirname, 'chat.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('Base de données supprimée');
}

// Supprimer les uploads générés
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (fs.existsSync(uploadsDir)) {
  const files = fs.readdirSync(uploadsDir);
  files.forEach(file => {
    if (file.startsWith('profile_') || file === 'admin.svg') {
      fs.unlinkSync(path.join(uploadsDir, file));
      console.log(`Supprimé: ${file}`);
    }
  });
}

console.log('Reset terminé. Relancez le serveur avec: npm start');