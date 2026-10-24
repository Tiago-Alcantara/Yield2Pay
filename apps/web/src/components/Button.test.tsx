/**
 * Módulo: Button
 * Criado em: 2026-06-24
 * Última atualização: 2026-10-22
 * Intuito: O botão dispara o clique e fica mudo quando está desabilitado.
 * Sequência: renders label and fires onClick; does not fire when disabled.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders label and fires onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="chrome" onClick={onClick}>
        Get started
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button variant="ghost" onClick={onClick} disabled>
        X
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
