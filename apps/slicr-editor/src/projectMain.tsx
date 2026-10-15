import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {ReadOnlyProjectApp} from './ReadOnlyProjectApp';
import './styles.css';
import './readOnlyProject.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReadOnlyProjectApp />
  </StrictMode>,
);
