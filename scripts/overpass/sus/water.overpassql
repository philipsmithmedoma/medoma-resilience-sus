// water.overpassql (sus)
[out:json][timeout:60];
(
  node["man_made"="water_works"](55.35,12.8,55.95,13.75);
  way["man_made"="water_works"](55.35,12.8,55.95,13.75);
);
out body geom;
