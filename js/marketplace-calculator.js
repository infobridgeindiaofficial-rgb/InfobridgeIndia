'use strict';
 
/*
  InfoBridgeIndia - Marketplace Profit Calculator
 
  Assumptions used in this version:
  - Referral fee: category and selling-price slab from the supplied Amazon fee list.
  - Closing fee (Easy Ship): supplied fee list.
  - GST on Amazon fees: 18%.
  - GST TCS: 0.5% of taxable product value.
  - Income-tax TDS: 0.1% of gross selling price.
  - Meesho uses estimated baseline logistics slabs supplied for Version 1.
  - Net Profit excludes recoverable TCS/TDS from business expense.
*/
 
const AMAZON_CATEGORIES = [
  {
    "name": "School Textbook Bundles",
    "tiers": [
      {
        "min": 0,
        "max": 250.0,
        "rate": 2.0
      },
      {
        "min": 250.0,
        "max": 1000.0,
        "rate": 3.0
      },
      {
        "min": 1000.0,
        "max": 1500.0,
        "rate": 4.0
      },
      {
        "min": 1500.0,
        "max": null,
        "rate": 4.5
      }
    ]
  },
  {
    "name": "Books",
    "tiers": [
      {
        "min": 0,
        "max": 250.0,
        "rate": 0.0
      },
      {
        "min": 250.0,
        "max": 500.0,
        "rate": 2.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 4.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Movies",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 6.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Software products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 2000.0,
        "rate": 7.5
      },
      {
        "min": 2000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Music",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 6.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Video Games – Consoles",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 7.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Video Games – Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Video Games – Online Game Services",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 2000.0,
        "rate": 2.0
      },
      {
        "min": 2000.0,
        "max": null,
        "rate": 3.0
      }
    ]
  },
  {
    "name": "Video Games – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Toys – Drones",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 30.0
      }
    ]
  },
  {
    "name": "Toys – Party Supplies, Balloons, Banners, Masks, Confetti, Birthday Celebration",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Toys – Games and Puzzles, Boards Games, Adult Games and Building Sets",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Toys – Infant and Pre-school Toys (Electronic and Non-Electronic)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Toys – Outdoor, Activity and Sports Toys",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.5
      }
    ]
  },
  {
    "name": "Toys – Plush Toys, Action Figures and Dolls",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.5
      }
    ]
  },
  {
    "name": "Toys – Remote and Non-Remote Controlled Vehicles and Vehicle Sets",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Toys – STEM, Art and Craft, Learning and Development Toys",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Toys – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Pet Foods",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 6.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Pet – Aquatics Supplies",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Pet Accessories including Apparel, Collar, Leash and Harness",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Pet comforters including Bed, Feeder, Cages, Carriers, Crates, Kennels and Doors",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Pet Essentials including Health Care, Grooming Aids, Shower and Bath Supplies, Supplements and Vitamins, Tick and Flea Control, Dental Care",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Pet – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Beauty – Haircare, Bath and Shower",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Beauty – Make-up",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Deodorants",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 6.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Facial Steamers",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Beauty – Fragrance",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 14.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Face Wash",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Moisturiser Cream",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Sunscreen",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Beauty – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Luxury Beauty",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 0.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Feminine Hygiene and Care",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Health and Household – Medical Equipment, Sexual Wellness, Adult Incontinence, Elderly Care",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Health and Household – Sports Nutrition and Meal Replacement Shakes",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 9.0
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Health and Household – Ayurvedic, Homeopathic and Alternate Medicine products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Health and Household – Household Cleaning, Laundry, Air Fresheners, Personal Hygiene (Hand Wash)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Health and Household – Vitamins and Mineral Health Supplements",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 9.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 10.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Health and Household – Regulated Healthcare: Menstrual Cups, Contact Lenses, Diagnostic Kits, Pain Relief",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Health and Household – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Baby Hardlines – Swings, Bouncers and Rockers, Carriers, Baby Safety – Guards and Locks, Baby Room Décor, Baby Furniture, Baby Car Seats and Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Baby Strollers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Baby and Kids-Furniture and Home Décor",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Baby-Walker",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Body Support – Wearables and Soft Aids",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Baby – Diapers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Baby – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Breast pumps",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Diaper bags",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Grocery – Herbs and Spices",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Grocery – Dried Fruits and Nuts",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Grocery – Hampers and gifting",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Grocery and Gourmet – Oils",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Grocery and Gourmet – Beverages",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Grocery and Gourmet – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "OTC Medicine",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 12.0
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Pharmacy – Prescription Medicines",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Weighing Scales and Fat Analysers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Grooming and Styling",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Electric Massagers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Glucometer and Glucometer Strips",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Thermometers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Blood Pressure Monitors",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Electric Pain Relief Devices (Electric Heating Pads, Electric Hot Water Bags, EMS, Tens)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "0.00% for item price <= 1,000",
    "tiers": [
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Personal Care Appliances – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Apparel – Women’s Innerwear and Lingerie",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.0
      }
    ]
  },
  {
    "name": "Apparel – Sarees and Dress Materials",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Apparel – Sweat Shirts and Jackets",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.0
      }
    ]
  },
  {
    "name": "Apparel – Dress",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Apparel – Shirts",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 21.0
      }
    ]
  },
  {
    "name": "Apparel – Socks and Stockings",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Apparel – Thermals",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Pants – Trousers, Jeans, Trackpants and Leggings",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Apparel Other Innerwear",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.5
      }
    ]
  },
  {
    "name": "Sleepwear",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Apparel – Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Apparel – Men’s T-Shirts (except Tank Tops and Full Sleeve Tops)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 23.0
      }
    ]
  },
  {
    "name": "Apparel – Ethnic Wear",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.5
      }
    ]
  },
  {
    "name": "Apparel – Baby",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Apparel – Shorts",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 24.0
      }
    ]
  },
  {
    "name": "Apparel – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 19.0
      }
    ]
  },
  {
    "name": "Eyewear – Sunglasses, Frames and Zero Power Eye Glasses",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.5
      }
    ]
  },
  {
    "name": "Watches",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Flip Flops",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Kids Shoes",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Shoes",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Wallets",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Backpacks, Laptop Sleeves and Bags",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.5
      }
    ]
  },
  {
    "name": "Handbags",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Luggage – Suitcase and Trolleys",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Luggage – Travel Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Luggage – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Silver Jewellery",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Silver Coins and Bars",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Fine Jewellery – Unstudded and Solitaire",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Fine Jewellery – Studded",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Fine Jewellery – Gold Coins",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Fashion Jewellery",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 22.5
      }
    ]
  },
  {
    "name": "Kitchen Tools and Supplies – Choppers, Knives, Bakeware and Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Cookware, Tableware and Dinnerware",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Kitchen – Glassware and Ceramicware",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Gas Stoves and Pressure Cookers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 1500.0,
        "rate": 6.0
      },
      {
        "min": 1500.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Small Appliances",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 4.5
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Fans and Robotic Vacuums",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 7.0
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Water Purifier and Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 6.5
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Water Heaters and Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 8.0
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Inverter and Batteries",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 4.5
      }
    ]
  },
  {
    "name": "Cleaning and Home Appliances",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 7.5
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Containers, Boxes, Bottles and Kitchen Storage",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Slipcovers and Kitchen Linens",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.5
      }
    ]
  },
  {
    "name": "Kitchen – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Wall Art",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Home Fragrance and Candles",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Home Furnishing (Excluding Curtain and Curtain Accessories)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Netting Cover",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Bedsheets, Blankets and Covers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Home Storage (Excluding Kitchen Containers, Boxes, Bottles and Kitchen Storage)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Shelfs, Cabinets, Racks & Item Stands",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Home – Waste and Recycling",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Craft Materials",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Home Decor Products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Clocks",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "LED Bulbs and Battens",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Indoor Lighting – Wall, Ceiling Fixture Lights, Lamp Bases, Lamp Shades and Smart Lighting",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Indoor Lighting – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Cushion Covers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Curtains and Curtain Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.5
      }
    ]
  },
  {
    "name": "Rugs and Doormats",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Doors and Windows (Wooden, Metal, PVC/UPVC Doors and Windows)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 5000.0,
        "rate": 6.0
      },
      {
        "min": 5000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Sanitaryware – Toilets, Bathtubs, Basins/Sinks, Bath Mirrors and Vanities, and Shower Enclosures/Partitions",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 10000.0,
        "rate": 8.0
      },
      {
        "min": 10000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Tiles and Flooring Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Wires (Electrical Wires/cables for House Wiring, ad hoc usage)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Home – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.0
      }
    ]
  },
  {
    "name": "Wallpapers and Wallpaper Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Wall Paints and Tools",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Home Improvement Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Safes and Lockers with Locking Mechanism",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Home improvement – Kitchen and Bath (Fittings, accessories), Cleaning Supplies, Electricals, Hardware, Building Materials",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Ladders",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Home Safety and Security Systems",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Home Improvement – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Lawn and Garden – Solar Panels",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Lawn and Garden – Leaf Blower and Water Pump",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Lawn and Garden – Solar Devices, Inverters, Charge Controller, Battery, Lights, Solar Gadgets",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Lawn and Garden – Chemical Pest Control, Bird Control, Plant Protection, Foggers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 9.0
      }
    ]
  },
  {
    "name": "Lawn and Garden – Outdoor equipments, Saws, Lawn Mowers, Cultivator, Tiller, String Trimmers, Generators, Barbeque Grills, Greenhouses",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.5
      }
    ]
  },
  {
    "name": "Lawn and Garden – Plants, Seeds, Bulbs and Gardening Tools",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Lawn and Garden – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 10.0
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Automotive – Tyres and Rims",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Automotive – Batteries and Air Fresheners",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Automotive Accessories – Floor Mats, Seat, Car and Bike Covers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Automotive Helmets and Riding Gloves",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Automotive Vehicles – 2-Wheelers, 4-Wheelers and Electric Vehicle",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 50000.0,
        "rate": 5.0
      },
      {
        "min": 50000.0,
        "max": null,
        "rate": 2.0
      }
    ]
  },
  {
    "name": "Automotive – Car and Bike Parts, Brakes, Styling and Body Fittings, Transmission, Engine Parts, Exhaust Systems, Interior Fitting, Suspension and Wipers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Vehicle Tools and Appliances",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Oils, Lubricants",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Automotive – Cleaning Kits, Sponges, Brush, Duster, Cloths and Liquids, Car Interior and Exterior Care, Waxes, Polish, Shampoo, Car and Bike, Lighting and Paints",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Automotive – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Major Appliances Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Chimneys",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 9.5
      }
    ]
  },
  {
    "name": "Refrigerators",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Major Appliances – Other products",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Mattresses",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 25.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 20000.0,
        "rate": 16.0
      },
      {
        "min": 20000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Bean Bags and Inflatables",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Office Furniture – Study Table, Office and Gaming Chairs",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 16.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 15.5
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Large Furniture – Sofa, Beds, Wardrobes, Recliners, Living & Dining room chairs and tables",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 15.5
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Furniture – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 15.5
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Business and Scientific Supplies",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 11.5
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "3D_Printers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Business and Industrial Supplies – Electrical Testing, Dimensional Measurement, Thermal Printers and Barcode Scanners",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Business and Industrial Supplies – Commercial, Food Handling Equipment and Health Supplies",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Stethoscopes",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.5
      }
    ]
  },
  {
    "name": "Packing Materials",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Power and Hand Tools and Water Dispenser",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Masks",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Business and Industrial Supplies – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 15000.0,
        "rate": 8.0
      },
      {
        "min": 15000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Bicycles",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Gym Equipment’s",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": 35000.0,
        "rate": 12.0
      },
      {
        "min": 35000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Gym Weights",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Sports – Footwear",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Sports – Cricket and Badminton Equipments, Tennis, Table Tennis, Squash, Football, Volleyball, Basketball, Throwball and Swimming",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.5
      }
    ]
  },
  {
    "name": "Sports – Cricket Bats, Badminton Racquets, Tennis Racquets, Pickleball Paddles, Squash Racquets and TT Tables",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 7.5
      }
    ]
  },
  {
    "name": "Sports – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Sports Collectibles",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Consumable Physical Gift Card",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Email Gift Card",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 0.0
      }
    ]
  },
  {
    "name": "Entertainment Collectibles",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 13.0
      },
      {
        "min": 300.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Coins Collectibles",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Mobile Phones",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Tablets",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 12000.0,
        "rate": 6.0
      },
      {
        "min": 12000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Laptops",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Scanners and Printers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.5
      }
    ]
  },
  {
    "name": "PC Components – RAM and Motherboards",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": null,
        "rate": 5.5
      }
    ]
  },
  {
    "name": "Desktops",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Monitors",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 6.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Laptop and Camera Battery",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 14.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 12.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 14.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.5
      }
    ]
  },
  {
    "name": "USB Flash Drives – Pen Drives",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Hard Disks",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 9.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.5
      }
    ]
  },
  {
    "name": "Kindle Accessories",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 25.0
      }
    ]
  },
  {
    "name": "Memory Cards",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 16.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 16.0
      }
    ]
  },
  {
    "name": "Modems and Networking Devices",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Car Electronics Devices",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 7.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 9.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 12.0
      }
    ]
  },
  {
    "name": "Car Electronics Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 15.0
      }
    ]
  },
  {
    "name": "Electronic Devices (Excluding TV, Camera and Camcorder, Camera Lenses and Accessories, GPS Devices and Speakers)",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 9.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Landline Phones",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Smart Watches and Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Television",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Camera and Camcorder",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": 19000.0,
        "rate": 7.0
      },
      {
        "min": 19000.0,
        "max": 49000.0,
        "rate": 9.0
      },
      {
        "min": 49000.0,
        "max": null,
        "rate": 7.0
      }
    ]
  },
  {
    "name": "Camera Lenses",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 7.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Camera Accessories",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "GPS Devices",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 13.5
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 12.5
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 13.5
      }
    ]
  },
  {
    "name": "Speakers",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 11.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 11.5
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Headsets, Headphones and Earphones",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 18.0
      }
    ]
  },
  {
    "name": "Computer and Laptop – Keyboards and Mouse",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Power Banks and Chargers",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 20.5
      }
    ]
  },
  {
    "name": "Accessories – Electronics, PC and Wireless",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 17.0
      }
    ]
  },
  {
    "name": "Cases, Covers and Skins, and Screen Guards",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 25.0
      }
    ]
  },
  {
    "name": "Cables and Adapters – Electronics, PC and Wireless",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 20.0
      }
    ]
  },
  {
    "name": "Car Cradles, Lens Kits and Tablet Cases",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 0.0
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 5.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 28.5
      }
    ]
  },
  {
    "name": "Warranty Services",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 10.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 29.0
      },
      {
        "min": 500.0,
        "max": null,
        "rate": 30.0
      }
    ]
  },
  {
    "name": "Office Products – Arts and Crafts",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 5.0
      }
    ]
  },
  {
    "name": "Office Products – Office Supplies",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 13.0
      }
    ]
  },
  {
    "name": "Office Products – Writing Instruments",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 14.0
      }
    ]
  },
  {
    "name": "Office – Electronic Devices",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Office – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Projectors, Home Theatre Systems, Binoculars and Telescopes",
    "tiers": [
      {
        "min": 0,
        "max": null,
        "rate": 6.0
      }
    ]
  },
  {
    "name": "Musical Instruments – Guitars",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 10.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 10.0
      }
    ]
  },
  {
    "name": "Musical Instruments – Keyboards",
    "tiers": [
      {
        "min": 0,
        "max": 500.0,
        "rate": 8.0
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 8.0
      }
    ]
  },
  {
    "name": "Musical Instruments – Microphones",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 9.5
      },
      {
        "min": 300.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.5
      }
    ]
  },
  {
    "name": "Musical Instruments – DJ and VJ Equipment, Recording and Computer, Cables and Leads, and PA and Stage",
    "tiers": [
      {
        "min": 0,
        "max": 300.0,
        "rate": 6.0
      },
      {
        "min": 300.0,
        "max": 500.0,
        "rate": 4.5
      },
      {
        "min": 500.0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  },
  {
    "name": "Musical Instruments – Other products",
    "tiers": [
      {
        "min": 0,
        "max": 1000.0,
        "rate": 0.0
      },
      {
        "min": 1000.0,
        "max": null,
        "rate": 11.0
      }
    ]
  }
];
 
const AMAZON_SETTINGS = {
  feeGstRate: 18,
  gstTcsRate: 1,
  incomeTaxTdsRate: 1,
 
  // Easy Ship closing fee from the supplied Amazon fee list.
  closingFeeSlabs: [
    { max: 300, fee: 1 },
    { max: 500, fee: 22 },
    { max: 1000, fee: 45 },
    { max: Infinity, fee: 76 }
  ],
 
  /*
    Standard-size Easy Ship weight handling fee.
    First 500 g + additional 500 g up to 1 kg +
    each additional kg after 1 kg up to 5 kg.
  */
  shipping: {
    local:    { first500: 27, next500: 13, eachKgAfter1: 15 },
    regional: { first500: 45, next500: 17, eachKgAfter1: 21 },
    national: { first500: 65, next500: 25, eachKgAfter1: 27 }
  }
};
 
const FLIPKART_SETTINGS = {
  feeGstRate: 18,
  tcsRate: 1,
  tdsRate: 1,
  maximumSupportedPrice: 1000,
 
  // Bronze seller fixed-fee slabs supplied from the Flipkart rate card.
  fixedFeeSlabs: [
    { max: 200, fee: 13 },
    { max: 300, fee: 15 },
    { max: 500, fee: 16 },
    { max: 1000, fee: 20 }
  ],
 
  shipping: {
    local: {
      upTo500: 109,
      upTo1000: 144,
      upTo1500: 194,
      upTo2000: 234,
      twoKgBase: 234,
      twoToThreeIncrement: 38,
      threeKgBase: 310,
      threeToTwelveIncrement: 26,
      twelveKgBase: 544,
      aboveTwelveIncrement: 16
    },
    regional: {
      upTo500: 129,
      upTo1000: 179,
      upTo1500: 229,
      upTo2000: 279,
      twoKgBase: 279,
      twoToThreeIncrement: 45,
      threeKgBase: 369,
      threeToTwelveIncrement: 30,
      twelveKgBase: 639,
      aboveTwelveIncrement: 17
    },
    national: {
      upTo500: 165,
      upTo1000: 220,
      upTo1500: 280,
      upTo2000: 330,
      twoKgBase: 330,
      twoToThreeIncrement: 50,
      threeKgBase: 430,
      threeToTwelveIncrement: 36,
      twelveKgBase: 754,
      aboveTwelveIncrement: 20
    }
  }
};
 
 
const MEESHO_SETTINGS = {
  feeGstRate: 18,
  tcsRate: 1,
  tdsRate: 1,
 
  // Version 1 estimated baseline logistics slabs.
  shipping: {
    local: {
      upTo500: 38,
      upTo1000: 54,
      upTo2000: 72,
      upTo3000: 92,
      extraKgAfter3: 20
    },
    regional: {
      upTo500: 49,
      upTo1000: 68,
      upTo2000: 98,
      upTo3000: 126,
      extraKgAfter3: 28
    },
    national: {
      upTo500: 61,
      upTo1000: 82,
      upTo2000: 124,
      upTo3000: 158,
      extraKgAfter3: 36
    }
  }
};
 
const form = document.getElementById('amazonCalculatorForm');
const marketplaceSelect = document.getElementById('marketplace');
const categoryGroup = document.getElementById('categoryGroup');
const categorySelect = document.getElementById('productCategory');
const sellingPriceInput = document.getElementById('sellingPrice');
const productCostInput = document.getElementById('productCost');
const gstRateSelect = document.getElementById('gstRate');
const weightInput = document.getElementById('productWeight');
const errorMessage = document.getElementById('errorMessage');
const resultPlaceholder = document.getElementById('resultPlaceholder');
const resultContent = document.getElementById('resultContent');
const resultTitle = document.getElementById('resultTitle');
const commissionLabel = document.getElementById('commissionLabel');
const fixedFeeLabel = document.getElementById('fixedFeeLabel');
const gstFeeLabel = document.getElementById('gstFeeLabel');
const calculationNoteText = document.getElementById('calculationNoteText');
 
function populateCategories() {
  const fragment = document.createDocumentFragment();
 
  AMAZON_CATEGORIES.forEach((category, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = category.name;
    fragment.appendChild(option);
  });
 
  categorySelect.appendChild(fragment);
}
 
function money(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
 
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeValue);
}
 
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
 
