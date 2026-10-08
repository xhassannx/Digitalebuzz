-- Allow wallet ledger to record SaaS subscription / panel fee debits.
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN (
    'reload', 'debit_message', 'debit_campaign', 'debit_subscription', 'refund', 'adjustment'
  ));
