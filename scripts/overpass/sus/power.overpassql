// power.overpassql (sus)
[out:json][timeout:120];
(
  node["power"="substation"]["voltage"~"400000|220000"](55.35,12.8,55.95,13.75);
  way["power"="substation"]["voltage"~"400000|220000"](55.35,12.8,55.95,13.75);
  way["power"="line"]["voltage"~"400000|220000"](55.35,12.8,55.95,13.75);
);
out body geom;
