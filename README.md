# SimpleRPG

A RPG game project built with:
- **Framework**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [SCSS](https://sass-lang.com/)

## Project Commands

### Development
Run the development server:
```bash
npm run dev
```

### Build
Build for production:
```bash
npm run build
```

### Lint
Check for linting issues:
```bash
npm run lint
```

### Preview
Preview the production build locally:
```bash
npm run preview
```

## Project Structure

- `src/store/`: Redux store configuration and slices.
- `src/index.scss`: Global styles with Tailwind directives.
- `src/App.tsx`: Main application component.
- `tailwind.config.js`: Tailwind CSS configuration.
- `postcss.config.js`: PostCSS configuration.

## Initialization Details

The project was initialized with a React-TS template and expanded to include:
1. **Redux Toolkit**: Set up with a dummy counter slice.
2. **Tailwind CSS**: Integrated with PostCSS and Autoprefixer.
3. **SCSS**: Configured for advanced styling capabilities.
