# HighPark Consult PMS — Phase 38
## Staff RBAC Permission Enforcement & Property Scope

Phase 38 advances the Phase 36 identity/RBAC foundation and Phase 37 Super Admin security into actual permission enforcement.

### Implemented
- Super Admin remains unrestricted.
- Operational staff permissions are loaded through `my_staff_access()`.
- Admin navigation hides modules the current staff role does not have permission to use.
- Direct `/admin/...` URL access is guarded by the same permission set.
- Suspended operational staff receive no operational permissions and cannot use the Admin workspace.
- Staff are no longer treated as Owner/Tenant merely because their technical profile role is `admin`.
- Property-scoped staff access is enforced through `staff_property_assignments`.
- Super Admin can assign a staff member to one or more properties from **Admin → Staff & Access → Scope**.
- Core property/unit RLS now uses staff permissions and property assignments instead of the legacy blanket `role='admin'` branch.
- Reservations, leases, payments, maintenance, expenses, tax, documents and sales-listing access use the staff permission/scope helpers where applicable.
- Sensitive property verification, payment review, KRA settings and paginated expense/maintenance RPCs now enforce permissions server-side.

### Operational roles
- Property Manager: portfolio, units, leases, tenants, maintenance, reservations, short-stay, reports.
- Finance Officer: payments, expenses, tax and reports.
- Sales & Lettings Officer: property viewing, sales, enquiries and viewings.
- Compliance & Verification Officer: property viewing/verification, documents and audit.
- Customer Support Officer: customers, messages, enquiries, viewings and notifications.

### Security model
`Identity → Staff Role → Permission → Property Scope → Actual Access`

### Deployment
Run from the project root:

```powershell
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push --include-all
```

No new Edge Function is required for Phase 38. The existing `staff-admin` function from Phase 37 remains responsible for invitation, role and suspension lifecycle.

### Validation
On Windows, after extracting the phase ZIP:

```powershell
npm ci
npm run build
npm run lint
```

Then test at least:
1. Super Admin sees the full Admin navigation.
2. Create/activate an operational staff member and assign a role.
3. Use **Scope** to assign one property.
4. Sign in as that staff member.
5. Confirm only permitted modules appear.
6. Manually enter an unauthorized `/admin/...` URL and confirm **Access restricted**.
7. Confirm the assigned property is visible to property-scoped modules while unassigned properties are not exposed through the staff RLS path.
8. Confirm a suspended staff member cannot access operational Admin routes.
