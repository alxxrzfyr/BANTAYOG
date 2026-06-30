-- =============================================================================
-- BANTAYOG — Seed data
-- BE1 owns this file. Seeds the products catalog with eligible and
-- ineligible items for AI scan validation and manual entry flows.
-- =============================================================================

-- Products catalog — eligible nutritional items (government-subsidized)
INSERT INTO public.products (name, category, eligibility_status, price_range_min, price_range_max) VALUES
    ('Fresh Eggs (1 tray)',       'Eggs',         'eligible',   80.00,  120.00),
    ('Fresh Milk (1L)',           'Dairy',        'eligible',   65.00,   95.00),
    ('Powdered Milk (400g)',      'Dairy',        'eligible',  180.00,  250.00),
    ('Leafy Vegetables (1 bundle)','Vegetables',  'eligible',   20.00,   50.00),
    ('Lean Pork (1kg)',           'Meat',         'eligible',  220.00,  320.00),
    ('Fresh Fish (1kg)',          'Seafood',      'eligible',  150.00,  280.00),
    ('Mung Beans (500g)',         'Legumes',      'eligible',   40.00,   70.00),
    ('Brown Rice (2kg)',          'Grains',       'eligible',   55.00,   85.00),
    ('Fresh Bananas (1 bunch)',   'Fruits',       'eligible',   30.00,   60.00),
    ('Peanut Butter (250g)',      'Spreads',      'eligible',   75.00,  130.00)
ON CONFLICT DO NOTHING;

-- Products catalog — ineligible items (NOT subsidized)
INSERT INTO public.products (name, category, eligibility_status, price_range_min, price_range_max) VALUES
    ('Instant Noodles (1 pack)',  'Instant Food', 'ineligible',  12.00,   18.00),
    ('Cola (500mL)',              'Beverages',    'ineligible',  18.00,   25.00),
    ('Candy Bar',                 'Snacks',       'ineligible',  15.00,   30.00),
    ('Potato Chips (100g)',       'Snacks',       'ineligible',  25.00,   45.00),
    ('Instant Coffee (1 stick)',  'Beverages',    'ineligible',   5.00,   12.00)
ON CONFLICT DO NOTHING;
