/**
 * Toast Notifications Module
 * Lekki system powiadomień typu toast jako zamiennik alert()
 * @version 1.0.0
 */

const ToastModule = (() => {
  let toastContainer = null;
  let toastId = 0;

  /**
   * Inicjalizuje kontener dla toastów
   */
  function init() {
    if (toastContainer) return;

    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  /**
   * Wyświetla toast notification
   * @param {string} message - Treść wiadomości
   * @param {object} options - Opcje toasta
   * @param {string} options.type - Typ: 'info', 'success', 'warning', 'error'
   * @param {number} options.duration - Czas wyświetlania w ms (0 = infinite)
   * @param {string} options.title - Opcjonalny tytuł
   * @returns {HTMLElement} Element toasta
   */
  function show(message, options = {}) {
    init();

    const {
      type = 'info',
      duration = 5000,
      title = null,
      rawHtml = false
    } = options;

    const toast = document.createElement('div');
    const id = `toast-${++toastId}`;
    toast.id = id;
    toast.className = `toast toast-${type}`;

    // Ikona w zależności od typu
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    // Struktura toasta
    let html = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
        <div class="toast-message">${rawHtml ? message : escapeHtml(message)}</div>
      </div>
      <button class="toast-close" onclick="ToastModule.close('${id}')">&times;</button>
    `;

    toast.innerHTML = html;
    toastContainer.appendChild(toast);

    // Animacja wejścia
    setTimeout(() => toast.classList.add('toast-show'), 10);

    // Auto-zamykanie
    if (duration > 0) {
      setTimeout(() => close(id), duration);
    }

    return toast;
  }

  /**
   * Zamyka toast o podanym ID
   * @param {string} id - ID toasta do zamknięcia
   */
  function close(id) {
    const toast = document.getElementById(id);
    if (!toast) return;

    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Zamyka wszystkie toasty
   */
  function closeAll() {
    if (!toastContainer) return;

    const toasts = toastContainer.querySelectorAll('.toast');
    toasts.forEach(toast => close(toast.id));
  }

  /**
   * Helper: escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Skróty dla różnych typów
  const info = (message, options = {}) => show(message, { ...options, type: 'info' });
  const success = (message, options = {}) => show(message, { ...options, type: 'success' });
  const warning = (message, options = {}) => show(message, { ...options, type: 'warning' });
  const error = (message, options = {}) => show(message, { ...options, type: 'error' });

  // Publiczne API
  return {
    init,
    show,
    close,
    closeAll,
    info,
    success,
    warning,
    error
  };
})();

// Export jako globalny obiekt
if (typeof window !== 'undefined') {
  window.ToastModule = ToastModule;
}

export default ToastModule;
