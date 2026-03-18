import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store/index.ts';
import App from './App.tsx';
import './index.scss';
import { PrimeReactProviderServiceComponent } from './services/components/PrimeReactProviderServiceComponent.tsx';

const Strict = ({ strict, children }: any) => {
  if (!strict) return children;
  return (
    <React.StrictMode>
      {children}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Strict strict={false}>
    <Provider store={store}>
      <PrimeReactProviderServiceComponent>
        <App />
      </PrimeReactProviderServiceComponent>
    </Provider>
  </Strict>,
)
