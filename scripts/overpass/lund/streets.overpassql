// streets.overpassql (lund) – one around clause per zone centre
[out:json][timeout:180];
(
  way["highway"~"^(residential|living_street)$"](around:2500,55.706,13.192);
  way["highway"~"^(residential|living_street)$"](around:2500,55.792,13.112);
  way["highway"~"^(residential|living_street)$"](around:2500,55.695,13.055);
  way["highway"~"^(residential|living_street)$"](around:2500,55.642,13.212);
  way["highway"~"^(residential|living_street)$"](around:2500,55.666,13.352);
  way["highway"~"^(residential|living_street)$"](around:2500,55.838,13.305);
  way["highway"~"^(residential|living_street)$"](around:2500,55.851,13.66);
);
out body geom;