function getAmazonReferralRate(categoryIndex, sellingPrice) {
  const category = AMAZON_CATEGORIES[categoryIndex];
 
  if (!category) {
    throw new Error('Please select a valid product category.');
  }
 
  const tier = category.tiers.find((item) => {
    const aboveMinimum = sellingPrice > item.min || item.min === 0;
    const withinMaximum = item.max === null || sellingPrice <= item.max;
    return aboveMinimum && withinMaximum;
  });
 
  if (!tier) {
    throw new Error('Referral fee slab was not found for this selling price.');
  }
 
  return tier.rate;
}
 
function getAmazonClosingFee(sellingPrice) {
  const slab = AMAZON_SETTINGS.closingFeeSlabs.find(
    (item) => sellingPrice <= item.max
  );
 
  return slab ? slab.fee : 0;
}
 
function getAmazonShippingFee(weightInKg, zone) {
  const rates = AMAZON_SETTINGS.shipping[zone];
 
  if (!rates) {
    throw new Error('Invalid shipping zone.');
  }
 
  const weightInGrams = weightInKg * 1000;
 
  if (weightInGrams <= 500) return rates.first500;
  if (weightInGrams <= 1000) return rates.first500 + rates.next500;
 
  const extraKgAfterOne = Math.ceil((weightInGrams - 1000) / 1000);
 
  return rates.first500 + rates.next500 +
    extraKgAfterOne * rates.eachKgAfter1;
}
 
