-- Phase 11.3: Authoritative HighPark Consult payment destinations
-- M-Pesa rent/deposit: PayBill 247242, account 382000#<HOUSE NO>
-- Direct bank transfer: Equity Bank, HIGHPARK CONSULT LIMITED, A/C 0470281425369
-- The previously introduced 247247/4080693 values are not used for rent/deposit payments.

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS mpesa_account_prefix text;

-- Remove obsolete payment-destination fields/values from earlier iterations.
ALTER TABLE public.system_settings
  DROP COLUMN IF EXISTS equity_paybill_business_number;

UPDATE public.system_settings
SET mpesa_paybill = '247242',
    mpesa_account_prefix = '382000',
    equity_bank_name = 'Equity Bank',
    equity_account_name = 'HIGHPARK CONSULT LIMITED',
    equity_account_number = '0470281425369',
    equity_paybill = NULL,
    equity_paybill_number = NULL,
    mpesa_account_number = NULL
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
