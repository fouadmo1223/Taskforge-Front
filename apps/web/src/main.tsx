import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './styles/index.css';
import { router } from '@/app/router';
import { AppProviders } from '@/app/providers';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing');

createRoot(rootEl).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
