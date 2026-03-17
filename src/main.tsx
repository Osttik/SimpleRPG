import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/index.ts';
import App from './App.tsx';
import './index.scss';
import { PrimeReactProviderServiceComponent } from './services/components/PrimeReactProviderServiceComponent.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <PrimeReactProviderServiceComponent>
        <App />
      </PrimeReactProviderServiceComponent>
    </Provider>
  </React.StrictMode>,
)
