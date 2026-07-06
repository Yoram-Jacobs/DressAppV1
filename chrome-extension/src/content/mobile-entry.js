import styles from './content.css?inline';

// Inject compiled CSS styles into the document head
try {
  const styleEl = document.createElement('style');
  styleEl.id = 'dressapp-mobile-styles';
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
} catch (e) {
  console.error('[DressApp/Mobile] Failed to inject styles:', e);
}

// Load and run the core content script
import './content.js';
