-- Fix the admin user's confirmation_token
UPDATE auth.users 
SET confirmation_token = NULL
WHERE id = '9138f9ee-ca94-4563-9016-05e5d2b496df';