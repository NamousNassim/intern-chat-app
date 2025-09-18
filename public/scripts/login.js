document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorMessage = document.getElementById('error-message');

  // Vérifier si l'utilisateur est déjà connecté
  const userData = localStorage.getItem('userData');
  if (userData) {
    window.location.href = '/chat.html'; // Changed from '/' to '/chat.html'
  }

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    
    if (!username || !password) {
      showError('Veuillez remplir tous les champs');
      return;
    }
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Sauvegarder les données utilisateur
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        // Rediriger vers le chat
        window.location.href = '/chat.html'; // Changed from '/' to '/chat.html'
      } else {
        showError(data.error || 'Erreur de connexion');
      }
    } catch (error) {
      showError('Erreur de connexion au serveur');
    }
  });

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    
    setTimeout(() => {
      errorMessage.classList.remove('show');
    }, 5000);
  }
});