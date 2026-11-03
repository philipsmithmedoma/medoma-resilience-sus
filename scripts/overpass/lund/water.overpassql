// water.overpassql (lund)
[out:json][timeout:60];
(
  node["man_made"="water_works"](55.58,12.84,55.93,13.74);
  way["man_made"="water_works"](55.58,12.84,55.93,13.74);
);
out body geom;
