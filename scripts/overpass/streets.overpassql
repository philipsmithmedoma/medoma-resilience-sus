// streets.overpassql – one around clause per zone, lat/lon from SPEC § 11.4
[out:json][timeout:180];
(
  way["highway"~"^(residential|living_street)$"](around:2500,59.3597,18.0005);
  way["highway"~"^(residential|living_street)$"](around:2500,59.3312,18.0407);
  way["highway"~"^(residential|living_street)$"](around:2500,59.3383,17.9401);
  way["highway"~"^(residential|living_street)$"](around:2500,59.3125,18.0616);
  way["highway"~"^(residential|living_street)$"](around:2500,59.2986,18.0459);
  way["highway"~"^(residential|living_street)$"](around:2500,59.2365,17.9818);
  way["highway"~"^(residential|living_street)$"](around:2500,59.1988,17.8332);
  way["highway"~"^(residential|living_street)$"](around:2500,59.3100,18.1648);
  way["highway"~"^(residential|living_street)$"](around:2500,59.3661,18.1352);
  way["highway"~"^(residential|living_street)$"](around:2500,59.4451,18.0717);
);
out body geom;
