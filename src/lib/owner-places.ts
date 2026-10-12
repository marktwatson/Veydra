export type CityPop = { name: string; people: number };

const CITIES: Record<string, CityPop[]> = {
  Alabama: [
    { name: "Huntsville", people: 230000 },
    { name: "Birmingham", people: 197000 },
    { name: "Montgomery", people: 196000 },
    { name: "Mobile", people: 183000 },
    { name: "Tuscaloosa", people: 111000 },
  ],
  Alaska: [
    { name: "Anchorage", people: 286000 },
    { name: "Fairbanks", people: 32000 },
    { name: "Juneau", people: 32000 },
  ],
  Arizona: [
    { name: "Phoenix", people: 1650000 },
    { name: "Tucson", people: 543000 },
    { name: "Mesa", people: 504000 },
    { name: "Chandler", people: 280000 },
    { name: "Gilbert", people: 267000 },
    { name: "Glendale", people: 249000 },
    { name: "Scottsdale", people: 241000 },
    { name: "Peoria", people: 191000 },
  ],
  Arkansas: [
    { name: "Little Rock", people: 203000 },
    { name: "Fayetteville", people: 99000 },
    { name: "Fort Smith", people: 89000 },
    { name: "Springdale", people: 88000 },
  ],
  California: [
    { name: "Los Angeles", people: 3800000 },
    { name: "San Diego", people: 1380000 },
    { name: "San Jose", people: 970000 },
    { name: "San Francisco", people: 808000 },
    { name: "Fresno", people: 545000 },
    { name: "Sacramento", people: 525000 },
    { name: "Long Beach", people: 450000 },
    { name: "Oakland", people: 430000 },
  ],
  Colorado: [
    { name: "Denver", people: 716000 },
    { name: "Colorado Springs", people: 488000 },
    { name: "Aurora", people: 395000 },
    { name: "Fort Collins", people: 170000 },
    { name: "Boulder", people: 106000 },
  ],
  Connecticut: [
    { name: "Bridgeport", people: 148000 },
    { name: "Stamford", people: 136000 },
    { name: "New Haven", people: 135000 },
    { name: "Hartford", people: 121000 },
  ],
  Delaware: [
    { name: "Wilmington", people: 71000 },
    { name: "Dover", people: 39000 },
    { name: "Newark", people: 31000 },
  ],
  Florida: [
    { name: "Jacksonville", people: 986000 },
    { name: "Miami", people: 456000 },
    { name: "Tampa", people: 403000 },
    { name: "Orlando", people: 320000 },
    { name: "St. Petersburg", people: 263000 },
    { name: "Fort Lauderdale", people: 184000 },
  ],
  Georgia: [
    { name: "Atlanta", people: 510000 },
    { name: "Augusta", people: 202000 },
    { name: "Columbus", people: 202000 },
    { name: "Macon", people: 157000 },
    { name: "Savannah", people: 148000 },
  ],
  Hawaii: [
    { name: "Honolulu", people: 343000 },
    { name: "Hilo", people: 48000 },
    { name: "Kailua", people: 40000 },
  ],
  Idaho: [
    { name: "Boise", people: 236000 },
    { name: "Meridian", people: 134000 },
    { name: "Nampa", people: 114000 },
    { name: "Idaho Falls", people: 69000 },
  ],
  Illinois: [
    { name: "Chicago", people: 2660000 },
    { name: "Aurora", people: 180000 },
    { name: "Naperville", people: 150000 },
    { name: "Joliet", people: 150000 },
    { name: "Rockford", people: 147000 },
  ],
  Indiana: [
    { name: "Indianapolis", people: 880000 },
    { name: "Fort Wayne", people: 270000 },
    { name: "Evansville", people: 116000 },
    { name: "South Bend", people: 103000 },
    { name: "Carmel", people: 102000 },
  ],
  Iowa: [
    { name: "Des Moines", people: 214000 },
    { name: "Cedar Rapids", people: 137000 },
    { name: "Davenport", people: 101000 },
    { name: "Iowa City", people: 75000 },
  ],
  Kansas: [
    { name: "Wichita", people: 397000 },
    { name: "Overland Park", people: 197000 },
    { name: "Kansas City", people: 156000 },
    { name: "Olathe", people: 147000 },
    { name: "Topeka", people: 126000 },
  ],
  Kentucky: [
    { name: "Louisville", people: 633000 },
    { name: "Lexington", people: 322000 },
    { name: "Bowling Green", people: 76000 },
    { name: "Owensboro", people: 60000 },
  ],
  Louisiana: [
    { name: "New Orleans", people: 364000 },
    { name: "Baton Rouge", people: 225000 },
    { name: "Shreveport", people: 177000 },
    { name: "Lafayette", people: 121000 },
  ],
  Maine: [
    { name: "Portland", people: 69000 },
    { name: "Lewiston", people: 37000 },
    { name: "Bangor", people: 32000 },
  ],
  Maryland: [
    { name: "Baltimore", people: 565000 },
    { name: "Frederick", people: 82000 },
    { name: "Gaithersburg", people: 69000 },
    { name: "Rockville", people: 67000 },
  ],
  Massachusetts: [
    { name: "Boston", people: 650000 },
    { name: "Worcester", people: 207000 },
    { name: "Springfield", people: 155000 },
    { name: "Cambridge", people: 118000 },
    { name: "Lowell", people: 115000 },
  ],
  Michigan: [
    { name: "Detroit", people: 633000 },
    { name: "Grand Rapids", people: 198000 },
    { name: "Warren", people: 138000 },
    { name: "Ann Arbor", people: 122000 },
    { name: "Lansing", people: 113000 },
  ],
  Minnesota: [
    { name: "Minneapolis", people: 425000 },
    { name: "St. Paul", people: 307000 },
    { name: "Rochester", people: 122000 },
    { name: "Bloomington", people: 89000 },
  ],
  Mississippi: [
    { name: "Jackson", people: 143000 },
    { name: "Gulfport", people: 72000 },
    { name: "Southaven", people: 58000 },
    { name: "Hattiesburg", people: 48000 },
  ],
  Missouri: [
    { name: "Kansas City", people: 510000 },
    { name: "St. Louis", people: 282000 },
    { name: "Springfield", people: 169000 },
    { name: "Columbia", people: 130000 },
  ],
  Montana: [
    { name: "Billings", people: 120000 },
    { name: "Missoula", people: 77000 },
    { name: "Great Falls", people: 60000 },
    { name: "Bozeman", people: 57000 },
  ],
  Nebraska: [
    { name: "Omaha", people: 485000 },
    { name: "Lincoln", people: 295000 },
    { name: "Bellevue", people: 64000 },
  ],
  Nevada: [
    { name: "Las Vegas", people: 660000 },
    { name: "Henderson", people: 330000 },
    { name: "Reno", people: 274000 },
    { name: "North Las Vegas", people: 280000 },
  ],
  "New Hampshire": [
    { name: "Manchester", people: 115000 },
    { name: "Nashua", people: 91000 },
    { name: "Concord", people: 44000 },
  ],
  "New Jersey": [
    { name: "Newark", people: 305000 },
    { name: "Jersey City", people: 292000 },
    { name: "Paterson", people: 158000 },
    { name: "Elizabeth", people: 137000 },
  ],
  "New Mexico": [
    { name: "Albuquerque", people: 560000 },
    { name: "Las Cruces", people: 113000 },
    { name: "Rio Rancho", people: 110000 },
    { name: "Santa Fe", people: 89000 },
  ],
  "New York": [
    { name: "New York", people: 8100000 },
    { name: "Buffalo", people: 275000 },
    { name: "Rochester", people: 207000 },
    { name: "Yonkers", people: 208000 },
    { name: "Syracuse", people: 146000 },
    { name: "Albany", people: 100000 },
  ],
  "North Carolina": [
    { name: "Charlotte", people: 910000 },
    { name: "Raleigh", people: 480000 },
    { name: "Greensboro", people: 302000 },
    { name: "Durham", people: 296000 },
    { name: "Winston-Salem", people: 252000 },
    { name: "Fayetteville", people: 209000 },
  ],
  "North Dakota": [
    { name: "Fargo", people: 132000 },
    { name: "Bismarck", people: 75000 },
    { name: "Grand Forks", people: 59000 },
  ],
  Ohio: [
    { name: "Columbus", people: 908000 },
    { name: "Cleveland", people: 362000 },
    { name: "Cincinnati", people: 311000 },
    { name: "Toledo", people: 265000 },
    { name: "Akron", people: 189000 },
  ],
  Oklahoma: [
    { name: "Oklahoma City", people: 700000 },
    { name: "Tulsa", people: 413000 },
    { name: "Norman", people: 130000 },
    { name: "Broken Arrow", people: 120000 },
  ],
  Oregon: [
    { name: "Portland", people: 630000 },
    { name: "Eugene", people: 177000 },
    { name: "Salem", people: 177000 },
    { name: "Gresham", people: 111000 },
    { name: "Bend", people: 104000 },
  ],
  Pennsylvania: [
    { name: "Philadelphia", people: 1550000 },
    { name: "Pittsburgh", people: 303000 },
    { name: "Allentown", people: 126000 },
    { name: "Reading", people: 95000 },
  ],
  "Rhode Island": [
    { name: "Providence", people: 190000 },
    { name: "Warwick", people: 83000 },
    { name: "Cranston", people: 82000 },
  ],
  "South Carolina": [
    { name: "Charleston", people: 155000 },
    { name: "Columbia", people: 143000 },
    { name: "North Charleston", people: 120000 },
    { name: "Greenville", people: 72000 },
  ],
  "South Dakota": [
    { name: "Sioux Falls", people: 206000 },
    { name: "Rapid City", people: 79000 },
  ],
  Tennessee: [
    { name: "Nashville", people: 687000 },
    { name: "Memphis", people: 621000 },
    { name: "Knoxville", people: 198000 },
    { name: "Chattanooga", people: 187000 },
    { name: "Clarksville", people: 180000 },
  ],
  Texas: [
    { name: "Houston", people: 2300000 },
    { name: "San Antonio", people: 1490000 },
    { name: "Dallas", people: 1300000 },
    { name: "Austin", people: 980000 },
    { name: "Fort Worth", people: 970000 },
    { name: "El Paso", people: 678000 },
  ],
  Utah: [
    { name: "Salt Lake City", people: 209000 },
    { name: "West Valley City", people: 140000 },
    { name: "West Jordan", people: 117000 },
    { name: "Provo", people: 115000 },
    { name: "Orem", people: 97000 },
  ],
  Vermont: [
    { name: "Burlington", people: 45000 },
    { name: "South Burlington", people: 21000 },
  ],
  Virginia: [
    { name: "Virginia Beach", people: 455000 },
    { name: "Chesapeake", people: 253000 },
    { name: "Norfolk", people: 232000 },
    { name: "Richmond", people: 229000 },
    { name: "Newport News", people: 184000 },
    { name: "Alexandria", people: 155000 },
  ],
  Washington: [
    { name: "Seattle", people: 755000 },
    { name: "Spokane", people: 230000 },
    { name: "Tacoma", people: 222000 },
    { name: "Vancouver", people: 196000 },
    { name: "Bellevue", people: 152000 },
  ],
  "West Virginia": [
    { name: "Charleston", people: 47000 },
    { name: "Huntington", people: 45000 },
    { name: "Morgantown", people: 30000 },
  ],
  Wisconsin: [
    { name: "Milwaukee", people: 561000 },
    { name: "Madison", people: 280000 },
    { name: "Green Bay", people: 107000 },
    { name: "Kenosha", people: 99000 },
  ],
  Wyoming: [
    { name: "Cheyenne", people: 65000 },
    { name: "Casper", people: 59000 },
  ],
};