function getFlipkartFixedFee(sellingPrice) {
  const slab = FLIPKART_SETTINGS.fixedFeeSlabs.find(
    (item) => sellingPrice <= item.max
  );
 
  if (!slab) {
    throw new Error('Flipkart currently supports selling prices up to ₹1,000 only.');
  }
 
  return slab.fee;
}
 
function getFlipkartShippingFee(weightInKg, zone) {
  const rates = FLIPKART_SETTINGS.shipping[zone];
 
  if (!rates) {
    throw new Error('Invalid shipping zone.');
  }
 
  if (weightInKg <= 0.5) return rates.upTo500;
  if (weightInKg <= 1) return rates.upTo1000;
  if (weightInKg <= 1.5) return rates.upTo1500;
  if (weightInKg <= 2) return rates.upTo2000;
 
  if (weightInKg <= 3) {
    const extraHalfKg = Math.ceil((weightInKg - 2) / 0.5);
    return rates.twoKgBase + extraHalfKg * rates.twoToThreeIncrement;
  }
 
  if (weightInKg <= 12) {
    const extraKg = Math.ceil(weightInKg - 3);
    return rates.threeKgBase + extraKg * rates.threeToTwelveIncrement;
  }
 
  const extraKgAboveTwelve = Math.ceil(weightInKg - 12);
  return rates.twelveKgBase +
    extraKgAboveTwelve * rates.aboveTwelveIncrement;
}
 
 
function getMeeshoShippingFee(weightInKg, zone) {
  const rates = MEESHO_SETTINGS.shipping[zone];
 
  if (!rates) {
    throw new Error('Invalid shipping zone.');
  }
 
  if (weightInKg <= 0.5) return rates.upTo500;
  if (weightInKg <= 1) return rates.upTo1000;
  if (weightInKg <= 2) return rates.upTo2000;
  if (weightInKg <= 3) return rates.upTo3000;
 
  const extraKg = Math.ceil(weightInKg - 3);
  return rates.upTo3000 + extraKg * rates.extraKgAfter3;
}
 
