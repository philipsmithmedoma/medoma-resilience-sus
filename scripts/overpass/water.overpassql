// water.overpassql
[out:json][timeout:60];
(
  node["man_made"="water_works"](59.10,17.50,59.60,18.40);
  way["man_made"="water_works"](59.10,17.50,59.60,18.40);
);
out body geom;
