// power.overpassql (lund)
[out:json][timeout:120];
(
  node["power"="substation"]["voltage"~"400000|220000"](55.58,12.84,55.93,13.74);
  way["power"="substation"]["voltage"~"400000|220000"](55.58,12.84,55.93,13.74);
  way["power"="line"]["voltage"~"400000|220000"](55.58,12.84,55.93,13.74);
);
out body geom;
