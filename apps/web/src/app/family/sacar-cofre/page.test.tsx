import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../_components/VenueMoveForm', () => ({
  VenueMoveForm: ({ mode }: { mode: string }) => <div data-testid="venue-move-form">{mode}</div>,
}));

import FamilyVaultWithdrawPage from './page';

describe('/family/sacar-cofre', () => {
  it('renderiza VenueMoveForm em modo withdraw', () => {
    render(<FamilyVaultWithdrawPage />);
    expect(screen.getByTestId('venue-move-form')).toHaveTextContent('withdraw');
  });
});
