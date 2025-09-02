/**
 * HTML templates for OAuth callback responses
 */

export function getSuccessHtml(): string {
	return `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Successful</title>
    <style>
      body { 
        font-family: system-ui, -apple-system, sans-serif; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      }
      .container { 
        text-align: center; 
        padding: 3rem; 
        background: white; 
        border-radius: 12px; 
        box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
      }
      h1 { 
        color: #28a745; 
        margin-bottom: 1rem; 
      }
      p { 
        color: #666; 
        margin-top: 1rem; 
      }
      .checkmark { 
        width: 80px; 
        height: 80px; 
        margin: 0 auto 1rem; 
      }
    </style>
  </head>
  <body>
    <div class="container">
      <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="25" fill="none" stroke="#28a745" stroke-width="2"/>
        <path fill="none" stroke="#28a745" stroke-width="3" d="M14 27l7 7 16-16"/>
      </svg>
      <h1>Authentication Successful!</h1>
      <p>You can close this window and return to your terminal.</p>
      <p style="color: #999; font-size: 0.9rem; margin-top: 2rem;">Task Master CLI</p>
    </div>
  </body>
</html>
`;
}

export function getErrorHtml(errorMessage: string): string {
	return `
<!DOCTYPE html>
<html>
  <head>
    <title>Authentication Failed</title>
    <style>
      body { 
        font-family: system-ui, -apple-system, sans-serif; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        height: 100vh; 
        margin: 0; 
        background: #f5f5f5; 
      }
      .container { 
        text-align: center; 
        padding: 2rem; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      }
      h1 { 
        color: #dc3545; 
      }
      p { 
        color: #666; 
        margin-top: 1rem; 
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>❌ Authentication Failed</h1>
      <p>${errorMessage}</p>
      <p>You can close this window and try again.</p>
    </div>
  </body>
</html>
`;
}

export function getSecurityErrorHtml(): string {
	return `
<!DOCTYPE html>
<html>
  <head>
    <title>Security Error</title>
    <style>
      body { 
        font-family: system-ui, -apple-system, sans-serif; 
        display: flex; 
        justify-content: center; 
        align-items: center; 
        height: 100vh; 
        margin: 0; 
        background: #f5f5f5; 
      }
      .container { 
        text-align: center; 
        padding: 2rem; 
        background: white; 
        border-radius: 8px; 
        box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
      }
      h1 { 
        color: #dc3545; 
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>⚠️ Security Error</h1>
      <p>Invalid state parameter. Please try again.</p>
    </div>
  </body>
</html>
`;
}