function calculateAmazonZone(inputs, zone) {
  const taxableValue = inputs.gstRate === 0
    ? inputs.sellingPrice
    : inputs.sellingPrice / (1 + inputs.gstRate / 100);
 
  const referralRate = getAmazonReferralRate(
    inputs.categoryIndex,
    inputs.sellingPrice
  );
  const referralFee = inputs.sellingPrice * (referralRate / 100);
  const closingFee = getAmazonClosingFee(inputs.sellingPrice);
  const shippingFee = getAmazonShippingFee(inputs.weight, zone);
  const feesBeforeGst = referralFee + closingFee + shippingFee;
  const feeGst = feesBeforeGst * (AMAZON_SETTINGS.feeGstRate / 100);
  const tcs = taxableValue * (AMAZON_SETTINGS.gstTcsRate / 100);
  const tds = inputs.sellingPrice *
    (AMAZON_SETTINGS.incomeTaxTdsRate / 100);
 
  return createResult(
    inputs,
    shippingFee,
    referralFee,
    closingFee,
    feeGst,
    tcs,
    tds
  );
}
 
function calculateFlipkartZone(inputs, zone) {
  if (inputs.sellingPrice > FLIPKART_SETTINGS.maximumSupportedPrice) {
    throw new Error(
      'Flipkart calculator currently supports products priced up to ₹1,000 only.'
    );
  }
 
  const taxableValue = inputs.gstRate === 0
    ? inputs.sellingPrice
    : inputs.sellingPrice / (1 + inputs.gstRate / 100);
 
  const commissionFee = 0;
  const fixedFee = getFlipkartFixedFee(inputs.sellingPrice);
  const shippingFee = getFlipkartShippingFee(inputs.weight, zone);
  const feesBeforeGst = commissionFee + fixedFee + shippingFee;
  const feeGst = feesBeforeGst * (FLIPKART_SETTINGS.feeGstRate / 100);
  const tcs = taxableValue * (FLIPKART_SETTINGS.tcsRate / 100);
  const tds = inputs.sellingPrice * (FLIPKART_SETTINGS.tdsRate / 100);
 
  return createResult(
    inputs,
    shippingFee,
    commissionFee,
    fixedFee,
    feeGst,
    tcs,
    tds
  );
}
 
 
function calculateMeeshoZone(inputs, zone) {
  const taxableValue = inputs.gstRate === 0
    ? inputs.sellingPrice
    : inputs.sellingPrice / (1 + inputs.gstRate / 100);
 
  const commissionFee = 0;
  const fixedFee = 0;
  const shippingFee = getMeeshoShippingFee(inputs.weight, zone);
  const feesBeforeGst = shippingFee;
  const feeGst = feesBeforeGst * (MEESHO_SETTINGS.feeGstRate / 100);
  const tcs = taxableValue * (MEESHO_SETTINGS.tcsRate / 100);
  const tds = inputs.sellingPrice * (MEESHO_SETTINGS.tdsRate / 100);
 
  return createResult(
    inputs,
    shippingFee,
    commissionFee,
    fixedFee,
    feeGst,
    tcs,
    tds
  );
}
 