const EASTERN = new Set(["Connecticut", "Delaware", "Florida", "Georgia", "Maine", "Maryland", "Massachusetts", "New Hampshire", "New Jersey", "New York", "North Carolina", "Ohio", "Pennsylvania", "Rhode Island", "South Carolina", "Vermont", "Virginia", "West Virginia"]);
const CENTRAL = new Set(["Alabama", "Arkansas", "Illinois", "Iowa", "Kansas", "Kentucky", "Louisiana", "Minnesota", "Mississippi", "Missouri", "Nebraska", "North Dakota", "Oklahoma", "South Dakota", "Texas", "Wisconsin"]);
const MOUNTAIN = new Set(["Colorado", "Idaho", "Montana", "New Mexico", "Utah", "Wyoming"]);
const PACIFIC = new Set(["California", "Nevada", "Oregon", "Washington"]);

const WORDS: Record<string, string[]> = {
  Arizona: ["Sonoran", "Copper", "Adobe", "Verde", "Saguaro", "Palo"],
  California: ["Golden", "Cove", "Laurel", "Marin", "Sol", "Pacific"],
  Colorado: ["Alpine", "Ridge", "Aspen", "Summit", "Colfax", "Front"],
  Florida: ["Palm", "Coral", "Tide", "Shore", "Lantern", "Gulf"],
  Georgia: ["Peach", "Magnolia", "Savannah", "Piedmont", "Oconee", "Lantern"],
  "North Carolina": ["Carolina", "Bluebird", "Magnolia", "Piedmont", "Oak", "Lantern"],
  Tennessee: ["Cumberland", "Magnolia", "Volunteer", "River", "Hearth", "Lantern"],
  Texas: ["Lone", "Mesquite", "Brazos", "Hill", "Sage", "Rio"],
};

