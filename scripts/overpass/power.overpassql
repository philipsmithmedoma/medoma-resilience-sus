// power.overpassql
[out:json][timeout:120];
(
  node["power"="substation"]["voltage"~"400000|220000"](59.10,17.50,59.60,18.40);
  way["power"="substation"]["voltage"~"400000|220000"](59.10,17.50,59.60,18.40);
  way["power"="line"]["voltage"~"400000|220000"](59.10,17.50,59.60,18.40);
);
out body geom;
