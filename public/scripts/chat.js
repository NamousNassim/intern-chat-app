// Vérification de l'authentification
const userData = JSON.parse(localStorage.getItem('userData'));
if (!userData) {
  window.location.href = '/login.html'; 
}

// Afficher l'écran de chargement initial
showLoadingScreen('Connexion au serveur...');

// Initialisation
const socket = io();
const messagesContainer = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const attachmentInput = document.getElementById('attachmentInput');
const attachmentBtn = document.getElementById('attachmentBtn');
const attachmentPreview = document.getElementById('attachmentPreview');
const removeAttachment = document.getElementById('removeAttachment');
const currentUserPic = document.getElementById('currentUserPic');
const currentUsername = document.getElementById('currentUsername');
const onlineCount = document.getElementById('onlineCount');
const usersList = document.getElementById('usersList');
const adminPanelBtn = document.getElementById('adminPanelBtn');
const adminModal = document.getElementById('adminModal');
const logoutBtn = document.getElementById('logoutBtn');

// Variables pour l'attachement
let currentAttachment = null;

// Configuration utilisateur actuel
currentUserPic.src = userData.profilePic || '/uploads/default-avatar.svg';
currentUsername.textContent = userData.username;

// Afficher le bouton admin si nécessaire
if (userData.isAdmin) {
  adminPanelBtn.style.display = 'block';
}

// Authentifier le socket
socket.emit('authenticate', userData);

// Socket.IO - Connexion établie
socket.on('connect', () => {
  console.log('Connecté au serveur');
  updateLoadingMessage('Chargement des messages...');
});

// Socket.IO - Erreur de connexion
socket.on('connect_error', (error) => {
  console.error('Erreur de connexion:', error);
  showLoadingError('Erreur de connexion au serveur');
});

// Socket.IO - Authentification réussie
socket.on('activeUsers', (users) => {
  updateActiveUsers(users);
  onlineCount.textContent = users.length;
  
  // Cacher l'écran de chargement une fois tout chargé
  if (!document.querySelector('.loading-screen.hidden')) {
    hideLoadingScreen();
  }
});

// Charger l'historique des messages
loadMessageHistory();

// Événements Socket.IO
socket.on('chatMessage', (messageData) => {
  displayMessage(messageData);
});

socket.on('userJoined', (username) => {
  showNotification(`${username} a rejoint le chat`, 'success');
});

socket.on('userLeft', (username) => {
  showNotification(`${username} a quitté le chat`, 'info');
});

