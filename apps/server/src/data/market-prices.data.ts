export interface MarketPriceData {
  id: string
  commodity_name: string
  local_name: string | null
  category: string
  unit: string
  price_min: number
  price_max: number
  market_location: string
  source: string
  as_of_date: string
}

export const marketPrices: MarketPriceData[] = [
  // RICE
  { id: 'rice-kadiwa', commodity_name: 'Kadiwa Rice-For-All', local_name: 'P20 Benteng Bigas', category: 'GRAINS', unit: 'per kilo', price_min: 20.00, price_max: 20.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-imp-basmati', commodity_name: 'Imported Basmati Rice', local_name: 'Basmati', category: 'GRAINS', unit: 'per kilo', price_min: 150.00, price_max: 190.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-imp-glutinous', commodity_name: 'Imported Glutinous Rice', local_name: 'Malagkit', category: 'GRAINS', unit: 'per kilo', price_min: 52.00, price_max: 70.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-imp-japonica', commodity_name: 'Imported Japonica Rice', local_name: 'Jasponica/Japonica', category: 'GRAINS', unit: 'per kilo', price_min: 55.00, price_max: 65.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-imp-premium', commodity_name: 'Imported Premium Rice', local_name: 'Premium Rice', category: 'GRAINS', unit: 'per kilo', price_min: 48.00, price_max: 62.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-imp-wellmilled', commodity_name: 'Imported Well Milled Rice', local_name: 'Bigas', category: 'GRAINS', unit: 'per kilo', price_min: 45.00, price_max: 50.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-loc-glutinous', commodity_name: 'Local Glutinous Rice', local_name: 'Malagkit', category: 'GRAINS', unit: 'per kilo', price_min: 55.00, price_max: 120.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-loc-premium', commodity_name: 'Local Premium Rice', local_name: 'Premium Rice', category: 'GRAINS', unit: 'per kilo', price_min: 46.00, price_max: 62.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-loc-wellmilled', commodity_name: 'Local Well Milled Rice', local_name: 'Bigas', category: 'GRAINS', unit: 'per kilo', price_min: 42.00, price_max: 58.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'rice-loc-regular', commodity_name: 'Local Regular Milled Rice', local_name: 'Bigas', category: 'GRAINS', unit: 'per kilo', price_min: 39.00, price_max: 50.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // CORN & LEGUMES
  { id: 'corn-white', commodity_name: 'Corn (White)', local_name: 'Mais (Puti)', category: 'GRAINS', unit: 'per kilo', price_min: 60.00, price_max: 120.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'corn-yellow', commodity_name: 'Yellow Sweet Corn (Cob)', local_name: 'Mais (Dilaw)', category: 'GRAINS', unit: 'per kilo', price_min: 70.00, price_max: 100.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'mungbean', commodity_name: 'Mung Bean', local_name: 'Monggo', category: 'GRAINS', unit: 'per kilo', price_min: 130.00, price_max: 160.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // LIVESTOCK & POULTRY
  { id: 'meat-beef-brisket', commodity_name: 'Beef Brisket', local_name: 'Baka', category: 'MEATS', unit: 'per kilo', price_min: 360.00, price_max: 500.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'meat-beef-rump', commodity_name: 'Beef Rump', local_name: 'Baka', category: 'MEATS', unit: 'per kilo', price_min: 420.00, price_max: 550.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'meat-pork-ham', commodity_name: 'Pork Ham', local_name: 'Baboy Kasim/Pigue', category: 'MEATS', unit: 'per kilo', price_min: 250.00, price_max: 380.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'meat-pork-belly', commodity_name: 'Pork Belly', local_name: 'Liempo', category: 'MEATS', unit: 'per kilo', price_min: 320.00, price_max: 440.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'meat-frozen-kasim', commodity_name: 'Frozen Kasim', local_name: 'Frozen Baboy Kasim', category: 'MEATS', unit: 'per kilo', price_min: 230.00, price_max: 260.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'meat-frozen-liempo', commodity_name: 'Frozen Liempo', local_name: 'Frozen Liempo', category: 'MEATS', unit: 'per kilo', price_min: 270.00, price_max: 350.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'poultry-chicken', commodity_name: 'Whole Chicken', local_name: 'Manok', category: 'MEATS', unit: 'per kilo', price_min: 160.00, price_max: 240.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // EGGS (Simplifying to Medium/Large)
  { id: 'egg-white-med', commodity_name: 'Chicken Egg (White, Medium)', local_name: 'Itlog', category: 'DAIRY', unit: 'per piece', price_min: 6.44, price_max: 9.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'egg-white-lrg', commodity_name: 'Chicken Egg (White, Large)', local_name: 'Itlog', category: 'DAIRY', unit: 'per piece', price_min: 7.00, price_max: 10.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'egg-brown-med', commodity_name: 'Chicken Egg (Brown, Medium)', local_name: 'Itlog', category: 'DAIRY', unit: 'per piece', price_min: 8.00, price_max: 12.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // FISH
  { id: 'fish-alumahan', commodity_name: 'Alumahan', local_name: 'Alumahan', category: 'MEATS', unit: 'per kilo', price_min: 240.00, price_max: 450.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fish-bangus', commodity_name: 'Milkfish', local_name: 'Bangus', category: 'MEATS', unit: 'per kilo', price_min: 175.00, price_max: 280.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fish-galunggong', commodity_name: 'Local Round Scad', local_name: 'Galunggong', category: 'MEATS', unit: 'per kilo', price_min: 180.00, price_max: 340.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fish-sardines', commodity_name: 'Sardines', local_name: 'Tamban', category: 'MEATS', unit: 'per kilo', price_min: 110.00, price_max: 160.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fish-squid', commodity_name: 'Squid', local_name: 'Pusit Bisaya', category: 'MEATS', unit: 'per kilo', price_min: 360.00, price_max: 560.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fish-tilapia', commodity_name: 'Tilapia', local_name: 'Tilapia', category: 'MEATS', unit: 'per kilo', price_min: 110.00, price_max: 180.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // LOWLAND VEGETABLES
  { id: 'veg-ampalaya', commodity_name: 'Bittergourd', local_name: 'Ampalaya', category: 'VEGETABLES', unit: 'per kilo', price_min: 80.00, price_max: 150.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-eggplant', commodity_name: 'Eggplant', local_name: 'Talong', category: 'VEGETABLES', unit: 'per kilo', price_min: 55.00, price_max: 120.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-pechay-tagalog', commodity_name: 'Pechay Tagalog', local_name: 'Pechay', category: 'VEGETABLES', unit: 'per kilo', price_min: 50.00, price_max: 130.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-stringbeans', commodity_name: 'String Beans', local_name: 'Sitao', category: 'VEGETABLES', unit: 'per kilo', price_min: 80.00, price_max: 180.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-squash', commodity_name: 'Squash', local_name: 'Kalabasa', category: 'VEGETABLES', unit: 'per kilo', price_min: 40.00, price_max: 100.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-tomato', commodity_name: 'Tomato', local_name: 'Kamatis', category: 'VEGETABLES', unit: 'per kilo', price_min: 70.00, price_max: 160.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // HIGHLAND VEGETABLES
  { id: 'veg-bellpepper-green', commodity_name: 'Bell Pepper (Green)', local_name: 'Siling Bell', category: 'VEGETABLES', unit: 'per kilo', price_min: 160.00, price_max: 380.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-bellpepper-red', commodity_name: 'Bell Pepper (Red)', local_name: 'Siling Bell', category: 'VEGETABLES', unit: 'per kilo', price_min: 130.00, price_max: 320.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-cabbage-repolyo', commodity_name: 'Cabbage Repolyo', local_name: 'Repolyo', category: 'VEGETABLES', unit: 'per kilo', price_min: 60.00, price_max: 150.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-carrot', commodity_name: 'Carrot', local_name: 'Karot', category: 'VEGETABLES', unit: 'per kilo', price_min: 70.00, price_max: 150.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-chayote', commodity_name: 'Chayote', local_name: 'Sayote', category: 'VEGETABLES', unit: 'per kilo', price_min: 30.00, price_max: 100.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-baguio-beans', commodity_name: 'Baguio Beans', local_name: 'Habitchuelas', category: 'VEGETABLES', unit: 'per kilo', price_min: 80.00, price_max: 180.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-pechay-baguio', commodity_name: 'Pechay Baguio', local_name: 'Pechay Baguio', category: 'VEGETABLES', unit: 'per kilo', price_min: 60.00, price_max: 120.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'veg-white-potato', commodity_name: 'White Potato', local_name: 'Patatas', category: 'VEGETABLES', unit: 'per kilo', price_min: 90.00, price_max: 150.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // FRUITS
  { id: 'fruit-banana-lakatan', commodity_name: 'Banana (Lakatan)', local_name: 'Lakatan', category: 'FRUITS', unit: 'per kilo', price_min: 70.00, price_max: 110.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-banana-latundan', commodity_name: 'Banana (Latundan)', local_name: 'Latundan', category: 'FRUITS', unit: 'per kilo', price_min: 60.00, price_max: 90.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-banana-saba', commodity_name: 'Banana (Saba)', local_name: 'Saba', category: 'FRUITS', unit: 'per kilo', price_min: 35.00, price_max: 90.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-calamansi', commodity_name: 'Calamansi', local_name: 'Calamansi', category: 'FRUITS', unit: 'per kilo', price_min: 70.00, price_max: 150.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-mango', commodity_name: 'Mango (Carabao)', local_name: 'Mangga', category: 'FRUITS', unit: 'per kilo', price_min: 90.00, price_max: 200.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-papaya', commodity_name: 'Papaya', local_name: 'Papaya', category: 'FRUITS', unit: 'per kilo', price_min: 60.00, price_max: 90.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'fruit-watermelon', commodity_name: 'Watermelon', local_name: 'Pakwan', category: 'FRUITS', unit: 'per kilo', price_min: 60.00, price_max: 90.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },

  // SPICES & OTHERS
  { id: 'spice-chili', commodity_name: 'Chili', local_name: 'Siling Labuyo', category: 'OTHER', unit: 'per kilo', price_min: 100.00, price_max: 250.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'spice-garlic-local', commodity_name: 'Local Garlic', local_name: 'Bawang', category: 'OTHER', unit: 'per kilo', price_min: 350.00, price_max: 360.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'spice-garlic-imp', commodity_name: 'Imported Garlic', local_name: 'Bawang', category: 'OTHER', unit: 'per kilo', price_min: 115.00, price_max: 190.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'spice-ginger', commodity_name: 'Ginger', local_name: 'Luya', category: 'OTHER', unit: 'per kilo', price_min: 120.00, price_max: 250.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'spice-onion-red', commodity_name: 'Red Onion', local_name: 'Pulang Sibuyas', category: 'OTHER', unit: 'per kilo', price_min: 70.00, price_max: 160.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'spice-onion-white', commodity_name: 'White Onion', local_name: 'Puting Sibuyas', category: 'OTHER', unit: 'per kilo', price_min: 65.00, price_max: 160.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  
  { id: 'other-sugar-refined', commodity_name: 'Sugar (Refined)', local_name: 'Asukal (Refined)', category: 'OTHER', unit: 'per kilo', price_min: 70.00, price_max: 95.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
  { id: 'other-sugar-brown', commodity_name: 'Sugar (Brown)', local_name: 'Asukal (Brown)', category: 'OTHER', unit: 'per kilo', price_min: 60.00, price_max: 85.00, market_location: 'NCR Markets', source: 'Bantay Presyo (DA-AMAS)', as_of_date: '2026-07-07' },
]
