import { render, screen } from '@testing-library/react';
import TermosPage from './termos/page';
import PrivacidadePage from './privacidade/page';

it('renders terms with a contact email', () => {
  render(<TermosPage />);
  expect(screen.getByRole('heading', { name: /termos de uso/i })).toBeTruthy();
  expect(screen.getByText(/suporte@yield2pay.com.br/i)).toBeTruthy();
});

it('renders privacy with LGPD export and delete sections', () => {
  render(<PrivacidadePage />);
  expect(
    screen.getByRole('heading', { name: /política de privacidade/i }),
  ).toBeTruthy();
  expect(screen.getByText(/exportar/i)).toBeTruthy();
  expect(screen.getByText(/apagar/i)).toBeTruthy();
  expect(screen.getByText(/suporte@yield2pay.com.br/i)).toBeTruthy();
});