// Fonctions de chargement
function showLoadingScreen(message) {
  const loadingHtml = `
    <div class="loading-screen" id="loadingScreen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <h3>💬 Chat Entreprise</h3>
        <p id="loadingMessage">${message}</p>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('afterbegin', loadingHtml);
}

function updateLoadingMessage(message) {
  const loadingMessage = document.getElementById('loadingMessage');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

function showLoadingError(message) {
  const loadingMessage = document.getElementById('loadingMessage');
  const loadingScreen = document.getElementById('loadingScreen');
  
  if (loadingMessage && loadingScreen) {
    loadingMessage.textContent = message;
    loadingMessage.style.color = '#dc3545';
    
    // Ajouter un bouton de retry
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Réessayer';
    retryBtn.className = 'retry-btn';
    retryBtn.onclick = () => {
      location.reload();
    };
    
    loadingScreen.querySelector('.loading-content').appendChild(retryBtn);
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
  }
}

// Gestion des attachements
attachmentBtn.addEventListener('click', () => {
  attachmentInput.click();
});

attachmentInput.addEventListener('change', handleFileSelect);

removeAttachment.addEventListener('click', () => {
  currentAttachment = null;
  attachmentPreview.classList.remove('show');
  attachmentInput.value = '';
});

// Envoi de message
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const message = messageInput.value.trim();
  
  if (currentAttachment) {
    // Envoyer message avec attachement
    socket.emit('attachmentMessage', {
      message: message,
      attachmentUrl: currentAttachment.url,
      attachmentName: currentAttachment.originalName,
      attachmentSize: currentAttachment.size,
      attachmentIcon: currentAttachment.icon,
      formattedSize: currentAttachment.formattedSize
    });
    
    // Reset
    currentAttachment = null;
    attachmentPreview.classList.remove('show');
    attachmentInput.value = '';
  } else if (message) {
    // Envoyer message texte normal
    socket.emit('chatMessage', { message });
  }
  
  messageInput.value = '';
});

// Fonctions pour la gestion des fichiers
async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Vérifier la taille du fichier (50MB max)
  if (file.size > 50 * 1024 * 1024) {
    showNotification('Le fichier est trop volumineux (maximum 50MB)', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('attachment', file);

  try {
    // Afficher la preview avec barre de progression
    showAttachmentPreview(file);
    showUploadProgress();
    
    // Désactiver le bouton d'envoi pendant l'upload
    const sendBtn = document.querySelector('.send-btn');
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');

    const response = await fetch('/api/upload-attachment', {
      method: 'POST',
      body: formData
    });

    hideUploadProgress();
    sendBtn.disabled = false;
    sendBtn.classList.remove('loading');

    if (response.ok) {
      const result = await response.json();
      currentAttachment = result.file;
      updateAttachmentPreview(result.file);
      showNotification('Fichier téléchargé avec succès!', 'success');
    } else {
      const error = await response.json();
      showNotification('Erreur lors de l\'upload: ' + error.error, 'error');
      hideAttachmentPreview();
    }
  } catch (error) {
    console.error('Erreur upload:', error);
    showNotification('Erreur lors de l\'upload du fichier', 'error');
    hideAttachmentPreview();
    
    // Réactiver le bouton
    const sendBtn = document.querySelector('.send-btn');
    sendBtn.disabled = false;
    sendBtn.classList.remove('loading');
  }
}

function showAttachmentPreview(file) {
  const icon = getFileIcon(file.type);
  const formattedSize = formatFileSize(file.size);
  
  document.getElementById('attachmentIcon').textContent = icon;
  document.getElementById('attachmentName').textContent = file.name;
  document.getElementById('attachmentSize').textContent = formattedSize;
  
  attachmentPreview.classList.add('show');
}

function updateAttachmentPreview(fileInfo) {
  document.getElementById('attachmentIcon').textContent = fileInfo.icon;
  document.getElementById('attachmentName').textContent = fileInfo.originalName;
  document.getElementById('attachmentSize').textContent = fileInfo.formattedSize;
}

function hideAttachmentPreview() {
  attachmentPreview.classList.remove('show');
  currentAttachment = null;
  attachmentInput.value = '';
}

function showUploadProgress() {
  document.getElementById('uploadProgress').classList.add('show');
  document.getElementById('progressBar').style.width = '0%';
  
  // Simulation du progrès (dans un vrai projet, utilisez les events de upload)
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90; // Ne pas aller à 100% avant la fin
    document.getElementById('progressBar').style.width = progress + '%';
    
    if (progress >= 90) {
      clearInterval(interval);
    }
  }, 200);
}

function hideUploadProgress() {
  document.getElementById('uploadProgress').classList.remove('show');
  document.getElementById('progressBar').style.width = '100%';
  setTimeout(() => {
    document.getElementById('progressBar').style.width = '0%';
  }, 300);
}

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

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadMessageHistory() {
  try {
    updateLoadingMessage('Chargement de l\'historique...');
    const response = await fetch('/api/messages');
    const messages = await response.json();
    
    messages.forEach(message => displayMessage(message));
    scrollToBottom();
    
    // Si pas d'utilisateurs encore chargés, cacher l'écran de chargement
    if (document.getElementById('onlineCount').textContent === '0') {
      setTimeout(() => {
        hideLoadingScreen();
      }, 1000);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des messages:', error);
    showLoadingError('Erreur lors du chargement de l\'historique');
  }
}

function displayMessage(messageData) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${messageData.username === userData.username ? 'own' : 'other'}`;
  
  const time = new Date(messageData.timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let attachmentHtml = '';
  
  if (messageData.messageType === 'attachment' && messageData.attachmentUrl) {
    const isImage = messageData.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    
    if (isImage) {
      attachmentHtml = `
        <div class="image-attachment">
          <img src="${messageData.attachmentUrl}" 
               alt="${messageData.attachmentName}" 
               onclick="showImageModal('${messageData.attachmentUrl}')"
               loading="lazy">
        </div>
      `;
    } else {
      const icon = messageData.attachmentIcon || getFileIcon('');
      const size = messageData.attachmentSize ? formatFileSize(messageData.attachmentSize) : '';
      
      attachmentHtml = `
        <div class="attachment-message" onclick="downloadFile('${messageData.attachmentUrl}', '${messageData.attachmentName}')">
          <div class="attachment-content">
            <span class="attachment-file-icon">${icon}</span>
            <div class="attachment-file-info">
              <div class="attachment-file-name">${escapeHtml(messageData.attachmentName)}</div>
              <div class="attachment-file-size">${size}</div>
            </div>
            <button class="download-btn" onclick="event.stopPropagation(); downloadFile('${messageData.attachmentUrl}', '${messageData.attachmentName}')" title="Télécharger">
              ⬇️
            </button>
          </div>
        </div>
      `;
    }
  }
  
  messageElement.innerHTML = `
    <div class="message-bubble">
      ${messageData.username !== userData.username ? `
        <div class="message-header">
          <img src="${messageData.profilePic || '/uploads/default-avatar.svg'}" 
               class="message-profile-pic" 
               alt="Photo de profil de ${escapeHtml(messageData.username)}"
               loading="lazy">
          <span class="message-username">${escapeHtml(messageData.username)}</span>
        </div>
      ` : ''}
      ${messageData.message ? `<div class="message-text">${escapeHtml(messageData.message)}</div>` : ''}
      ${attachmentHtml}
      <div class="message-time">${time}</div>
    </div>
  `;
  
  messagesContainer.appendChild(messageElement);
  scrollToBottom();
}

function showImageModal(imageUrl) {
  document.getElementById('modalImage').src = imageUrl;
  document.getElementById('imageModal').classList.add('show');
  
  // Empêcher le scroll de la page
  document.body.style.overflow = 'hidden';
}

function closeImageModal() {
  document.getElementById('imageModal').classList.remove('show');
  
  // Réactiver le scroll de la page
  document.body.style.overflow = 'auto';
}

function downloadFile(url, filename) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showNotification(`Téléchargement de ${filename} commencé`, 'success');
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    showNotification('Erreur lors du téléchargement', 'error');
  }
}

