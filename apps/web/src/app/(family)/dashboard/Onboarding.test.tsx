/**
 * Módulo: Onboarding
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: O primeiro acesso não avança um nome curto, o pular monta o painel e a falha fica na tela.
 * Sequência: does not advance a one-character name; skip lands on the result and finish sends the empty answers; stays on the result when saving fails.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Onboarding } from './Onboarding';

describe('onboarding de primeiro acesso', () => {
  it('does not advance a one-character name', () => {
    render(<Onboarding onSave={vi.fn()} onFinish={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'A' } });
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('skip lands on the result and finish sends the empty answers', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onFinish = vi.fn();
    render(<Onboarding onSave={onSave} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pular por agora' }));
    expect(screen.getByRole('heading', { name: 'Seu painel está montado.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o painel' }));
    await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({
      fullName: null,
      displayName: null,
      goals: [],
      importMode: null,
      cryptoFamiliarity: null,
      cryptoActions: [],
      showFreedom: true,
      showFamily: false,
      learnCrypto: false,
    });
    expect(onFinish).toHaveBeenCalled();
  });

  it('stays on the result when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'));
    const onFinish = vi.fn();
    render(<Onboarding onSave={onSave} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pular por agora' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir para o painel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(screen.getByRole('button', { name: 'Ir para o painel' })).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Seu painel está montado.' })).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