function createResult(
  inputs,
  shippingFee,
  marketplaceFee,
  fixedFee,
  feeGst,
  tcs,
  tds
) {
  const feesBeforeGst = marketplaceFee + fixedFee + shippingFee;
  const totalDeduction = feesBeforeGst + feeGst + tcs + tds;
  const bankSettlement = inputs.sellingPrice - totalDeduction;
 
  // TCS and TDS affect bank settlement, but are not treated as permanent expense.
  const netProfit = inputs.sellingPrice - inputs.productCost -
    feesBeforeGst - feeGst;
 
  return {
    sellingPrice: round2(inputs.sellingPrice),
    productCost: round2(inputs.productCost),
    shippingFee: round2(shippingFee),
    referralFee: round2(marketplaceFee),
    closingFee: round2(fixedFee),
    feeGst: round2(feeGst),
    tcs: round2(tcs),
    tds: round2(tds),
    totalDeduction: round2(totalDeduction),
    bankSettlement: round2(bankSettlement),
    netProfit: round2(netProfit)
  };
}
 
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = money(value);
}
 
function setProfit(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
 
  element.textContent = money(value);
  element.classList.toggle('loss-value', value < 0);
}
 
function renderZone(prefix, result) {
  setText(`${prefix}SellingPrice`, result.sellingPrice);
  setText(`${prefix}ProductCost`, result.productCost);
  setText(`${prefix}ShippingFee`, result.shippingFee);
  setText(`${prefix}ReferralFee`, result.referralFee);
  setText(`${prefix}ClosingFee`, result.closingFee);
  setText(`${prefix}FeeGst`, result.feeGst);
  setText(`${prefix}Tcs`, result.tcs);
  setText(`${prefix}Tds`, result.tds);
  setText(`${prefix}TotalDeduction`, result.totalDeduction);
  setText(`${prefix}Settlement`, result.bankSettlement);
  setProfit(`${prefix}Profit`, result.netProfit);
  setProfit(`${prefix}ProfitSummary`, result.netProfit);
}
 
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  resultPlaceholder.style.display = 'flex';
  resultContent.style.display = 'none';
}
 
