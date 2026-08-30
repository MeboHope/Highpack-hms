/*
# Seed Demo Data — Kenyan Properties

## Overview
Inserts realistic Kenyan sample properties and units for the public portal.
Properties are created with status 'verified' so they appear publicly.

## Data
- 6 properties across Nairobi, Mombasa, Kisumu, Nakuru
- Each with 2-4 units
- Realistic rent prices for the Kenyan market
*/

INSERT INTO properties (name, description, property_type, county, town, estate, street, number_of_units, amenities, parking, water_availability, electricity, internet, pets_allowed, photos, status, latitude, longitude)
VALUES
(
  'Sunrise Apartments',
  'Modern apartment complex in the heart of Kilimani with spacious units, ample parking, and 24/7 security. Walking distance to Yaya Centre and Junction Mall.',
  'Apartment', 'Nairobi', 'Nairobi', 'Kilimani', 'Argwings Kodhek Road', 4,
  ARRAY['Elevator', 'CCTV Security', 'Backup Generator', 'Ample Parking', 'Near Shopping Mall', 'Fibre Internet'],
  true, true, true, true, false,
  ARRAY['https://images.pexels.com/photos/1438832/pexels-photo-1438832.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -1.2921, 36.7833
),
(
  'Westlands Gardens',
  'Luxury apartments in Westlands with swimming pool, gym, and rooftop terrace. Close to Sarit Centre and Westgate Mall.',
  'Apartment', 'Nairobi', 'Nairobi', 'Westlands', 'Waiyaki Way', 6,
  ARRAY['Swimming Pool', 'Gym', 'Elevator', 'CCTV Security', 'Balcony', 'Fibre Internet', 'Servant Quarter (SQ)'],
  true, true, true, true, false,
  ARRAY['https://images.pexels.com/photos/323780/pexels-photo-323780.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/1396122/pexels-photo-1396122.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -1.2646, 36.8025
),
(
  'Kileleshwa Heights',
  'Quiet residential apartments in Kileleshwa with beautiful gardens, borehole water, and backup generator. Family-friendly environment.',
  'Apartment', 'Nairobi', 'Nairobi', 'Kileleshwa', 'Kileleshwa Road', 4,
  ARRAY['Garden', 'Borehole Water', 'Backup Generator', 'CCTV Security', 'Playground', 'Ample Parking'],
  true, true, true, false, true,
  ARRAY['https://images.pexels.com/photos/1571463/pexels-photo-1571463.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -1.2795, 36.7928
),
(
  'Nyali Beach Villas',
  'Stunning beachside villas in Nyali, Mombasa. Just minutes from the Indian Ocean with sea views, swimming pool, and tropical gardens.',
  'Villa', 'Mombasa', 'Mombasa', 'Nyali', 'Links Road', 3,
  ARRAY['Swimming Pool', 'Garden', 'CCTV Security', 'Borehole Water', 'Solar Water Heating', 'Near Hospital', 'Near Shopping Mall'],
  true, true, true, true, true,
  ARRAY['https://images.pexels.com/photos/280222/pexels-photo-280222.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -4.0167, 39.7000
),
(
  'Milimani Residences',
  'Upscale residential properties in Milimani, Kisumu. Serene environment near Lake Victoria with modern amenities.',
  'Townhouse', 'Kisumu', 'Kisumu', 'Milimani', 'Milimani Road', 4,
  ARRAY['Gated Community', 'Garden', 'CCTV Security', 'Borehole Water', 'Near School', 'Tarmac Road Access'],
  true, true, true, false, true,
  ARRAY['https://images.pexels.com/photos/1080721/pexels-photo-1080721.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/1438832/pexels-photo-1438832.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -0.0917, 34.7683
),
(
  'Nakuru CBD Apartments',
  'Central apartments in Nakuru CBD, close to shopping, schools, and transport. Affordable living with modern finishes.',
  'Apartment', 'Nakuru', 'Nakuru', 'CBD', 'Kenyatta Avenue', 5,
  ARRAY['Elevator', 'CCTV Security', 'Near Matatu Stage', 'Near Shopping Mall', 'Near School', 'Fibre Internet'],
  false, true, true, true, false,
  ARRAY['https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&w=800'],
  'verified', -0.3031, 36.0800
)
ON CONFLICT DO NOTHING;

-- Insert units for each property
DO $$
DECLARE
  prop_id uuid;
BEGIN
  SELECT id INTO prop_id FROM properties WHERE name = 'Sunrise Apartments' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'A01', 1, '1 Bedroom', 1, 1, 45000, 45000, 2000, 'available', 'semi_furnished', ARRAY['Balcony', 'Fibre Internet'], 'Ground floor unit with garden view'),
      (prop_id, 'A02', 1, '2 Bedroom', 2, 2, 65000, 65000, 2000, 'available', 'unfurnished', ARRAY['Balcony', 'Ample Parking'], 'Spacious 2-bedroom with en-suite'),
      (prop_id, 'A03', 2, '2 Bedroom', 2, 2, 70000, 70000, 2000, 'available', 'furnished', ARRAY['Balcony', 'Fibre Internet', 'DSTV Ready'], 'Fully furnished with modern appliances'),
      (prop_id, 'A04', 2, '3 Bedroom', 3, 3, 95000, 95000, 2000, 'available', 'unfurnished', ARRAY['Balcony', 'Servant Quarter (SQ)'], 'Penthouse unit with panoramic views');
  END IF;

  SELECT id INTO prop_id FROM properties WHERE name = 'Westlands Gardens' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'B01', 1, 'Studio', 0, 1, 35000, 35000, 2000, 'available', 'furnished', ARRAY['Fibre Internet', 'DSTV Ready'], 'Compact studio with city view'),
      (prop_id, 'B02', 2, '1 Bedroom', 1, 1, 55000, 55000, 2000, 'available', 'semi_furnished', ARRAY['Balcony', 'Fibre Internet'], 'Modern 1-bedroom with open kitchen'),
      (prop_id, 'B03', 3, '2 Bedroom', 2, 2, 80000, 80000, 2000, 'available', 'unfurnished', ARRAY['Balcony', 'Servant Quarter (SQ)'], 'Corner unit with extra windows'),
      (prop_id, 'B04', 4, '3 Bedroom', 3, 3, 120000, 120000, 2000, 'available', 'furnished', ARRAY['Balcony', 'Fibre Internet', 'DSTV Ready'], 'Luxury 3-bedroom with pool view');
  END IF;

  SELECT id INTO prop_id FROM properties WHERE name = 'Kileleshwa Heights' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'C01', 1, '2 Bedroom', 2, 2, 55000, 55000, 2000, 'available', 'unfurnished', ARRAY['Garden', 'Borehole Water'], 'Garden-facing unit'),
      (prop_id, 'C02', 2, '3 Bedroom', 3, 2, 75000, 75000, 2000, 'available', 'unfurnished', ARRAY['Balcony', 'Playground'], 'Family-friendly unit near playground'),
      (prop_id, 'C03', 3, 'Bedsitter', 0, 1, 25000, 25000, 2000, 'available', 'unfurnished', ARRAY['Borehole Water'], 'Affordable bedsitter with separate entrance');
  END IF;

  SELECT id INTO prop_id FROM properties WHERE name = 'Nyali Beach Villas' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'V01', 1, '3 Bedroom', 3, 3, 150000, 150000, 2000, 'available', 'furnished', ARRAY['Swimming Pool', 'Garden', 'Solar Water Heating'], 'Beachfront villa with sea view'),
      (prop_id, 'V02', 1, '4 Bedroom', 4, 4, 200000, 200000, 2000, 'available', 'furnished', ARRAY['Swimming Pool', 'Garden', 'Servant Quarter (SQ)'], 'Luxury villa with private pool access');
  END IF;

  SELECT id INTO prop_id FROM properties WHERE name = 'Milimani Residences' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'M01', 1, '2 Bedroom', 2, 2, 40000, 40000, 2000, 'available', 'unfurnished', ARRAY['Garden', 'Gated Community'], 'Quiet townhouse in gated community'),
      (prop_id, 'M02', 1, '3 Bedroom', 3, 2, 55000, 55000, 2000, 'available', 'semi_furnished', ARRAY['Garden', 'Borehole Water'], 'Corner unit with large garden'),
      (prop_id, 'M03', 2, '1 Bedroom', 1, 1, 30000, 30000, 2000, 'available', 'unfurnished', ARRAY['Gated Community'], 'Compact unit near Milimani Primary');
  END IF;

  SELECT id INTO prop_id FROM properties WHERE name = 'Nakuru CBD Apartments' LIMIT 1;
  IF prop_id IS NOT NULL THEN
    INSERT INTO property_units (property_id, unit_number, floor, house_type, bedrooms, bathrooms, monthly_rent, security_deposit, reservation_fee, status, furnishing, amenities, description)
    VALUES
      (prop_id, 'N01', 1, 'Bedsitter', 0, 1, 12000, 12000, 2000, 'available', 'unfurnished', ARRAY['Near Matatu Stage', 'Near Shopping Mall'], 'Affordable bedsitter in CBD'),
      (prop_id, 'N02', 2, '1 Bedroom', 1, 1, 20000, 20000, 2000, 'available', 'unfurnished', ARRAY['Elevator', 'Fibre Internet'], 'Modern 1-bedroom with elevator access'),
      (prop_id, 'N03', 3, '2 Bedroom', 2, 1, 30000, 30000, 2000, 'available', 'semi_furnished', ARRAY['Elevator', 'Balcony'], 'Spacious 2-bedroom with city view'),
      (prop_id, 'N04', 4, 'Studio', 0, 1, 15000, 15000, 2000, 'available', 'furnished', ARRAY['Elevator', 'Fibre Internet'], 'Furnished studio near CBD');
  END IF;
END $$;