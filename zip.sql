/*
# Make owner_id nullable on properties for demo data

## Overview
Allows demo properties to exist without a registered owner account.
This is needed for seeding sample properties that appear on the public portal
before any owner has registered.

## Changes
- `properties.owner_id` changed from NOT NULL to nullable
*/

ALTER TABLE properties ALTER COLUMN owner_id DROP NOT NULL;