function clearError() {
  errorMessage.textContent = '';
  errorMessage.style.display = 'none';
}
 
function updateMarketplaceView() {
  const marketplace = marketplaceSelect.value;
  const isAmazon = marketplace === 'amazon';
  const isFlipkart = marketplace === 'flipkart';
 
  categoryGroup.style.display = isAmazon ? 'block' : 'none';
  categorySelect.required = isAmazon;
 
  if (isAmazon) {
    resultTitle.textContent = 'Amazon Fee Calculation Result';
    commissionLabel.textContent = 'Referral Fee';
    fixedFeeLabel.textContent = 'Closing Fee';
    gstFeeLabel.textContent = 'GST on Amazon Fees';
    calculationNoteText.textContent =
      'This calculator provides an estimated result based on the selected category, selling price, product weight and available Amazon fee structure. Actual settlement may vary.';
  } else if (isFlipkart) {
    resultTitle.textContent = 'Flipkart Fee Calculation Result';
    commissionLabel.textContent = 'Commission Fee';
    fixedFeeLabel.textContent = 'Fixed Fee';
    gstFeeLabel.textContent = 'GST on Flipkart Fees';
    calculationNoteText.textContent =
      'Flipkart calculation currently supports selling prices up to ₹1,000 with 0% commission. Fixed fee uses the Bronze seller slab supplied in the rate card. Actual settlement may vary.';
  } else {
    resultTitle.textContent = 'Meesho Fee Calculation Result';
    commissionLabel.textContent = 'Commission Fee';
    fixedFeeLabel.textContent = 'Fixed Fee';
    gstFeeLabel.textContent = 'GST on Meesho Fees';
    calculationNoteText.textContent =
      'Meesho uses 0% commission and estimated baseline logistics slabs for Local, Regional and National delivery. Actual shipping deductions may vary by courier partner, pickup location and billable weight.';
  }
 
  clearError();
  resultPlaceholder.style.display = 'flex';
  resultContent.style.display = 'none';
}
 
