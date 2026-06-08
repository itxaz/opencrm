import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db.js';
import { authenticate, requireRole, tenantContext } from '../auth/context.js';
import { parse, z } from '../http.js';

const createSchema = z.object({
  displayName: z.string().min(1),
  email: z.string().email().optional(),
  defaultSplit: z.number().min(0).max(1).optional(),
});

const patchSchema = z.object({
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  defaultSplit: z.number().min(0).max(1).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/agents', async (req) =>
    withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `SELECT id, display_name, email, default_split, status, created_at
         FROM agents ORDER BY display_name`,
      );
      return { agents: rows };
    }),
  );

  app.post('/agents', { preHandler: requireRole('agency_admin', 'agency_staff') }, async (req, reply) => {
    const body = parse(createSchema, req.body, reply);
    if (!body) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `INSERT INTO agents (agency_id, display_name, email, default_split)
         VALUES (app.current_agency(), $1, $2, $3)
         RETURNING id, display_name, email, default_split, status`,
        [body.displayName, body.email ?? null, body.defaultSplit ?? null],
      );
      return reply.code(201).send(rows[0]);
    });
  });

  app.patch('/agents/:id', { preHandler: requireRole('agency_admin', 'agency_staff') }, async (req, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), req.params, reply);
    const body = parse(patchSchema, req.body, reply);
    if (!params || !body) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rows, rowCount } = await c.query(
        `UPDATE agents
         SET display_name = COALESCE($2, display_name),
             email        = COALESCE($3, email),
             default_split = COALESCE($4, default_split),
             status       = COALESCE($5, status)
         WHERE id = $1
         RETURNING id, display_name, email, default_split, status`,
        [params.id, body.displayName ?? null, body.email ?? null,
         body.defaultSplit ?? null, body.status ?? null],
      );
      if (!rowCount) return reply.code(404).send({ error: 'agent_not_found' });
      return rows[0];
    });
  });
}
