import { config } from 'dotenv';

// Carrega apps/api/.env (o cwd dos testes) em process.env antes dos testes, para
// alcançar o Postgres local sem exportar variáveis manualmente.
config({ quiet: true });

// JSON não serializa BigInt; codifica como string decimal na borda.
// Espelha o shim de main.ts para os testes exercitarem o mesmo comportamento.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}
BigInt.prototype.toJSON = function () {
  return this.toString();
};
