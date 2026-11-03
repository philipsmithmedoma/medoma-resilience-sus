// roads.overpassql (lund)
[out:json][timeout:180];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](55.58,12.84,55.93,13.74);
out body geom;
