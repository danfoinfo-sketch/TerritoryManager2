// Global styles for map components
export const globalStyles = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject global styles into document head
export const injectGlobalStyles = () => {
  if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = globalStyles;
    document.head.appendChild(style);
  }
};