-- Allow the property AI Edge Function's server-side role to read
-- verified marketplace data. service_role bypasses RLS but still needs
-- table-level privileges in this project.
GRANT SELECT ON TABLE
  public.properties,
  public.property_units,
  public.sale_listings,
  public.short_stay_listings,
  public.land_parcels
TO service_role;
