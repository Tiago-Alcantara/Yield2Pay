import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/errorCopy';

export default function TermosPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0c0d0f',
        color: '#EDEFF1',
        padding: '48px 24px 80px',
      }}
    >
      <article style={{ maxWidth: 720, margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: 16, marginBottom: 32, fontSize: 14 }}>
          <Link href="/" style={{ color: '#C8CACD' }}>
            Início
          </Link>
          <Link href="/login" style={{ color: '#C8CACD' }}>
            Entrar
          </Link>
        </nav>

        <h1 style={{ fontSize: 32, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Termos de Uso
        </h1>
        <p style={{ color: '#9A9DA1', margin: '0 0 32px' }}>Vigência: 2026</p>

        <h2>Aceite</h2>
        <p>
          Ao criar uma conta ou usar o Yield2Pay, você concorda com estes termos.
          Se não concordar, não use o serviço.
        </p>

        <h2>O que é o Yield2Pay</h2>
        <p>
          O Yield2Pay é uma ferramenta de pagamento para empresas. Não somos
          instituição financeira, banco ou corretora. Qualquer rendimento
          associado a depósitos é variável e pode ser zero; não há garantia de
          retorno.
        </p>

        <h2>Conta</h2>
        <p>
          O acesso é feito com Google, intermediado pelo Privy. Você é
          responsável pela conta Google vinculada e por manter o e-mail
          acessível.
        </p>

        <h2>Uso aceitável</h2>
        <p>
          Use o serviço apenas para pagar contas da sua empresa de forma lícita.
          É proibido fraudar, burlar limites, usar dados de terceiros sem
          autorização ou operar em nome de quem não representa.
        </p>

        <h2>Limitação de responsabilidade</h2>
        <p>
          O Yield2Pay é oferecido no estado em que se encontra. Não respondemos
          por perdas indiretas, interrupções de rede, variação de rendimento ou
          decisões de pagamento tomadas por você. O produto não é custodial no
          sentido de guardar o dinheiro da empresa como um banco.
        </p>

        <h2>Contato</h2>
        <p>
          Dúvidas sobre estes termos: {SUPPORT_EMAIL}.
        </p>
      </article>
    </main>
  );
}
