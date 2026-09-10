import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LaboratoryWorkspace } from './App';
import { MockLaboratoryProvider } from './provider';

createRoot(document.getElementById('root')!).render(<StrictMode><MockLaboratoryProvider><LaboratoryWorkspace /></MockLaboratoryProvider></StrictMode>);