function validateInputs() {
  const marketplace = marketplaceSelect.value;
  const categoryIndex = Number(categorySelect.value);
  const sellingPrice = Number(sellingPriceInput.value);
  const productCost = Number(productCostInput.value);
  const gstRate = Number(gstRateSelect.value);
  const weight = Number(weightInput.value);
 
  if (marketplace === 'amazon' && categorySelect.value === '') {
    throw new Error('Please select the product category.');
  }
 
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
    throw new Error('Please enter a valid selling price.');
  }
 
  if (
    marketplace === 'flipkart' &&
    sellingPrice > FLIPKART_SETTINGS.maximumSupportedPrice
  ) {
    throw new Error(
      'Flipkart calculator currently supports products priced up to ₹1,000 only.'
    );
  }
 
  if (!Number.isFinite(productCost) || productCost < 0) {
    throw new Error('Please enter a valid product cost.');
  }
 
  if (gstRateSelect.value === '' || !Number.isFinite(gstRate)) {
    throw new Error('Please select the product GST rate.');
  }
 
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error('Please enter a valid packed product weight in kg.');
  }
 
  return {
    marketplace,
    categoryIndex,
    sellingPrice,
    productCost,
    gstRate,
    weight
  };
}
 
function handleCalculate(event) {
  event.preventDefault();
  clearError();
 
  try {
    const inputs = validateInputs();
    let calculator;
 
    if (inputs.marketplace === 'amazon') {
      calculator = calculateAmazonZone;
    } else if (inputs.marketplace === 'flipkart') {
      calculator = calculateFlipkartZone;
    } else {
      calculator = calculateMeeshoZone;
    }
 
    const local = calculator(inputs, 'local');
    const regional = calculator(inputs, 'regional');
    const national = calculator(inputs, 'national');
 
    renderZone('local', local);
    renderZone('regional', regional);
    renderZone('national', national);
 
    resultPlaceholder.style.display = 'none';
    resultContent.style.display = 'block';
  } catch (error) {
    showError(
      error instanceof Error
        ? error.message
        : 'Unable to calculate. Please check the entered details.'
    );
  }
}
 
populateCategories();
marketplaceSelect.addEventListener('change', updateMarketplaceView);
form.addEventListener('submit', handleCalculate);
updateMarketplaceView();
 
