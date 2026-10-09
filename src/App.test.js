import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the demo sign-in form', () => {
  render(<App />);
  expect(screen.getByPlaceholderText(/usuario/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText('CONTRASEÑA')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
});
