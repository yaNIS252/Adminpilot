-- Une seule ligne « AdminPilot » par compte.
--
-- Stripe envoie plusieurs événements presque simultanés au paiement
-- (checkout.session.completed, customer.subscription.created…). Deux
-- traitements parallèles ne voyaient pas encore la ligne de l'autre et en
-- créaient chacun une : l'abonnement AdminPilot apparaissait en double.
create unique index subscriptions_one_own_billing_idx
  on subscriptions (user_id)
  where (metadata->>'source') = 'adminpilot_billing';
