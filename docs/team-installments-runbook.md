# Parcelas das equipes — roteiro de ativação e validação

## 1. Ativar (uma vez)

1. Deploy da `main`: o `start` roda `prisma migrate deploy` (só cria tabelas novas).
2. Seed das 18 parcelas (9 por equipe, dia 10, abr–dez/2026): `node prisma/seed.cjs` com o `DATABASE_URL` de produção. É idempotente.
3. Variáveis no Railway: `TEAM_INSTALLMENTS_ENABLED=true`, `CRON_SECRET=<valor longo e aleatório>`; `TEAM_INSTALLMENT_AMOUNT_CENTS=93330` é o padrão.
4. Credenciais da Efí com escopo `pix.read` (a conciliação nunca chama endpoints que movimentam dinheiro).

## 2. Primeira carga pela tela (recomendado)

Em `/admin/equipes/parcelas`, seção **Buscar pagamentos na Efí**, período 01/03/2026 até hoje:

| Conferir                   | O que esperar                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Valores                    | Só R$ 933,30 ou múltiplos (a coluna mostra o nº de parcelas)                                            |
| Responsável                | Nome do devedor da cobrança (txid) ou pagador da Efí; documento mascarado. Pix avulso pode vir sem nome |
| Equipe sugerida            | Vem de txid ou alias, com o motivo; sem sugestão = "Definir depois"                                     |
| Já registrado              | Linhas cinza, sem checkbox                                                                              |
| Lançamento manual provável | Link "Confirmar com este Pix" (mesmo valor, até 7 dias)                                                 |

Pontos de atenção na primeira execução:

- Se a lista vier vazia ou truncada, reduza o período (janelas de 30 dias, máx. 100 páginas).
- Se a paginação da Efí divergir (numeração das páginas), o erro aparece na própria tela.
- Pix sem equipe sugerida: escolha a equipe pelo comprovante/pagador; o motivo fica gravado.

Depois de registrar, confira a coluna **Parcelas pagas** (ex.: `3/9 — 3 confirmadas na Efí`).
Lançamentos de comprovante que a Efí não mostra: use **Lançamento manual** (fica "não confirmado").

## 3. Conferência final

- Cada equipe: parcelas pagas confirmadas = Pix de R$ 933,30 conferidos na Efí.
- "Não atribuídos" vazio; "Pagamentos não confirmados" só com o que depende de comprovante.
- Pix de valor diferente (ex.: R$ 183 e R$ 366) ficam em "Ignorados e sobras" até haver decisão sobre pagamento parcial.

## 4. Automático (depois de validar)

Serviço de cron no Railway, diário (ex.: `0 9 * * *`):

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$APP_URL/api/cron/team-payments-reconcile"
```

Resposta esperada: `{"ok":true,"days":7,"scanned":…,"created":…,"existing":…,"failed":0}`.
`?days=31` faz um backfill. O webhook `/api/webhooks/efi/pix` passa a registrar em tempo real.

## 5. Se algo der errado

- Desligar: `TEAM_INSTALLMENTS_ENABLED=false` (webhook e job param; a tela continua lendo).
- Corrigir um pagamento: ajuste o lançamento (atribuir/confirmar); a alocação é recalculada, nunca edite parcelas.
- A migração é só aditiva: não altera tabelas existentes.
