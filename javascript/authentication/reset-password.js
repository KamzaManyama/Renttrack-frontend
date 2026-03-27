
  (function() {
    // DOM elements
    const form = document.getElementById('reset-form');
    const passwordInput = document.getElementById('password');
    const confirmInput = document.getElementById('confirm-password');
    const passwordError = document.getElementById('password-error');
    const confirmError = document.getElementById('confirm-error');
    const resetBtn = document.getElementById('reset-btn');
    const successAlert = document.getElementById('success-alert');
    const errorAlert = document.getElementById('error-alert');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');
    const slugSpan = document.getElementById('slug-text');
    const tokenInput = document.getElementById('token');

    // Password strength elements
    const strengthBars = [
      document.getElementById('strength-1'),
      document.getElementById('strength-2'),
      document.getElementById('strength-3'),
      document.getElementById('strength-4')
    ];
    const strengthText = document.getElementById('strength-text');

    // Helper functions
    function hideAlerts() {
      successAlert.classList.remove('show');
      errorAlert.classList.remove('show');
    }

    function showSuccess(message) {
      successMessage.innerText = message;
      successAlert.classList.add('show');
    }

    function showError(message) {
      errorMessage.innerText = message;
      errorAlert.classList.add('show');
    }

    function setLoading(isLoading) {
      if (isLoading) {
        resetBtn.disabled = true;
        const originalText = resetBtn.innerHTML;
        resetBtn.innerHTML = `<span class="spinner"></span><span>Resetting...</span>`;
        resetBtn.setAttribute('data-original-text', originalText);
      } else {
        resetBtn.disabled = false;
        const original = resetBtn.getAttribute('data-original-text');
        if (original) {
          resetBtn.innerHTML = original;
        } else {
          resetBtn.innerHTML = 'Reset password';
        }
      }
    }

    function clearFieldErrors() {
      passwordInput.classList.remove('error');
      confirmInput.classList.remove('error');
      passwordError.classList.remove('show');
      confirmError.classList.remove('show');
    }

    // Password strength checker
    function checkPasswordStrength(password) {
      let strength = 0;
      
      if (password.length >= 8) strength++;
      if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
      if (password.match(/[0-9]/)) strength++;
      if (password.match(/[^a-zA-Z0-9]/)) strength++;
      
      // Update strength bars
      strengthBars.forEach((bar, index) => {
        if (index < strength) {
          bar.classList.add('active');
          if (strength === 1) bar.style.background = '#ef4444';
          else if (strength === 2) bar.style.background = '#f59e0b';
          else if (strength === 3) bar.style.background = '#10b981';
          else if (strength === 4) bar.style.background = '#10b981';
        } else {
          bar.classList.remove('active');
          bar.style.background = '#e2e8f0';
        }
      });
      
      // Update strength text
      if (strength === 0) strengthText.textContent = 'Very weak';
      else if (strength === 1) strengthText.textContent = 'Weak';
      else if (strength === 2) strengthText.textContent = 'Fair';
      else if (strength === 3) strengthText.textContent = 'Good';
      else if (strength === 4) strengthText.textContent = 'Strong';
      
      return strength;
    }

    function validatePassword(password) {
      if (!password) {
        return { valid: false, message: 'Password is required.' };
      }
      if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters.' };
      }
      return { valid: true, message: '' };
    }

    function validateConfirm(password, confirm) {
      if (!confirm) {
        return { valid: false, message: 'Please confirm your password.' };
      }
      if (password !== confirm) {
        return { valid: false, message: 'Passwords do not match.' };
      }
      return { valid: true, message: '' };
    }

    function validateForm() {
      clearFieldErrors();
      let isValid = true;
      
      const password = passwordInput.value;
      const confirm = confirmInput.value;
      
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        passwordError.textContent = passwordValidation.message;
        passwordError.classList.add('show');
        passwordInput.classList.add('error');
        isValid = false;
      }
      
      const confirmValidation = validateConfirm(password, confirm);
      if (!confirmValidation.valid) {
        confirmError.textContent = confirmValidation.message;
        confirmError.classList.add('show');
        confirmInput.classList.add('error');
        isValid = false;
      }
      
      return isValid;
    }

    // Get token from URL
    function getTokenFromUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      if (token) {
        tokenInput.value = token;
      }
      return token;
    }

    // API call to reset password
    async function resetPassword(token, newPassword) {
      // Replace with your actual API endpoint
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token: token,
          password: newPassword 
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reset password');
      }
      
      return await response.json();
    }

    // Form submission handler
    async function handleSubmit(e) {
      e.preventDefault();
      hideAlerts();
      
      if (!validateForm()) {
        return;
      }
      
      const token = tokenInput.value;
      if (!token) {
        showError('Invalid or expired reset link. Please request a new password reset.');
        return;
      }
      
      const newPassword = passwordInput.value;
      setLoading(true);
      
      try {
        // Call your actual API endpoint
        await resetPassword(token, newPassword);
        
        // Show success message
        showSuccess('Password reset successful! Redirecting to login...');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        
      } catch (error) {
        console.error('Password reset error:', error);
        showError(error.message || 'Unable to reset password. Please try again or request a new reset link.');
      } finally {
        setLoading(false);
      }
    }

    // Toggle password visibility
    function setupPasswordToggle(toggleBtn, inputField) {
      if (toggleBtn && inputField) {
        toggleBtn.addEventListener('click', function() {
          const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
          inputField.setAttribute('type', type);
          
          const eyeSvg = toggleBtn.querySelector('svg');
          if (type === 'text') {
            eyeSvg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
          } else {
            eyeSvg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
          }
        });
      }
    }

    // Load slug from env.js
    function loadSlug() {
      if (slugSpan) {
        if (typeof window.ENV !== 'undefined' && window.ENV.SLUG) {
          slugSpan.innerText = window.ENV.SLUG;
        } else if (typeof window.__ENV !== 'undefined' && window.__ENV.SLUG) {
          slugSpan.innerText = window.__ENV.SLUG;
        } else {
          slugSpan.innerText = 'RentTrack';
        }
      }
    }

    // Event listeners
    form.addEventListener('submit', handleSubmit);
    
    passwordInput.addEventListener('input', () => {
      const strength = checkPasswordStrength(passwordInput.value);
      clearFieldErrors();
      hideAlerts();
    });
    
    confirmInput.addEventListener('input', () => {
      clearFieldErrors();
      hideAlerts();
    });
    
    // Setup password toggles
    const toggle1 = document.getElementById('pw-toggle-1');
    const toggle2 = document.getElementById('pw-toggle-2');
    setupPasswordToggle(toggle1, passwordInput);
    setupPasswordToggle(toggle2, confirmInput);
    
    // Check for token in URL on load
    const token = getTokenFromUrl();
    if (!token) {
      showError('Invalid reset link. Please request a new password reset.');
    }
    
    // Load initial data
    loadSlug();
    
    // Mock API version (uncomment for testing without backend)
    /*
    async function resetPassword(token, newPassword) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (token && token.length > 10 && newPassword.length >= 8) {
            resolve({ success: true, message: 'Password reset successful' });
          } else {
            reject(new Error('Invalid token or password requirements not met'));
          }
        }, 1000);
      });
    }
    */
    
  })();
