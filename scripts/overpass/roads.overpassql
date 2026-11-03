// roads.overpassql
[out:json][timeout:180];
way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"](59.15,17.65,59.52,18.30);
out body geom;
