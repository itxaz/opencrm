import type { FastifyInstance } from 'fastify';
import { withTenant } from '../db.js';
import { authenticate, requireRole, tenantContext } from '../auth/context.js';
import { parse, z } from '../http.js';

// A reusable per-carrier column mapping. Global defaults (agency_id IS NULL) are
// curated by ITX and visible to everyone; agencies can save their own overrides.
const fieldMapSchema = z.object({
  policyNumber: z.string().optional(),
  premiumAmount: z.string().optional(),
  commissionAmount: z.string().optional(),
  commissionPct: z.string().optional(),
  isRenewal: z.string().optional(),
  renewalValue: z.string().optional(),
});

const profileSchema = z.object({
  carrierId: z.string().uuid(),
  name: z.string().min(1),
  format: z.string().default('csv'),
  fieldMap: fieldMapSchema,
});

export async function mappingProfileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // Profiles for a carrier: global defaults + this agency's overrides (RLS handles scoping).
  app.get('/mapping-profiles', async (req, reply) => {
    const q = parse(z.object({ carrierId: z.string().uuid().optional() }), req.query, reply);
    if (!q) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `SELECT mp.id, mp.carrier_id, c.name AS carrier_name, mp.agency_id,
                mp.name, mp.format, mp.field_map, mp.version,
                (mp.agency_id IS NULL) AS is_global
         FROM mapping_profiles mp
         JOIN carriers c ON c.id = mp.carrier_id
         WHERE ($1::uuid IS NULL OR mp.carrier_id = $1)
         ORDER BY c.name, is_global DESC, mp.name`,
        [q.carrierId ?? null],
      );
      return { profiles: rows };
    });
  });

  app.post('/mapping-profiles', { preHandler: requireRole('agency_admin', 'agency_staff') }, async (req, reply) => {
    const body = parse(profileSchema, req.body, reply);
    if (!body) return;
    return withTenant(tenantContext(req), async (c) => {
      const { rows } = await c.query(
        `INSERT INTO mapping_profiles (carrier_id, agency_id, name, format, field_map)
         VALUES ($1, app.current_agency(), $2, $3, $4)
         RETURNING id, carrier_id, name, format, field_map, version`,
        [body.carrierId, body.name, body.format, JSON.stringify(body.fieldMap)],
      );
      return reply.code(201).send(rows[0]);
    });
  });

  app.delete('/mapping-profiles/:id', { preHandler: requireRole('agency_admin', 'agency_staff') }, async (req, reply) => {
    const params = parse(z.object({ id: z.string().uuid() }), req.params, reply);
    if (!params) return;
    return withTenant(tenantContext(req), async (c) => {
      // RLS WITH CHECK prevents deleting global (NULL-agency) profiles.
      const { rowCount } = await c.query(
        'DELETE FROM mapping_profiles WHERE id = $1 AND agency_id = app.current_agency()',
        [params.id],
      );
      if (!rowCount) return reply.code(404).send({ error: 'profile_not_found' });
      return reply.code(204).send();
    });
  });
}
