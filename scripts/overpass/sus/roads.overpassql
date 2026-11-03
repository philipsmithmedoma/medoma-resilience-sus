// roads.overpassql (sus)
[out:json][timeout:180];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](55.35,12.8,55.95,13.75);
out body geom;