export function largestCities(state: string) {
  const key = Object.keys(CITIES).find((name) => name.toLowerCase() === state.trim().toLowerCase());
  return key ? CITIES[key] : [];
}

export function peopleLabel(people: number) {
  if (people >= 1000000) {
    const millions = people / 1000000;
    return `${millions >= 10 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  return `${Math.round(people / 1000)}k`;
}

export function timezoneFor(state: string, cities: string[]) {
  const name = state.trim();
  if (name.toLowerCase() === "arizona") return "America/Phoenix";
  if (name.toLowerCase() === "hawaii") return "Pacific/Honolulu";
  if (name.toLowerCase() === "alaska") return "America/Anchorage";
  if (name.toLowerCase() === "tennessee") {
    return cities.some((city) => /knoxville|chattanooga/i.test(city)) && !cities.some((city) => /nashville|memphis|clarksville/i.test(city))
      ? "America/New_York"
      : "America/Chicago";
  }
  if (EASTERN.has(name)) return "America/New_York";
  if (CENTRAL.has(name)) return "America/Chicago";
  if (MOUNTAIN.has(name)) return "America/Denver";
  if (PACIFIC.has(name)) return "America/Los_Angeles";
  return "America/Chicago";
}

export function studioNameIdeas(state: string, vibe: "classic" | "film" | "rooted" | "short") {
  const words = WORDS[state] || ["Willow", "Hearth", "North", "Lantern", "Golden", "Oak"];
  const [a, b, c, d] = words;
  if (vibe === "film") return [`${a} Picture Co.`, `${b} Motion`, `${c} Frames`, `Reel ${d}`, `${a} & Reel`, `${b} Cinema Co.`];
  if (vibe === "rooted") return [`${a} & ${b}`, `House of ${c}`, `${d} Light Co.`, `${a} Ground`, `${b} & Field`, `${c} House`];
  if (vibe === "short") return [a, `${b} Co.`, c, `${d} Studio`, `${a}${b}`.replace(/\s/g, ""), `${c} Co.`];
  return [`${a} House`, `${b} & Co.`, `The ${c} Studio`, `${d} Atelier`, `${a} & ${b}`, `House of ${c}`];
}
