/**
 * Comprehensive ZIP code prefix to coordinates mapping
 * Maps 3-digit ZIP prefixes to [latitude, longitude] coordinates
 * Covers major metropolitan areas and known regions across the US
 */
export const zipToCoords = {
  // Texas Panhandle - more precise locations
  '790': [35.22, -101.83], // Amarillo area
  '791': [35.22, -101.83], // Amarillo
  '792': [34.18, -101.72], // Plainview/Snyder area
  '793': [33.58, -101.85], // Lubbock area
  '794': [33.58, -101.85], // Lubbock
  '795': [32.45, -99.73],  // Abilene area
  '796': [32.45, -99.73],  // Abilene
  '797': [31.99, -102.08], // Midland/Odessa

  // Additional Texas prefixes
  '798': [30.85, -104.02], // Fort Hancock area
  '799': [31.76, -106.49], // El Paso area

  // New Mexico
  '870': [35.08, -106.65], // Albuquerque area
  '871': [35.08, -106.65], // Albuquerque
  '872': [35.08, -106.65], // Albuquerque
  '873': [36.41, -107.05], // Crownpoint area
  '874': [36.73, -108.22], // Farmington area
  '875': [35.69, -105.94], // Santa Fe area
  '876': [36.75, -108.18], // Navajo Nation area
  '877': [34.41, -104.24], // Roswell area
  '878': [33.28, -108.87], // Truth or Consequences area
  '879': [32.78, -107.82], // Hillsboro area
  '880': [32.28, -106.75], // Las Cruces area
  '881': [33.41, -104.52], // Clovis/Portales area
  '882': [32.89, -103.13], // Hobbs area
  '883': [33.24, -105.66], // Ruidoso area
  '884': [36.75, -103.98], // Raton area

  // Kansas
  '660': [38.96, -94.78],  // Kansas City, KS area
  '661': [39.11, -94.76],  // Kansas City, KS
  '662': [38.96, -94.78],  // Overland Park area
  '664': [39.18, -96.60],  // Manhattan, KS area
  '665': [39.05, -95.68],  // Topeka area
  '666': [39.05, -95.68],  // Topeka
  '667': [37.43, -94.71],  // Pittsburg, KS area
  '668': [38.37, -95.65],  // Emporia area
  '669': [39.78, -99.33],  // Hays area
  '670': [37.69, -97.34],  // Wichita area
  '671': [37.69, -97.34],  // Wichita
  '672': [37.69, -97.34],  // Wichita
  '673': [37.41, -95.27],  // Independence area
  '674': [38.85, -97.61],  // Salina area
  '675': [38.37, -98.78],  // Hutchinson area
  '676': [39.36, -99.32],  // Hays area
  '677': [39.78, -99.33],  // Hays
  '678': [37.04, -100.93], // Liberal area
  '679': [37.04, -100.93], // Liberal

  // Arkansas
  '716': [33.45, -91.50], // Monticello area
  '717': [33.25, -92.70], // El Dorado area
  '718': [35.25, -90.70], // Jonesboro area
  '719': [34.50, -93.00], // Hot Springs area
  '720': [34.75, -92.30], // Little Rock area
  '721': [34.75, -92.30], // Little Rock
  '722': [34.75, -92.30], // Little Rock
  '723': [35.15, -90.20], // West Memphis area
  '724': [35.75, -89.95], // Blytheville area
  '725': [35.80, -91.65], // Batesville area
  '726': [36.25, -92.35], // Mountain Home area
  '727': [36.35, -94.20], // Fayetteville area
  '728': [35.30, -93.15], // Russellville area
  '729': [35.40, -94.45], // Fort Smith area
  '755': [33.45, -94.05], // Texarkana, AR area

  // North Carolina (truncated for brevity - full mapping would be extensive)
  '270': [36.10, -80.25], // Winston-Salem area
  '271': [36.10, -80.25], // Winston-Salem
  '272': [35.80, -79.00], // Greensboro area
  '273': [35.80, -79.00], // Greensboro
  '274': [36.10, -79.90], // Greensboro
  '275': [35.80, -78.65], // Raleigh area
  '276': [35.80, -78.65], // Raleigh
  '277': [35.90, -78.90], // Durham area
  '278': [35.60, -77.40], // Greenville area
  '279': [36.00, -75.70], // Outer Banks area
  '280': [35.25, -80.90], // Charlotte area
  '281': [35.25, -80.90], // Charlotte
  '282': [35.25, -80.90], // Charlotte
  '283': [35.05, -79.00], // Fayetteville area
  '284': [34.25, -77.95], // Wilmington area
  '285': [34.75, -77.40], // Jacksonville area
  '286': [36.20, -81.70], // Hickory area
  '287': [35.60, -82.55], // Asheville area
  '288': [35.60, -82.55], // Asheville
  '289': [34.75, -76.90], // Morehead City area

  // Illinois (truncated for brevity)
  '600': [42.10, -87.90], // Chicago northern suburbs
  '601': [41.90, -88.00], // Chicago western suburbs
  '602': [41.90, -87.90], // Chicago
  '603': [41.90, -87.90], // Chicago
  '604': [41.60, -87.70], // Chicago southern suburbs
  '605': [41.75, -88.25], // Aurora area
  '606': [41.90, -87.65], // Chicago
  '607': [41.90, -87.65], // Chicago
  '608': [41.70, -87.75], // Chicago
  '609': [40.50, -87.65], // Kankakee area
  '610': [42.25, -89.10], // Rockford area
  '611': [42.25, -89.10], // Rockford
  '612': [41.50, -90.50], // Moline area
  '613': [41.35, -88.85], // Ottawa area
  '614': [40.70, -89.60], // Peoria area
  '615': [40.70, -89.60], // Peoria
  '616': [40.70, -89.60], // Peoria
  '617': [40.45, -88.95], // Bloomington area
  '618': [40.10, -88.25], // Champaign/Urbana area
  '619': [39.80, -88.30], // Charleston area
  '620': [38.90, -90.20], // St. Louis area
  '621': [38.90, -90.20], // St. Louis
  '622': [38.60, -90.15], // St. Louis
  '623': [39.95, -91.35], // Quincy area
  '624': [39.10, -88.60], // Effingham area
  '625': [39.75, -89.65], // Springfield area
  '626': [39.75, -89.65], // Springfield
  '627': [39.75, -89.65], // Springfield
  '628': [38.00, -88.95], // Mount Vernon area
  '629': [37.75, -89.35], // Carbondale area

  // South Dakota
  '570': [43.55, -96.73], // Sioux Falls area
  '571': [43.55, -96.73], // Sioux Falls
  '572': [45.46, -98.49], // Aberdeen area
  '573': [44.37, -100.35], // Pierre area
  '574': [45.46, -98.49], // Aberdeen
  '575': [43.72, -99.32], // Winner area (Rosebud Sioux Reservation)
  '576': [45.67, -100.51], // Mobridge area
  '577': [44.08, -103.23], // Rapid City area
  '578': [44.37, -100.35], // Pierre
  '579': [44.37, -100.35], // Pierre
};