import Link from 'next/link';
import { SUPPORT_EMAIL } from '@/lib/errorCopy';

export default function PrivacidadePage() {
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

        <h1 style={{ fontSize: 32, letterSpacing: '-0.03em', margin: '0 0 32px' }}>
          Política de Privacidade
        </h1>

        <h2>Controlador</h2>
        <p>
          O controlador dos dados pessoais tratados nesta plataforma é a
          Yield2Pay. Pedidos de titular vão para o contato LGPD abaixo.
        </p>

        <h2>Dados que tratamos</h2>
        <p>
          Podemos tratar: identificador Privy; e-mail do Google se o Privy
          enviar; bills (fornecedor, valor, tipo); e metadados de depósito
          (valor, hash, data). Não pedimos documentos de identidade nesta
          versão.
        </p>

        <h2>Finalidade</h2>
        <p>
          Os dados servem para criar e manter a conta da empresa e para
          registrar e acompanhar assinaturas e depósitos ligados a esses
          pagamentos.
        </p>

        <h2>Bases legais (LGPD)</h2>
        <p>
          Tratamos dados para executar o contrato de uso da ferramenta
          (art. 7º, V) e, quando necessário, para cumprir obrigação legal
          (art. 7º, II) ou para atender a um interesse legítimo de segurança
          da conta (art. 7º, IX), sempre de forma proporcional.
        </p>

        <h2>Retenção</h2>
        <p>
          Guardamos os dados enquanto a conta existir. Depois da exclusão,
          podemos reter o mínimo exigido por lei ou para defesa em disputa.
        </p>

        <h2>Seus direitos</h2>
        <p>
          Você pode pedir acesso, correção, oposição, exportar os dados da
          conta (via GET /account/export) e apagar a conta (via DELETE
          /account, recusado se ainda houver depósito registrado).
        </p>

        <h2>Compartilhamento</h2>
        <p>
          Compartilhamos o necessário com o Privy (login Google) e com o
          provedor que hospeda a API e o banco. Não vendemos dados.
        </p>

        <h2>Cookies</h2>
        <p>
          Usamos cookies e armazenamento de sessão para manter você autenticado
          e para o funcionamento do login.
        </p>

        <h2>Contato LGPD</h2>
        <p>
          Envie pedidos de privacidade para {SUPPORT_EMAIL}.
        </p>
      </article>
    </main>
  );
}
