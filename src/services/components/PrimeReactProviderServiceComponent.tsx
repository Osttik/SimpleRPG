import type { PropsWithChildren } from "react";
import { PrimeReactProvider, type APIOptions } from 'primereact/api';

import 'primereact/resources/themes/viva-dark/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

const ptOptions: Partial<APIOptions> = {
  inputStyle: 'outlined',
};

export const PrimeReactProviderServiceComponent = ({ children }: PropsWithChildren) => {

  return (
    <PrimeReactProvider value={ptOptions}>
      {children}
    </PrimeReactProvider>
  );
}