const fs = require('fs');
const path = require('path');

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

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Créer l'image admin par défaut
const adminSvg = createProfileImage('A', '#dc3545'); // Rouge pour admin
fs.writeFileSync(path.join(uploadsDir, 'admin.svg'), adminSvg);

// Créer l'image utilisateur par défaut
const defaultSvg = createProfileImage('U', '#6c757d'); // Gris pour utilisateur
fs.writeFileSync(path.join(uploadsDir, 'default-avatar.svg'), defaultSvg);

console.log('Images par défaut créées avec succès !');