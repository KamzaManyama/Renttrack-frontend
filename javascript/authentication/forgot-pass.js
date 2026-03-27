
  (function() {
    // DOM elements
    const form = document.getElementById('forgot-form');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    const resetBtn = document.getElementById('reset-btn');
    const successAlert = document.getElementById('success-alert');
    const errorAlert = document.getElementById('error-alert');
    const successMessage = document.getElementById('success-message');
    const errorMessage = document.getElementById('error-message');
    const slugSpan = document.getElementById('slug-text');

    // Helper functions
    function hideAlerts() {
      successAlert.classList.remove('show');
      errorAlert.classList.remove('show');
    }

    function showSuccess(message) {
      successMessage.innerText = message;
      successAlert.classList.add('show');
      setTimeout(() => {
        successAlert.classList.remove('show');
      }, 5000);
    }

    function showError(message) {
      errorMessage.innerText = message;
      errorAlert.classList.add('show');
      setTimeout(() => {
        errorAlert.classList.remove('show');
      }, 5000);
    }

    function setLoading(isLoading) {
      if (isLoading) {
        resetBtn.disabled = true;
        const originalText = resetBtn.innerHTML;
        resetBtn.innerHTML = `<span class="spinner"></span><span>Sending...</span>`;
        resetBtn.setAttribute('data-original-text', originalText);
      } else {
        resetBtn.disabled = false;
        const original = resetBtn.getAttribute('data-original-text');
        if (original) {
          resetBtn.innerHTML = original;
        } else {
          resetBtn.innerHTML = 'Send reset link';
        }
      }
    }

    function clearFieldError() {
      emailInput.classList.remove('error');
      emailError.classList.remove('show');
    }

    function validateEmail(email) {
      const re = /^[^\s@]+@([^\s@]+\.)+[^\s@]+$/;
      return re.test(String(email).toLowerCase());
    }

    function validateForm() {
      let isValid = true;
      const emailVal = emailInput.value.trim();
      
      if (!emailVal) {
        emailError.innerText = 'Email address is required.';
        emailError.classList.add('show');
        emailInput.classList.add('error');
        isValid = false;
      } else if (!validateEmail(emailVal)) {
        emailError.innerText = 'Please enter a valid email address.';
        emailError.classList.add('show');
        emailInput.classList.add('error');
        isValid = false;
      } else {
        clearFieldError();
      }
      
      return isValid;
    }

    // API call to request password reset
    async function requestPasswordReset(email) {
      // Replace this with your actual API endpoint
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send reset link');
      }
      
      return await response.json();
    }

    // Form submission handler
    async function handleSubmit(e) {
      e.preventDefault();
      hideAlerts();
      clearFieldError();
      
      if (!validateForm()) {
        return;
      }
      
      const email = emailInput.value.trim();
      setLoading(true);
      
      try {
        // Call your actual API endpoint
        await requestPasswordReset(email);
        
        // Show success message
        showSuccess(`Reset link sent to ${email}. Please check your inbox.`);
        form.reset();
        
        // Optional: redirect after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        
      } catch (error) {
        console.error('Password reset error:', error);
        showError(error.message || 'Unable to send reset link. Please try again later.');
      } finally {
        setLoading(false);
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
    emailInput.addEventListener('input', () => {
      clearFieldError();
      hideAlerts();
    });
    
    // Clear alerts when typing
    emailInput.addEventListener('focus', hideAlerts);
    
    // Load initial data
    loadSlug();
    
    // If you're not ready with the API endpoint yet, you can use this mock version:
    // Uncomment the lines below and comment out the real API call above for testing
    
    /*
    async function requestPasswordReset(email) {
      // Mock API call - replace with real implementation
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (email && validateEmail(email)) {
            resolve({ success: true, message: 'Reset link sent' });
          } else {
            reject(new Error('Email not found in our system'));
          }
        }, 1000);
      });
    }
    */
    
  })();
