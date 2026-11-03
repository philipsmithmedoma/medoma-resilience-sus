// streets.overpassql (sus) – one around clause per zone centre
[out:json][timeout:180];
(
  way["highway"~"^(residential|living_street)$"](around:2500,55.706,13.192);
  way["highway"~"^(residential|living_street)$"](around:2500,55.792,13.112);
  way["highway"~"^(residential|living_street)$"](around:2500,55.695,13.055);
  way["highway"~"^(residential|living_street)$"](around:2500,55.642,13.212);
  way["highway"~"^(residential|living_street)$"](around:2500,55.666,13.352);
  way["highway"~"^(residential|living_street)$"](around:2500,55.838,13.305);
  way["highway"~"^(residential|living_street)$"](around:2500,55.851,13.66);
  way["highway"~"^(residential|living_street)$"](around:2500,55.6061,13.0002);
  way["highway"~"^(residential|living_street)$"](around:2500,55.5816,12.9339);
  way["highway"~"^(residential|living_street)$"](around:2500,55.5644,12.9735);
  way["highway"~"^(residential|living_street)$"](around:2500,55.586,13.0431);
  way["highway"~"^(residential|living_street)$"](around:2500,55.6398,13.0848);
  way["highway"~"^(residential|living_street)$"](around:2500,55.54,13.0952);
  way["highway"~"^(residential|living_street)$"](around:2500,55.4721,13.0205);
  way["highway"~"^(residential|living_street)$"](around:2500,55.5083,13.2359);
  way["highway"~"^(residential|living_street)$"](around:2500,55.3744,13.1584);
);
out body geom;
