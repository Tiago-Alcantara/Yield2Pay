### Task 4: Validar o body de POST /bills

**Files:**
- Create: `apps/api/src/bills/create-bill.body.ts`
- Create: `apps/api/src/bills/create-bill.body.spec.ts`
- Modify: `apps/api/src/bills/bills.controller.ts`

**Interfaces:**
- Consumes: `CreateBillDto` em `@yield2pay/shared`
- Produces: classe `CreateBillBody` com os mesmos campos; `BillsController.create` recebe `CreateBillBody`

Copy the test file and class from the plan verbatim (vendor Length 1-80, monthlyCost Length 1-16 + /^\d+$/, type IsIn software|utility|other). Swap the controller @Body type. Do not change bills.service.ts. Do not commit.

TDD: write create-bill.body.spec.ts first, run until FAIL, then implement, then run create-bill.body.spec.ts + bills.service.spec.ts.

If pnpm missing from PATH, use node vitest.mjs as before.

Exact tests: accepts valid; rejects empty vendor; vendor > 80; monthlyCost 12.5; monthlyCost 17 digits; type saas.
