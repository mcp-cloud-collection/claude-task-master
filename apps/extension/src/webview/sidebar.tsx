import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidebarView } from './components/SidebarView';
import './index.css';

// Mount the React app
const root = ReactDOM.createRoot(
	document.getElementById('root') as HTMLElement
);
root.render(
	<React.StrictMode>
		<SidebarView />
	</React.StrictMode>
);
