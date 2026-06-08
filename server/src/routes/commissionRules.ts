import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db.js';
import { authenticate, requireRole, tenantContext } from '../auth/context.js';
import { parse, z } from '../http.js';

const ruleSchema = z.object({
  carrierId: z.string().uuid(),
  productLine: z.string().optional(),
  basis: z.enum(['upfront_first_term', 'level_each_term', 'renewal_only', 'split']),
  firstTermPct: z.number().min(0).max(1).optional(),
  renewalPct: z.number().min(0).max(1).optional(),
  agencyRetainsRenewal: z.boolean().default(false),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

export async function commissionRuleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/commission-rules', async (req) =>
    withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `SELECT r.id, r.carrier_id, c.name AS carrier_name, r.product_line, r.basis,
                r.first_term_pct, r.renewal_pct, r.agency_retains_renewal,
                r.effective_from, r.effective_to
         FROM commission_rules r
         JOIN carriers c ON c.id = r.carrier_id
         ORDER BY c.name, r.product_line NULLS FIRST`,
      );
      return { rules: rows };
    }),
  );

  app.post('/commission-rules', { preHandler: requireRole('agency_admin', 'agency_staff') }, async (req, reply) => {
    const body = parse(ruleSchema, req.body, reply);
    if (!body) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `INSERT INTO commission_rules
           (agency_id, carrier_id, product_line, basis, first_term_pct, renewal_pct,
            agency_retains_renewal, effective_from, effective_to)
         VALUES (app.current_agency(), $1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [body.carrierId, body.productLine ?? null, body.basis,
         body.firstTermPct ?? null, body.renewalPct ?? null,
         body.agencyRetainsRenewal, body.effectiveFrom ?? null, body.effectiveTo ?? null],
      );
      return reply.code(201).send({ id: rows[0]!.id });
    });
  });

  app.delete('/commission-rules/:id', { preHandler: requireRole('agency_admin') }, async (req, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), req.params, reply);
    if (!params) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rowCount } = await c.query('DELETE FROM commission_rules WHERE id = $1', [params.id]);
      if (!rowCount) return reply.code(404).send({ error: 'rule_not_found' });
      return reply.code(204).send();
    });
  });
}