function updateActiveUsers(users) {
  usersList.innerHTML = '';
  
  users.forEach(user => {
    if (user.username !== userData.username) {
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.innerHTML = `
        <img src="${user.profilePic || '/uploads/default-avatar.svg'}" 
             class="profile-pic" 
             alt="Photo de profil de ${escapeHtml(user.username)}"
             loading="lazy">
        <span class="username">${escapeHtml(user.username)}</span>
      `;
      usersList.appendChild(userElement);
    }
  });
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'info') {
  // Créer l'élément de notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Ajouter au DOM
  document.body.appendChild(notification);
  
  // Supprimer après 3 secondes
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Ajouter les styles pour slideOut et l'écran de chargement
const style = document.createElement('style');
style.textContent = `
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }

  .loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    transition: opacity 0.5s ease, visibility 0.5s ease;
  }

  .loading-screen.hidden {
    opacity: 0;
    visibility: hidden;
  }

  .loading-content {
    text-align: center;
    color: white;
  }

  .loading-content h3 {
    margin: 20px 0 10px 0;
    font-size: 2rem;
  }

  .loading-content p {
    margin: 10px 0;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .retry-btn {
    margin-top: 20px;
    padding: 12px 24px;
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid white;
    border-radius: 8px;
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.3s ease;
  }

  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;
document.head.appendChild(style);

// Fermer le modal image en cliquant à l'extérieur
document.getElementById('imageModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeImageModal();
  }
});

// Fermer avec la touche Échap
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.getElementById('imageModal').classList.contains('show')) {
      closeImageModal();
    }
    if (adminModal.style.display === 'flex') {
      adminModal.style.display = 'none';
    }
  }
});

// Gestion du panel admin
if (userData.isAdmin) {
  adminPanelBtn.addEventListener('click', () => {
    adminModal.style.display = 'flex';
    loadUsers();
  });

  document.getElementById('closeAdmin').addEventListener('click', () => {
    adminModal.style.display = 'none';
  });

  // Ajouter un utilisateur
  document.getElementById('addUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    
    if (!username || !password) {
      showNotification('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }
    
    formData.append('username', username);
    formData.append('password', password);
    formData.append('isAdmin', document.getElementById('isAdmin').checked);
    
    const profilePicFile = document.getElementById('profilePicFile').files[0];
    if (profilePicFile) {
      formData.append('profilePic', profilePicFile);
    }
    
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        showNotification('Utilisateur ajouté avec succès', 'success');
        document.getElementById('addUserForm').reset();
        loadUsers();
      } else {
        showNotification('Erreur: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erreur ajout utilisateur:', error);
      showNotification('Erreur lors de l\'ajout de l\'utilisateur', 'error');
    }
  });

  async function loadUsers() {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      
      const userManagement = document.getElementById('userManagement');
      userManagement.innerHTML = '';
      
      users.forEach(user => {
        if (user.id !== 1) { // Ne pas afficher l'admin principal
          const userElement = document.createElement('div');
          userElement.className = 'user-management-item';
          userElement.innerHTML = `
            <div>
              <strong>${escapeHtml(user.username)}</strong>
              ${user.isAdmin ? ' <span style="color: #dc3545; font-weight: bold;">(Admin)</span>' : ''}
              <div style="font-size: 12px; color: #666; margin-top: 2px;">
                Créé le: ${new Date(user.createdAt).toLocaleDateString('fr-FR')}
              </div>
            </div>
            <button class="delete-user-btn" onclick="deleteUser(${user.id})" title="Supprimer cet utilisateur">
              Supprimer
            </button>
          `;
          userManagement.appendChild(userElement);
        }
      });
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      showNotification('Erreur lors du chargement des utilisateurs', 'error');
    }
  }

  window.deleteUser = async function(userId) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        showNotification('Utilisateur supprimé avec succès', 'success');
        loadUsers();
      } else {
        showNotification('Erreur: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      showNotification('Erreur lors de la suppression', 'error');
    }
  };
}

// Déconnexion
logoutBtn.addEventListener('click', () => {
  if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
    localStorage.removeItem('userData');
    showNotification('Déconnexion réussie', 'success');
    setTimeout(() => {
      window.location.href = '/login.html';
    }, 1000);
  }
});

// Fermer le modal admin en cliquant à l'extérieur
adminModal.addEventListener('click', (e) => {
  if (e.target === adminModal) {
    adminModal.style.display = 'none';
  }
});

// Auto-focus sur le champ de message une fois chargé
setTimeout(() => {
  if (messageInput) {
    messageInput.focus();
  }
}, 1500);

// Envoyer message avec Ctrl+Enter
messageInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    messageForm.dispatchEvent(new Event('submit'));
  }
});

// Notification de nouvelle connection
window.addEventListener('beforeunload', () => {
  if (socket) {
    socket.disconnect();
  }
});

// Afficher un message de bienvenue une fois tout chargé
setTimeout(() => {
  if (!document.getElementById('loadingScreen')) {
    showNotification(`Bienvenue ${userData.username}! 👋`, 'success');
  }
}, 2000);